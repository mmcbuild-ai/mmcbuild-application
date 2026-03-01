import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "./severity-badge";
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle } from "lucide-react";

interface RiskSummaryProps {
  summary: string;
  overallRisk: "low" | "medium" | "high" | "critical";
  findings: {
    severity: string;
  }[];
}

export function RiskSummary({ summary, overallRisk, findings }: RiskSummaryProps) {
  const counts = {
    compliant: findings.filter((f) => f.severity === "compliant").length,
    advisory: findings.filter((f) => f.severity === "advisory").length,
    non_compliant: findings.filter((f) => f.severity === "non_compliant").length,
    critical: findings.filter((f) => f.severity === "critical").length,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Compliance Summary</CardTitle>
          <RiskBadge risk={overallRisk} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{summary}</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-2 rounded-md border p-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-lg font-bold">{counts.compliant}</p>
              <p className="text-xs text-muted-foreground">Compliant</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border p-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-lg font-bold">{counts.advisory}</p>
              <p className="text-xs text-muted-foreground">Advisory</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border p-3">
            <XCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-lg font-bold">{counts.non_compliant}</p>
              <p className="text-xs text-muted-foreground">Non-Compliant</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border p-3">
            <ShieldCheck className="h-5 w-5 text-red-800" />
            <div>
              <p className="text-lg font-bold">{counts.critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
