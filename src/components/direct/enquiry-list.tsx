"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markEnquiryRead } from "@/app/(dashboard)/direct/actions";
import { useRouter } from "next/navigation";
import type { Enquiry } from "@/lib/direct/types";

interface EnquiryListProps {
  enquiries: Enquiry[];
}

const STATUS_STYLES: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  new: { label: "New", variant: "default" },
  read: { label: "Read", variant: "secondary" },
  replied: { label: "Replied", variant: "outline" },
  archived: { label: "Archived", variant: "outline" },
};

export function EnquiryList({ enquiries }: EnquiryListProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (enquiries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No enquiries yet.
      </p>
    );
  }

  const handleMarkRead = async (id: string) => {
    setLoadingId(id);
    await markEnquiryRead(id);
    setLoadingId(null);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      {enquiries.map((enq) => {
        const style = STATUS_STYLES[enq.status] || STATUS_STYLES.new;
        return (
          <div key={enq.id} className={`border rounded-lg p-4 space-y-2 ${enq.status === "new" ? "border-amber-300 bg-amber-50/50" : ""}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{enq.sender_name}</span>
                <Badge variant={style.variant}>{style.label}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(enq.created_at).toLocaleDateString("en-AU")}
              </span>
            </div>
            <p className="font-medium text-sm">{enq.subject}</p>
            <p className="text-sm text-muted-foreground">{enq.message}</p>
            {enq.status === "new" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMarkRead(enq.id)}
                disabled={loadingId === enq.id}
              >
                {loadingId === enq.id ? "Marking..." : "Mark as Read"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
