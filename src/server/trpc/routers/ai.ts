import { z } from "zod";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";

const AiItemSchema = z.object({
  name: z.string(),
  type: z.enum(["text", "image", "video"]),
  youtubeSearchQuery: z.string().nullable(),
  wikipediaSearchQuery: z.string().nullable(),
});

const ItemsSchema = z.object({
  items: z.array(AiItemSchema),
});

const client = new OpenAI();

const WIKIPEDIA_HEADERS = {
  "User-Agent": "TierHub/1.0 (https://tierhub.app)",
  "Api-User-Agent": "TierHub/1.0 (https://tierhub.app)",
};

async function fetchWikipediaImage(query: string): Promise<string | null> {
  try {
    // Search generator resolves non-English queries to the correct English article.
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=pageimages&pithumbsize=300&format=json`;
    const searchRes = await fetch(searchUrl, { cache: "no-store", headers: WIKIPEDIA_HEADERS });
    const searchData = await searchRes.json() as { query?: { pages?: Record<string, { title?: string; thumbnail?: { source: string } }> } };
    const page = Object.values(searchData?.query?.pages ?? {})[0];
    if (!page) return null;

    // pageimages only returns the designated lead image. Fall back to the REST
    // summary API which finds article images not set as the page thumbnail.
    if (page.thumbnail?.source) return page.thumbnail.source;

    if (page.title) {
      const summaryRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`,
        { cache: "no-store", headers: WIKIPEDIA_HEADERS }
      );
      const summaryData = await summaryRes.json() as { thumbnail?: { source: string } };
      return summaryData?.thumbnail?.source ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

async function searchYouTube(query: string): Promise<{ videoId: string; thumbnailUrl: string } | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json() as { items?: { id: { videoId: string }; snippet: { thumbnails?: { medium?: { url: string } } } }[] };
    const item = data?.items?.[0];
    if (!item?.id?.videoId) return null;
    return {
      videoId: item.id.videoId,
      thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
    };
  } catch {
    return null;
  }
}

const EnrichSchema = z.object({
  type: z.enum(["text", "image", "video"]),
  youtubeSearchQuery: z.string().nullable(),
  wikipediaSearchQuery: z.string().nullable(),
});

type ResolvedMedia =
  | { type: "text" }
  | { type: "image"; imageUrl?: string }
  | { type: "video"; youtubeUrl: string; previewUrl: string };

async function resolveItemMedia(item: {
  name: string;
  type: "text" | "image" | "video";
  youtubeSearchQuery: string | null;
  wikipediaSearchQuery: string | null;
}): Promise<ResolvedMedia> {
  if (item.type === "image") {
    // Prefer the LLM-provided disambiguating query; fall back to the raw name.
    const imageUrl = await fetchWikipediaImage(item.wikipediaSearchQuery ?? item.name);
    return { type: "image", imageUrl: imageUrl ?? undefined };
  }
  if (item.type === "video" && item.youtubeSearchQuery != null) {
    const yt = await searchYouTube(item.youtubeSearchQuery);
    if (yt) {
      return {
        type: "video",
        youtubeUrl: `https://www.youtube.com/watch?v=${yt.videoId}`,
        previewUrl: yt.thumbnailUrl,
      };
    }
  }
  return { type: "text" };
}

const IMAGE_QUERY_INSTRUCTION =
  'For image items, provide a specific English Wikipedia search query in wikipediaSearchQuery that unambiguously identifies this item — include disambiguating context like nationality, role, or field (e.g. "Eli Cohen Israeli foreign minister Likud" not just "Eli Cohen"). For non-image items set wikipediaSearchQuery to null.';

export const aiRouter = createTRPCRouter({
  enrichItem: protectedProcedure
    .input(
      z.object({
        itemName: z.string().min(1),
        title: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const context = [
        input.title ? `Tier list: "${input.title}"` : null,
        input.description ? `Description: "${input.description}"` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const systemPrompt = `Given a tier list item and its context, determine the best media type:
- "image" if the item has a well-known visual (movie poster, person photo, animal, brand logo, etc.)
- "video" if the item is best represented by a video (theme song, music video, trailer, etc.). Provide a precise YouTube search query.
- "text" if no media is appropriate.
${IMAGE_QUERY_INSTRUCTION}`;

      const response = await client.chat.completions.parse({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${context}\nItem: "${input.itemName}"` },
        ],
        response_format: zodResponseFormat(EnrichSchema, "enrich"),
      });

      const result = response.choices[0]?.message.parsed;
      if (!result) return { type: "text" as const };

      return resolveItemMedia({
        name: input.itemName,
        type: result.type,
        youtubeSearchQuery: result.youtubeSearchQuery,
        wikipediaSearchQuery: result.wikipediaSearchQuery,
      });
    }),

  // Phase 2 (lazy): resolve media for an already-classified item — no LLM call.
  resolveMedia: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.enum(["text", "image", "video"]),
        youtubeSearchQuery: z.string().nullable().optional(),
        wikipediaSearchQuery: z.string().nullable().optional(),
      })
    )
    .query(async ({ input }) => {
      return resolveItemMedia({
        name: input.name,
        type: input.type,
        youtubeSearchQuery: input.youtubeSearchQuery ?? null,
        wikipediaSearchQuery: input.wikipediaSearchQuery ?? null,
      });
    }),

  generateItems: protectedProcedure
    .input(
      z.object({
        prompt: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        existingItems: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const hasExisting = (input.existingItems?.length ?? 0) > 0;

      const context = [
        input.title ? `Tier list title: "${input.title}"` : null,
        input.description ? `Description: "${input.description}"` : null,
        input.prompt ? `User request: "${input.prompt}"` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const systemPrompt = `You help users build tier lists. For each item decide the type:
- "image" if the item has a well-known visual (movies, celebrities, animals, brands, etc.)
- "video" if the item is best represented by a video (music videos, TV theme songs, trailers, etc.). For video items provide a precise YouTube search query in youtubeSearchQuery (e.g. "Queen Bohemian Rhapsody official music video").
- "text" for everything else.
${IMAGE_QUERY_INSTRUCTION}
Return only the item name — concise, no descriptions.

Decide how many items to return based on the topic:
- If the topic has a well-defined, finite, and reasonably complete set (e.g. "all US presidents", "the main characters of a show", "the planets in the solar system", "every Zelda game"), return ALL of the items that belong to that set — be exhaustive, even if that is more than 15. Do not stop at an arbitrary number.
- If the topic is open-ended, effectively infinite, or has no clear boundary (e.g. "best foods", "favorite songs", "good movies"), return the 10–15 best, most representative, or most popular items.`;

      const countInstruction =
        "Choose the count based on the topic: return the complete set if it is finite and well-defined, otherwise cap at 10–15 of the best/most representative items.";

      const userPrompt = hasExisting
        ? `${context}\n\nExisting items: ${input.existingItems!.join(", ")}.\nSuggest more distinct items that fit well alongside the existing ones but are not duplicates. ${countInstruction}`
        : `${context}\n\nGenerate items for this tier list. Return only item names, no explanations. ${countInstruction}`;

      const response = await client.chat.completions.parse({
        model: "gpt-5.4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: zodResponseFormat(ItemsSchema, "items_list"),
      });

      // Phase 1: return names + classification only. Media URLs are fetched
      // later, lazily, via `resolveMedia` — keeps generation fast and avoids
      // spending YouTube quota on items the user may never use.
      const rawItems = response.choices[0]?.message.parsed?.items ?? [];

      return rawItems.map((item) => ({
        name: item.name,
        type: item.type,
        youtubeSearchQuery: item.youtubeSearchQuery,
        wikipediaSearchQuery: item.wikipediaSearchQuery,
      }));
    }),
});
