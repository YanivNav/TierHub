import {z} from "zod";
import {generateText, streamText, Output} from "ai";
import {createDeepSeek} from "@ai-sdk/deepseek";
import {type ResolvedMedia, resolveItemMedia} from "./resolve-media";

export type { ResolvedMedia };

// ── Model ────────────────────────────────────────────────────────────────────

const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
const model = deepseek("deepseek-chat");

// ── Schemas ──────────────────────────────────────────────────────────────────

const AiItemSchema = z.object({
  name: z.string(),
  type: z.enum(["text", "image", "video"]),
  searchQuery: z.string().nullable().optional(),
});

// ── Types ────────────────────────────────────────────────────────────────────

export type AiItem = z.infer<typeof AiItemSchema>;

// ── Shared prompt fragments ──────────────────────────────────────────────────

const SYSTEM_PROMPT =
  "You are a helpful AI assistant for TierHub, an app where users create and share tier lists. You generate items and classify them with appropriate media types. Be concise.\n\n" +
  'Media types:\n' +
  '- "image" - well-known visual (movie, celebrity, landmark, brand, etc.). Always include "searchQuery" with a specific, disambiguated English Wikipedia search (e.g. "Eli Cohen Israeli politician" not "Eli Cohen", "Iron Man 2008 film poster" not "Iron Man").\n' +
  '- "video" - best as video (music video, trailer, theme song, etc.). Include "searchQuery" with a precise YouTube search (e.g. "Queen Bohemian Rhapsody official music video").\n' +
  '- "text" - no media appropriate. Omit "searchQuery".';

const COUNT_INSTRUCTION =
  "Choose the count based on the topic: return the complete set if it is finite and well-defined, otherwise cap at 10-15 of the best/most representative items.";

const SEARCH_QUERY_INSTRUCTION =
  'For image items, always include a "searchQuery" - a specific disambiguated English Wikipedia search (e.g. "Eli Cohen Israeli politician" not "Eli Cohen"). For video items, include a precise YouTube search query (e.g. "Bohemian Rhapsody official music video"). For text items, omit searchQuery.';

// ── Public API ───────────────────────────────────────────────────────────────

export interface GenerateItemsInput {
  prompt?: string;
  title?: string;
  description?: string;
  existingItems?: string[];
}

function buildGeneratePrompt(input: GenerateItemsInput): string {
  const context = [
    input.title ? `Tier-list title: ${JSON.stringify(input.title)}` : null,
    input.description ? `Tier-list description: ${JSON.stringify(input.description)}` : null,
    input.prompt ? `USER REQUEST (highest priority): ${JSON.stringify(input.prompt)}` : null,
  ].filter(Boolean).join("\n");

  const hasExisting = (input.existingItems?.length ?? 0) > 0;
  const existing = hasExisting
    ? `\nExisting items (reference only; never repeat them): ${JSON.stringify(input.existingItems)}.`
    : "";

  return `Generate ${hasExisting ? "additional " : ""}items for this tier list.

${context}${existing}

Follow the USER REQUEST literally. It overrides patterns you infer from the existing items. If the request names specific examples, every named example that is not already present MUST be included, spelled correctly, before adding similar items. Words such as "like", "including", "and such", or "etc." mean include the named examples plus other close matches; they do not make the named examples optional. Existing items define what to avoid, not a narrower genre that can override the request.

Do not output duplicates or alternate spellings of the same item. ${COUNT_INSTRUCTION}

${SEARCH_QUERY_INSTRUCTION}`;
}

/**
 * Phase 1: Stream tier list items as the model produces them.
 * Yields each item (name + type + optional searchQuery) the moment it's
 * complete via the AI SDK's array `elementStream`, so the UI can render names
 * progressively. No media URLs - resolve those lazily via {@link resolveMedia},
 * or use {@link enrichItem} for AI-driven classification + media in one call.
 */
export async function* generateItemsStream(
  input: GenerateItemsInput
): AsyncGenerator<AiItem> {
  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    output: Output.array({ element: AiItemSchema }),
    prompt: buildGeneratePrompt(input),
  });

  for await (const item of result.elementStream) {
    yield { ...item, name: item.name.trim() };
  }
}

export interface EnrichItemInput {
  itemName: string;
  title?: string;
  description?: string;
}

/**
 * Classify an item's media type then resolve its media URL directly.
 * The model decides the type and search query; the impl does the actual
 * Wikipedia/YouTube fetch.
 */
export async function enrichItem(input: EnrichItemInput): Promise<ResolvedMedia> {
  const context = [
    input.title ? `Tier list: "${input.title}"` : null,
    input.description ? `Description: "${input.description}"` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Classify the media type for this tier list item.\n\n${context}\nItem: "${input.itemName}"\n\nReturn the classification as { type: "image"|"video"|"text", searchQuery?: string }. For image items, include a disambiguated Wikipedia search query. For video items, include a precise YouTube search query. For text items, omit searchQuery.`;

  try {
    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      output: Output.object({
        schema: z.object({
          type: z.enum(["text", "image", "video"]),
          searchQuery: z.string().nullable().optional(),
        })
      }),
      prompt,
    });

    return resolveItemMedia({
      name: input.itemName,
      type: result.output.type,
      searchQuery: result.output.searchQuery,
    });
  } catch {
    return { type: "text" as const };
  }
}

export interface ResolveMediaInput {
  name: string;
  type: "text" | "image" | "video";
  searchQuery?: string | null;
}

/**
 * Phase 2 (lazy): Resolve the media URL for an already-classified item.
 * Pure data fetch - uses the model-provided search query if available,
 * falls back to the item name. No model call.
 */
export async function resolveMedia(input: ResolveMediaInput): Promise<ResolvedMedia> {
  return resolveItemMedia({
    name: input.name,
    type: input.type,
    searchQuery: input.searchQuery ?? null,
  });
}
