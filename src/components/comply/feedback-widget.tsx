"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { submitFeedback } from "@/app/(dashboard)/comply/actions";

interface FeedbackWidgetProps {
  checkId: string;
}

export function FeedbackWidget({ checkId }: FeedbackWidgetProps) {
  const [rating, setRating] = useState<-1 | 1 | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (selectedRating: -1 | 1) => {
    setRating(selectedRating);
    setSubmitting(true);

    await submitFeedback(checkId, selectedRating, comment || undefined);

    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <p className="text-sm text-muted-foreground">
        Thanks for your feedback!
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Was this report helpful?</p>
      <div className="flex items-center gap-2">
        <Button
          variant={rating === 1 ? "default" : "outline"}
          size="sm"
          onClick={() => handleSubmit(1)}
          disabled={submitting}
        >
          {submitting && rating === 1 ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <ThumbsUp className="mr-1 h-4 w-4" />
          )}
          Yes
        </Button>
        <Button
          variant={rating === -1 ? "default" : "outline"}
          size="sm"
          onClick={() => handleSubmit(-1)}
          disabled={submitting}
        >
          {submitting && rating === -1 ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <ThumbsDown className="mr-1 h-4 w-4" />
          )}
          No
        </Button>
        <Input
          placeholder="Optional comment..."
          className="ml-2 max-w-xs text-sm"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
    </div>
  );
}
