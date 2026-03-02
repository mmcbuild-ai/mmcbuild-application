"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitFindingFeedback } from "@/app/(dashboard)/comply/actions";

interface FindingFeedbackProps {
  findingId: string;
  checkId: string;
  currentSeverity: string;
}

export function FindingFeedback({ findingId, checkId, currentSeverity }: FindingFeedbackProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFeedback = async (rating: -1 | 0 | 1, correctionSeverity?: string) => {
    setSubmitting(true);
    try {
      const result = await submitFindingFeedback(findingId, checkId, rating, correctionSeverity);
      if (result?.success) {
        setSubmitted(true);
      }
    } catch {
      // Silent fail — feedback is non-critical
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <span className="text-xs text-muted-foreground">Thanks for your feedback</span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1">Accurate?</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => handleFeedback(1)}
        disabled={submitting}
        title="Correct"
      >
        <ThumbsUp className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => handleFeedback(0)}
        disabled={submitting}
        title="Partially correct"
      >
        <Minus className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => handleFeedback(-1)}
        disabled={submitting}
        title="Incorrect"
      >
        <ThumbsDown className="h-3 w-3" />
      </Button>
    </div>
  );
}
