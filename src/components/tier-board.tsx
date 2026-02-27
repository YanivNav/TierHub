"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Video, Type, Link, Check } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

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
  imageUrl: string | null;
  videoUrl: string | null;
};

export default function TierBoard({
  tiers,
  items,
  isOwner,
}: {
  tiers: Tier[];
  items: Item[];
  isOwner: boolean;
}) {
  const [positions, setPositions] = useState<Record<string, string | null>>(
    () => Object.fromEntries(items.map((item) => [item.id, item.tierId]))
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const updateTier = trpc.item.updateTier.useMutation();

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  function getItemsInTier(tierId: string | null) {
    return items.filter((item) => positions[item.id] === tierId);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const itemId = active.id as string;
    const newTierId = over.id === "unranked" ? null : (over.id as string);
    const currentTierId = positions[itemId];
    if (newTierId === currentTierId) return;

    setPositions((prev) => ({ ...prev, [itemId]: newTierId }));
    if (isOwner) updateTier.mutate({ id: itemId, tierId: newTierId, rank: 0 });
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const unrankedItems = getItemsInTier(null);

  return (
    <div className="space-y-4">
      {/* Share button */}
      <div className="flex justify-end">
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
        onDragEnd={handleDragEnd}
        collisionDetection={pointerWithin}
      >
        {/* Tier rows */}
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          {tiers.map((tier, i) => (
            <TierRow
              key={tier.id}
              tier={tier}
              items={getItemsInTier(tier.id)}
              isLast={i === tiers.length - 1}
              isDragging={!!activeId}
              isOwner={isOwner}
            />
          ))}
        </div>

        {/* Unranked pool */}
        <UnrankedPool
          items={unrankedItems}
          isDragging={!!activeId}
          isOwner={isOwner}
        />

        <DragOverlay dropAnimation={null}>
          {activeItem && <ItemCard item={activeItem} isOverlay />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function TierRow({
  tier,
  items,
  isLast,
  isDragging,
  isOwner,
}: {
  tier: Tier;
  items: Item[];
  isLast: boolean;
  isDragging: boolean;
  isOwner: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tier.id });

  return (
    <div
      className={`flex min-h-[5.5rem] ${!isLast ? "border-b border-zinc-800" : ""}`}
    >
      {/* Tier label */}
      <div
        className="flex w-16 shrink-0 items-center justify-center text-xl font-black sm:w-20"
        style={{
          backgroundColor: tier.color + "22",
          borderRight: `3px solid ${tier.color}`,
        }}
      >
        <span style={{ color: tier.color }}>{tier.label}</span>
      </div>

      {/* Drop area */}
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-wrap content-start gap-2 p-2 transition-colors ${
          isOver ? "bg-white/5" : isDragging ? "bg-white/[0.02]" : ""
        }`}
      >
        {items.map((item) => (
          <DraggableItem key={item.id} item={item} isOwner={isOwner} />
        ))}
      </div>
    </div>
  );
}

function UnrankedPool({
  items,
  isDragging,
  isOwner,
}: {
  items: Item[];
  isDragging: boolean;
  isOwner: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unranked" });

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-zinc-500">
        Unranked{items.length > 0 ? ` · ${items.length}` : ""}
      </p>
      <div
        ref={setNodeRef}
        className={`min-h-20 rounded-xl border transition-colors ${
          isOver
            ? "border-zinc-600 bg-white/5"
            : isDragging
            ? "border-zinc-700 bg-white/[0.02]"
            : "border-zinc-800"
        } p-3`}
      >
        {items.length === 0 && !isDragging ? (
          <p className="flex h-14 items-center justify-center text-sm text-zinc-600">
            Drag items here to unrank them
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <DraggableItem key={item.id} item={item} isOwner={isOwner} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableItem({ item, isOwner }: { item: Item; isOwner: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={`cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <ItemCard item={item} />
    </div>
  );
}

function ItemCard({ item, isOverlay }: { item: Item; isOverlay?: boolean }) {
  const base = `relative h-20 w-20 overflow-hidden rounded-lg border transition-shadow ${
    isOverlay
      ? "border-blue-500 shadow-2xl shadow-blue-500/20"
      : "border-zinc-700"
  }`;

  if (item.type === "image" && item.imageUrl) {
    return (
      <div className={base}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.label}
          className="h-full w-full object-cover"
          draggable={false}
        />
        {item.label && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 pb-1 pt-3">
            <p className="truncate text-center text-[10px] text-white">
              {item.label}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (item.type === "video") {
    return (
      <div
        className={`${base} flex flex-col items-center justify-center gap-1 bg-zinc-800/80`}
      >
        <Video className="h-6 w-6 text-purple-400" />
        {item.label && (
          <p className="line-clamp-2 px-1 text-center text-[10px] text-zinc-300">
            {item.label}
          </p>
        )}
      </div>
    );
  }

  // Text
  return (
    <div
      className={`${base} flex items-center justify-center bg-zinc-800/80 p-2`}
    >
      <p className="line-clamp-4 text-center text-[11px] font-medium leading-tight text-white">
        {item.label || <Type className="h-4 w-4 text-zinc-500" />}
      </p>
    </div>
  );
}
