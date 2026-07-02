import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Upstash deletes free-tier databases after 14 days with no commands. This
// route issues one cheap command so a scheduled Vercel Cron keeps the timer
// from ever reaching 14 days during quiet periods. (Normal AI usage already
// touches Redis via the rate limiter; this is insurance.)
export async function GET(req: Request) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
  // set - reject anything else so the endpoint isn't publicly triggerable.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return NextResponse.json({ ok: false, reason: "Upstash not configured" });
  }

  const redis = new Redis({ url, token });
  await redis.set("keepalive", new Date().toISOString());
  return NextResponse.json({ ok: true });
}
