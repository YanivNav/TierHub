import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-blue-500" />
        <p className="text-sm text-muted-foreground">Finishing sign in…</p>
      </div>
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/dashboard"
        signUpForceRedirectUrl="/dashboard"
      />
    </main>
  );
}
