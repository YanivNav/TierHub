"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Video,
  Type,
  Link,
  Check,
  Play,
  RotateCcw,
  GitFork,
  Copy,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ScreenshotButton from "@/components/screenshot-button";
import { getYouTubeVideoId, getYouTubeEmbedUrl } from "@/lib/youtube";

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

const UNRANKED = "unranked";

// Stable empty reference so SortableContext's `items` identity doesn't churn.
const EMPTY_IDS: string[] = [];

/** Map of container id (tier id or UNRANKED) → ordered list of item ids. */
type Containers = Record<string, string[]>;

export default function TierBoard({
  tierListId,
  tiers: initialTiers,
  items,
  isOwner,
  ownerPlan,
}: {
  tierListId: string;
  tiers: Tier[];
  items: Item[];
  isOwner: boolean;
  ownerPlan?: "free" | "pro";
}) {
  const itemMap = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item])),
    [items]
  );

  const containerIds = useMemo(
    () => [...initialTiers.map((t) => t.id), UNRANKED],
    [initialTiers]
  );

  // Source of truth while interacting: each container's ordered item ids.
  const [containers, setContainers] = useState<Containers>(() => {
    const grouped: Containers = Object.fromEntries(
      containerIds.map((id) => [id, [] as string[]])
    );
    [...items]
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      .forEach((item) => {
        const cid = item.tierId ?? UNRANKED;
        (grouped[cid] ?? grouped[UNRANKED]).push(item.id);
      });
    return grouped;
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Container the dragged item started in, so we know which lists to persist.
  const sourceContainerRef = useRef<string | null>(null);
  // Stabilizers for the multi-container collision strategy.
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedToNewContainer = useRef(false);

  const duplicateMutation = trpc.tierList.duplicate.useMutation({
    onSuccess: ({ id }) => router.push(`/dashboard/${id}`),
  });
  const updateItemTier = trpc.item.updateTier.useMutation();

  const sensors = useSensors(
    // Small activation distance so a click (e.g. the play button) never starts a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeItem = activeId ? itemMap[activeId] : null;

  function findContainer(id: string): string | undefined {
    if (id in containers) return id;
    return containerIds.find((cid) => containers[cid]?.includes(id));
  }

  /** Persist the given containers' items with their new tier + rank. */
  function persist(state: Containers, touched: (string | null | undefined)[]) {
    if (!isOwner) return;
    const unique = Array.from(new Set(touched.filter(Boolean))) as string[];
    unique.forEach((cid) => {
      const tierId = cid === UNRANKED ? null : cid;
      state[cid]?.forEach((id, index) => {
        updateItemTier.mutate({ id, tierId, rank: index });
      });
    });
  }

  /** Custom collision detection for the multi-container grid:
   *  prefer pointer-based hits, and when hovering a container's empty area,
   *  fall back to the closest item *inside* that container. Keeps empty tiers
   *  droppable while still snapping to the nearest slot. */
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const pointerCollisions = pointerWithin(args);
      const intersections =
        pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
      let overId = getFirstCollision(intersections, "id");

      if (overId != null) {
        // Hovering a container's empty area → snap to the closest item inside it.
        if (typeof overId === "string" && overId in containers) {
          const itemsInContainer = containers[overId];
          if (itemsInContainer.length > 0) {
            const closest = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (c) =>
                  c.id !== overId &&
                  itemsInContainer.includes(c.id as string)
              ),
            });
            if (closest.length > 0) overId = closest[0].id;
          }
        }
        lastOverId.current = overId;
        return [{ id: overId }];
      }

      // Pointer is momentarily over no droppable (label column, row borders,
      // board edges). Hold the last valid target so the gap doesn't flicker.
      if (recentlyMovedToNewContainer.current) {
        lastOverId.current = activeId;
      }
      return lastOverId.current != null ? [{ id: lastOverId.current }] : [];
    },
    [activeId, containers]
  );

  // Reset the "just moved containers" flag after the resulting re-render.
  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false;
    });
  }, [containers]);

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    setActiveId(id);
    sourceContainerRef.current = findContainer(id) ?? null;
    lastOverId.current = id;
  }

  // Live cross-container moves: as soon as the item hovers a different
  // container, move it there so the opening gap reflects the real drop target.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const id = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(id);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer || activeContainer === overContainer)
      return;

    recentlyMovedToNewContainer.current = true;
    setContainers((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const overIndex = overItems.indexOf(overId);
      const newIndex = overId in prev ? overItems.length : Math.max(overIndex, 0);

      return {
        ...prev,
        [activeContainer]: activeItems.filter((x) => x !== id),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          id,
          ...overItems.slice(newIndex),
        ],
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const id = active.id as string;
    const source = sourceContainerRef.current;
    sourceContainerRef.current = null;
    setActiveId(null);

    if (!over) return;
    const overId = over.id as string;
    const overContainer = findContainer(overId);
    const activeContainer = findContainer(id);
    if (!activeContainer || !overContainer) return;

    let finalState = containers;
    let changed = source !== overContainer; // crossed containers during drag

    if (activeContainer === overContainer) {
      const list = containers[overContainer];
      const oldIndex = list.indexOf(id);
      const newIndex = list.indexOf(overId);
      if (newIndex !== -1 && oldIndex !== newIndex) {
        finalState = {
          ...containers,
          [overContainer]: arrayMove(list, oldIndex, newIndex),
        };
        setContainers(finalState);
        changed = true;
      }
    }

    if (changed) persist(finalState, [source, overContainer]);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClearRanking() {
    const ordered = [...items]
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      .map((item) => item.id);
    const cleared: Containers = Object.fromEntries(
      containerIds.map((id) => [id, id === UNRANKED ? ordered : []])
    );
    setContainers(cleared);
    if (isOwner) {
      ordered.forEach((id, i) => {
        updateItemTier.mutate({ id, tierId: null, rank: i });
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={handleClearRanking}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear ranking
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => duplicateMutation.mutate({ id: tierListId })}
            disabled={duplicateMutation.isPending}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-50"
          >
            {isOwner ? (
              <>
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </>
            ) : (
              <>
                <GitFork className="h-3.5 w-3.5" />
                Remix
              </>
            )}
          </button>
          <ScreenshotButton captureRef={captureRef} />
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
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
      </div>

      <DndContext
        id="tier-board-dnd"
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div ref={captureRef} className="relative overflow-hidden rounded-xl border border-border">
          {initialTiers.map((tier, i) => (
            <div key={tier.id}>
              <TierRow
                tier={tier}
                itemIds={containers[tier.id] ?? EMPTY_IDS}
                itemMap={itemMap}
                isLast={i === initialTiers.length - 1}
                isDragging={!!activeId}
                onPlayClick={setPreviewVideoId}
              />
              {i === 0 && ownerPlan === "free" && (
                <div className="pointer-events-none relative z-10 flex h-0 select-none justify-center">
                  <span className="-translate-y-full pb-0.5 text-[10px] font-medium tracking-wide text-foreground/30">
                    Made with TierHub
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <UnrankedPool
          itemIds={containers[UNRANKED] ?? EMPTY_IDS}
          itemMap={itemMap}
          isDragging={!!activeId}
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

function tierLabelSize(label: string): string {
  const len = label.length;
  if (len <= 2) return "text-xl";
  if (len <= 4) return "text-lg";
  if (len <= 7) return "text-sm";
  return "text-xs";
}

function TierRow({
  tier,
  itemIds,
  itemMap,
  isLast,
  isDragging,
  onPlayClick,
}: {
  tier: Tier;
  itemIds: string[];
  itemMap: Record<string, Item>;
  isLast: boolean;
  isDragging: boolean;
  onPlayClick?: (itemId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tier.id });

  return (
    <div className={`flex min-h-22 ${!isLast ? "border-b border-border" : ""}`}>
      {/* Label cell */}
      <div
        className="flex w-16 shrink-0 items-center justify-center px-1 font-bold sm:w-20"
        style={{ backgroundColor: tier.color + "22", borderRight: `3px solid ${tier.color}` }}
      >
        <span
          className={`w-full wrap-break-words text-center leading-tight ${tierLabelSize(tier.label)}`}
          style={{ color: tier.color, fontFamily: "system-ui, sans-serif" }}
        >
          {tier.label}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-wrap content-start gap-2 p-2 transition-colors ${
          isOver ? "bg-white/5" : isDragging ? "bg-white/2" : ""
        }`}
      >
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          {itemIds.map((id) => {
            const item = itemMap[id];
            return item ? (
              <SortableItem key={id} item={item} onPlayClick={onPlayClick} />
            ) : null;
          })}
        </SortableContext>
      </div>
    </div>
  );
}

function UnrankedPool({ itemIds, itemMap, isDragging, onPlayClick }: {
  itemIds: string[];
  itemMap: Record<string, Item>;
  isDragging: boolean;
  onPlayClick?: (itemId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNRANKED });

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        Unranked{itemIds.length > 0 ? ` · ${itemIds.length}` : ""}
      </p>
      <div
        ref={setNodeRef}
        className={`min-h-20 rounded-xl border p-3 transition-colors ${
          isOver
            ? "border-border bg-white/5"
            : isDragging
            ? "border-border bg-white/2"
            : "border-border"
        }`}
      >
        {itemIds.length === 0 && !isDragging ? (
          <p className="flex h-14 items-center justify-center text-sm text-muted-foreground">
            Drag items here to unrank them
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <SortableContext items={itemIds} strategy={rectSortingStrategy}>
              {itemIds.map((id) => {
                const item = itemMap[id];
                return item ? (
                  <SortableItem key={id} item={item} onPlayClick={onPlayClick} />
                ) : null;
              })}
            </SortableContext>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableItem({ item, onPlayClick }: { item: Item; onPlayClick?: (itemId: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`touch-none cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
      {...attributes}
      {...listeners}
    >
      <ItemCard item={item} onPlayClick={onPlayClick} />
    </div>
  );
}

function ItemCard({ item, isOverlay, onPlayClick }: { item: Item; isOverlay?: boolean; onPlayClick?: (itemId: string) => void }) {
  const base = `relative h-20 w-20 overflow-hidden rounded-lg border transition-shadow ${
    isOverlay ? "border-blue-500 shadow-2xl shadow-blue-500/20" : "border-border"
  }`;

  if (item.type === "image" && item.imageUrl) {
    return (
      <div className={base} title={item.label || undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={item.label} className="h-full w-full object-cover" draggable={false} />
        {item.label && (
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent px-1 pb-1 pt-3">
            <p className="truncate text-center text-[10px] text-white">{item.label}</p>
          </div>
        )}
      </div>
    );
  }

  if (item.type === "video") {
    const hasThumbnail = !!item.imageUrl;

    return (
      <div className={`${base} flex flex-col items-center justify-center gap-1 ${hasThumbnail ? "bg-background" : "bg-muted/80"}`} title={item.label || undefined}>
        {hasThumbnail && item.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={item.label} className="h-full w-full object-cover" draggable={false} />
            {item.label && (
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent px-1 pb-1 pt-3">
                <p className="truncate text-center text-[10px] text-white">{item.label}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <Video className="h-6 w-6 text-purple-400" />
            {item.label && (
              <p className="line-clamp-2 px-1 text-center text-[10px] text-muted-foreground">{item.label}</p>
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
    <div className={`${base} flex items-center justify-center bg-muted/80 p-2`} title={item.label || undefined}>
      <p className="line-clamp-4 text-center text-[11px] font-medium leading-tight text-foreground">
        {item.label || <Type className="h-4 w-4 text-muted-foreground" />}
      </p>
    </div>
  );
}

function VideoPreview({ item }: { item?: Item }) {
  if (!item || item.type !== "video") {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        No video selected
      </div>
    );
  }

  const videoUrl = item.videoUrl;
  if (!videoUrl) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        Video URL not available
      </div>
    );
  }

  // Only embed a YouTube iframe when we can extract a real video id from a
  // genuine youtube.com/youtu.be URL. Never fall back to embedding an arbitrary
  // url as the iframe src — that allowed stored XSS (e.g. a `javascript:` url
  // that merely contained the substring "youtube.com").
  const youTubeId = getYouTubeVideoId(videoUrl);

  return (
    <div className="flex items-center justify-center bg-black rounded-lg overflow-hidden">
      {youTubeId ? (
        <iframe
          width="100%"
          height="400"
          src={getYouTubeEmbedUrl(youTubeId)}
          title={item.label || "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="rounded-lg"
        />
      ) : (
        // Uploaded video file (served from our own R2 bucket).
        <video
          src={videoUrl}
          controls
          className="w-full max-h-100 rounded-lg"
          title={item.label || "Video"}
        />
      )}
    </div>
  );
}
