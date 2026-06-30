"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function DangerSection() {
  const router = useRouter();
  const { signOut } = useClerk();
  const me = trpc.user.getMe.useQuery();

  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const handle = me.data?.username ?? "";

  const deleteAccount = trpc.user.deleteAccount.useMutation({
    onSuccess: () => {
      // Session is gone server-side; clear it client-side and leave.
      void signOut(() => router.push("/"));
    },
    onError: () =>
      setError("Couldn't delete your account. Please try again."),
  });

  const canDelete = handle.length > 0 && confirm.trim().toLowerCase() === handle;

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-red-400">Danger zone</h2>
      <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
        <p className="text-sm font-medium text-foreground">Delete account</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently delete your account and every tier list you&apos;ve
          created. This can&apos;t be undone.
        </p>
        <Button
          className="mt-4 bg-red-600 text-white hover:bg-red-500"
          onClick={() => {
            setConfirm("");
            setError("");
            setOpen(true);
          }}
        >
          Delete account
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This permanently deletes your account and all of your tier lists.
              This can&apos;t be undone. Type{" "}
              <span className="font-medium text-foreground">@{handle}</span> to
              confirm.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={handle}
            autoComplete="off"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <DialogFooter>
            <Button
              variant="outline"
              className="border-border text-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
              disabled={deleteAccount.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={() => deleteAccount.mutate()}
              disabled={!canDelete || deleteAccount.isPending}
            >
              {deleteAccount.isPending ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
