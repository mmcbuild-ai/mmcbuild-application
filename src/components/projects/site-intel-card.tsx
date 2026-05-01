import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Thermometer,
  Wind,
  Flame,
  Landmark,
  MapPinned,
  Layers,
} from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type SiteIntel = Database["public"]["Tables"]["project_site_intel"]["Row"];

interface SiteIntelCardProps {
  intel: SiteIntel;
}

function IntelField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        {value != null ? (
          <p
            className="truncate text-sm font-medium"
            title={String(value)}
          >
            {value}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">Not determined</p>
        )}
      </div>
    </div>
  );
}

export function SiteIntelCard({ intel }: SiteIntelCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Site Intelligence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {intel.static_map_url && (
          <img
            src={intel.static_map_url}
            alt="Site location map"
            className="w-full rounded-md border"
            loading="lazy"
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <IntelField
            icon={Thermometer}
            label="Climate Zone"
            value={intel.climate_zone ? `Zone ${intel.climate_zone}` : null}
          />
          <IntelField
            icon={Wind}
            label="Wind Region"
            value={intel.wind_region}
          />
          <IntelField
            icon={Flame}
            label="BAL Rating"
            value={intel.bal_rating}
          />
          <IntelField
            icon={Landmark}
            label="Council / LGA"
            value={intel.council_name}
          />
          <IntelField
            icon={MapPinned}
            label="Zoning"
            value={intel.zoning}
          />
          <IntelField
            icon={Layers}
            label="Location"
            value={
              intel.suburb && intel.state
                ? `${intel.suburb}, ${intel.state} ${intel.postcode ?? ""}`
                : intel.suburb ?? intel.postcode
            }
          />
        </div>

        {intel.derived_at && (
          <p className="text-xs text-muted-foreground">
            Derived{" "}
            {new Date(intel.derived_at).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
