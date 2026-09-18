import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db, families, familyInvites, familyMembers, familySync } from "@workspace/db";
import { claimFamilyInvite, sanitizeFamilySyncState, saveFamilySync } from "./family";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

test("a family invite can be claimed by only one concurrent account", async () => {
  const [family] = await db.insert(families).values({}).returning();
  const token = randomUUID();
  await db.insert(familyInvites).values({
    familyId: family.id,
    tokenHash: tokenHash(token),
    role: "student",
    expiresAt: new Date(Date.now() + 60_000),
  });

  try {
    const results = await Promise.all([
      claimFamilyInvite(`test-${randomUUID()}`, token),
      claimFamilyInvite(`test-${randomUUID()}`, token),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 400]);
    const members = await db.select().from(familyMembers).where(eq(familyMembers.familyId, family.id));
    assert.equal(members.length, 1);
  } finally {
    await db.delete(families).where(eq(families.id, family.id));
  }
});

test("two initial revision-zero writes produce one save and one conflict", async () => {
  const [family] = await db.insert(families).values({}).returning();
  const userId = `test-${randomUUID()}`;
  await db.insert(familyMembers).values({ familyId: family.id, clerkUserId: userId, role: "parent" });

  try {
    const results = await Promise.all([
      saveFamilySync(userId, 0, { marker: "first" }),
      saveFamilySync(userId, 0, { marker: "second" }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    const documents = await db.select().from(familySync).where(eq(familySync.familyId, family.id));
    assert.equal(documents.length, 1);
    assert.equal(documents[0].revision, 1);
  } finally {
    await db.delete(families).where(eq(families.id, family.id));
  }
});

test("server sanitizer accepts a client-sanitized reviewed drive without video metadata", () => {
  const sanitizedState = {
    prompts: [],
    settings: { parentMode: false },
    sessions: [{
      date: "2026-09-18",
      minutes: 20,
      night: false,
      notes: "Reviewed drive",
      review: {
        id: "review-1",
        durationSeconds: 120,
        eventCount: 0,
        events: [],
        route: { coordinates: [], distanceMeters: 0, durationSeconds: 0, origin: [0, 0], steps: [] },
      },
    }],
  };

  const accepted = sanitizeFamilySyncState(sanitizedState) as any;
  assert.equal(accepted.sessions[0].review.id, "review-1");
  assert.equal("videoType" in accepted.sessions[0].review, false);
});

test("one account can concurrently join only one active family", async () => {
  const [firstFamily, secondFamily] = await db.insert(families).values([{}, {}]).returning();
  const firstToken = randomUUID();
  const secondToken = randomUUID();
  const userId = `test-${randomUUID()}`;
  await db.insert(familyInvites).values([
    { familyId: firstFamily.id, tokenHash: tokenHash(firstToken), role: "student", expiresAt: new Date(Date.now() + 60_000) },
    { familyId: secondFamily.id, tokenHash: tokenHash(secondToken), role: "student", expiresAt: new Date(Date.now() + 60_000) },
  ]);

  try {
    const results = await Promise.all([
      claimFamilyInvite(userId, firstToken),
      claimFamilyInvite(userId, secondToken),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    const activeMemberships = await db.select().from(familyMembers).where(and(
      eq(familyMembers.clerkUserId, userId),
      isNull(familyMembers.revokedAt),
    ));
    assert.equal(activeMemberships.length, 1);
    const claimedInvites = await db.select().from(familyInvites).where(and(
      isNotNull(familyInvites.acceptedAt),
      isNull(familyInvites.revokedAt),
    ));
    assert.equal(claimedInvites.filter((invite) => invite.familyId === firstFamily.id || invite.familyId === secondFamily.id).length, 1);
  } finally {
    await db.delete(families).where(eq(families.id, firstFamily.id));
    await db.delete(families).where(eq(families.id, secondFamily.id));
  }
});