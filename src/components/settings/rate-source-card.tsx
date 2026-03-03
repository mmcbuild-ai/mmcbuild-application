"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { toggleRateSource, triggerSync } from "@/app/(dashboard)/settings/cost-rates/actions";

interface RateSourceCardProps {
  source: {
    id: string;
    name: string;
    source_type: string;
    config: Record<string, unknown>;
    last_synced_at: string | null;
    is_active: boolean;
    created_at: string;
  };
}

export function RateSourceCard({ source }: RateSourceCardProps) {
  const [isPending, startTransition] = useTransition();
  const [syncTriggered, setSyncTriggered] = useState(false);

  const typeLabel =
    source.source_type === "api" ? "API" :
    source.source_type === "csv" ? "CSV" : "Manual";

  const typeBg =
    source.source_type === "api" ? "bg-blue-100 text-blue-700" :
    source.source_type === "csv" ? "bg-orange-100 text-orange-700" :
    "bg-gray-100 text-gray-700";

  function handleToggle() {
    startTransition(async () => {
      await toggleRateSource(source.id, !source.is_active);
    });
  }

  function handleSync() {
    startTransition(async () => {
      await triggerSync(source.id);
      setSyncTriggered(true);
      setTimeout(() => setSyncTriggered(false), 3000);
    });
  }

  return (
    <Card className={!source.is_active ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBg}`}>
                {typeLabel}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  source.is_active
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {source.is_active ? "Active" : "Disabled"}
              </span>
            </div>
            <CardTitle className="text-sm font-medium">
              {source.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggle}
              disabled={isPending}
              title={source.is_active ? "Disable source" : "Enable source"}
            >
              {source.is_active ? (
                <ToggleRight className="h-4 w-4 text-green-600" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            {source.source_type !== "manual" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isPending || !source.is_active}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isPending ? "animate-spin" : ""}`} />
                {syncTriggered ? "Queued" : "Sync"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Created {new Date(source.created_at).toLocaleDateString("en-AU")}
          </span>
          {source.last_synced_at && (
            <span>
              Last synced {new Date(source.last_synced_at).toLocaleString("en-AU")}
            </span>
          )}
          {!source.last_synced_at && source.source_type !== "manual" && (
            <span>Never synced</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
