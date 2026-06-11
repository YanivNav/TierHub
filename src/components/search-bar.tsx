"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/** Top-bar search: navigates to /search?q=… (shareable, server-rendered results). */
export default function SearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form onSubmit={submit} className={className} role="search">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search tier lists…"
          aria-label="Search tier lists"
          className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 pl-8 pr-3 text-sm text-white
          placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
      </div>
    </form>
  );
}
