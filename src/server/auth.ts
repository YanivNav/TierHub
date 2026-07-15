import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins/username";
import { nextCookies } from "better-auth/next-js";
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { sendEmail } from "@/lib/email";
import { redis } from "@/server/ratelimit";
import { checkoutProducts, isPolarConfigured } from "@/server/billing/polar-products";
import { polarWebhookHandlers } from "@/server/billing/polar-webhooks";

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
          // Signing out of TierHub does not sign the user out of Google. Always
          // show Google's chooser so a subsequent sign-in can use another
          // account instead of silently reusing the previous one.
          prompt: "select_account" as const,
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

// Point Better Auth's built-in login rate limiter at the shared Upstash Redis
// (its default store is in-memory / per-serverless-instance). Falls back to the
// default store when Upstash isn't configured.
type RateLimitRecord = { key: string; count: number; lastRequest: number };
function buildRateLimitStorage() {
  if (!redis) return undefined;
  const client = redis;
  return {
    enabled: true as const,
    customStorage: {
      get: async (key: string) =>
        (await client.get<RateLimitRecord>(`ba-rl:${key}`)) ?? undefined,
      set: async (key: string, value: RateLimitRecord) => {
        await client.set(`ba-rl:${key}`, value, { ex: 3600 });
      },
    },
  };
}

// Polar (Merchant of Record) — only mounted once its env is configured, so the
// app runs locally without billing set up.
const polarPlugin = isPolarConfigured()
  ? polar({
      client: new Polar({
        accessToken: process.env.POLAR_ACCESS_TOKEN,
        server: process.env.POLAR_SERVER === "production" ? "production" : "sandbox",
      }),
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: checkoutProducts(),
          successUrl: "/dashboard?upgraded=1",
          authenticatedUsersOnly: true,
        }),
        portal(),
        ...(process.env.POLAR_WEBHOOK_SECRET
          ? [
              webhooks({
                secret: process.env.POLAR_WEBHOOK_SECRET,
                ...polarWebhookHandlers,
              }),
            ]
          : []),
      ],
    })
  : null;

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? ('https://' + process.env.VERCEL_URL),
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
  rateLimit: buildRateLimitStorage(),
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
  // nextCookies() must stay last.
  plugins: [username(), ...(polarPlugin ? [polarPlugin] : []), nextCookies()],
});

export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getServerUserId(): Promise<string | null> {
  const session = await getServerSession();
  return session?.user.id ?? null;
}
