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

export async function syncUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const existing = await db.query.users.findFirst({
    where: eq(users.id, clerkUser.id),
  });

  if (existing) return existing;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const username =
    clerkUser.username ??
    clerkUser.firstName?.toLowerCase() ??
    `user_${clerkUser.id.slice(-6)}`;

  const [user] = await db
    .insert(users)
    .values({
      id: clerkUser.id,
      email,
      username,
      imageUrl: clerkUser.imageUrl,
    })
    .returning();

  return user;
}
