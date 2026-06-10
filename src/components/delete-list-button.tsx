"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function DeleteListButton({
  id,
  title,
  label,
  redirectTo,
}: {
  id: string;
  title: string;
  /** When set, render a labelled button instead of an icon-only one. */
  label?: string;
  /** When set, navigate here after deleting instead of refreshing in place. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const del = trpc.tierList.delete.useMutation({
    onSuccess: () => {
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    },
  });

  return (
    <>
      <Button
        size="sm"
        variant={label ? "outline" : "ghost"}
        aria-label="Delete tier list"
        title="Delete"
        className={
          label
            ? "border-red-900/60 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            : "text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
        }
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        {label && <span className="ml-1.5">{label}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle>Delete tier list?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              <span className="font-medium text-zinc-200">{title}</span> and all
              of its tiers and items will be permanently deleted. This can&apos;t
              be undone.
            </DialogDescription>
          </DialogHeader>

          {del.isError && (
            <p className="text-sm text-red-400">
              Couldn&apos;t delete the list. Please try again.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:text-white"
              onClick={() => setOpen(false)}
              disabled={del.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={() => del.mutate({ id })}
              disabled={del.isPending}
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
