import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { tierLists } from "@/server/db/schema";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lists = await db.query.tierLists.findMany({
    where: eq(tierLists.isPublic, true),
    columns: { id: true, updatedAt: true },
    orderBy: (t, { desc }) => desc(t.updatedAt),
    limit: 5000,
  });

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.5,
    },
    ...lists.map((list) => ({
      url: `${baseUrl}/tier-lists/${list.id}`,
      lastModified: list.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
