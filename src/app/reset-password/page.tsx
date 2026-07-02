import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/reset-password-form";

export const metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background p-6">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
