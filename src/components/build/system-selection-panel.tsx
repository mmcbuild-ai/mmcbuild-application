"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, Loader2, Settings2 } from "lucide-react";
import { updateSelectedSystems } from "@/app/(dashboard)/build/actions";

export const CONSTRUCTION_SYSTEMS = [
  { key: "sips", label: "SIPs", description: "Structural Insulated Panels for walls, roofs, and floors" },
  { key: "clt", label: "CLT / Mass Timber", description: "Cross-Laminated Timber, Glulam, and mass timber systems" },
  { key: "steel_frame", label: "Steel Frame", description: "Light-gauge cold-formed steel framing systems" },
  { key: "timber_frame", label: "Timber Frame", description: "Prefabricated timber wall panels and cassette floors" },
  { key: "volumetric_modular", label: "Volumetric Modular", description: "Complete 3D modules manufactured off-site" },
  { key: "hybrid", label: "Hybrid", description: "Combination of multiple MMC systems and emerging tech" },
] as const;

export type ConstructionSystemKey = (typeof CONSTRUCTION_SYSTEMS)[number]["key"];

interface SystemSelectionPanelProps {
  projectId: string;
  initialSystems: string[];
  hasDownstreamReports: boolean;
}

export function SystemSelectionPanel({
  projectId,
  initialSystems,
  hasDownstreamReports,
}: SystemSelectionPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSystems));
  const [saved, setSaved] = useState<Set<string>>(new Set(initialSystems));
  const [isPending, startTransition] = useTransition();
  const [showWarning, setShowWarning] = useState(false);
  const router = useRouter();

  const isDirty = !setsEqual(selected, saved);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSave() {
    if (hasDownstreamReports && isDirty) {
      setShowWarning(true);
      return;
    }
    doSave();
  }

  function doSave() {
    setShowWarning(false);
    startTransition(async () => {
      const result = await updateSelectedSystems(projectId, [...selected]);
      if (!("error" in result)) {
        setSaved(new Set(selected));
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-teal-600" />
          <CardTitle className="text-base">Construction Systems</CardTitle>
        </div>
        <CardDescription>
          Select the MMC systems for this project. This flows into Comply, Quote, Directory, and Training.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {CONSTRUCTION_SYSTEMS.map((sys) => {
            const isSelected = selected.has(sys.key);
            return (
              <button
                key={sys.key}
                type="button"
                onClick={() => toggle(sys.key)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-teal-300 bg-teal-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    isSelected
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-gray-300"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{sys.label}</p>
                  <p className="text-xs text-muted-foreground">{sys.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {CONSTRUCTION_SYSTEMS.filter((s) => selected.has(s.key)).map((s) => (
              <Badge key={s.key} variant="secondary" className="bg-teal-100 text-teal-800">
                {s.label}
              </Badge>
            ))}
          </div>
        )}

        {showWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">Downstream reports may need re-running</p>
              <p className="text-amber-700 mt-1">
                Changing systems may affect Comply, Quote, and Build analyses. Existing reports won't update automatically.
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowWarning(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={doSave} disabled={isPending}>
                  {isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  Save Anyway
                </Button>
              </div>
            </div>
          </div>
        )}

        {!showWarning && isDirty && (
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Selection"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
