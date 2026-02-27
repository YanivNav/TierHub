import TierListForm from "@/components/tier-list-form";

export default function NewTierListPage() {
  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-3xl font-bold">New Tier List</h1>
        <TierListForm mode="create" />
      </div>
    </main>
  );
}
