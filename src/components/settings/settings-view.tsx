"use client";

import { useState } from "react";
import { BarChart3, Link2, ShieldAlert, User } from "lucide-react";
import { cn } from "@/lib/utils";
import ProfileSection from "@/components/settings/profile-section";
import UsageSection from "@/components/settings/usage-section";
import ConnectionsSection from "@/components/settings/connections-section";
import DangerSection from "@/components/settings/danger-section";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "usage", label: "Usage", icon: BarChart3 },
  { id: "connections", label: "Connections", icon: Link2 },
  { id: "account", label: "Account", icon: ShieldAlert },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function SettingsView() {
  const [active, setActive] = useState<SectionId>("profile");

  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <nav className="flex gap-1 overflow-x-auto sm:w-44 sm:shrink-0 sm:flex-col sm:overflow-visible">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active === s.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">
        {active === "profile" && <ProfileSection />}
        {active === "usage" && <UsageSection />}
        {active === "connections" && <ConnectionsSection />}
        {active === "account" && <DangerSection />}
      </div>
    </div>
  );
}
