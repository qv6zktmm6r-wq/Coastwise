import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";

export const families = pgTable("families", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const familyMembers = pgTable("family_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  familyId: uuid("family_id").references(() => families.id, { onDelete: "cascade" }).notNull(),
  clerkUserId: text("clerk_user_id").notNull(),
  role: text("role", { enum: ["parent", "student"] }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("family_member_user_idx").on(table.familyId, table.clerkUserId),
  uniqueIndex("family_member_one_active_family_idx").on(table.clerkUserId).where(sql`${table.revokedAt} is null`),
]);

export const familyInvites = pgTable("family_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  familyId: uuid("family_id").references(() => families.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  role: text("role", { enum: ["parent", "student"] }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const familySync = pgTable("family_sync", {
  familyId: uuid("family_id").references(() => families.id, { onDelete: "cascade" }).primaryKey(),
  revision: integer("revision").default(0).notNull(),
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertFamilySchema = createInsertSchema(families);
export const insertFamilyMemberSchema = createInsertSchema(familyMembers);
export const insertFamilyInviteSchema = createInsertSchema(familyInvites);
export const insertFamilySyncSchema = createInsertSchema(familySync);
export type Family = typeof families.$inferSelect;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type FamilyInvite = typeof familyInvites.$inferSelect;
export type FamilySync = typeof familySync.$inferSelect;