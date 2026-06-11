import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function getAuthUser() {
  const { userId } = await auth();
  if (!userId) return null;
  return userId;
}

/** Reduce an arbitrary string to a safe, lowercase handle. */
function sanitizeHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 30);
}

/**
 * Picks a handle from the best available signal: an explicit Clerk username,
 * else the email local-part (e.g. randomdude8102@… → "randomdude8102"), else
 * the first name, and only as a last resort an opaque id-based handle.
 */
export function deriveUsername(opts: {
  username?: string | null;
  email?: string | null;
  firstName?: string | null;
  id: string;
}): string {
  const candidates = [
    opts.username,
    opts.email?.split("@")[0],
    opts.firstName,
  ];
  for (const candidate of candidates) {
    const handle = candidate ? sanitizeHandle(candidate) : "";
    if (handle) return handle;
  }
  return `user_${opts.id.slice(-6)}`;
}

/**
 * Returns `base` if free (or already owned by `id`), otherwise appends a short
 * id suffix so two accounts sharing a local-part across domains don't collide
 * on the unique username constraint.
 */
export async function resolveUniqueUsername(base: string, id: string): Promise<string> {
  const taken = await db.query.users.findFirst({
    where: eq(users.username, base),
    columns: { id: true },
  });
  if (!taken || taken.id === id) return base;
  return `${base}_${id.slice(-4)}`.slice(0, 30);
}

/**
 * Guarantees a `users` row exists for the currently authenticated Clerk user.
 *
 * Cheap path: a single primary-key lookup. The Clerk API is only hit when the
 * row is missing — which happens in local dev (webhook can't reach localhost)
 * or if a `user.created` webhook was ever dropped. This keeps inserts that hold
 * a foreign key to `users.id` from failing.
 */
export async function ensureUser(userId: string) {
  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });
  if (existing) return;

  const clerkUser = await currentUser();
  if (!clerkUser) return;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const base = deriveUsername({
    username: clerkUser.username,
    email,
    firstName: clerkUser.firstName,
    id: clerkUser.id,
  });
  const username = await resolveUniqueUsername(base, clerkUser.id);

  await db
    .insert(users)
    .values({
      id: clerkUser.id,
      email,
      username,
      imageUrl: clerkUser.imageUrl,
    })
    .onConflictDoNothing({ target: users.id });
}
