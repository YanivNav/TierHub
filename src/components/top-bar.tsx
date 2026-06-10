"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Moon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/user-menu";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "My Tier Lists" },
];

export default function TopBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        {/* Logo → home */}
        <Link
          href="/"
          className="text-lg font-extrabold tracking-tight text-white"
        >
          Tier<span className="text-blue-500">Hub</span>
        </Link>

        {/* Primary nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive(item.href)
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Light/dark switch — UI only for now, not wired to actual theming */}
          <button
            type="button"
            aria-label="Toggle theme"
            title="Light / dark — coming soon"
            className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-white"
          >
            <Moon className="h-4 w-4" />
          </button>

          <SignedIn>
            <Button
              asChild
              size="sm"
              className="hidden bg-blue-600 hover:bg-blue-500 sm:inline-flex"
            >
              <Link href="/dashboard/new">
                <Plus className="mr-1 h-4 w-4" />
                New List
              </Link>
            </Button>
            <UserMenu />
          </SignedIn>

          <SignedOut>
            <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-500">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}
