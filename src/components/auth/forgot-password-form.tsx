"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setSubmitting(false);

    // Only surface rate limiting; otherwise always show the same confirmation so
    // we don't reveal whether an account exists for this email.
    if (error?.status === 429) {
      setError(getAuthErrorMessage(error, "sign-in"));
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-border bg-card/60 p-6 text-center shadow-xl">
        <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          If an account exists for{" "}
          <span className="text-foreground">{email}</span>, we&apos;ve sent a
          password reset link.
        </p>
        <Link
          href="/sign-in"
          className="mt-6 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-card/60 p-6 shadow-xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll email you a link to set a new one.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <p className="text-sm text-red-400">{error || " "}</p>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-500"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-blue-400 hover:text-blue-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
