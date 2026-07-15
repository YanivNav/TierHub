"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Settings, Sparkles, User as UserIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";

export default function UserMenu() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  const router = useRouter();
  const billing = trpc.billing.getStatus.useQuery(undefined, {
    enabled: !!session,
    staleTime: 60_000,
  });

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isPending || !user) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />;
  }

  const email = user.email ?? "";
  const name = user.name ?? user.username ?? email.split("@")[0] ?? "Account";
  const initial = (name[0] ?? "?").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-semibold text-foreground transition hover:ring-2 hover:ring-border"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={name} className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        >
          <div className="flex items-center gap-3 border-b border-border p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-semibold text-foreground">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt={name} className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
              {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
            </div>
          </div>

          {/* Credit balance */}
          {billing.data && (
            <div className="border-b border-border px-3 pb-3 pt-2">
              {(() => {
                const b = billing.data;
                const pct =
                  b.monthlyAllowance > 0
                    ? Math.round((b.monthlyRemaining / b.monthlyAllowance) * 100)
                    : 0;
                const barColor =
                  pct > 50
                    ? "bg-emerald-500"
                    : pct > 25
                      ? "bg-amber-500"
                      : "bg-red-500";
                return (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        AI Usage Credits
                      </span>
                      <span className="font-medium tabular-nums">
                        {b.totalCredits} left
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      />
                    </div>
                    {b.purchasedCredits > 0 && (
                      <p className="mt-1 text-[10px] leading-none text-muted-foreground">
                        +{b.purchasedCredits} purchased
                      </p>
                    )}
                    {b.plan === "free" && (
                      <Link
                        href="/pricing"
                        onClick={() => setOpen(false)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-violet-400 hover:text-violet-300"
                      >
                        <Sparkles className="h-3 w-3" />
                        Upgrade for more
                      </Link>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          <div className="p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                router.push("/dashboard");
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <UserIcon className="h-4 w-4" />
              My Tier Lists
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                router.push("/settings");
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                await authClient.signOut();
                router.replace("/");
                router.refresh();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
