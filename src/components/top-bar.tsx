"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Plus, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/user-menu";
import SearchBar from "@/components/search-bar";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "My Tier Lists" },
];

export default function TopBar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => setMounted(true), []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        {/* Logo → home */}
        <Link
          href="/"
          className="text-lg font-extrabold tracking-tight text-zinc-900 dark:text-white"
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
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-white"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Search - flexes to fill the middle on wider screens.
            Suspense satisfies Next's useSearchParams static-render requirement. */}
        <Suspense
          fallback={<div className="hidden h-9 max-w-md flex-1 md:block" />}
        >
          <SearchBar className="hidden max-w-md flex-1 md:block" />
        </Suspense>

        <div className="ml-auto flex items-center gap-2">
          {/* Theme toggle */}
          {mounted && (
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-white"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}

          {/* Avoid a flash before the session resolves. */}
          {isPending ? null : session ? (
            <>
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
            </>
          ) : (
            <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-500">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
