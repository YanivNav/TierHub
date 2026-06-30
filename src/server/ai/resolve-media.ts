// ── Wikipedia ────────────────────────────────────────────────────────────────

const WIKIPEDIA_HEADERS = {
  "User-Agent": "TierHub/1.0 (https://tierhub.app)",
  "Api-User-Agent": "TierHub/1.0 (https://tierhub.app)",
};

/** Search Wikipedia for a lead image. Returns the image URL or null. */
export async function searchWikipediaImage(query: string): Promise<string | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=pageimages&pithumbsize=300&format=json`;
    const searchRes = await fetch(searchUrl, { headers: WIKIPEDIA_HEADERS });
    if (!searchRes.ok) {
      const body = await searchRes.text().catch(() => "");
      console.warn(`[wikipedia] search HTTP ${searchRes.status} for "${query}" — ${body.slice(0, 200)}`);
      return null;
    }
    const searchData = await searchRes.json() as {
      query?: { pages?: Record<string, { title?: string; thumbnail?: { source: string } }> };
    };
    const page = Object.values(searchData?.query?.pages ?? {})[0];
    if (!page) {
      console.warn(`[wikipedia] no article found for "${query}"`);
      return null;
    }

    if (page.thumbnail?.source) {
      console.log(`[wikipedia] "${query}" → "${page.title}" (lead image)`);
      return page.thumbnail.source;
    }

    if (page.title) {
      const summaryRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`,
        { headers: WIKIPEDIA_HEADERS }
      );
      if (!summaryRes.ok) {
        const body = await summaryRes.text().catch(() => "");
        console.warn(`[wikipedia] summary HTTP ${summaryRes.status} for "${page.title}" — ${body.slice(0, 200)}`);
        return null;
      }
      const summaryData = await summaryRes.json() as { thumbnail?: { source: string } };
      if (summaryData?.thumbnail?.source) {
        console.log(`[wikipedia] "${query}" → "${page.title}" (summary image)`);
        return summaryData.thumbnail.source;
      }
      console.warn(`[wikipedia] article "${page.title}" for "${query}" has no thumbnail`);
      return null;
    }

    return null;
  } catch (err) {
    console.error(`[wikipedia] fetch failed for "${query}":`, err);
    return null;
  }
}

// ── YouTube ──────────────────────────────────────────────────────────────────

/** Search YouTube for a video. Returns videoId + thumbnailUrl, or null. */
export async function searchYouTubeVideo(query: string): Promise<{
  videoId: string;
  thumbnailUrl: string;
} | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("[youtube] YOUTUBE_API_KEY is not set — skipping video resolution");
    return null;
  }
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[youtube] search HTTP ${res.status} for "${query}" — ${body.slice(0, 300)}`);
      return null;
    }
    const data = await res.json() as {
      items?: { id: { videoId: string }; snippet: { thumbnails?: { medium?: { url: string } } } }[];
    };
    const item = data?.items?.[0];
    if (!item?.id?.videoId) {
      console.warn(`[youtube] no video results for "${query}"`);
      return null;
    }
    console.log(`[youtube] "${query}" → ${item.id.videoId}`);
    return {
      videoId: item.id.videoId,
      thumbnailUrl:
        item.snippet.thumbnails?.medium?.url ??
        `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
    };
  } catch (err) {
    console.error(`[youtube] fetch failed for "${query}":`, err);
    return null;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export type ResolvedMedia =
  | { type: "text" }
  | { type: "image"; imageUrl?: string }
  | { type: "video"; youtubeUrl: string; previewUrl: string };

// ── Convenience ──────────────────────────────────────────────────────────────

/**
 * Resolve media for an already-classified item. Uses the model-provided
 * search query if available, falls back to the item name.
 * Pure data fetch — no LLM call.
 */
export async function resolveItemMedia(item: {
  name: string;
  type: "text" | "image" | "video";
  searchQuery?: string | null;
}): Promise<ResolvedMedia> {
  const query = item.searchQuery || item.name;
  console.log(`[resolveMedia] "${item.name}" type=${item.type} query="${query}"`);

  if (item.type === "image") {
    const imageUrl = await searchWikipediaImage(query);
    if (!imageUrl) {
      console.warn(`[resolveMedia] "${item.name}" → image UNRESOLVED`);
    }
    return { type: "image", imageUrl: imageUrl ?? undefined };
  }
  if (item.type === "video") {
    const yt = await searchYouTubeVideo(query);
    if (yt) {
      return {
        type: "video",
        youtubeUrl: `https://www.youtube.com/watch?v=${yt.videoId}`,
        previewUrl: yt.thumbnailUrl,
      };
    }
    console.warn(`[resolveMedia] "${item.name}" → video UNRESOLVED, falling back to text`);
  }
  return { type: "text" };
}
