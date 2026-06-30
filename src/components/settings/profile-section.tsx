"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { trpc } from "@/lib/trpc/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function validateUsername(v: string): string {
  if (v.length < 3 || v.length > 30) return "Username must be 3-30 characters.";
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return "Only letters, numbers and underscores.";
  return "";
}

export default function ProfileSection() {
  const { user } = useUser();
  const router = useRouter();
  const utils = trpc.useUtils();

  const me = trpc.user.getMe.useQuery();
  const updateUsername = trpc.user.updateUsername.useMutation();
  const syncFromClerk = trpc.user.syncFromClerk.useMutation();

  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameSaved, setUsernameSaved] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const handle = me.data?.username ?? "";

  useEffect(() => {
    if (handle) setUsername(handle);
  }, [handle]);

  const dirty = username.toLowerCase() !== handle;

  const saveUsername = async () => {
    setUsernameSaved(false);
    const localError = validateUsername(username);
    if (localError) {
      setUsernameError(localError);
      return;
    }
    setUsernameError("");
    try {
      await updateUsername.mutateAsync({ username });
      await utils.user.getMe.invalidate();
      router.refresh();
      setUsernameSaved(true);
    } catch (err) {
      setUsernameError(
        err instanceof Error ? err.message : "Couldn't update username."
      );
    }
  };

  const applyAvatar = async (file: File | null) => {
    if (!user) return;
    // Nothing to remove when only Clerk's default generated avatar is present.
    if (file === null && !user.hasImage) return;
    setAvatarError("");
    setAvatarBusy(true);
    try {
      await user.setProfileImage({ file });
      await user.reload();
      await syncFromClerk.mutateAsync();
      router.refresh();
    } catch (err) {
      setAvatarError(getAuthErrorMessage(err, "profile"));
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const initial = (handle[0] ?? "?").toUpperCase();

  return (
    <div className="space-y-8">
      {/* Avatar */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Profile picture
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xl font-semibold text-foreground">
            {user?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={avatarBusy}
                onClick={() => fileRef.current?.click()}
                className="border-border text-foreground hover:text-foreground"
              >
                {avatarBusy ? "Uploading…" : "Upload"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={avatarBusy || !user?.hasImage}
                onClick={() => applyAvatar(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                Remove
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">PNG or JPG, up to 10 MB.</p>
            {avatarError && (
              <p className="text-sm text-red-400">{avatarError}</p>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void applyAvatar(file);
            }}
          />
        </div>
      </section>

      {/* Username */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Username</h2>
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="username" className="sr-only">
              Username
            </Label>
            <div className="flex items-center rounded-md border border-border bg-card pl-3 focus-within:ring-1 focus-within:ring-border">
              <span className="text-sm text-muted-foreground">@</span>
              <Input
                id="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setUsernameError("");
                  setUsernameSaved(false);
                }}
                disabled={me.isLoading}
                autoComplete="off"
                className="border-0 bg-transparent focus-visible:ring-0"
                placeholder="username"
              />
            </div>
            {usernameError && (
              <p className="text-sm text-red-400">{usernameError}</p>
            )}
            {usernameSaved && !dirty && (
              <p className="text-sm text-green-400">Saved.</p>
            )}
          </div>
          <Button
            size="sm"
            disabled={!dirty || updateUsername.isPending || me.isLoading}
            onClick={saveUsername}
            className="bg-blue-600 hover:bg-blue-500"
          >
            {updateUsername.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </section>
    </div>
  );
}
