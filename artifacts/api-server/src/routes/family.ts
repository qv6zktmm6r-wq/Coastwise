import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, gt } from "drizzle-orm";
import { Router } from "express";
import { db, families, familyInvites, familyMembers, familySync } from "@workspace/db";
import { CreateFamilyInviteBody, CreateFamilyInviteResponse, AcceptFamilyInviteResponse, GetFamilySyncResponse, UpdateFamilySyncBody, UpdateFamilySyncResponse, GetFamilyMembershipResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
class FamilyMembershipConflict extends Error {}

function isUniqueViolation(error: unknown): boolean {
  let current = error;
  while (current && typeof current === "object") {
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

async function membership(userId: string) {
  const [member] = await db.select().from(familyMembers).where(and(eq(familyMembers.clerkUserId, userId), isNull(familyMembers.revokedAt))).limit(1);
  return member;
}

export function sanitizeFamilySyncState(value: unknown, key = ""): unknown {
  if (key.toLowerCase().includes("video") || key.toLowerCase().includes("blob") || key.toLowerCase().includes("bytes")) {
    throw new Error("Video data is device-local and cannot be synced.");
  }
  if (typeof value === "string") {
    if (value.length > 100_000) throw new Error("Synced text is too large.");
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 10_000) throw new Error("Synced list is too large.");
    return value.map((item) => sanitizeFamilySyncState(item));
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [childKey, child] of Object.entries(value)) output[childKey] = sanitizeFamilySyncState(child, childKey);
    return output;
  }
  return value;
}

function parentFields(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const state = value as Record<string, unknown>;
  const settings = state.settings && typeof state.settings === "object" && !Array.isArray(state.settings)
    ? state.settings as Record<string, unknown>
    : {};
  return {
    prompts: state.prompts ?? [],
    parentMode: settings.parentMode ?? false,
  };
}

export async function claimFamilyInvite(userId: string, token: string) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [invite] = await tx.update(familyInvites)
      .set({ acceptedAt: now })
      .where(and(
        eq(familyInvites.tokenHash, hash(token)),
        isNull(familyInvites.acceptedAt),
        isNull(familyInvites.revokedAt),
        gt(familyInvites.expiresAt, now),
      ))
      .returning();
    if (!invite) return { status: 400 as const };

    const [existing] = await tx.select().from(familyMembers).where(and(
      eq(familyMembers.clerkUserId, userId),
      isNull(familyMembers.revokedAt),
    )).limit(1);
    if (existing && existing.familyId !== invite.familyId) throw new FamilyMembershipConflict();

    const [previous] = await tx.select().from(familyMembers).where(and(
      eq(familyMembers.familyId, invite.familyId),
      eq(familyMembers.clerkUserId, userId),
    )).limit(1);
    const [member] = previous
      ? await tx.update(familyMembers).set({ role: invite.role, revokedAt: null }).where(eq(familyMembers.id, previous.id)).returning()
      : await tx.insert(familyMembers).values({ familyId: invite.familyId, clerkUserId: userId, role: invite.role }).returning();
    return { status: 200 as const, member };
  }).catch((error) => {
    if (error instanceof FamilyMembershipConflict || isUniqueViolation(error)) {
      return { status: 409 as const };
    }
    throw error;
  });
}

export async function saveFamilySync(userId: string, revision: number, unsafeState: unknown) {
  const member = await membership(userId);
  if (!member) return { status: 403 as const, error: "You are not a member of this family." };
  let state: unknown;
  try {
    state = sanitizeFamilySyncState(unsafeState);
  } catch (error) {
    return { status: 400 as const, error: error instanceof Error ? error.message : "Unsafe sync document." };
  }
  const [current] = await db.select().from(familySync).where(eq(familySync.familyId, member.familyId)).limit(1);
  if (member.role === "student" && JSON.stringify(parentFields(state)) !== JSON.stringify(parentFields(current?.state))) {
    return { status: 403 as const, error: "Only a parent can update parent coaching prompts or parent-view defaults." };
  }
  if ((current?.revision ?? 0) !== revision) {
    return { status: 409 as const, revision: current?.revision ?? 0, state: current?.state ?? {} };
  }
  const now = new Date();
  const [saved] = current
    ? await db.update(familySync).set({ state, revision: revision + 1, updatedAt: now }).where(and(eq(familySync.familyId, member.familyId), eq(familySync.revision, revision))).returning()
    : await db.insert(familySync).values({ familyId: member.familyId, state, revision: 1, updatedAt: now }).onConflictDoNothing().returning();
  if (!saved) return { status: 409 as const };
  return { status: 200 as const, saved, now };
}

router.post("/families/invites", requireAuth, async (req, res) => {
  const parsed = CreateFamilyInviteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid invite request." }); return; }
  let member = await membership(req.userId!);
  if (member && member.role !== "parent") { res.status(403).json({ error: "Only a parent can create invites." }); return; }
  if (!member) {
    const [family] = await db.insert(families).values({}).returning();
    [member] = await db.insert(familyMembers).values({ familyId: family.id, clerkUserId: req.userId!, role: "parent" }).returning();
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 3600_000);
  await db.insert(familyInvites).values({ familyId: member.familyId, tokenHash: hash(token), role: parsed.data.role, expiresAt });
  res.status(201).json(CreateFamilyInviteResponse.parse({ token, role: parsed.data.role, expiresAt }));
});

router.post("/families/invites/:token/accept", requireAuth, async (req, res) => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const result = await claimFamilyInvite(req.userId!, token);
  if (result.status === 400) { res.status(400).json({ error: "Invite is invalid, revoked, or expired." }); return; }
  if (result.status === 409) { res.status(409).json({ error: "This account already belongs to another active family." }); return; }
  res.json(AcceptFamilyInviteResponse.parse({ memberId: result.member.id, familyId: result.member.familyId, role: result.member.role }));
});

router.delete("/families/invites/:token", requireAuth, async (req, res) => {
  const owner = await membership(req.userId!);
  if (!owner || owner.role !== "parent") { res.status(403).json({ error: "Only a parent can revoke invites." }); return; }
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  await db.update(familyInvites).set({ revokedAt: new Date() }).where(and(eq(familyInvites.familyId, owner.familyId), eq(familyInvites.tokenHash, hash(token)), isNull(familyInvites.acceptedAt)));
  res.status(204).send();
});

router.get("/families/sync", requireAuth, async (req, res) => {
  const member = await membership(req.userId!);
  if (!member) { res.status(403).json({ error: "You are not a member of this family." }); return; }
  const [doc] = await db.select().from(familySync).where(eq(familySync.familyId, member.familyId)).limit(1);
  res.json(GetFamilySyncResponse.parse({ familyId: member.familyId, revision: doc?.revision ?? 0, state: doc?.state ?? {}, updatedAt: doc?.updatedAt ?? new Date() }));
});

router.get("/families/membership", requireAuth, async (req, res) => {
  const member = await membership(req.userId!);
  if (!member) { res.status(204).send(); return; }
  const members = await db.select({ memberId: familyMembers.id, role: familyMembers.role })
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, member.familyId), isNull(familyMembers.revokedAt)));
  res.json(GetFamilyMembershipResponse.parse({
    familyId: member.familyId,
    memberId: member.id,
    role: member.role,
    members,
  }));
});

router.put("/families/sync", requireAuth, async (req, res) => {
  const parsed = UpdateFamilySyncBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid sync document." }); return; }
  const result = await saveFamilySync(req.userId!, parsed.data.revision, parsed.data.state);
  if (result.status !== 200) {
    res.status(result.status).json({ error: result.error ?? "Sync revision is stale.", revision: result.revision, state: result.state });
    return;
  }
  res.json(UpdateFamilySyncResponse.parse({ familyId: result.saved.familyId, revision: result.saved.revision, state: result.saved.state, updatedAt: result.now }));
});

router.delete("/families/members/:memberId", requireAuth, async (req, res) => {
  const owner = await membership(req.userId!);
  if (!owner || owner.role !== "parent") { res.status(403).json({ error: "Only a parent can revoke members." }); return; }
  const memberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
  if (memberId === owner.id) { res.status(400).json({ error: "A parent cannot revoke their own membership." }); return; }
  await db.update(familyMembers).set({ revokedAt: new Date() }).where(and(eq(familyMembers.id, memberId), eq(familyMembers.familyId, owner.familyId)));
  res.status(204).send();
});

export default router;