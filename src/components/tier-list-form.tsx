"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, Type, Video, X } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import TierEditor, { type PendingTier } from "@/components/tier-editor";

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
  previewUrl?: string;
  labelDirty: boolean;
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
    initialItems.map((item) => ({
      localId: item.id,
      dbId: item.id,
      type: item.type,
      label: item.label,
      previewUrl: item.imageUrl ?? item.videoUrl ?? undefined,
      labelDirty: false,
    }))
  );

  const [pendingTiers, setPendingTiers] = useState<PendingTier[]>(() =>
    [...initialTiers]
      .sort((a, b) => a.rank - b.rank)
      .map((t) => ({ localId: t.id, dbId: t.id, label: t.label, color: t.color }))
  );

  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Item mutations
  const createTierList = trpc.tierList.create.useMutation();
  const updateTierList = trpc.tierList.update.useMutation();
  const getUploadUrl = trpc.item.getUploadUrl.useMutation();
  const createManyItems = trpc.item.createMany.useMutation();
  const updateItem = trpc.item.update.useMutation();
  const deleteItem = trpc.item.delete.useMutation();

  // Tier mutations (edit mode only)
  const createTier = trpc.tier.create.useMutation();
  const updateTier = trpc.tier.update.useMutation();
  const deleteTier = trpc.tier.delete.useMutation();
  const reorderTiers = trpc.tier.reorder.useMutation();

  // ── Item handlers ──────────────────────────────────────────────────────────

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: PendingItem[] = Array.from(files).map((file) => ({
      localId: crypto.randomUUID(),
      type: file.type.startsWith("video/") ? "video" : "image",
      label: "",
      file,
      previewUrl: URL.createObjectURL(file),
      labelDirty: false,
    }));
    setPendingItems((prev) => [...prev, ...newItems]);
  }, []);

  const addTextItem = () =>
    setPendingItems((prev) => [
      ...prev,
      { localId: crypto.randomUUID(), type: "text", label: "", labelDirty: false },
    ]);

  const removeItem = (localId: string) =>
    setPendingItems((prev) => {
      const item = prev.find((i) => i.localId === localId);
      if (item?.previewUrl && !item.dbId) URL.revokeObjectURL(item.previewUrl);
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

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
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

        // Update label-changed items
        await Promise.all(
          pendingItems
            .filter((p) => p.dbId && p.labelDirty)
            .map((p) => updateItem.mutateAsync({ id: p.dbId!, label: p.label }))
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
        return {
          label: item.label || item.file!.name,
          type: item.type,
          imageUrl: item.type === "image" ? publicUrl : undefined,
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

      {/* Tier structure — edit mode only */}
      {!isCreate && (
        <>
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
        </>
      )}

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

        {/* Items list */}
        {pendingItems.length > 0 && (
          <div className="divide-y divide-zinc-700/50 overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-800/30">
            {pendingItems.map((item) => (
              <div key={item.localId} className="flex items-center gap-3 p-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-700">
                  {item.type === "image" && item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : item.type === "video" ? (
                    <Video className="h-5 w-5 text-purple-400" />
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
