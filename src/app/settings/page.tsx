import SettingsView from "@/components/settings/settings-view";

export const metadata = { title: "Settings · TierHub" };

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Settings</h1>
      <SettingsView />
    </main>
  );
}
