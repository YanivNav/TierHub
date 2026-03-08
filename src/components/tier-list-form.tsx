"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, Type, Video, X, Youtube, Sparkles, Wand2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import TierEditor, { type PendingTier } from "@/components/tier-editor";
import { getYouTubeVideoId, getYouTubeThumbnail } from "@/lib/youtube";

type ItemType = "text" | "image" | "video";

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
  /** For YouTube or other pre-existing video URLs — no file upload needed */
  videoUrl?: string;
  /** For AI-provided or other external image URLs — no file upload needed */
  imageUrl?: string;
  /** Thumbnail shown in the list (blob URL for images, YouTube thumbnail for YT videos) */
  previewUrl?: string;
  labelDirty: boolean;
  /** True when type/imageUrl/videoUrl was changed by enrichment on an existing (dbId) item */
  enrichDirty?: boolean;
};

type Props = {
  mode: "create" | "edit";
  tierListId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialIsPublic?: boolean;
  initialItems?: ExistingItemData[];
  initialTiers?: InitialTierData[];
};

export default function TierListForm({
  mode,
  tierListId,
  initialTitle = "",
  initialDescription = "",
  initialIsPublic = true,
  initialItems = [],
  initialTiers = [],
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [isPublic, setIsPublic] = useState(initialIsPublic);

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [enrichingItems, setEnrichingItems] = useState<Set<string>>(new Set());

  // Item mutations
  const createTierList = trpc.tierList.create.useMutation();
  const updateTierList = trpc.tierList.update.useMutation();
  const getUploadUrl = trpc.item.getUploadUrl.useMutation();
  const createManyItems = trpc.item.createMany.useMutation();
  const updateItem = trpc.item.update.useMutation();
  const deleteItem = trpc.item.delete.useMutation();

  // AI
  const generateItems = trpc.ai.generateItems.useMutation();
  const enrichItem = trpc.ai.enrichItem.useMutation();

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

  // ── Tier handlers (local state only — no mutations yet) ────────────────────

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

  const handleMoveTier = (localId: string, direction: "up" | "down") =>
    setPendingTiers((prev) => {
      const idx = prev.findIndex((t) => t.localId === localId);
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === prev.length - 1) return prev;
      const next = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [next[idx], next[swapIdx]] = [next[swapIdx]!, next[idx]!];
      return next;
    });

  // ── AI handlers ────────────────────────────────────────────────────────────

  const handleAiGenerate = async () => {
    const prompt = aiPrompt.trim() || undefined;
    if (!prompt && !title.trim()) return;
    setAiError(null);
    try {
      const existingItems = pendingItems.map((i) => i.label || i.type);
      const aiItems = await generateItems.mutateAsync({
        prompt,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        existingItems,
      });
      const newItems: PendingItem[] = aiItems.map((item) => ({
        localId: crypto.randomUUID(),
        type: item.type,
        label: item.name,
        imageUrl: item.imageUrl,
        videoUrl: item.youtubeUrl,
        previewUrl: item.imageUrl ?? item.previewUrl,
        labelDirty: false,
      }));
      
      setPendingItems((prev) => [...prev, ...newItems]);
    } catch {
      setAiError("Couldn't generate items. Please try again later.");
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
        prev.map((item) => {
          if (item.localId !== localId) return item;
          return {
            ...item,
            type: result.type,
            imageUrl: result.imageUrl,
            videoUrl: result.youtubeUrl,
            previewUrl: result.imageUrl ?? result.previewUrl ?? item.previewUrl,
            enrichDirty: item.dbId !== undefined ? true : item.enrichDirty,
          };
        })
      );
    } finally {
      setEnrichingItems((prev) => {
        const next = new Set(prev);
        next.delete(localId);
        return next;
      });
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.SubmitEvent) => {
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
        router.push("/dashboard");
      } else {
        // 1. Update metadata
        await updateTierList.mutateAsync({
          id: tierListId!,
          title: title.trim(),
          description: description.trim() || undefined,
          isPublic,
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
            .filter((p) => p.dbId && (p.labelDirty || p.enrichDirty))
            .map((p) => {
              const patch: Parameters<typeof updateItem.mutateAsync>[0] = { id: p.dbId! };
              if (p.labelDirty) {
                patch.label = p.label;
                patch.tierId = null; // unrank renamed items
              }
              if (p.enrichDirty) {
                patch.type = p.type;
                // For videos, imageUrl holds the thumbnail; for images, it holds the image URL
                patch.imageUrl = p.type === "video" ? (p.previewUrl ?? null) : (p.imageUrl ?? null);
                patch.videoUrl = p.type === "video" ? (p.videoUrl ?? null) : null;
              }
              return updateItem.mutateAsync(patch);
            })
        );

        // Create new items
        const newItems = pendingItems.filter((p) => !p.dbId);
        if (newItems.length > 0) await uploadAndSaveItems(tierListId!, newItems);

        router.push("/dashboard");
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
        // Pre-existing URL (YouTube etc.) — skip upload
        if (item.videoUrl && !item.file) {
          return { label: item.label || "Video", type: "video" as const, videoUrl: item.videoUrl, imageUrl: item.previewUrl };
        }
        // External image URL (e.g. AI-provided Wikipedia image) — skip upload
        if (item.imageUrl && !item.file) {
          return { label: item.label || "Image", type: "image" as const, imageUrl: item.imageUrl };
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
          className="border-zinc-700 bg-zinc-900"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">
          Description <span className="text-zinc-500">(optional)</span>
        </Label>
        <Textarea
          id="description"
          placeholder="What is this tier list about?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="resize-none border-zinc-700 bg-zinc-900"
        />
      </div>

      {/* Visibility */}
      <div className="flex items-center gap-3">
        <Switch id="public" checked={isPublic} onCheckedChange={setIsPublic} />
        <Label htmlFor="public" className="cursor-pointer">
          {isPublic ? "Public" : "Private"}
        </Label>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Tier structure */}
      <div className="space-y-3">
        <Label>Tier Structure</Label>
        <TierEditor
          tiers={pendingTiers}
          onAdd={handleAddTier}
          onUpdate={handleUpdateTier}
          onDelete={handleDeleteTier}
          onMove={handleMoveTier}
        />
      </div>
      <Separator className="bg-zinc-800" />

      {/* AI item generation */}
      <div className="space-y-3 rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <Label className="text-violet-300">Generate items with AI</Label>
        </div>
        <div className="flex gap-2">
          <input
            value={aiPrompt}
            onChange={(e) => { setAiPrompt(e.target.value); setAiError(null); }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAiGenerate())}
            placeholder='e.g. "Best Pixar movies" or "Programming languages"'
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-zinc-500"
            disabled={generateItems.isPending}
          />
          <Button
            type="button"
            onClick={() => handleAiGenerate()}
            disabled={(!aiPrompt.trim() && !title.trim()) || generateItems.isPending}
            className="shrink-0 bg-violet-600 hover:bg-violet-500 text-white"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {generateItems.isPending ? "Generating…" : "Generate"}
          </Button>
        </div>
        {aiError && <p className="text-xs text-red-400">{aiError}</p>}
      </div>

      <Separator className="bg-zinc-800" />

      {/* Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>
            Items <span className="text-zinc-500">({pendingItems.length})</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTextItem}
            className="border-zinc-700 text-zinc-300 hover:text-white"
          >
            <Type className="mr-2 h-4 w-4" />
            Add Text Item
          </Button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragging ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 hover:border-zinc-500"
          }`}
        >
          <Upload className="h-8 w-8 text-zinc-500" />
          <p className="text-sm text-zinc-400">
            Drag & drop images or videos, or <span className="text-blue-400">browse</span>
          </p>
          <p className="text-xs text-zinc-600">Supports JPG, PNG, GIF, WebP, MP4, WebM</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* YouTube URL input */}
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Youtube className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500" />
              <input
                value={youtubeInput}
                onChange={(e) => { setYoutubeInput(e.target.value); setYoutubeError(null); }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddYouTube())}
                placeholder="Paste a YouTube URL…"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-zinc-500"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddYouTube}
              className="shrink-0 border-zinc-700 text-zinc-300 hover:text-white"
            >
              Add
            </Button>
          </div>
          {youtubeError && <p className="text-xs text-red-400">{youtubeError}</p>}
        </div>

        {/* Items list */}
        {pendingItems.length > 0 && (
          <div className="divide-y divide-zinc-700/50 overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-800/30">
            {pendingItems.map((item) => (
              <div key={item.localId} className="flex items-center gap-3 p-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-700">
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : item.type === "video" ? (
                    <Video className="h-5 w-5 text-purple-400" />
                  ) : item.type === "image" ? (
                    <div className="h-full w-full bg-linear-to-br from-blue-500/30 to-blue-600/30" />
                  ) : (
                    <Type className="h-5 w-5 text-blue-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <input
                    value={item.label}
                    onChange={(e) => updateItemLabel(item.localId, e.target.value)}
                    placeholder={item.type === "text" ? "Item label..." : "Label (optional)"}
                    className="w-full bg-transparent text-sm font-medium text-white placeholder:text-zinc-500 outline-none"
                  />
                  {item.file && (
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{item.file.name}</p>
                  )}
                </div>

                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.type === "image"
                      ? "bg-blue-500/20 text-blue-300"
                      : item.type === "video"
                      ? "bg-purple-500/20 text-purple-300"
                      : "bg-zinc-600/50 text-zinc-300"
                  }`}
                >
                  {item.type}
                </span>

                <button
                  type="button"
                  onClick={() => handleEnrichItem(item.localId, item.label)}
                  disabled={!item.label.trim() || enrichingItems.has(item.localId)}
                  title="Find media with AI"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-violet-700/40 hover:text-violet-300 disabled:opacity-40"
                >
                  <Wand2 className={`h-3.5 w-3.5 ${enrichingItems.has(item.localId) ? "animate-pulse text-violet-400" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={() => removeItem(item.localId)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Separator className="bg-zinc-800" />

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-zinc-700 text-zinc-300"
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
  );
}
