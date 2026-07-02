import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins/username";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { sendEmail } from "@/lib/email";

function sanitizeHandle(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 30);
}

function deriveUsername(opts: {
  username?: string | null;
  email?: string | null;
  name?: string | null;
  id: string;
}): string {
  const candidates = [opts.username, opts.email?.split("@")[0], opts.name];
  for (const candidate of candidates) {
    const handle = candidate ? sanitizeHandle(candidate) : "";
    if (handle.length >= 3) return handle;
  }
  return `user_${opts.id.slice(-6)}`;
}

async function resolveUniqueUsername(base: string, id: string): Promise<string> {
  const taken = await db.query.users.findFirst({
    where: eq(users.username, base),
    columns: { id: true },
  });
  if (!taken || taken.id === id) return base;
  return `${base}_${id.slice(-4)}`.slice(0, 30);
}

// Only enable social providers whose credentials are actually configured.
const socialProviders = {
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
      }
    : {}),
  ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
    ? {
        discord: {
          clientId: process.env.DISCORD_CLIENT_ID,
          clientSecret: process.env.DISCORD_CLIENT_SECRET,
        },
      }
    : {}),
};

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? ('https://' + process.env.VERCEL_URL),
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
  // Better Auth's `image` field lives in our existing `imageUrl` column.
  user: { fields: { image: "imageUrl" } },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    password: {
      hash: (password) => bcrypt.hash(password, 10),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your TierHub password",
        html: `<p>Someone requested a password reset for your TierHub account.</p>
               <p><a href="${url}">Reset your password</a> — ignore this email if it wasn't you.</p>`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your TierHub email",
        html: `<p>Welcome to TierHub! Confirm your email to finish signing up.</p>
               <p><a href="${url}">Verify email</a></p>`,
      });
    },
  },
  socialProviders,
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github", "discord"],
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const u = user as typeof user & { username?: string | null };
          const base = deriveUsername({
            username: u.username,
            email: user.email,
            name: user.name,
            id: user.id ?? "",
          });
          const username = await resolveUniqueUsername(base, user.id ?? "");
          return {
            data: { ...user, username, displayUsername: u.username ?? username },
          };
        },
      },
    },
  },
  plugins: [username(), nextCookies()],
});

export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getServerUserId(): Promise<string | null> {
  const session = await getServerSession();
  return session?.user.id ?? null;
}
