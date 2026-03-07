"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";

export type PendingTier = {
  localId: string; // stable React key; equals dbId for existing tiers
  dbId?: string;   // undefined = new tier not yet in DB
  label: string;
  color: string;
};

export default function TierEditor({
  tiers,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
}: {
  tiers: PendingTier[];
  onAdd: () => void;
  onUpdate: (localId: string, data: { label?: string; color?: string }) => void;
  onDelete: (localId: string) => void;
  onMove: (localId: string, direction: "up" | "down") => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      {tiers.map((tier, i) => (
        <TierRow
          key={tier.localId}
          tier={tier}
          isFirst={i === 0}
          isLast={i === tiers.length - 1}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onMoveUp={() => onMove(tier.localId, "up")}
          onMoveDown={() => onMove(tier.localId, "down")}
        />
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 py-2.5 text-sm text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
      >
        <Plus className="h-4 w-4" />
        Add tier
      </button>
    </div>
  );
}

function TierRow({
  tier,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  tier: PendingTier;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (localId: string, data: { label?: string; color?: string }) => void;
  onDelete: (localId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  // Keep local label state for smooth typing; sync to parent on blur
  const [label, setLabel] = useState(tier.label);
  const colorRef = useRef<HTMLInputElement>(null);

  // Sync if parent resets the tier (e.g. after move)
  useEffect(() => setLabel(tier.label), [tier.label]);

  function handleLabelBlur() {
    const trimmed = label.trim();
    if (!trimmed) { setLabel(tier.label); return; }
    if (trimmed !== tier.label) onUpdate(tier.localId, { label: trimmed });
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${!isLast ? "border-b border-zinc-800" : ""}`}>
      {/* Color swatch → opens native color picker */}
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
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-zinc-500"
        style={{ color: tier.color }}
        placeholder="Tier name"
      />

      {/* Reorder + delete */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Move up"
          className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-20"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          title="Move down"
          className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-20"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(tier.localId)}
          title="Delete tier"
          className="rounded p-1 text-zinc-600 hover:bg-red-500/20 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
