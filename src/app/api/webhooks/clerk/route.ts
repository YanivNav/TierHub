import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { deriveUsername, resolveUniqueUsername } from "@/lib/auth";

type ClerkUserEvent = {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    primary_email_address_id: string;
    username: string | null;
    first_name: string | null;
    image_url: string;
  };
};

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(secret);

  let event: ClerkUserEvent;
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const { type, data } = event;

  if (type === "user.created" || type === "user.updated") {
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id
    )?.email_address ?? "";

    const base = deriveUsername({
      username: data.username,
      email: primaryEmail,
      firstName: data.first_name,
      id: data.id,
    });
    const username = await resolveUniqueUsername(base, data.id);

    await db
      .insert(users)
      .values({
        id: data.id,
        email: primaryEmail,
        username,
        imageUrl: data.image_url,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: primaryEmail,
          username,
          imageUrl: data.image_url,
          updatedAt: new Date(),
        },
      });
  }

  if (type === "user.deleted") {
    await db.delete(users).where(eq(users.id, data.id));
  }

  return new Response(null, { status: 200 });
}
