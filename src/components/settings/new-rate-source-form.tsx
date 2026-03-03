"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createRateSource } from "@/app/(dashboard)/settings/cost-rates/actions";

export function NewRateSourceForm() {
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"api" | "csv" | "manual">("csv");
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const config: Record<string, unknown> = {};
    if (sourceType !== "manual" && url.trim()) {
      config.url = url.trim();
    }

    startTransition(async () => {
      await createRateSource(name.trim(), sourceType, config);
      setName("");
      setUrl("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Source Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rawlinsons 2025"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Source Type
          </label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as "api" | "csv" | "manual")}
          >
            <option value="csv">CSV File / URL</option>
            <option value="api">JSON API</option>
            <option value="manual">Manual Entry</option>
          </select>
        </div>
      </div>

      {sourceType !== "manual" && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {sourceType === "csv" ? "CSV URL" : "API Endpoint URL"}
          </label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              sourceType === "csv"
                ? "https://example.com/rates.csv"
                : "https://api.example.com/rates"
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            {sourceType === "csv"
              ? "CSV must have columns: category, element, unit, rate, state"
              : "JSON API should return an array of rate objects"}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? "Creating..." : "Add Source"}
        </Button>
        {success && (
          <span className="text-xs text-green-600 font-medium">
            Source created successfully
          </span>
        )}
      </div>
    </form>
  );
}
