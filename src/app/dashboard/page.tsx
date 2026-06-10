import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/server/db";
import { tierLists } from "@/server/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const lists = await db
    .select()
    .from(tierLists)
    .where(eq(tierLists.userId, userId))
    .orderBy(desc(tierLists.createdAt));

  return (
    <main className="flex-1 bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Tier Lists</h1>
          <Button asChild className="bg-blue-600 hover:bg-blue-500">
            <Link href="/dashboard/new">+ New List</Link>
          </Button>
        </div>

        {lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-zinc-700 py-24 text-center">
            <p className="text-zinc-400">No tier lists yet.</p>
            <Button asChild className="bg-blue-600 hover:bg-blue-500">
              <Link href="/dashboard/new">Create your first one</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <Card
                key={list.id}
                className="flex flex-col border-zinc-800 bg-zinc-900 text-white"
              >
                <CardHeader className="flex-1">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {list.title}
                    </CardTitle>
                    <Badge
                      variant={list.isPublic ? "default" : "secondary"}
                      className="shrink-0 text-xs"
                    >
                      {list.isPublic ? "Public" : "Private"}
                    </Badge>
                  </div>
                  {list.description && (
                    <CardDescription className="line-clamp-2 text-zinc-400">
                      {list.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardFooter className="flex items-center justify-between border-t border-zinc-800 pt-3">
                  <span className="text-xs text-zinc-500">
                    {new Date(list.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="text-zinc-400 hover:text-white"
                    >
                      <Link href={`/tier-lists/${list.id}`}>View</Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-zinc-300 hover:text-white"
                    >
                      <Link href={`/dashboard/${list.id}`}>Edit</Link>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
