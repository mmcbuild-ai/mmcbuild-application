"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { TRADE_TYPE_LABELS, AUSTRALIAN_STATES, STATE_LABELS, MMC_SPECIALISATIONS } from "@/lib/direct/constants";
import type { TradeType, AustralianState } from "@/lib/direct/types";

export function DirectorySearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [tradeType, setTradeType] = useState(searchParams.get("trade") || "");
  const [region, setRegion] = useState(searchParams.get("region") || "");
  const [specialisation, setSpecialisation] = useState(searchParams.get("spec") || "");

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (tradeType) params.set("trade", tradeType);
    if (region) params.set("region", region);
    if (specialisation) params.set("spec", specialisation);
    router.push(`/direct?${params.toString()}`);
  }, [query, tradeType, region, specialisation, router]);

  const clearFilters = () => {
    setQuery("");
    setTradeType("");
    setRegion("");
    setSpecialisation("");
    router.push("/direct");
  };

  const hasFilters = query || tradeType || region || specialisation;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search professionals..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="pl-9"
          />
        </div>
        <Button onClick={applyFilters}>Search</Button>
        {hasFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={tradeType}
          onChange={(e) => { setTradeType(e.target.value); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Trades</option>
          {Object.entries(TRADE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={region}
          onChange={(e) => { setRegion(e.target.value); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Regions</option>
          {AUSTRALIAN_STATES.map((state) => (
            <option key={state} value={state}>{STATE_LABELS[state as AustralianState]}</option>
          ))}
        </select>

        <select
          value={specialisation}
          onChange={(e) => { setSpecialisation(e.target.value); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Specialisations</option>
          {MMC_SPECIALISATIONS.map((spec) => (
            <option key={spec} value={spec}>{spec}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
