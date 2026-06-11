import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Sparkles, TrendingUp, Trophy } from "lucide-react";
import {
  getNewRandomLists,
  getThumbnailImages,
  getTopLists,
  getTrendingLists,
} from "@/server/db/discover";
import DiscoverSection from "@/components/discover-section";

const TRENDING_LIMIT = 8;
const TOP_LIMIT = 8;
const NEW_LIMIT = 8;

export default async function HomePage() {
  const { userId } = await auth();

  const [trending, topRaw, newRaw] = await Promise.all([
    getTrendingLists(TRENDING_LIMIT),
    getTopLists(TOP_LIMIT),
    getNewRandomLists(NEW_LIMIT),
  ]);

  // De-dupe across sections so a list appears at most once (Trending wins,
  // then Top, then New).
  const trendingIds = new Set(trending.map((l) => l.id));
  const top = topRaw.filter((l) => !trendingIds.has(l.id));
  const topIds = new Set(top.map((l) => l.id));
  const newLists = newRaw.filter(
    (l) => !trendingIds.has(l.id) && !topIds.has(l.id)
  );

  // One batched thumbnail fetch over every list we're about to render.
  const allIds = [
    ...new Set([...trending, ...top, ...newLists].map((l) => l.id)),
  ];
  const thumbs = await getThumbnailImages(allIds);

  const isEmpty = trending.length === 0 && top.length === 0 && newLists.length === 0;

  return (
    <main className="flex-1 bg-zinc-950 text-white">
      {/* Slim hero */}
      <section className="bg-gradient-to-b from-zinc-900 to-zinc-950 px-4 py-12 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Tier<span className="text-blue-500">Hub</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-zinc-400">
          Create beautiful tier lists with text, images, videos, and AI-powered suggestions. Share with the world.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={userId ? "/dashboard/new" : "/sign-up"}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold transition hover:bg-blue-500"
          >
            {userId ? "New tier list" : "Create your own tier list"}
          </Link>
          {userId && (
            <Link
              href="/dashboard"
              className="rounded-lg border border-zinc-600 px-5 py-2.5 font-semibold transition hover:border-zinc-400"
            >
              My Tier Lists
            </Link>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-zinc-700 py-24 text-center">
            <p className="text-zinc-400">No public tier lists yet.</p>
            <Link
              href={userId ? "/dashboard/new" : "/sign-up"}
              className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold transition hover:bg-blue-500"
            >
              {userId ? "Create the first one" : "Get Started"}
            </Link>
          </div>
        ) : (
          <>
            <DiscoverSection
              title="Trending"
              icon={<TrendingUp className="h-5 w-5 text-blue-400" />}
              lists={trending}
              thumbs={thumbs}
            />
            <DiscoverSection
              title="Top"
              icon={<Trophy className="h-5 w-5 text-amber-400" />}
              lists={top}
              thumbs={thumbs}
            />
            <DiscoverSection
              title="New"
              icon={<Sparkles className="h-5 w-5 text-violet-400" />}
              lists={newLists}
              thumbs={thumbs}
            />
          </>
        )}
      </div>
    </main>
  );
}
