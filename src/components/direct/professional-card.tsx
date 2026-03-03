import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin } from "lucide-react";
import { TRADE_TYPE_LABELS, STATE_LABELS } from "@/lib/direct/constants";
import type { Professional, Specialisation, TradeType, AustralianState } from "@/lib/direct/types";
import Link from "next/link";

interface ProfessionalCardProps {
  professional: Professional & { professional_specialisations?: Specialisation[] };
}

export function ProfessionalCard({ professional: pro }: ProfessionalCardProps) {
  const tradeLabel = TRADE_TYPE_LABELS[pro.trade_type as TradeType] || pro.trade_type;
  const regionLabels = pro.regions
    .slice(0, 3)
    .map((r: string) => STATE_LABELS[r as AustralianState] || r);

  return (
    <Link href={`/direct/${pro.id}`}>
      <Card className="hover:shadow-md transition-shadow h-full">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            {pro.logo_url ? (
              <img
                src={pro.logo_url}
                alt={pro.company_name}
                className="w-12 h-12 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <span className="text-amber-700 font-bold text-lg">
                  {pro.company_name.charAt(0)}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{pro.company_name}</h3>
              <Badge variant="secondary" className="text-xs mt-1">
                {tradeLabel}
              </Badge>
            </div>
          </div>

          {pro.headline && (
            <p className="text-sm text-muted-foreground line-clamp-2">{pro.headline}</p>
          )}

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{regionLabels.join(", ")}{pro.regions.length > 3 ? ` +${pro.regions.length - 3}` : ""}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-sm font-medium">
                {pro.avg_rating > 0 ? Number(pro.avg_rating).toFixed(1) : "New"}
              </span>
              {pro.review_count > 0 && (
                <span className="text-xs text-muted-foreground">({pro.review_count})</span>
              )}
            </div>
            {pro.insurance_verified && (
              <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                Verified
              </Badge>
            )}
          </div>

          {pro.professional_specialisations && pro.professional_specialisations.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {pro.professional_specialisations.slice(0, 3).map((s: Specialisation) => (
                <span
                  key={s.id}
                  className="inline-block px-2 py-0.5 text-[10px] bg-amber-50 text-amber-700 rounded-full"
                >
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
