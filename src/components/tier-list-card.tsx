import Link from "next/link";
import TierCardThumbnail from "@/components/tier-card-thumbnail";

interface TierListCardProps {
  id: string;
  title: string;
  createdAt: Date | string;
  coverImageUrl?: string | null;
  images: string[];
  /** Badge overlaid on the thumbnail (e.g. "Public" / "Private") */
  badge?: React.ReactNode;
  /** Author row shown below the title (discover cards) */
  author?: React.ReactNode;
  /** Action row shown at the bottom (dashboard cards) */
  actions?: React.ReactNode;
}

export default function TierListCard({
  id,
  title,
  createdAt,
  coverImageUrl,
  images,
  badge,
  author,
  actions,
}: TierListCardProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-white">
      <Link href={`/tier-lists/${id}`} className="relative block">
        <TierCardThumbnail coverImageUrl={coverImageUrl} images={images} />
        {badge && (
          <span className="absolute right-2 top-2">{badge}</span>
        )}
      </Link>

      <div className="px-3 py-2">
        <Link
          href={`/tier-lists/${id}`}
          className="line-clamp-2 text-sm font-semibold leading-snug hover:text-blue-400"
        >
          {title}
        </Link>
        {author ? (
          <div className="mt-1">{author}</div>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">
            {new Date(createdAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {actions && (
        <div className="mt-auto flex items-center gap-1 border-t border-zinc-800 px-2 py-2">
          {actions}
        </div>
      )}
    </div>
  );
}
