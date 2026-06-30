"use client";

import { useState } from "react";
import html2canvas from "html2canvas-pro";
import { Camera, Download, Copy, Check, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ScreenshotButton({
  captureRef,
}: {
  captureRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function capture() {
    if (!captureRef.current) return;
    setIsCapturing(true);
    setError(null);

    try {
      const isDark = document.documentElement.classList.contains("dark");
      const bgColor = isDark ? "#18181b" : "#ffffff";

      const canvas = await html2canvas(captureRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: bgColor,
      });

      setPreviewUrl(canvas.toDataURL("image/png"));
      setDialogOpen(true);
    } catch (err) {
      console.error("Screenshot capture failed:", err);
      setError("Failed to capture screenshot.");
      setDialogOpen(true);
    } finally {
      setIsCapturing(false);
    }
  }

  function handleClose() {
    setDialogOpen(false);
    setPreviewUrl(null);
    setError(null);
    setCopied(false);
  }

  async function handleDownload() {
    if (!previewUrl) return;
    const link = document.createElement("a");
    link.download = "tier-list.png";
    link.href = previewUrl;
    link.click();
  }

  async function handleCopy() {
    if (!previewUrl) return;
    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed — not supported or permission denied
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={capture}
        disabled={isCapturing}
        className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-accent-foreground/20 hover:text-foreground disabled:opacity-50"
      >
        {isCapturing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
        Screenshot
      </button>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {error ? "Screenshot failed" : "Screenshot"}
            </DialogTitle>
          </DialogHeader>

          {error ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <XCircle className="h-12 w-12 text-red-400" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="border-border"
              >
                Close
              </Button>
            </div>
          ) : previewUrl ? (
            <div className="space-y-4">
              {/* Preview */}
              <div className="overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Tier list screenshot"
                  className="w-full"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className="border-border"
                >
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-4 w-4 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-4 w-4" />
                      Copy to clipboard
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={handleDownload}
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Download PNG
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
