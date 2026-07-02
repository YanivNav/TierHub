import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// WebSocket driver - unlike neon-http, this supports interactive transactions
// (db.transaction with logic between statements), needed for atomic multi-row
// writes like tierList.duplicate.
//
// Node 22+ (we pin Node 24) and edge runtimes expose a global WebSocket, which
// the driver uses automatically. If a deploy target lacks one, install `ws` and
// set: neonConfig.webSocketConstructor = (await import("ws")).default;
if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 8,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
export const db = drizzle(pool, { schema });
