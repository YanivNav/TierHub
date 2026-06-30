"use client";

import { useState, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus } from "lucide-react";

export type PendingTier = {
  localId: string;
  dbId?: string;
  label: string;
  color: string;
};

export default function TierEditor({
  tiers,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}: {
  tiers: PendingTier[];
  onAdd: () => void;
  onUpdate: (localId: string, data: { label?: string; color?: string }) => void;
  onDelete: (localId: string) => void;
  onReorder: (activeId: string, overId: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tiers.map((t) => t.localId)} strategy={verticalListSortingStrategy}>
          {tiers.map((tier, i) => (
            <TierRow
              key={tier.localId}
              tier={tier}
              isLast={i === tiers.length - 1}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        Add tier
      </button>
    </div>
  );
}

function TierRow({
  tier,
  isLast,
  onUpdate,
  onDelete,
}: {
  tier: PendingTier;
  isLast: boolean;
  onUpdate: (localId: string, data: { label?: string; color?: string }) => void;
  onDelete: (localId: string) => void;
}) {
  const [label, setLabel] = useState(tier.label);
  const colorRef = useRef<HTMLInputElement>(null);

  useEffect(() => setLabel(tier.label), [tier.label]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tier.localId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
  };

  function handleLabelBlur() {
    const trimmed = label.trim();
    if (!trimmed) { setLabel(tier.label); return; }
    if (trimmed !== tier.label) onUpdate(tier.localId, { label: trimmed });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 bg-card px-4 py-3 ${!isLast ? "border-b border-border" : ""}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-muted-foreground active:cursor-grabbing"
        tabIndex={-1}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Color swatch */}
      <button
        type="button"
        onClick={() => colorRef.current?.click()}
        title="Change color"
        className="h-5 w-5 shrink-0 rounded-full border-2 border-white/10 transition-transform hover:scale-110"
        style={{ backgroundColor: tier.color }}
      />
      <input
        ref={colorRef}
        type="color"
        value={tier.color}
        onChange={(e) => onUpdate(tier.localId, { color: e.target.value })}
        className="sr-only"
      />

      {/* Accent bar */}
      <div className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: tier.color }} />

      {/* Label */}
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={handleLabelBlur}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        maxLength={30}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
        style={{ color: tier.color }}
        placeholder="Tier name"
      />

      {/* Delete */}
      <button
        type="button"
        onClick={() => onDelete(tier.localId)}
        title="Delete tier"
        className="rounded p-1 text-muted-foreground hover:bg-red-500/20 hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
