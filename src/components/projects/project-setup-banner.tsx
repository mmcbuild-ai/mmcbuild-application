"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { activateProject } from "@/app/(dashboard)/projects/actions";
import { CheckCircle2, Circle, Rocket } from "lucide-react";

interface ProjectSetupBannerProps {
  projectId: string;
  hasPlans: boolean;
  hasQuestionnaire: boolean;
  hasCertifications: boolean;
  hasTeam: boolean;
}

export function ProjectSetupBanner({
  projectId,
  hasPlans,
  hasQuestionnaire,
  hasCertifications,
  hasTeam,
}: ProjectSetupBannerProps) {
  const router = useRouter();
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canActivate = hasPlans && hasQuestionnaire;

  async function handleActivate() {
    setActivating(true);
    setError(null);
    const result = await activateProject(projectId);
    if (result.error) {
      setError(result.error);
      setActivating(false);
    } else {
      router.refresh();
    }
  }

  const steps = [
    { label: "Upload plans", done: hasPlans, required: true },
    { label: "Complete questionnaire", done: hasQuestionnaire, required: true },
    { label: "Upload certifications", done: hasCertifications, required: false },
    { label: "Add team members", done: hasTeam, required: false },
  ];

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Project Setup</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Complete the required steps below to activate your project for compliance checking.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {steps.map((step) => (
            <div key={step.label} className="flex items-center gap-2">
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span
                className={`text-sm ${
                  step.done
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
                {step.required && !step.done && (
                  <span className="ml-1 text-xs text-destructive">*required</span>
                )}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          onClick={handleActivate}
          disabled={!canActivate || activating}
          className="w-full sm:w-auto"
        >
          {activating ? "Activating..." : "Activate Project"}
        </Button>

        {!canActivate && (
          <p className="text-xs text-muted-foreground">
            Complete both required steps to enable activation.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
