import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tierLists = pgTable("tier_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  isPublic: boolean("is_public").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tiers = pgTable("tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tierListId: uuid("tier_list_id")
    .notNull()
    .references(() => tierLists.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // e.g. "S", "A", "B", "C", "D"
  color: text("color").notNull().default("#ef4444"),
  rank: integer("rank").notNull(), // sort order
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const items = pgTable("items", {
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
});

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

export type User = typeof users.$inferSelect;
export type TierList = typeof tierLists.$inferSelect;
export type Tier = typeof tiers.$inferSelect;
export type Item = typeof items.$inferSelect;
