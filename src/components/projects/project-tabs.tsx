"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, FileText, Users, ClipboardList } from "lucide-react";

const TABS = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "team", label: "Team", icon: Users },
  { value: "questionnaire", label: "Questionnaire", icon: ClipboardList },
] as const;

export type ProjectTab = (typeof TABS)[number]["value"];

export function ProjectTabs({
  projectId,
  readiness,
}: {
  projectId: string;
  readiness?: { hasPlans: boolean; hasQuestionnaire: boolean };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as ProjectTab) || "overview";

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    router.push(`/projects/${projectId}${qs ? `?${qs}` : ""}`);
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        {TABS.map((tab) => {
          const showDot =
            readiness &&
            ((tab.value === "documents" && readiness.hasPlans) ||
              (tab.value === "questionnaire" && readiness.hasQuestionnaire));
          return (
            <TabsTrigger key={tab.value} value={tab.value}>
              <tab.icon className="mr-1.5 h-4 w-4" />
              {tab.label}
              {showDot && (
                <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-green-500" />
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
