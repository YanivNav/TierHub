"use client";

import React, { useState, useRef, useCallback } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { Upload, Type, Video, X, Youtube, Sparkles, Wand2, Play, Loader2, ImageOff } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import TierEditor, { type PendingTier } from "@/components/tier-editor";
import { getYouTubeVideoId, getYouTubeThumbnail, getYouTubeEmbedUrl } from "@/lib/youtube";

type ItemType = "text" | "image" | "video";

/** Shape returned by the ai.resolveMedia / ai.enrichItem procedures. */
type MediaResult =
  | { type: "text" }
  | { type: "image"; imageUrl?: string }
  | { type: "video"; youtubeUrl: string; previewUrl: string };

/** Apply a resolved-media result onto a pending item, narrowing the union. */
function withResolvedMedia(item: PendingItem, result: MediaResult): PendingItem {
  const base = {
    ...item,
    file: undefined,
    mediaDirty: item.dbId !== undefined ? true : item.mediaDirty,
  };
  if (result.type === "image") {
    return { ...base, type: "image", imageUrl: result.imageUrl, videoUrl: undefined, previewUrl: result.imageUrl ?? item.previewUrl };
  }
  if (result.type === "video") {
    return { ...base, type: "video", videoUrl: result.youtubeUrl, imageUrl: undefined, previewUrl: result.previewUrl };
  }
  return { ...base, type: "text", imageUrl: undefined, videoUrl: undefined };
}

/** Cap on simultaneous media lookups - fast, but gentle on Wikipedia/YouTube. */
const MAX_CONCURRENT_MEDIA = 4;

/** Minimal counting semaphore for bounding concurrent async work. */
function createSemaphore(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const acquire = () =>
    new Promise<void>((resolve) => {
      if (active < max) {
        active++;
        resolve();
      } else {
        queue.push(() => {
          active++;
          resolve();
        });
      }
    });
  const release = () => {
    active--;
    queue.shift()?.();
  };
  return { acquire, release };
}

type ExistingItemData = {
  id: string;
  type: ItemType;
  label: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
};

type InitialTierData = {
  id: string;
  label: string;
  color: string;
  rank: number;
};

type PendingItem = {
  localId: string;
  dbId?: string;
  type: ItemType;
  label: string;
  file?: File;
  /** For YouTube or other pre-existing video URLs - no file upload needed */
  videoUrl?: string;
  /** For AI-provided or other external image URLs - no file upload needed */
  imageUrl?: string;
  /** Thumbnail shown in the list (blob URL for images, YouTube thumbnail for YT videos) */
  previewUrl?: string;
  /** Model-provided disambiguated search query (Wikipedia or YouTube) */
  searchQuery?: string;
  labelDirty: boolean;
  /** True when type/imageUrl/videoUrl/file was changed on an existing (dbId) item */
  mediaDirty?: boolean;
};

type Props = {
  mode: "create" | "edit";
  tierListId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialIsPublic?: boolean;
  initialCoverImageUrl?: string | null;
  initialItems?: ExistingItemData[];
  initialTiers?: InitialTierData[];
};

export default function TierListForm({
  mode,
  tierListId,
  initialTitle = "",
  initialDescription = "",
  initialIsPublic = true,
  initialCoverImageUrl = null,
  initialItems = [],
  initialTiers = [],
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [isPublic, setIsPublic] = useState(initialIsPublic);

  // Manual cover image (edit mode). `coverFile` is a freshly picked file pending
  // upload; `coverPreview` is what to show (existing URL or local blob).
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initialCoverImageUrl);
  const [coverDirty, setCoverDirty] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [pendingItems, setPendingItems] = useState<PendingItem[]>(() =>
    initialItems.map((item) => {
      if (item.type === "video" && item.videoUrl) {
        const videoId = getYouTubeVideoId(item.videoUrl);
        return {
          localId: item.id,
          dbId: item.id,
          type: "video" as const,
          label: item.label,
          videoUrl: item.videoUrl,
          previewUrl: videoId ? getYouTubeThumbnail(videoId) : undefined,
          labelDirty: false,
        };
      }
      return {
        localId: item.id,
        dbId: item.id,
        type: item.type,
        label: item.label,
        previewUrl: item.imageUrl ?? undefined,
        labelDirty: false,
      };
    })
  );

  const DEFAULT_TIERS: PendingTier[] = [
    { localId: crypto.randomUUID(), label: "S", color: "#ef4444" },
    { localId: crypto.randomUUID(), label: "A", color: "#f97316" },
    { localId: crypto.randomUUID(), label: "B", color: "#eab308" },
    { localId: crypto.randomUUID(), label: "C", color: "#22c55e" },
    { localId: crypto.randomUUID(), label: "D", color: "#3b82f6" },
  ];

  const [pendingTiers, setPendingTiers] = useState<PendingTier[]>(() =>
    mode === "create"
      ? DEFAULT_TIERS
      : [...initialTiers]
          .sort((a, b) => a.rank - b.rank)
          .map((t) => ({ localId: t.id, dbId: t.id, label: t.label, color: t.color }))
  );

  const [isDragging, setIsDragging] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState("");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set after a successful save → drives the "what next?" dialog.
  const [savedListId, setSavedListId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const perItemFileInputRef = useRef<HTMLInputElement>(null);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [enrichingItems, setEnrichingItems] = useState<Set<string>>(new Set());
  const [previewVideoLocalId, setPreviewVideoLocalId] = useState<string | null>(null);
  const [mediaDialogLocalId, setMediaDialogLocalId] = useState<string | null>(null);
  const [itemYoutubeInput, setItemYoutubeInput] = useState("");
  const [itemYoutubeError, setItemYoutubeError] = useState<string | null>(null);

  // Item mutations
  const createTierList = trpc.tierList.create.useMutation();
  const updateTierList = trpc.tierList.update.useMutation();
  const getUploadUrl = trpc.item.getUploadUrl.useMutation();
  const createManyItems = trpc.item.createMany.useMutation();
  const updateItem = trpc.item.update.useMutation();
  const deleteItem = trpc.item.delete.useMutation();

  // AI
  const enrichItem = trpc.ai.enrichItem.useMutation();
  const trpcUtils = trpc.useUtils();

  // Tier mutations (edit mode only)
  const createTier = trpc.tier.create.useMutation();
  const updateTier = trpc.tier.update.useMutation();
  const deleteTier = trpc.tier.delete.useMutation();
  const reorderTiers = trpc.tier.reorder.useMutation();

  // ── Item handlers ──────────────────────────────────────────────────────────

  const addFiles = useCallback((files: FileList | File[]) => {
    const processFile = async (file: File) => {
      const isVideo = file.type.startsWith("video/");
      const localId = crypto.randomUUID();
      const baseItem: PendingItem = {
        localId,
        type: isVideo ? "video" : "image",
        label: "",
        file,
        labelDirty: false,
      };

      if (isVideo) {
        // Generate video thumbnail from first frame
        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
        video.addEventListener(
          "loadedmetadata",
          () => {
            video.currentTime = 0;
          },
          { once: true }
        );
        video.addEventListener(
          "seeked",
          () => {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(video, 0, 0);
            setPendingItems((prev) =>
              prev.map((item) =>
                item.localId === localId ? { ...item, previewUrl: canvas.toDataURL() } : item
              )
            );
            URL.revokeObjectURL(video.src);
          },
          { once: true }
        );
      } else {
        baseItem.previewUrl = URL.createObjectURL(file);
      }

      return baseItem;
    };

    Array.from(files).forEach((file) => {
      processFile(file).then((item) => {
        setPendingItems((prev) => [...prev, item]);
      });
    });
  }, []);

  const addTextItem = () =>
    setPendingItems((prev) => [
      ...prev,
      { localId: crypto.randomUUID(), type: "text", label: "", labelDirty: false },
    ]);

  const handleAddYouTube = () => {
    const url = youtubeInput.trim();
    if (!url) return;
    const videoId = getYouTubeVideoId(url);
    if (!videoId) { setYoutubeError("Not a valid YouTube URL"); return; }
    setYoutubeError(null);
    setYoutubeInput("");
    setPendingItems((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        type: "video",
        label: "",
        videoUrl: url,
        previewUrl: getYouTubeThumbnail(videoId),
        labelDirty: false,
      },
    ]);
  };

  const removeItem = (localId: string) =>
    setPendingItems((prev) => {
      const item = prev.find((i) => i.localId === localId);
      // Only revoke blob URLs created for image file previews
      if (item?.previewUrl && !item.dbId && !item.videoUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.localId !== localId);
    });

  const updateItemLabel = (localId: string, label: string) =>
    setPendingItems((prev) =>
      prev.map((i) =>
        i.localId === localId
          ? { ...i, label, labelDirty: i.dbId !== undefined ? true : i.labelDirty }
          : i
      )
    );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  // ── Tier handlers (local state only - no mutations yet) ────────────────────

  const handleAddTier = () =>
    setPendingTiers((prev) => [
      ...prev,
      { localId: crypto.randomUUID(), label: "New", color: "#6b7280" },
    ]);

  const handleUpdateTier = (localId: string, data: { label?: string; color?: string }) =>
    setPendingTiers((prev) =>
      prev.map((t) => (t.localId === localId ? { ...t, ...data } : t))
    );

  const handleDeleteTier = (localId: string) =>
    setPendingTiers((prev) => prev.filter((t) => t.localId !== localId));

  const handleReorderTier = (activeId: string, overId: string) =>
    setPendingTiers((prev) => {
      const from = prev.findIndex((t) => t.localId === activeId);
      const to = prev.findIndex((t) => t.localId === overId);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });

  // ── AI handlers ────────────────────────────────────────────────────────────

  const handleAiGenerate = async () => {
    const prompt = aiPrompt.trim() || undefined;
    if (!prompt && !title.trim()) return;
    setAiError(null);
    setIsGenerating(true);

    // Phase 2 runs alongside Phase 1: image lookups are dispatched as each item
    // streams in, but a semaphore caps concurrency so a large list (e.g. 45
    // politicians) doesn't hammer Wikipedia all at once.
    const sem = createSemaphore(MAX_CONCURRENT_MEDIA);
    const mediaTasks: Promise<void>[] = [];

    try {
      const existingItems = pendingItems.map((i) => i.label || i.type);
      // Phase 1: stream names + classification as the model produces them.
      const stream = await trpcUtils.client.ai.generateItems.mutate({
        prompt,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        existingItems,
      });

      for await (const item of stream) {
        const localId = crypto.randomUUID();
        const searchQuery = item.searchQuery ?? undefined;
        setPendingItems((prev) => [
          ...prev,
          { localId, type: item.type, label: item.name, searchQuery, labelDirty: false },
        ]);

        // Resolve images progressively (no LLM call - pure Wikipedia fetch).
        // Videos stay on-demand to conserve the YouTube Data API quota.
        if (item.type === "image") {
          mediaTasks.push(
            (async () => {
              await sem.acquire();
              try {
                await runResolveMedia(localId, item.name, "image", searchQuery);
              } finally {
                sem.release();
              }
            })()
          );
        }
      }
    } catch {
      setAiError("Couldn't generate items. Please try again later.");
    } finally {
      setIsGenerating(false);
    }

    // Let in-flight image lookups settle (errors are handled inside).
    await Promise.allSettled(mediaTasks);
  };

  /** Phase 2: fetch the real media URL for an already-classified item. */
  const runResolveMedia = async (
    localId: string,
    name: string,
    type: ItemType,
    searchQuery?: string,
  ) => {
    if (!name.trim()) return;
    setEnrichingItems((prev) => new Set(prev).add(localId));
    try {
      const result = await trpcUtils.client.ai.resolveMedia.query({
        name: name.trim(),
        type,
        searchQuery: searchQuery || undefined,
      });
      setPendingItems((prev) =>
        prev.map((item) => (item.localId === localId ? withResolvedMedia(item, result) : item))
      );
    } catch {
      // silently leave the item as-is if media resolution fails
    } finally {
      setEnrichingItems((prev) => {
        const next = new Set(prev);
        next.delete(localId);
        return next;
      });
    }
  };

  const handleEnrichItem = async (localId: string, label: string) => {
    if (!label.trim()) return;
    setEnrichingItems((prev) => new Set(prev).add(localId));
    try {
      const result = await enrichItem.mutateAsync({
        itemName: label.trim(),
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      });
      setPendingItems((prev) =>
        prev.map((item) => (item.localId === localId ? withResolvedMedia(item, result) : item))
      );
    } finally {
      setEnrichingItems((prev) => {
        const next = new Set(prev);
        next.delete(localId);
        return next;
      });
    }
  };

  // ── Per-item media handlers ────────────────────────────────────────────────

  const applyItemFile = useCallback((localId: string, file: File) => {
    const isVideo = file.type.startsWith("video/");
    const type: ItemType = isVideo ? "video" : "image";
    setPendingItems((prev) =>
      prev.map((item) =>
        item.localId !== localId
          ? item
          : {
              ...item,
              type,
              file,
              imageUrl: undefined,
              videoUrl: undefined,
              previewUrl: isVideo ? undefined : URL.createObjectURL(file),
              mediaDirty: item.dbId !== undefined ? true : item.mediaDirty,
            }
      )
    );
    if (isVideo) {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(file);
      video.addEventListener("loadedmetadata", () => { video.currentTime = 0; }, { once: true });
      video.addEventListener("seeked", () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        setPendingItems((prev) =>
          prev.map((i) => i.localId === localId ? { ...i, previewUrl: canvas.toDataURL() } : i)
        );
        URL.revokeObjectURL(video.src);
      }, { once: true });
    }
  }, []);

  const handlePerItemFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && mediaDialogLocalId) {
      applyItemFile(mediaDialogLocalId, file);
      setMediaDialogLocalId(null);
    }
    e.target.value = "";
  };

  const handleItemYouTube = (localId: string) => {
    const url = itemYoutubeInput.trim();
    if (!url) return;
    const videoId = getYouTubeVideoId(url);
    if (!videoId) { setItemYoutubeError("Not a valid YouTube URL"); return; }
    setPendingItems((prev) =>
      prev.map((item) =>
        item.localId !== localId
          ? item
          : {
              ...item,
              type: "video",
              file: undefined,
              videoUrl: url,
              imageUrl: undefined,
              previewUrl: getYouTubeThumbnail(videoId),
              mediaDirty: item.dbId !== undefined ? true : item.mediaDirty,
            }
      )
    );
    setItemYoutubeInput("");
    setItemYoutubeError(null);
    setMediaDialogLocalId(null);
  };

  const handleRemoveItemMedia = (localId: string) => {
    setPendingItems((prev) =>
      prev.map((item) =>
        item.localId !== localId
          ? item
          : {
              ...item,
              type: "text",
              file: undefined,
              videoUrl: undefined,
              imageUrl: undefined,
              previewUrl: undefined,
              mediaDirty: item.dbId !== undefined ? true : item.mediaDirty,
            }
      )
    );
    setMediaDialogLocalId(null);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleCoverSelect = (file: File | null) => {
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setCoverDirty(true);
  };

  const handleCoverRemove = () => {
    setCoverFile(null);
    setCoverPreview(null);
    setCoverDirty(true);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  /** Upload a cover image to R2 for the given list, returning its public URL. */
  async function uploadCover(listId: string, file: File) {
    const { uploadUrl, publicUrl } = await getUploadUrl.mutateAsync({
      tierListId: listId,
      filename: `cover-${file.name}`,
      contentType: file.type,
    });
    await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    return publicUrl;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === "create") {
        const list = await createTierList.mutateAsync({
          title: title.trim(),
          description: description.trim() || undefined,
          isPublic,
        });
        if (!list) throw new Error("Failed to create tier list");

        // Create tiers sequentially to preserve order
        const createdTierIds: { id: string; rank: number }[] = [];
        for (let i = 0; i < pendingTiers.length; i++) {
          const tier = pendingTiers[i]!;
          const created = await createTier.mutateAsync({
            tierListId: list.id,
            label: tier.label,
            color: tier.color,
          });
          createdTierIds.push({ id: created.id, rank: i });
        }
        if (createdTierIds.length > 0) {
          await reorderTiers.mutateAsync({ tierListId: list.id, tiers: createdTierIds });
        }

        await uploadAndSaveItems(list.id, pendingItems);

        // Cover image - the list now exists, so we can upload and attach it.
        if (coverFile) {
          const coverImageUrl = await uploadCover(list.id, coverFile);
          await updateTierList.mutateAsync({ id: list.id, coverImageUrl });
        }

        setIsSubmitting(false);
        setSavedListId(list.id);
      } else {
        // 0. Upload a newly-picked cover image (if any) before saving metadata.
        let coverImageUrl: string | null | undefined;
        if (coverDirty) {
          coverImageUrl = coverFile
            ? await uploadCover(tierListId!, coverFile)
            : null; // cover was removed
        }

        // 1. Update metadata
        await updateTierList.mutateAsync({
          id: tierListId!,
          title: title.trim(),
          description: description.trim() || null,
          isPublic,
          coverImageUrl,
        });

        // 2. Tiers ────────────────────────────────────────────────────────────

        // Delete tiers that were removed
        const removedTierIds = initialTiers
          .filter((orig) => !pendingTiers.some((t) => t.dbId === orig.id))
          .map((orig) => orig.id);
        await Promise.all(removedTierIds.map((id) => deleteTier.mutateAsync({ id })));

        // Update existing tiers (label / color may have changed)
        await Promise.all(
          pendingTiers
            .filter((t) => t.dbId)
            .map((t) => updateTier.mutateAsync({ id: t.dbId!, label: t.label, color: t.color }))
        );

        // Create new tiers sequentially so we can collect their DB IDs
        const newTierIdMap = new Map<string, string>(); // localId → dbId
        for (const tier of pendingTiers.filter((t) => !t.dbId)) {
          const created = await createTier.mutateAsync({
            tierListId: tierListId!,
            label: tier.label,
            color: tier.color,
          });
          newTierIdMap.set(tier.localId, created.id);
        }

        // Reorder all surviving tiers to match current pendingTiers order
        const tiersToReorder = pendingTiers.map((t, i) => ({
          id: t.dbId ?? newTierIdMap.get(t.localId)!,
          rank: i,
        }));
        if (tiersToReorder.length > 0) {
          await reorderTiers.mutateAsync({ tierListId: tierListId!, tiers: tiersToReorder });
        }

        // 3. Items ────────────────────────────────────────────────────────────

        // Delete removed items
        const removedItemIds = initialItems
          .filter((orig) => !pendingItems.some((p) => p.dbId === orig.id))
          .map((orig) => orig.id);
        await Promise.all(removedItemIds.map((id) => deleteItem.mutateAsync({ id })));

        // Update existing items whose label or media changed
        await Promise.all(
          pendingItems
            .filter((p) => p.dbId && (p.labelDirty || p.mediaDirty))
            .map(async (p) => {
              const patch: Parameters<typeof updateItem.mutateAsync>[0] = { id: p.dbId! };
              if (p.labelDirty) {
                patch.label = p.label;
                patch.tierId = null; // unrank renamed items
              }
              if (p.mediaDirty) {
                if (p.file) {
                  // New file attached to existing item - upload to S3 first
                  const { uploadUrl, publicUrl } = await getUploadUrl.mutateAsync({
                    tierListId: tierListId!,
                    filename: p.file.name,
                    contentType: p.file.type,
                  });
                  await fetch(uploadUrl, { method: "PUT", body: p.file, headers: { "Content-Type": p.file.type } });

                  let thumbnailUrl: string | undefined;
                  if (p.type === "video" && p.previewUrl) {
                    try {
                      const res = await fetch(p.previewUrl);
                      const blob = await res.blob();
                      const thumbName = `${p.file.name.split(".")[0]}-thumb.jpg`;
                      const { uploadUrl: tUrl, publicUrl: tPublic } = await getUploadUrl.mutateAsync({
                        tierListId: tierListId!,
                        filename: thumbName,
                        contentType: "image/jpeg",
                      });
                      await fetch(tUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
                      thumbnailUrl = tPublic;
                    } catch {}
                  }

                  patch.type = p.type;
                  patch.imageUrl = p.type === "image" ? publicUrl : (p.type === "video" ? (thumbnailUrl ?? null) : null);
                  patch.videoUrl = p.type === "video" ? publicUrl : null;
                } else {
                  // URL-only media change (AI enrich or manual YouTube/Wikipedia)
                  patch.type = p.type;
                  patch.imageUrl = p.type === "video" ? (p.previewUrl ?? null) : (p.imageUrl ?? null);
                  patch.videoUrl = p.type === "video" ? (p.videoUrl ?? null) : null;
                }
              }
              return updateItem.mutateAsync(patch);
            })
        );

        // Create new items
        const newItems = pendingItems.filter((p) => !p.dbId);
        if (newItems.length > 0) await uploadAndSaveItems(tierListId!, newItems);

        setIsSubmitting(false);
        setSavedListId(tierListId!);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  async function uploadAndSaveItems(listId: string, items: PendingItem[]) {
    if (items.length === 0) return;
    const itemsToSave = await Promise.all(
      items.map(async (item) => {
        if (item.type === "text") {
          return { label: item.label || "Untitled", type: "text" as const };
        }
        // Pre-existing URL (YouTube etc.) - skip upload
        if (item.videoUrl && !item.file) {
          return { label: item.label || "Video", type: "video" as const, videoUrl: item.videoUrl, imageUrl: item.previewUrl };
        }
        // External image URL (e.g. AI-provided Wikipedia image) - skip upload
        if (item.imageUrl && !item.file) {
          return { label: item.label || "Image", type: "image" as const, imageUrl: item.imageUrl };
        }
        // No uploaded file and no resolved media URL yet - e.g. an AI-generated
        // image whose Wikipedia lookup is still in flight when the user hits save.
        // Persist the label + type without media; it can be enriched later in edit.
        if (!item.file) {
          return { label: item.label || "Untitled", type: item.type };
        }
        const { uploadUrl, publicUrl } = await getUploadUrl.mutateAsync({
          tierListId: listId,
          filename: item.file!.name,
          contentType: item.file!.type,
        });
        await fetch(uploadUrl, {
          method: "PUT",
          body: item.file,
          headers: { "Content-Type": item.file!.type },
        });

        // For videos, also upload the thumbnail if it exists
        let thumbnailUrl: string | undefined;
        if (item.type === "video" && item.previewUrl) {
          try {
            // Convert data URL to blob
            const response = await fetch(item.previewUrl);
            const blob = await response.blob();

            // Upload thumbnail
            const thumbnailFilename = `${item.file!.name.split('.')[0]}-thumb.jpg`;
            const { uploadUrl: thumbUploadUrl, publicUrl: thumbPublicUrl } = await getUploadUrl.mutateAsync({
              tierListId: listId,
              filename: thumbnailFilename,
              contentType: "image/jpeg",
            });

            await fetch(thumbUploadUrl, {
              method: "PUT",
              body: blob,
              headers: { "Content-Type": "image/jpeg" },
            });

            thumbnailUrl = thumbPublicUrl;
          } catch (e) {
            console.error("Failed to upload video thumbnail:", e);
          }
        }

        return {
          label: item.label || item.file!.name,
          type: item.type,
          imageUrl: item.type === "image" ? publicUrl : (item.type === "video" ? thumbnailUrl : undefined),
          videoUrl: item.type === "video" ? publicUrl : undefined,
        };
      })
    );
    await createManyItems.mutateAsync({ tierListId: listId, items: itemsToSave });
  }

  const isCreate = mode === "create";

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="title">Name</Label>
        <Input
          id="title"
          placeholder="My tier list..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="border-border bg-card"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">
          Description <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="description"
          placeholder="What is this tier list about?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="resize-none border-border bg-card"
        />
      </div>

      {/* Cover image - manual thumbnail (collage/icon fallback if empty) */}
      <div className="space-y-2">
        <Label>
          Cover image <span className="text-muted-foreground">(optional)</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          Shown on the dashboard card. If left empty, a collage of item images
          (or a default icon) is used.
        </p>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleCoverSelect(e.target.files?.[0] ?? null)}
        />
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-md border border-border bg-card">
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverPreview}
                alt="Cover preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageOff className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-border text-foreground hover:text-foreground"
              onClick={() => coverInputRef.current?.click()}
            >
              <Upload className="mr-1 h-4 w-4" />
              {coverPreview ? "Replace" : "Upload"}
            </Button>
            {coverPreview && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                onClick={handleCoverRemove}
              >
                <X className="mr-1 h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Visibility */}
      <div className="flex items-center gap-3">
        <Switch id="public" checked={isPublic} onCheckedChange={setIsPublic} />
        <Label htmlFor="public" className="cursor-pointer">
          {isPublic ? "Public" : "Private"}
        </Label>
      </div>

      <Separator className="bg-border" />

      {/* Tier structure */}
      <div className="space-y-3">
        <Label>Tier Structure</Label>
        <TierEditor
          tiers={pendingTiers}
          onAdd={handleAddTier}
          onUpdate={handleUpdateTier}
          onDelete={handleDeleteTier}
          onReorder={handleReorderTier}
        />
      </div>
      <Separator className="bg-border" />

      {/* Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>
            Items <span className="text-muted-foreground">({pendingItems.length})</span>
          </Label>
        </div>

        {pendingItems.length > 0 ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`divide-y divide-border/50 overflow-hidden rounded-xl border bg-muted/30 transition-colors ${
              isDragging ? "border-blue-500 bg-blue-500/5" : "border-border/50"
            }`}
          >
            {pendingItems.map((item) => {
              const isEnriching = enrichingItems.has(item.localId);
              const hasVideo = item.type === "video" && (item.videoUrl ?? item.file);
              const needsVideoLoad =
                item.type === "video" && !item.previewUrl && !item.file;
              return (
                <div key={item.localId} className="flex flex-col">
                  <div className="flex items-center gap-3 p-3">
                    {/* Thumbnail / play button */}
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {item.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                      ) : needsVideoLoad ? (
                        <button
                          type="button"
                          onClick={() => runResolveMedia(item.localId, item.label, "video", item.searchQuery)}
                          disabled={isEnriching}
                          title="Load video from YouTube"
                          className="flex h-full w-full items-center justify-center text-red-500 hover:bg-muted/50 transition-colors"
                        >
                          <Youtube className="h-5 w-5" />
                        </button>
                      ) : item.type === "video" ? (
                        <Video className="h-5 w-5 text-purple-400" />
                      ) : item.type === "image" ? (
                        <button
                          type="button"
                          onClick={() => runResolveMedia(item.localId, item.label, "image", item.searchQuery)}
                          title="No image found - this item may not have a Wikipedia page. Click to retry."
                          className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-500/20 to-blue-600/20 transition-colors hover:from-blue-500/40 hover:to-blue-600/40"
                        >
                          <ImageOff className="h-4 w-4 text-blue-400/70" />
                        </button>
                      ) : (
                        <Type className="h-5 w-5 text-blue-400" />
                      )}
                      {isEnriching && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
                          <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                        </div>
                      )}
                      {!isEnriching && hasVideo && (
                        <button
                          type="button"
                          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                          onClick={(e) => { e.stopPropagation(); setPreviewVideoLocalId(item.localId); }}
                          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                          title="Watch video"
                        >
                          <Play className="h-5 w-5 text-white" fill="white" />
                        </button>
                      )}
                    </div>

                    {/* Label */}
                    <div className="min-w-0 flex-1">
                      <input
                        value={item.label}
                        onChange={(e) => updateItemLabel(item.localId, e.target.value)}
                        placeholder={item.type === "text" ? "Item label..." : "Label (optional)"}
                        className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none"
                      />
                      {item.file && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.file.name}</p>
                      )}
                      {item.type === "image" && !item.previewUrl && !item.file && !isEnriching && (
                        <p className="mt-0.5 text-xs text-amber-500/80">
                          No image found - retry or upload one
                        </p>
                      )}
                    </div>

                    {/* Media button */}
                    <button
                      type="button"
                      onClick={() => {
                        setMediaDialogLocalId(item.localId);
                        setItemYoutubeInput("");
                        setItemYoutubeError(null);
                      }}
                      title="Attach or replace media"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </button>

                    {/* Remove item */}
                    <button
                      type="button"
                      onClick={() => removeItem(item.localId)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed py-12 text-center transition-colors ${
              isDragging ? "border-blue-500 bg-blue-500/5" : "border-border/50"
            }`}
          >
            <div className="rounded-full bg-muted p-3">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">No items yet</p>
              <p className="text-xs text-muted-foreground">
                Drag & drop files here, or use the toolbar below
              </p>
            </div>
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <input
          ref={perItemFileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handlePerItemFileChange}
        />
      </div>

      <Separator className="bg-border" />

      {/* Add items */}
      <div className="space-y-4 rounded-xl border border-border bg-card/50 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add items</h3>

        {/* Quick-add toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTextItem}
            className="border-border bg-card text-foreground hover:border-border hover:text-foreground"
          >
            <Type className="mr-1.5 h-3.5 w-3.5" />
            Text
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="border-border bg-card text-foreground hover:border-border hover:text-foreground"
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Upload files
          </Button>

          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5">
            <Youtube className="h-3.5 w-3.5 shrink-0 text-red-500" />
            <input
              value={youtubeInput}
              onChange={(e) => { setYoutubeInput(e.target.value); setYoutubeError(null); }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddYouTube())}
              placeholder="YouTube URL…"
              className="w-36 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button
              type="button"
              onClick={handleAddYouTube}
              disabled={!youtubeInput.trim()}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>

        {youtubeError && <p className="text-xs text-red-400">{youtubeError}</p>}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* AI Generate */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={aiPrompt}
              onChange={(e) => { setAiPrompt(e.target.value); setAiError(null); }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAiGenerate())}
              placeholder='e.g. "Best Pixar movies" or "Programming languages"'
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-violet-500"
              disabled={isGenerating}
            />
            <Button
              type="button"
              onClick={() => handleAiGenerate()}
              disabled={(!aiPrompt.trim() && !title.trim()) || isGenerating}
              className="shrink-0 bg-violet-600 hover:bg-violet-500 text-white"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {isGenerating ? "Generating…" : "Generate"}
            </Button>
          </div>
          {isGenerating && (
            <div className="relative h-0.5 overflow-hidden rounded-full bg-muted">
              <div className="absolute h-full w-2/5 rounded-full bg-violet-500 animate-indeterminate" />
            </div>
          )}
          {aiError && <p className="text-xs text-red-400">{aiError}</p>}
        </div>
      </div>

      <p className="text-sm text-red-400 min-h-5">{error || " "}</p>

      <Separator className="bg-border" />

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-border text-foreground"
          onClick={() => router.push("/dashboard")}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!title.trim() || isSubmitting}
          className="bg-blue-600 hover:bg-blue-500"
        >
          {isSubmitting
            ? isCreate ? "Creating..." : "Saving..."
            : isCreate ? "Create Tier List" : "Save Changes"}
        </Button>
      </div>
    </form>

    {/* Post-save dialog: view the list, go to dashboard, or stay (X) */}
    <Dialog open={savedListId !== null} onOpenChange={(open) => { if (!open) setSavedListId(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Tier list created" : "Changes saved"}</DialogTitle>
          <DialogDescription>What would you like to do next?</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-border text-foreground"
            onClick={() => router.push("/dashboard")}
          >
            Back to dashboard
          </Button>
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-500"
            onClick={() => savedListId && router.push(`/tier-lists/${savedListId}`)}
          >
            View tier list
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Edit media dialog */}
    {(() => {
      const item = pendingItems.find((i) => i.localId === mediaDialogLocalId);
      const isEnriching = item ? enrichingItems.has(item.localId) : false;
      const hasMedia = !!(item?.file || item?.previewUrl || item?.imageUrl || item?.videoUrl);
      const isUnresolvedImage = !!item && item.type === "image" && !hasMedia;
      return (
        <Dialog open={!!mediaDialogLocalId} onOpenChange={(open) => { if (!open) { setMediaDialogLocalId(null); setItemYoutubeInput(""); setItemYoutubeError(null); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit media - {item?.label || "item"}</DialogTitle>
            </DialogHeader>
            {item && (
              <div className="space-y-4 pt-1">
                {isUnresolvedImage && !isEnriching && (
                  <div className="rounded-lg border border-amber-700/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-300/90">
                    No image was found for this item - it may not have a Wikipedia
                    page. Try a more specific label and{" "}
                    <span className="font-medium">Find media with AI</span>, or
                    upload an image yourself.
                  </div>
                )}

                {/* Upload file */}
                <button
                  type="button"
                  onClick={() => perItemFileInputRef.current?.click()}
                  className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-foreground hover:border-border hover:text-foreground transition-colors"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  Upload file
                </button>

                {/* YouTube URL */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 focus-within:border-border">
                    <Youtube className="h-4 w-4 shrink-0 text-red-500" />
                    <input
                      value={itemYoutubeInput}
                      onChange={(e) => { setItemYoutubeInput(e.target.value); setItemYoutubeError(null); }}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleItemYouTube(item.localId))}
                      placeholder="YouTube URL…"
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleItemYouTube(item.localId)}
                      disabled={!itemYoutubeInput.trim()}
                      className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                  {itemYoutubeError && <p className="text-xs text-red-400">{itemYoutubeError}</p>}
                </div>

                {/* AI enrich */}
                <button
                  type="button"
                  onClick={() => { handleEnrichItem(item.localId, item.label); setMediaDialogLocalId(null); }}
                  disabled={!item.label.trim() || isEnriching}
                  className="flex w-full items-center gap-2 rounded-lg border border-violet-700/50 px-3 py-2.5 text-sm text-violet-300 hover:border-violet-500 hover:text-violet-200 disabled:opacity-40 transition-colors"
                >
                  <Wand2 className={`h-4 w-4 shrink-0 ${isEnriching ? "animate-pulse" : ""}`} />
                  {isEnriching ? "Finding media…" : "Find media with AI"}
                </button>

                {/* Remove media - only when there's actually media attached */}
                {item.type !== "text" && hasMedia && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItemMedia(item.localId)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-muted-foreground hover:border-red-700/50 hover:text-red-400 transition-colors"
                  >
                    <X className="h-4 w-4 shrink-0" />
                    Remove media
                  </button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      );
    })()}

    {/* Video preview dialog */}
    {(() => {
      const item = pendingItems.find((i) => i.localId === previewVideoLocalId);
      const videoUrl = item?.videoUrl ?? (item?.file ? URL.createObjectURL(item.file) : null);
      const videoId = videoUrl ? getYouTubeVideoId(videoUrl) : null;
      return (
        <Dialog open={!!previewVideoLocalId} onOpenChange={(open) => !open && setPreviewVideoLocalId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{item?.label || "Video"}</DialogTitle>
            </DialogHeader>
            {videoId ? (
              <div className="overflow-hidden rounded-lg bg-black">
                <iframe
                  width="100%"
                  height="400"
                  src={getYouTubeEmbedUrl(videoId)}
                  title={item?.label || "Video"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : videoUrl ? (
              <video src={videoUrl} controls className="w-full max-h-100 rounded-lg" />
            ) : null}
          </DialogContent>
        </Dialog>
      );
    })()}
    </>
  );
}
