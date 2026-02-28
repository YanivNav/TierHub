"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Video,
  Type,
  Link,
  Check,
  Play,
  RotateCcw,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ItemType = "text" | "image" | "video";

type Tier = {
  id: string;
  label: string;
  color: string;
  rank: number;
};

type Item = {
  id: string;
  type: ItemType;
  label: string;
  tierId: string | null;
  rank: number;
  imageUrl: string | null;
  videoUrl: string | null;
};

export default function TierBoard({
  tierListId,
  tiers: initialTiers,
  items,
  isOwner,
}: {
  tierListId: string;
  tiers: Tier[];
  items: Item[];
  isOwner: boolean;
}) {
  const [positions, setPositions] = useState<Record<string, string | null>>(
    () => Object.fromEntries(items.map((item) => [item.id, item.tierId]))
  );
  const [ranks, setRanks] = useState<Record<string, number>>(
    () => Object.fromEntries(items.map((item) => [item.id, item.rank ?? 0]))
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    tierId: string | null;
    insertIndex: number;
  } | null>(null);

  const updateItemTier = trpc.item.updateTier.useMutation();

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  function getItemsInTier(tierId: string | null) {
    return items
      .filter((item) => positions[item.id] === tierId)
      .sort((a, b) => ranks[a.id] - ranks[b.id]);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
    setDropTarget(null);
  }

  /** Shared logic: given the dragged item and the over-target id, compute where
   *  it would be inserted (tierId + index into the filtered list without the
   *  dragged item itself). Used by both onDragOver and onDragEnd. */
  function computeDropTarget(itemId: string, overId: string) {
    const tierIds = new Set(initialTiers.map((t) => t.id));
    let newTierId: string | null;
    let overItemId: string | null = null;

    if (overId === "unranked") {
      newTierId = null;
    } else if (tierIds.has(overId)) {
      newTierId = overId;
    } else {
      overItemId = overId;
      newTierId = positions[overItemId] ?? null;
    }

    // Items already in the target tier, excluding the dragged item
    const filteredItems = items
      .filter((item) => positions[item.id] === newTierId && item.id !== itemId)
      .sort((a, b) => (ranks[a.id] ?? 0) - (ranks[b.id] ?? 0));

    let insertIndex = filteredItems.length; // default: append
    if (overItemId) {
      const idx = filteredItems.findIndex((item) => item.id === overItemId);
      if (idx !== -1) insertIndex = idx;
    }

    return { tierId: newTierId, insertIndex, filteredItems };
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) { setDropTarget(null); return; }
    const { tierId, insertIndex } = computeDropTarget(
      active.id as string,
      over.id as string,
    );
    setDropTarget({ tierId, insertIndex });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setDropTarget(null);
    if (!over) return;

    const itemId = active.id as string;
    const { tierId: newTierId, insertIndex, filteredItems } = computeDropTarget(
      itemId,
      over.id as string,
    );
    const oldTierId = positions[itemId] ?? null;

    if (newTierId !== oldTierId) {
      setPositions((prev) => ({ ...prev, [itemId]: newTierId }));
    }

    const reordered = [...filteredItems];
    reordered.splice(insertIndex, 0, items.find((i) => i.id === itemId)!);

    const newRanks: Record<string, number> = {};
    reordered.forEach((item, index) => { newRanks[item.id] = index; });

    // Skip no-op same-tier reorders
    if (newTierId === oldTierId && reordered.every((item, i) => (ranks[item.id] ?? 0) === i)) return;

    setRanks((prev) => ({ ...prev, ...newRanks }));

    if (isOwner) {
      Object.entries(newRanks).forEach(([id, rank]) => {
        updateItemTier.mutate({ id, tierId: newTierId, rank });
      });
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClearRanking() {
    const newPositions: Record<string, string | null> = {};
    const newRanks: Record<string, number> = {};
    items.forEach((item, i) => {
      newPositions[item.id] = null;
      newRanks[item.id] = i;
    });
    setPositions(newPositions);
    setRanks(newRanks);
    if (isOwner) {
      items.forEach((item, i) => {
        updateItemTier.mutate({ id: item.id, tierId: null, rank: i });
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={handleClearRanking}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear ranking
        </button>
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Link className="h-3.5 w-3.5" />
              Share
            </>
          )}
        </button>
      </div>

      <DndContext
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        collisionDetection={pointerWithin}
      >
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          {initialTiers.map((tier, i) => (
            <TierRow
              key={tier.id}
              tier={tier}
              items={getItemsInTier(tier.id)}
              isLast={i === initialTiers.length - 1}
              isDragging={!!activeId}
              activeId={activeId}
              dropTarget={dropTarget}
              onPlayClick={setPreviewVideoId}
            />
          ))}
        </div>

        <UnrankedPool
          items={getItemsInTier(null)}
          isDragging={!!activeId}
          activeId={activeId}
          dropTarget={dropTarget}
          onPlayClick={setPreviewVideoId}
        />

        <DragOverlay dropAnimation={null}>
          {activeItem && <ItemCard item={activeItem} isOverlay />}
        </DragOverlay>
      </DndContext>

      {/* Video preview dialog */}
      <Dialog open={!!previewVideoId} onOpenChange={(open) => !open && setPreviewVideoId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{items.find((i) => i.id === previewVideoId)?.label || "Video"}</DialogTitle>
          </DialogHeader>
          <VideoPreview item={items.find((i) => i.id === previewVideoId)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TierRow({
  tier,
  items,
  isLast,
  isDragging,
  activeId,
  dropTarget,
  onPlayClick,
}: {
  tier: Tier;
  items: Item[];
  isLast: boolean;
  isDragging: boolean;
  activeId: string | null;
  dropTarget: { tierId: string | null; insertIndex: number } | null;
  onPlayClick?: (itemId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tier.id });

  return (
    <div className={`flex min-h-[5.5rem] ${!isLast ? "border-b border-zinc-800" : ""}`}>
      {/* Label cell */}
      <div
        className="flex w-16 shrink-0 items-center justify-center text-xl font-black sm:w-20"
        style={{ backgroundColor: tier.color + "22", borderRight: `3px solid ${tier.color}` }}
      >
        <span style={{ color: tier.color }}>{tier.label}</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-wrap content-start gap-2 p-2 transition-colors ${
          isOver ? "bg-white/5" : isDragging ? "bg-white/[0.02]" : ""
        }`}
      >
        {(() => {
          const visible = items.filter((item) => item.id !== activeId);
          const isTarget = dropTarget?.tierId === tier.id;
          return visible.map((item, idx) => (
            <span key={item.id} className="contents">
              {isTarget && dropTarget!.insertIndex === idx && <Placeholder />}
              <DraggableItem item={item} onPlayClick={onPlayClick} />
            </span>
          )).concat(
            isTarget && dropTarget!.insertIndex >= visible.length
              ? [<Placeholder key="placeholder-end" />]
              : []
          );
        })()}
      </div>
    </div>
  );
}

function UnrankedPool({ items, isDragging, activeId, dropTarget, onPlayClick }: {
  items: Item[];
  isDragging: boolean;
  activeId: string | null;
  dropTarget: { tierId: string | null; insertIndex: number } | null;
  onPlayClick?: (itemId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unranked" });

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-zinc-500">
        Unranked{items.length > 0 ? ` · ${items.length}` : ""}
      </p>
      <div
        ref={setNodeRef}
        className={`min-h-20 rounded-xl border p-3 transition-colors ${
          isOver
            ? "border-zinc-600 bg-white/5"
            : isDragging
            ? "border-zinc-700 bg-white/[0.02]"
            : "border-zinc-800"
        }`}
      >
        {items.length === 0 && !isDragging ? (
          <p className="flex h-14 items-center justify-center text-sm text-zinc-600">
            Drag items here to unrank them
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(() => {
              const visible = items.filter((item) => item.id !== activeId);
              const isTarget = dropTarget?.tierId === null;
              return visible.map((item, idx) => (
                <span key={item.id} className="contents">
                  {isTarget && dropTarget!.insertIndex === idx && <Placeholder />}
                  <DraggableItem item={item} onPlayClick={onPlayClick} />
                </span>
              )).concat(
                isTarget && dropTarget!.insertIndex >= visible.length
                  ? [<Placeholder key="placeholder-end" />]
                  : []
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function Placeholder() {
  return (
    <div className="h-20 w-20 shrink-0 rounded-lg border-2 border-dashed border-zinc-500 bg-zinc-800/30" />
  );
}

function DraggableItem({ item, onPlayClick }: { item: Item; onPlayClick?: (itemId: string) => void }) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: item.id,
  });
  const { setNodeRef: setDropRef } = useDroppable({ id: item.id });

  const setRef = (el: HTMLElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  return (
    <div
      ref={setRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
      {...attributes}
      {...listeners}
    >
      <ItemCard item={item} onPlayClick={onPlayClick} />
    </div>
  );
}

function ItemCard({ item, isOverlay, onPlayClick }: { item: Item; isOverlay?: boolean; onPlayClick?: (itemId: string) => void }) {
  const base = `relative h-20 w-20 overflow-hidden rounded-lg border transition-shadow ${
    isOverlay ? "border-blue-500 shadow-2xl shadow-blue-500/20" : "border-zinc-700"
  }`;

  if (item.type === "image" && item.imageUrl) {
    return (
      <div className={base}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={item.label} className="h-full w-full object-cover" draggable={false} />
        {item.label && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 pb-1 pt-3">
            <p className="truncate text-center text-[10px] text-white">{item.label}</p>
          </div>
        )}
      </div>
    );
  }

  if (item.type === "video") {
    // Check if we have a thumbnail image (either from uploaded video or YouTube)
    const hasThumbnail = !!item.imageUrl;

    return (
      <div className={`${base} group relative flex flex-col items-center justify-center gap-1 ${hasThumbnail ? "bg-black" : "bg-zinc-800/80"}`}>
        {hasThumbnail && item.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={item.label} className="h-full w-full object-cover" draggable={false} />
            {item.label && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 pb-1 pt-3">
                <p className="truncate text-center text-[10px] text-white">{item.label}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <Video className="h-6 w-6 text-purple-400" />
            {item.label && (
              <p className="line-clamp-2 px-1 text-center text-[10px] text-zinc-300">{item.label}</p>
            )}
          </>
        )}
        {onPlayClick && item.videoUrl && !isOverlay && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPlayClick(item.id);
            }}
            className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded bg-black/60 transition-all hover:bg-black/80"
            title="Watch video"
          >
            <Play className="h-4 w-4 text-white" fill="white" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`${base} flex items-center justify-center bg-zinc-800/80 p-2`}>
      <p className="line-clamp-4 text-center text-[11px] font-medium leading-tight text-white">
        {item.label || <Type className="h-4 w-4 text-zinc-500" />}
      </p>
    </div>
  );
}

function VideoPreview({ item }: { item?: Item }) {
  if (!item || item.type !== "video") {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500">
        No video selected
      </div>
    );
  }

  const videoUrl = item.videoUrl;
  if (!videoUrl) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500">
        Video URL not available
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center bg-black rounded-lg overflow-hidden">
      {videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be") ? (
        // YouTube video - embed it
        <iframe
          width="100%"
          height="400"
          src={getYouTubeEmbedUrl(videoUrl)}
          title={item.label || "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="rounded-lg"
        />
      ) : (
        // Local video file
        <video
          src={videoUrl}
          controls
          className="w-full max-h-[400px] rounded-lg"
          title={item.label || "Video"}
        />
      )}
    </div>
  );
}

function getYouTubeEmbedUrl(url: string): string {
  const videoId = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
  )?.[1];
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
}
