import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-950">
      <SignUp />
    </main>
  );
}
