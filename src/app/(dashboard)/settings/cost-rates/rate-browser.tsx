"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, Pencil, RotateCcw, Plus, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  listMergedRates,
  upsertOrgOverride,
  deleteOrgOverride,
  type MergedRate,
} from "./actions";

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

interface RateBrowserProps {
  categories: string[];
}

export function RateBrowser({ categories }: RateBrowserProps) {
  const [rates, setRates] = useState<MergedRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Add new rate
  const [showAdd, setShowAdd] = useState(false);
  const [newRate, setNewRate] = useState({
    category: "",
    element: "",
    unit: "sqm",
    base_rate: "",
    state: "NSW",
    notes: "",
  });

  function fetchRates() {
    setLoading(true);
    listMergedRates({
      category: category || undefined,
      state: state || undefined,
      search: search || undefined,
    }).then((data) => {
      setRates(data);
      setLoading(false);
    });
  }

  useEffect(() => {
    fetchRates();
  }, [category, state]);

  useEffect(() => {
    const t = setTimeout(fetchRates, 300);
    return () => clearTimeout(t);
  }, [search]);

  function handleEdit(rate: MergedRate) {
    setEditingId(rate.id);
    setEditRate(String(rate.base_rate));
    setEditNotes(rate.notes ?? "");
  }

  function handleSaveEdit(rate: MergedRate) {
    const newBaseRate = parseFloat(editRate);
    if (isNaN(newBaseRate) || newBaseRate < 0) {
      toast.error("Invalid rate");
      return;
    }

    startTransition(async () => {
      await upsertOrgOverride({
        category: rate.category,
        element: rate.element,
        unit: rate.unit,
        base_rate: newBaseRate,
        state: rate.state,
        notes: editNotes || undefined,
      });
      setEditingId(null);
      toast.success("Rate override saved");
      fetchRates();
    });
  }

  function handleRevert(rate: MergedRate) {
    if (!rate.override_id) return;
    startTransition(async () => {
      await deleteOrgOverride(rate.override_id!);
      toast.success("Reverted to default rate");
      fetchRates();
    });
  }

  function handleAddRate() {
    const baseRate = parseFloat(newRate.base_rate);
    if (!newRate.category || !newRate.element || isNaN(baseRate)) {
      toast.error("Fill in all required fields");
      return;
    }

    startTransition(async () => {
      await upsertOrgOverride({
        category: newRate.category,
        element: newRate.element,
        unit: newRate.unit,
        base_rate: baseRate,
        state: newRate.state,
        notes: newRate.notes || undefined,
        source_label: "Client Addition",
      });
      setShowAdd(false);
      setNewRate({ category: "", element: "", unit: "sqm", base_rate: "", state: "NSW", notes: "" });
      toast.success("Custom rate added");
      fetchRates();
    });
  }

  const sourceBadge = (type: MergedRate["source_type"]) => {
    switch (type) {
      case "override":
        return "bg-amber-100 text-amber-700";
      case "external":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const sourceLabel = (rate: MergedRate) => {
    switch (rate.source_type) {
      case "override":
        return rate.source_label;
      case "external":
        return rate.source_label;
      default:
        return "Default";
    }
  };

  // Group by category
  const grouped = rates.reduce((acc, rate) => {
    if (!acc[rate.category]) acc[rate.category] = [];
    acc[rate.category].push(rate);
    return acc;
  }, {} as Record<string, MergedRate[]>);

  const overrideCount = rates.filter((r) => r.source_type === "override").length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search elements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          <select
            className="flex h-10 w-full min-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">State</label>
          <select
            className="flex h-10 w-full min-w-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">All States</option>
            {STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
          className="h-10"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Rate
        </Button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{rates.length} rates</span>
        {overrideCount > 0 && (
          <span className="text-amber-600 font-medium">
            {overrideCount} override{overrideCount !== 1 ? "s" : ""} active
          </span>
        )}
      </div>

      {/* Add rate form */}
      {showAdd && (
        <div className="rounded-lg border bg-amber-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Add Custom Rate</h3>
            <button onClick={() => setShowAdd(false)}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Input
                placeholder="e.g. frame"
                value={newRate.category}
                onChange={(e) => setNewRate({ ...newRate, category: e.target.value })}
                list="category-list"
              />
              <datalist id="category-list">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">Element</label>
              <Input
                placeholder="e.g. Timber wall frame supply & erect"
                value={newRate.element}
                onChange={(e) => setNewRate({ ...newRate, element: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Unit</label>
              <Input
                placeholder="sqm"
                value={newRate.unit}
                onChange={(e) => setNewRate({ ...newRate, unit: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Rate ($)</label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="85.00"
                value={newRate.base_rate}
                onChange={(e) => setNewRate({ ...newRate, base_rate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">State</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newRate.state}
                onChange={(e) => setNewRate({ ...newRate, state: e.target.value })}
              >
                {STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
            <Input
              placeholder="e.g. Based on Rawlinsons 2025 p.142"
              value={newRate.notes}
              onChange={(e) => setNewRate({ ...newRate, notes: e.target.value })}
            />
          </div>
          <Button onClick={handleAddRate} disabled={isPending} size="sm">
            {isPending ? "Saving..." : "Save Rate"}
          </Button>
        </div>
      )}

      {/* Rate table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : rates.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          No rates found matching your filters.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, catRates]) => (
            <div key={cat}>
              <h3 className="text-sm font-semibold mb-2 capitalize sticky top-0 bg-background py-1">
                {cat.replace(/_/g, " ")}
                <span className="text-muted-foreground font-normal ml-2">
                  ({catRates.length})
                </span>
              </h3>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-3 py-2 font-medium text-muted-foreground">Element</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground w-20">Unit</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground w-28 text-right">Rate</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground w-16">State</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground w-28">Source</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {catRates.map((rate) => (
                      <tr
                        key={`${rate.id}-${rate.source_type}`}
                        className={`border-t ${
                          rate.source_type === "override"
                            ? "bg-amber-50/40"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <span>{rate.element}</span>
                          {rate.notes && (
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              {rate.notes}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{rate.unit}</td>
                        <td className="px-3 py-2 text-right">
                          {editingId === rate.id ? (
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              className="w-24 h-8 text-right ml-auto"
                              value={editRate}
                              onChange={(e) => setEditRate(e.target.value)}
                              autoFocus
                            />
                          ) : (
                            <div>
                              <span className="font-medium">
                                ${rate.base_rate.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              </span>
                              {rate.default_rate !== null && rate.default_rate !== rate.base_rate && (
                                <span className="block text-xs text-muted-foreground line-through">
                                  ${rate.default_rate.toLocaleString("en-AU")}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{rate.state}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sourceBadge(rate.source_type)}`}
                          >
                            {sourceLabel(rate)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            {editingId === rate.id ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(rate)}
                                  disabled={isPending}
                                  className="p-1 rounded hover:bg-green-100 text-green-600"
                                  title="Save"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1 rounded hover:bg-slate-100 text-muted-foreground"
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEdit(rate)}
                                  className="p-1 rounded hover:bg-slate-100 text-muted-foreground"
                                  title="Override rate"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                {rate.override_id && (
                                  <button
                                    onClick={() => handleRevert(rate)}
                                    disabled={isPending}
                                    className="p-1 rounded hover:bg-red-100 text-red-500"
                                    title="Revert to default"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
