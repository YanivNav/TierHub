import DiscoverListCard from "@/components/discover-list-card";
import type { DiscoverList } from "@/server/db/discover";

/** A titled section: heading + responsive grid of public list cards. */
export default function DiscoverSection({
  title,
  icon,
  lists,
  thumbs,
}: {
  title: string;
  icon?: React.ReactNode;
  lists: DiscoverList[];
  thumbs: Map<string, string[]>;
}) {
  if (lists.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
        {icon}
        {title}
      </h2>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {lists.map((list) => (
          <DiscoverListCard
            key={list.id}
            list={list}
            images={thumbs.get(list.id) ?? []}
          />
        ))}
      </div>
    </section>
  );
}
