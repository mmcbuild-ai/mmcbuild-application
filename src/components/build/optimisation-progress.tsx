"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { getDesignReport } from "@/app/(dashboard)/build/actions";

interface OptimisationProgressProps {
  checkId: string;
  initialStatus: string;
}

export function OptimisationProgress({
  checkId,
  initialStatus,
}: OptimisationProgressProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  // Elapsed time ticker
  useEffect(() => {
    if (status === "completed" || status === "error") return;

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  // Poll for progress
  useEffect(() => {
    if (status === "completed" || status === "error") return;

    const interval = setInterval(async () => {
      const result = await getDesignReport(checkId);
      if (result.check) {
        const c = result.check as { status: string };
        setStatus(c.status);

        if (c.status === "completed") {
          clearInterval(interval);
          router.refresh();
        } else if (c.status === "error") {
          clearInterval(interval);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [checkId, status, router]);

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  if (status === "completed") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Design Optimisation Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium">Complete</p>
              <p className="text-xs text-muted-foreground">
                Your design optimisation report is ready.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Design Optimisation Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-medium">Error</p>
              <p className="text-xs text-muted-foreground">
                Something went wrong. Please try again.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Design Optimisation Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
            <span className="text-sm font-medium">
              {status === "queued"
                ? "Queued..."
                : "Analysing your plan for MMC opportunities"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {formatElapsed(elapsed)}
          </div>
        </div>

        {status === "queued" && (
          <p className="text-xs text-muted-foreground">
            Your design optimisation is in the queue and will start shortly.
          </p>
        )}

        {status === "processing" && (
          <p className="text-xs text-muted-foreground">
            AI is reviewing your plans for prefabrication and modern construction opportunities. This typically takes 30-60 seconds.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
