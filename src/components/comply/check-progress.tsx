"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { getComplianceReport } from "@/app/(dashboard)/comply/actions";

interface CheckProgressProps {
  checkId: string;
  initialStatus: string;
}

export function CheckProgress({ checkId, initialStatus }: CheckProgressProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (status === "completed" || status === "error") return;

    const interval = setInterval(async () => {
      const result = await getComplianceReport(checkId);
      if (result.check) {
        const newStatus = (result.check as { status: string }).status;
        setStatus(newStatus);

        if (newStatus === "completed") {
          clearInterval(interval);
          router.refresh();
        } else if (newStatus === "error") {
          clearInterval(interval);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [checkId, status, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Compliance Check Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          {status === "queued" && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Queued</p>
                <p className="text-xs text-muted-foreground">
                  Your compliance check is in the queue and will start shortly.
                </p>
              </div>
            </>
          )}
          {status === "processing" && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Analysing...</p>
                <p className="text-xs text-muted-foreground">
                  AI is reviewing your plan against NCC requirements. This typically takes 1-2 minutes.
                </p>
              </div>
            </>
          )}
          {status === "completed" && (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Complete</p>
                <p className="text-xs text-muted-foreground">
                  Your compliance report is ready.
                </p>
              </div>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium">Error</p>
                <p className="text-xs text-muted-foreground">
                  Something went wrong. Please try again.
                </p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
