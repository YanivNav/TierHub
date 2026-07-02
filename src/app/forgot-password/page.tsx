import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background p-6">
      <ForgotPasswordForm />
    </main>
  );
}
