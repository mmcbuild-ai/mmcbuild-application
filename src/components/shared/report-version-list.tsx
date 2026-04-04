"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowRight } from "lucide-react";

interface ReportVersion {
  id: string;
  version_number: number;
  source_id: string;
  created_at: string;
  pdf_url: string | null;
}

interface ReportVersionListProps {
  versions: ReportVersion[];
  module: "comply" | "build" | "quote";
  projectId: string;
  currentSourceId?: string;
}

const MODULE_REPORT_PATHS: Record<string, (projectId: string, sourceId: string) => string> = {
  comply: (pid, sid) => `/comply/${pid}/check/${sid}`,
  build: (pid, sid) => `/build/${pid}/report/${sid}`,
  quote: (pid, sid) => `/quote/${pid}/report/${sid}`,
};

const MODULE_LABELS: Record<string, string> = {
  comply: "Compliance",
  build: "Design Optimisation",
  quote: "Cost Estimation",
};

export function ReportVersionList({
  versions,
  module,
  projectId,
  currentSourceId,
}: ReportVersionListProps) {
  if (versions.length === 0) return null;

  const getPath = MODULE_REPORT_PATHS[module];

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {MODULE_LABELS[module]} Version History
      </h3>
      <div className="space-y-1.5">
        {versions.map((v) => {
          const isCurrent = v.source_id === currentSourceId;
          return (
            <Link key={v.id} href={getPath(projectId, v.source_id)}>
              <Card
                className={`hover:shadow-sm transition-shadow cursor-pointer ${
                  isCurrent ? "border-teal-300 bg-teal-50/50" : ""
                }`}
              >
                <CardContent className="flex items-center justify-between py-2.5 px-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium">v{v.version_number}</span>
                      {isCurrent && (
                        <Badge variant="secondary" className="ml-2 text-xs bg-teal-100 text-teal-800">
                          Current
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
