import { z } from "zod";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";

const AiItemSchema = z.object({
  name: z.string(),
  type: z.enum(["text", "image", "video"]),
  youtubeSearchQuery: z.string().nullable(),
});

const ItemsSchema = z.object({
  items: z.array(AiItemSchema),
});

const client = new OpenAI();

async function fetchWikipediaImage(query: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&format=json&pithumbsize=300`;
    const res = await fetch(url);
    const data = await res.json() as { query?: { pages?: Record<string, { thumbnail?: { source: string } }> } };
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    return page?.thumbnail?.source ?? null;
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
});

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
- "text" if no media is appropriate.`;

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

      if (result.type === "image") {
        const imageUrl = await fetchWikipediaImage(input.itemName);
        return { type: "image" as const, imageUrl: imageUrl ?? undefined };
      }
      if (result.type === "video" && result.youtubeSearchQuery != null) {
        const yt = await searchYouTube(result.youtubeSearchQuery);
        if (yt) {
          return {
            type: "video" as const,
            youtubeUrl: `https://www.youtube.com/watch?v=${yt.videoId}`,
            previewUrl: yt.thumbnailUrl,
          };
        }
      }
      return { type: "text" as const };
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
Return only the item name — concise, no descriptions.`;

      const userPrompt = hasExisting
        ? `${context}\n\nExisting items: ${input.existingItems!.join(", ")}.\nSuggest 10–15 more distinct items that fit well alongside the existing ones but are not duplicates.`
        : `${context}\n\nGenerate 10–15 items for this tier list. Return only item names, no explanations.`;

      const response = await client.chat.completions.parse({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: zodResponseFormat(ItemsSchema, "items_list"),
      });

      const rawItems = response.choices[0]?.message.parsed?.items ?? [];

      const enriched = await Promise.all(
        rawItems.map(async (item) => {
          if (item.type === "image") {
            const imageUrl = await fetchWikipediaImage(item.name);
            return { name: item.name, type: item.type, imageUrl: imageUrl ?? undefined };
          }
          if (item.type === "video" && item.youtubeSearchQuery != null) {
            const yt = await searchYouTube(item.youtubeSearchQuery);
            if (yt) {
              return {
                name: item.name,
                type: item.type,
                youtubeUrl: `https://www.youtube.com/watch?v=${yt.videoId}`,
                previewUrl: yt.thumbnailUrl,
              };
            }
          }
          return { name: item.name, type: "text" as const };
        })
      );

      return enriched;
    }),
});
