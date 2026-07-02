"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  // Better Auth appends ?error=... to the redirect when the token is bad/expired.
  const linkError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !token) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError("");

    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setSubmitting(false);
    if (error) {
      setError("This reset link is invalid or has expired. Request a new one.");
      return;
    }
    setDone(true);
  };

  if (!token || linkError) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-border bg-card/60 p-6 text-center shadow-xl">
        <h1 className="text-2xl font-bold text-foreground">Invalid link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-border bg-card/60 p-6 text-center shadow-xl">
        <h1 className="text-2xl font-bold text-foreground">Password updated</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You can now sign in with your new password.
        </p>
        <Button
          className="mt-6 w-full bg-blue-600 hover:bg-blue-500"
          onClick={() => router.push("/sign-in")}
        >
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-card/60 p-6 shadow-xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Set a new password</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-foreground">
            New password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-foreground">
            Confirm password
          </Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter password"
          />
        </div>

        <p className="text-sm text-red-400">{error || " "}</p>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-500"
        >
          {submitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
