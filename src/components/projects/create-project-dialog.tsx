"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProject } from "@/app/(dashboard)/projects/actions";
import { Plus } from "lucide-react";
import { AddressAutocomplete } from "@/components/common/address-autocomplete";
import type { GeocodedAddress } from "@/lib/mapbox-types";

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const geocodedRef = useRef<GeocodedAddress | null>(null);
  const router = useRouter();

  function handleAddressSelect(address: GeocodedAddress) {
    geocodedRef.current = address;
  }

  async function handleSubmit(formData: FormData) {
    // Inject geocoded fields into FormData
    const geo = geocodedRef.current;
    if (geo) {
      formData.set("address", geo.formatted_address);
      formData.set("latitude", String(geo.latitude));
      formData.set("longitude", String(geo.longitude));
      formData.set("suburb", geo.suburb ?? "");
      formData.set("postcode", geo.postcode ?? "");
      formData.set("state", geo.state ?? "");
    }

    setLoading(true);
    try {
      const { projectId } = await createProject(formData);
      setOpen(false);
      geocodedRef.current = null;
      router.push(`/projects/${projectId}?tab=documents`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. 42 Smith Street Renovation"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <AddressAutocomplete
              onSelect={handleAddressSelect}
              placeholder="Start typing an Australian address…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
