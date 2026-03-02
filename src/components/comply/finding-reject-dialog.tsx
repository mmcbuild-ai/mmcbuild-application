"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reviewFinding } from "@/app/(dashboard)/comply/actions";
import { useRouter } from "next/navigation";

interface FindingRejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  findingId: string;
}

export function FindingRejectDialog({
  open,
  onOpenChange,
  findingId,
}: FindingRejectDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    const reason = formData.get("reason") as string;
    if (!reason.trim()) {
      setError("Rejection reason is required");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await reviewFinding(findingId, "rejected", {
        rejection_reason: reason,
      });
      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Finding</DialogTitle>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Rejection Reason *</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Explain why this finding is being rejected..."
              rows={3}
              required
            />
            <p className="text-xs text-muted-foreground">
              This will be recorded in the activity log.
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isPending}
            >
              {isPending ? "Rejecting..." : "Reject Finding"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
