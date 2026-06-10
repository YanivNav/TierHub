import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

export default async function HomePage() {
  const { userId } = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-950 text-white">
      <div className="container flex flex-col items-center gap-8 px-4 py-16 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
          Tier<span className="text-blue-500">Hub</span>
        </h1>
        <p className="max-w-xl text-lg text-zinc-400">
          Create beautiful tier lists with text, images, videos, and AI-powered
          suggestions. Share with the world.
        </p>
        <div className="flex gap-4">
          {userId ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-up"
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500"
              >
                Get Started
              </Link>
              <Link
                href="/sign-in"
                className="rounded-lg border border-zinc-600 px-6 py-3 font-semibold transition hover:border-zinc-400"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
