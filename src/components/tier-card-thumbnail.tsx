import { cn } from "@/lib/utils";
import { toCookielessThumbnailUrl } from "@/lib/youtube";

/**
 * Card thumbnail with three fallback tiers:
 *   1. a manually-uploaded cover image (`coverImageUrl`)
 *   2. a collage built from the list's item images (computed at fetch time)
 *   3. a default colorful tier-list icon (text-only / empty lists)
 */
export default function TierCardThumbnail({
  coverImageUrl,
  images,
  className,
}: {
  coverImageUrl?: string | null;
  images: string[];
  className?: string;
}) {
  const wrapper = cn(
    "relative aspect-video w-full overflow-hidden bg-background",
    className
  );

  // 1. Manual cover
  if (coverImageUrl) {
    return (
      <div className={wrapper}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={toCookielessThumbnailUrl(coverImageUrl)}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  // 2. Collage of item images
  const pics = images.slice(0, 4);
  if (pics.length > 0) {
    return (
      <div className={wrapper}>
        <Collage pics={pics} />
      </div>
    );
  }

  // 3. Default icon
  return (
    <div className={wrapper}>
      <DefaultTierIcon />
    </div>
  );
}

function Collage({ pics }: { pics: string[] }) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = (src: string, key: number, cls?: string) => (
    <img
      key={key}
      src={toCookielessThumbnailUrl(src)}
      alt=""
      className={cn("h-full w-full object-cover", cls)}
    />
  );

  if (pics.length === 1) {
    return <div className="h-full w-full">{img(pics[0]!, 0)}</div>;
  }

  if (pics.length === 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-0.5">
        {pics.map((p, i) => img(p, i))}
      </div>
    );
  }

  if (pics.length === 3) {
    return (
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
        <div className="row-span-2 overflow-hidden">{img(pics[0]!, 0)}</div>
        <div className="overflow-hidden">{img(pics[1]!, 1)}</div>
        <div className="overflow-hidden">{img(pics[2]!, 2)}</div>
      </div>
    );
  }

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
      {pics.map((p, i) => (
        <div key={i} className="overflow-hidden">
          {img(p, i)}
        </div>
      ))}
    </div>
  );
}

function DefaultTierIcon() {
  const rows = [
    { label: "S", color: "#ef4444" },
    { label: "A", color: "#f97316" },
    { label: "B", color: "#eab308" },
    { label: "C", color: "#22c55e" },
  ];
  return (
    <div className="flex h-full w-full flex-col items-stretch justify-center gap-1 bg-card p-4">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-1.5">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold text-black/80"
            style={{ backgroundColor: r.color }}
          >
            {r.label}
          </span>
          <span
            className="h-2.5 flex-1 rounded-sm"
            style={{ backgroundColor: `${r.color}33` }}
          />
        </div>
      ))}
    </div>
  );
}
