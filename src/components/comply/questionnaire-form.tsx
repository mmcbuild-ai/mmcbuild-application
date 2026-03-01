"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { saveQuestionnaire } from "@/app/(dashboard)/comply/actions";

interface QuestionnaireFormProps {
  projectId: string;
  existingResponses?: Record<string, unknown> | null;
}

const BUILDING_CLASSES = ["Class 1a", "Class 1b", "Class 10a", "Class 10b"];
const CONSTRUCTION_TYPES = ["Type A", "Type B", "Type C"];
const CLIMATE_ZONES = [1, 2, 3, 4, 5, 6, 7, 8];
const BAL_RATINGS = ["N/A", "BAL-LOW", "BAL-12.5", "BAL-19", "BAL-29", "BAL-40", "BAL-FZ"];

const STEPS = [
  "Building Classification",
  "Construction Details",
  "Site & Climate",
  "Services & Requirements",
];

export function QuestionnaireForm({
  projectId,
  existingResponses,
}: QuestionnaireFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaults = (existingResponses ?? {}) as Record<string, string>;
  const [responses, setResponses] = useState<Record<string, string>>({
    building_class: defaults.building_class ?? "Class 1a",
    construction_type: defaults.construction_type ?? "Type C",
    storeys: defaults.storeys ?? "1",
    floor_area: defaults.floor_area ?? "",
    climate_zone: defaults.climate_zone ?? "6",
    bal_rating: defaults.bal_rating ?? "N/A",
    site_conditions: defaults.site_conditions ?? "",
    services: defaults.services ?? "",
    special_requirements: defaults.special_requirements ?? "",
  });

  const update = (key: string, value: string) =>
    setResponses((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await saveQuestionnaire(projectId, responses);
    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push(`/comply/${projectId}`);
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              i === step
                ? "bg-primary text-primary-foreground"
                : i < step
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
            onClick={() => setStep(i)}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div>
                <Label>Building Classification</Label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={responses.building_class}
                  onChange={(e) => update("building_class", e.target.value)}
                >
                  {BUILDING_CLASSES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Construction Type</Label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={responses.construction_type}
                  onChange={(e) => update("construction_type", e.target.value)}
                >
                  {CONSTRUCTION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <Label>Number of Storeys</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={responses.storeys}
                  onChange={(e) => update("storeys", e.target.value)}
                />
              </div>
              <div>
                <Label>Total Floor Area (m²)</Label>
                <Input
                  type="number"
                  min={1}
                  value={responses.floor_area}
                  onChange={(e) => update("floor_area", e.target.value)}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Label>Climate Zone</Label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={responses.climate_zone}
                  onChange={(e) => update("climate_zone", e.target.value)}
                >
                  {CLIMATE_ZONES.map((z) => (
                    <option key={z} value={String(z)}>Zone {z}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Bushfire Attack Level (BAL)</Label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={responses.bal_rating}
                  onChange={(e) => update("bal_rating", e.target.value)}
                >
                  {BAL_RATINGS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Site Conditions</Label>
                <Input
                  placeholder="e.g., flat site, M class soil, no flood overlay"
                  value={responses.site_conditions}
                  onChange={(e) => update("site_conditions", e.target.value)}
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Label>Services</Label>
                <Input
                  placeholder="e.g., smoke alarms, electric hot water, ducted A/C"
                  value={responses.services}
                  onChange={(e) => update("services", e.target.value)}
                />
              </div>
              <div>
                <Label>Special Requirements</Label>
                <Input
                  placeholder="e.g., accessibility provisions, heritage overlay"
                  value={responses.special_requirements}
                  onChange={(e) =>
                    update("special_requirements", e.target.value)
                  }
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          Previous
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
        ) : (
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save & Continue
          </Button>
        )}
      </div>
    </div>
  );
}
