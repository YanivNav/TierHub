import { pgTable, text, timestamp, uuid, integer, boolean, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  // Better Auth core requires a display name; we still keep a unique handle below.
  name: text("name"),
  username: text("username").notNull().unique(),
  displayUsername: text("display_username"), // username plugin: original casing
  imageUrl: text("image_url"), // mapped to Better Auth's `image` field via config
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Better Auth tables ───────────────────────────────────────────────────────
// Named plural to match this schema's convention; the Drizzle adapter is
// configured with usePlural so Better Auth's user/session/account/verification
// models resolve to users/sessions/accounts/verifications.

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(), // provider's user id, or our user id for credentials
  providerId: text("provider_id").notNull(), // "credential" | "google" | "github" | "discord"
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"), // credential provider: bcrypt digest (migrated) / scrypt (new)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tierLists = pgTable(
  "tier_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    coverImageUrl: text("cover_image_url"),
    isPublic: boolean("is_public").default(true).notNull(),
    // Self-reference: set when this list was created by remixing another list.
    remixedFromId: uuid("remixed_from_id").references(
      (): AnyPgColumn => tierLists.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("tier_lists_remixed_from_idx").on(t.remixedFromId),
    index("tier_lists_user_id_idx").on(t.userId),
    index("tier_lists_created_at_idx").on(t.createdAt),
  ]
);

// Records each view of a public tier list - drives trending/top rankings.
export const tierListViews = pgTable(
  "tier_list_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tierListId: uuid("tier_list_id")
      .notNull()
      .references(() => tierLists.id, { onDelete: "cascade" }),
    viewerId: text("viewer_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("tier_list_views_list_created_idx").on(t.tierListId, t.createdAt)]
);

export const tiers = pgTable(
  "tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tierListId: uuid("tier_list_id")
      .notNull()
      .references(() => tierLists.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // e.g. "S", "A", "B", "C", "D"
    color: text("color").notNull().default("#ef4444"),
    rank: integer("rank").notNull(), // sort order
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("tiers_tier_list_id_idx").on(t.tierListId)]
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tierListId: uuid("tier_list_id")
      .notNull()
      .references(() => tierLists.id, { onDelete: "cascade" }),
    tierId: uuid("tier_id").references(() => tiers.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    type: text("type", { enum: ["text", "image", "video"] }).notNull().default("text"),
    imageUrl: text("image_url"),
    videoUrl: text("video_url"),
    rank: integer("rank").notNull().default(0), // sort order within tier
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("items_tier_list_id_idx").on(t.tierListId),
    index("items_tier_id_idx").on(t.tierId),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  tierLists: many(tierLists),
}));

export const tierListsRelations = relations(tierLists, ({ one, many }) => ({
  user: one(users, { fields: [tierLists.userId], references: [users.id] }),
  tiers: many(tiers),
  items: many(items),
}));

export const tiersRelations = relations(tiers, ({ one, many }) => ({
  tierList: one(tierLists, { fields: [tiers.tierListId], references: [tierLists.id] }),
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  tierList: one(tierLists, { fields: [items.tierListId], references: [tierLists.id] }),
  tier: one(tiers, { fields: [items.tierId], references: [tiers.id] }),
}));

export const tierListViewsRelations = relations(tierListViews, ({ one }) => ({
  tierList: one(tierLists, { fields: [tierListViews.tierListId], references: [tierLists.id] }),
}));

export type User = typeof users.$inferSelect;
export type TierList = typeof tierLists.$inferSelect;
export type Tier = typeof tiers.$inferSelect;
export type Item = typeof items.$inferSelect;
export type TierListView = typeof tierListViews.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
