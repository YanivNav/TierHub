"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/**
 * Checkout CTA for the pricing page. Authenticated users go straight to Polar
 * checkout; signed-out visitors are routed to sign-up first (checkout requires
 * an account so the subscription attaches to their user).
 */
export function CheckoutButton({
  slug,
  label,
  isAuthed,
  variant,
  className,
}: {
  slug: string;
  label: string;
  isAuthed: boolean;
  variant?: "default" | "outline";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (!isAuthed) {
    return (
      <Button asChild variant={variant} className={className}>
        <Link href={`/sign-up?next=/pricing`}>{label}</Link>
      </Button>
    );
  }

  const go = async () => {
    setError(false);
    setBusy(true);
    try {
      await authClient.checkout({ slug });
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <Button variant={variant} disabled={busy} onClick={go} className="w-full">
        {busy ? "Redirecting…" : label}
      </Button>
      {error && (
        <p className="mt-1 text-xs text-destructive">Couldn&apos;t start checkout.</p>
      )}
    </div>
  );
}
