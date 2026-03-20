"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrganisation } from "@/app/(dashboard)/settings/organisation/actions";
import { useRouter } from "next/navigation";
import { validateAbn, type AbnLookupResult } from "@/lib/abn";

interface NameSearchResult {
  abn: string;
  name: string;
  nameType: string;
  state: string;
  postcode: string;
  score: number;
  isCurrent: boolean;
}

interface OrgDetailsFormProps {
  orgName: string;
  orgAbn: string | null;
  canEdit: boolean;
}

export function OrgDetailsForm({
  orgName,
  orgAbn,
  canEdit,
}: OrgDetailsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [abnLoading, setAbnLoading] = useState(false);
  const [abnResult, setAbnResult] = useState<AbnLookupResult | null>(null);
  const [abnError, setAbnError] = useState<string | null>(null);
  const [nameResults, setNameResults] = useState<NameSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abnInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        abnInputRef.current &&
        !abnInputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const lookupAbn = useCallback(async (digits: string) => {
    const validationError = validateAbn(digits);
    if (validationError) {
      setAbnError(validationError);
      setAbnLoading(false);
      return;
    }

    setAbnLoading(true);
    try {
      const res = await fetch(`/api/abn-lookup?abn=${digits}`);
      const data = await res.json();
      if (!res.ok) {
        setAbnError(data.error || "Lookup failed");
      } else {
        setAbnResult(data as AbnLookupResult);
      }
    } catch {
      setAbnError("Failed to look up ABN");
    } finally {
      setAbnLoading(false);
    }
  }, []);

  const searchByName = useCallback(async (query: string) => {
    setAbnLoading(true);
    try {
      const res = await fetch(`/api/abn-lookup?name=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setAbnError(data.error || "Search failed");
        setNameResults([]);
      } else {
        setNameResults(data.results || []);
        setShowDropdown((data.results || []).length > 0);
      }
    } catch {
      setAbnError("Name search failed");
    } finally {
      setAbnLoading(false);
    }
  }, []);

  const handleAbnChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (debounceRef.current) clearTimeout(debounceRef.current);

      setAbnResult(null);
      setAbnError(null);
      setNameResults([]);
      setShowDropdown(false);

      const digits = value.replace(/\s/g, "");

      // If it looks like an ABN (11 digits), do ABN lookup
      if (/^\d{11}$/.test(digits)) {
        debounceRef.current = setTimeout(() => lookupAbn(digits), 400);
        return;
      }

      // If it has 2+ non-digit chars, treat as name search
      const nonDigitChars = value.replace(/[\d\s]/g, "");
      if (nonDigitChars.length >= 2 && value.trim().length >= 2) {
        debounceRef.current = setTimeout(() => searchByName(value.trim()), 400);
        return;
      }

      setAbnLoading(false);
    },
    [lookupAbn, searchByName]
  );

  const handleSelectCompany = useCallback(
    async (result: NameSearchResult) => {
      setShowDropdown(false);
      setNameResults([]);

      // Set the ABN in the input
      if (abnInputRef.current) {
        // Format as "XX XXX XXX XXX"
        const raw = result.abn.replace(/\s/g, "");
        const formatted = raw.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, "$1 $2 $3 $4");
        abnInputRef.current.value = formatted;
      }

      // Fetch full details
      const digits = result.abn.replace(/\s/g, "");
      if (/^\d{11}$/.test(digits)) {
        await lookupAbn(digits);
      }
    },
    [lookupAbn]
  );

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);

    const name = formData.get("name") as string;
    const abn = formData.get("abn") as string;

    startTransition(async () => {
      const result = await updateOrganisation({ name, abn });
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Organisation Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organisation Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={orgName}
              disabled={!canEdit}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abn">ABN</Label>
            <p className="text-xs text-muted-foreground">
              Type a company name to search, or paste an 11-digit ABN
            </p>
            <div className="relative">
              <Input
                ref={abnInputRef}
                id="abn"
                name="abn"
                defaultValue={orgAbn ?? ""}
                disabled={!canEdit}
                placeholder="e.g. 99 691 530 426 or company name"
                onChange={handleAbnChange}
                autoComplete="off"
              />
              {showDropdown && nameResults.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-64 overflow-y-auto"
                >
                  {nameResults.map((r, i) => (
                    <button
                      key={`${r.abn}-${i}`}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground border-b last:border-b-0 transition-colors"
                      onClick={() => handleSelectCompany(r)}
                    >
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-2 text-muted-foreground">
                        ABN {r.abn}
                        {r.state ? ` · ${r.state}` : ""}
                        {r.postcode ? ` ${r.postcode}` : ""}
                      </span>
                      {!r.isCurrent && (
                        <span className="ml-2 text-xs text-orange-500">(historical)</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {abnLoading && (
              <p className="text-sm text-muted-foreground">Looking up ABN...</p>
            )}
            {abnError && (
              <p className="text-sm text-red-500">{abnError}</p>
            )}
            {abnResult && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                <p className="font-medium">{abnResult.entityName}</p>
                <p>
                  {abnResult.entityType} &middot; Status: {abnResult.abnStatus}
                  {abnResult.acn ? ` · ACN: ${abnResult.acn}` : ""}
                </p>
                {abnResult.state && (
                  <p>{abnResult.state} {abnResult.postcode}</p>
                )}
                {abnResult.businessNames.length > 0 && (
                  <p className="mt-1 text-green-600 dark:text-green-400">
                    Trading as: {abnResult.businessNames.join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {saved && (
            <p className="text-sm text-green-600">Saved successfully</p>
          )}

          {canEdit && (
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
