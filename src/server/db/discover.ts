import "server-only";
import { and, asc, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { items, tierLists, users } from "@/server/db/schema";

/** A public tier list as shown in Discover feeds / search, with its author. */
export type DiscoverList = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  createdAt: Date;
  authorUsername: string;
  authorImageUrl: string | null;
};

const WINDOW_DAYS = 7;
const REMIX_WEIGHT = 3;
const NEW_RECENCY_DAYS = 60;

function windowCutoff(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Column projection shared by every Discover query (inner-joins the author). */
const listSelection = {
  id: tierLists.id,
  title: tierLists.title,
  description: tierLists.description,
  coverImageUrl: tierLists.coverImageUrl,
  createdAt: tierLists.createdAt,
  authorUsername: users.username,
  authorImageUrl: users.imageUrl,
};

/**
 * Up to 4 item image URLs per list, for collage thumbnails. One batched query
 * for all listIds (mirrors the dashboard pattern).
 */
export async function getThumbnailImages(
  listIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (listIds.length === 0) return map;

  const rows = await db
    .select({ tierListId: items.tierListId, imageUrl: items.imageUrl })
    .from(items)
    .where(and(inArray(items.tierListId, listIds), isNotNull(items.imageUrl)))
    .orderBy(asc(items.rank), asc(items.createdAt));

  for (const row of rows) {
    if (!row.imageUrl) continue;
    const arr = map.get(row.tierListId) ?? [];
    if (arr.length < 4) {
      arr.push(row.imageUrl);
      map.set(row.tierListId, arr);
    }
  }
  return map;
}

// Correlated scalar subqueries — kept separate (not GROUP BY joins) so views and
// remixes don't multiply into a cartesian product. Raw column names are used for
// the inner alias so the self-join on tier_lists is unambiguous.
function viewCountSql(since?: Date) {
  return since
    ? sql<number>`(select count(*) from tier_list_views v where v.tier_list_id = ${tierLists.id} and v.created_at > ${since})`
    : sql<number>`(select count(*) from tier_list_views v where v.tier_list_id = ${tierLists.id})`;
}

function remixCountSql(since?: Date) {
  return since
    ? sql<number>`(select count(*) from tier_lists rs where rs.remixed_from_id = ${tierLists.id} and rs.created_at > ${since})`
    : sql<number>`(select count(*) from tier_lists rs where rs.remixed_from_id = ${tierLists.id})`;
}

/** Public lists ranked by recent activity: recent views + weighted recent remixes. */
export async function getTrendingLists(limit: number): Promise<DiscoverList[]> {
  const cutoff = windowCutoff(WINDOW_DAYS);
  const score = sql<number>`(${viewCountSql(cutoff)} + ${remixCountSql(cutoff)} * ${REMIX_WEIGHT})`;

  return db
    .select(listSelection)
    .from(tierLists)
    .innerJoin(users, eq(users.id, tierLists.userId))
    .where(eq(tierLists.isPublic, true))
    .orderBy(desc(score), desc(tierLists.createdAt))
    .limit(limit);
}

/** Public lists ranked by all-time activity (views + weighted remixes), score > 0. */
export async function getTopLists(limit: number): Promise<DiscoverList[]> {
  const score = sql<number>`(${viewCountSql()} + ${remixCountSql()} * ${REMIX_WEIGHT})`;

  return db
    .select(listSelection)
    .from(tierLists)
    .innerJoin(users, eq(users.id, tierLists.userId))
    .where(and(eq(tierLists.isPublic, true), sql`${score} > 0`))
    .orderBy(desc(score), desc(tierLists.createdAt))
    .limit(limit);
}

/** A random pick of recently-created public lists (falls back to all public). */
export async function getNewRandomLists(limit: number): Promise<DiscoverList[]> {
  const pick = (cutoff?: Date) =>
    db
      .select(listSelection)
      .from(tierLists)
      .innerJoin(users, eq(users.id, tierLists.userId))
      .where(
        cutoff
          ? and(eq(tierLists.isPublic, true), gt(tierLists.createdAt, cutoff))
          : eq(tierLists.isPublic, true)
      )
      .orderBy(sql`random()`)
      .limit(limit);

  const recent = await pick(windowCutoff(NEW_RECENCY_DAYS));
  if (recent.length >= limit) return recent;

  // Not enough recent lists — top up from all public, de-duped.
  const all = await pick();
  const seen = new Set(recent.map((r) => r.id));
  const merged = [...recent];
  for (const r of all) {
    if (merged.length >= limit) break;
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }
  return merged;
}

/** Case-insensitive title/description search over public lists. */
export async function searchPublicLists(
  q: string,
  limit: number
): Promise<DiscoverList[]> {
  const term = q.trim();
  if (!term) return [];
  // Escape LIKE wildcards so e.g. "100%" matches literally, not match-all.
  const pattern = `%${term.replace(/[%_\\]/g, "\\$&")}%`;

  return db
    .select(listSelection)
    .from(tierLists)
    .innerJoin(users, eq(users.id, tierLists.userId))
    .where(
      and(
        eq(tierLists.isPublic, true),
        sql`(${tierLists.title} ilike ${pattern} or ${tierLists.description} ilike ${pattern})`
      )
    )
    .orderBy(desc(tierLists.createdAt))
    .limit(limit);
}
