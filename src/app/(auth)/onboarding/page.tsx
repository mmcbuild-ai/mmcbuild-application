"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PERSONA_LABELS,
  PERSONA_DESCRIPTIONS,
  type UserPersona,
} from "@/lib/persona-access";
import {
  HardHat,
  Building,
  Ruler,
  Hammer,
  ClipboardCheck,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const personaCards: {
  persona: UserPersona;
  icon: typeof HardHat;
  color: string;
}[] = [
  { persona: "builder", icon: HardHat, color: "bg-teal-700" },
  { persona: "developer", icon: Building, color: "bg-teal-600" },
  { persona: "architect_bd", icon: Ruler, color: "bg-teal-500" },
  { persona: "design_and_build", icon: Hammer, color: "bg-cyan-700" },
  { persona: "consultant", icon: ClipboardCheck, color: "bg-sky-700" },
  { persona: "trade", icon: Wrench, color: "bg-slate-600" },
];

export default function OnboardingPage() {
  const [selected, setSelected] = useState<UserPersona | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSelect(persona: UserPersona) {
    setSelected(persona);
    setError(null);
  }

  function handleContinue() {
    if (!selected) return;

    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Not authenticated. Please sign in again.");
        return;
      }

      // Cast to bypass generated types until `supabase gen types` is re-run
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("profiles")
        .update({ persona: selected })
        .eq("user_id", user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 font-bold text-lg text-white">
            M
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome to MMC Build
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Tell us about your role so we can tailor your experience.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {personaCards.map(({ persona, icon: Icon, color }) => (
            <button
              key={persona}
              onClick={() => handleSelect(persona)}
              className={cn(
                "flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                selected === persona
                  ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  color
                )}
              >
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-slate-900">
                  {PERSONA_LABELS[persona]}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {PERSONA_DESCRIPTIONS[persona]}
                </p>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        )}

        <div className="mt-6 flex justify-center">
          <button
            onClick={handleContinue}
            disabled={!selected || isPending}
            className={cn(
              "rounded-lg px-8 py-2.5 text-sm font-medium text-white transition-colors",
              selected && !isPending
                ? "bg-teal-600 hover:bg-teal-700"
                : "bg-slate-300 cursor-not-allowed"
            )}
          >
            {isPending ? "Setting up..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
