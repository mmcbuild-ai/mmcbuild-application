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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DISCIPLINE_LABELS } from "@/lib/ai/types";
import { amendFinding } from "@/app/(dashboard)/comply/actions";
import { useRouter } from "next/navigation";

interface Contributor {
  id: string;
  discipline: string;
  contact_name: string;
  company_name: string | null;
}

interface FindingAmendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finding: {
    id: string;
    description: string;
    remediation_action: string | null;
    responsible_discipline: string | null;
    assigned_contributor_id: string | null;
  };
  contributors: Contributor[];
}

export function FindingAmendDialog({
  open,
  onOpenChange,
  finding,
  contributors,
}: FindingAmendDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    const amendments = {
      amended_description:
        (formData.get("description") as string) || undefined,
      amended_action: (formData.get("action") as string) || undefined,
      amended_discipline:
        (formData.get("discipline") as string) || undefined,
      assigned_contributor_id:
        (formData.get("contributor") as string) || undefined,
    };

    startTransition(async () => {
      const result = await amendFinding(finding.id, amendments);
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
          <DialogTitle>Amend Finding</DialogTitle>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Amended Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={finding.description}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="action">Amended Remediation Action</Label>
            <Textarea
              id="action"
              name="action"
              defaultValue={finding.remediation_action ?? ""}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="discipline">Discipline</Label>
            <Select
              name="discipline"
              defaultValue={finding.responsible_discipline ?? "other"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DISCIPLINE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {contributors.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="contributor">Assign Contributor</Label>
              <Select
                name="contributor"
                defaultValue={finding.assigned_contributor_id ?? ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contributor..." />
                </SelectTrigger>
                <SelectContent>
                  {contributors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contact_name}
                      {c.company_name ? ` (${c.company_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Amendment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
