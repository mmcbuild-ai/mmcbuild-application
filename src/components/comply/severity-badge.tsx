import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SEVERITY_CONFIG = {
  compliant: { label: "Compliant", className: "bg-green-100 text-green-800 border-green-200" },
  advisory: { label: "Advisory", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  non_compliant: { label: "Non-Compliant", className: "bg-red-100 text-red-800 border-red-200" },
  critical: { label: "Critical", className: "bg-red-200 text-red-900 border-red-300" },
} as const;

type Severity = keyof typeof SEVERITY_CONFIG;

export function SeverityBadge({ severity }: { severity: Severity }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}

const RISK_CONFIG = {
  low: { label: "Low Risk", className: "bg-green-100 text-green-800 border-green-200" },
  medium: { label: "Medium Risk", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  high: { label: "High Risk", className: "bg-orange-100 text-orange-800 border-orange-200" },
  critical: { label: "Critical Risk", className: "bg-red-200 text-red-900 border-red-300" },
} as const;

type Risk = keyof typeof RISK_CONFIG;

export function RiskBadge({ risk }: { risk: Risk }) {
  const config = RISK_CONFIG[risk];
  return (
    <Badge variant="outline" className={cn("text-sm font-semibold", config.className)}>
      {config.label}
    </Badge>
  );
}
