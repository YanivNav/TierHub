import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Tier Lists</h1>
          <Link
            href="/dashboard/new"
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold transition hover:bg-blue-500"
          >
            + New List
          </Link>
        </div>
        <p className="text-zinc-400">
          Your tier lists will appear here. Create your first one!
        </p>
      </div>
    </main>
  );
}
