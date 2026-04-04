"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, MessageSquare, Loader2 } from "lucide-react";
import {
  approveDirectoryListing,
  rejectDirectoryListing,
  requestInfoDirectoryListing,
} from "@/app/(dashboard)/admin/directory/actions";

interface Listing {
  id: string;
  company_name: string;
  abn: string | null;
  categories: string[];
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  location: string | null;
  service_area: string[];
  licences_held: string | null;
  description: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  published: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  info_requested: "bg-blue-100 text-blue-800",
};

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "published", label: "Published" },
  { key: "rejected", label: "Rejected" },
  { key: "info_requested", label: "Info Requested" },
];

export function DirectoryAdminQueue({ listings }: { listings: Listing[] }) {
  const [filter, setFilter] = useState("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = filter === "all"
    ? listings
    : listings.filter((l) => l.status === filter);

  const pendingCount = listings.filter((l) => l.status === "pending").length;

  function handleAction(action: "approve" | "reject" | "info", listingId: string) {
    startTransition(async () => {
      if (action === "approve") {
        await approveDirectoryListing(listingId);
      } else if (action === "reject") {
        await rejectDirectoryListing(listingId, notes || undefined);
      } else {
        await requestInfoDirectoryListing(listingId, notes);
      }
      setExpandedId(null);
      setNotes("");
    });
  }

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.key
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            {tab.label}
            {tab.key === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-[10px] text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No listings match this filter.
        </p>
      )}

      {/* Listing cards */}
      {filtered.map((listing) => (
        <Card key={listing.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{listing.company_name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {listing.contact_name} &middot; {listing.contact_email}
                  {listing.contact_phone && ` &middot; ${listing.contact_phone}`}
                </p>
              </div>
              <Badge className={STATUS_COLORS[listing.status] ?? "bg-gray-100"}>
                {listing.status.replace("_", " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              {listing.abn && (
                <div>
                  <span className="text-muted-foreground">ABN:</span> {listing.abn}
                </div>
              )}
              {listing.location && (
                <div>
                  <span className="text-muted-foreground">Location:</span> {listing.location}
                </div>
              )}
              {listing.licences_held && (
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Licences:</span> {listing.licences_held}
                </div>
              )}
            </div>

            {listing.categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {listing.categories.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs">
                    {c}
                  </Badge>
                ))}
              </div>
            )}

            {listing.service_area.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {listing.service_area.map((r) => (
                  <Badge key={r} variant="secondary" className="text-xs">
                    {r}
                  </Badge>
                ))}
              </div>
            )}

            {listing.description && (
              <p className="text-sm text-muted-foreground">{listing.description}</p>
            )}

            {listing.admin_notes && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-sm">
                <span className="font-medium text-blue-800">Admin notes:</span>{" "}
                <span className="text-blue-700">{listing.admin_notes}</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Submitted {new Date(listing.created_at).toLocaleString("en-AU")}
            </p>

            {/* Actions */}
            {listing.status === "pending" && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleAction("approve", listing.id)}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (expandedId === listing.id) {
                      handleAction("reject", listing.id);
                    } else {
                      setExpandedId(listing.id);
                    }
                  }}
                  disabled={isPending}
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (expandedId === listing.id) {
                      handleAction("info", listing.id);
                    } else {
                      setExpandedId(listing.id);
                    }
                  }}
                  disabled={isPending}
                >
                  <MessageSquare className="mr-1 h-3 w-3" />
                  Request Info
                </Button>
              </div>
            )}

            {expandedId === listing.id && (
              <div className="pt-2">
                <Textarea
                  placeholder="Add notes (required for request info, optional for reject)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
