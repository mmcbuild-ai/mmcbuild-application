"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "./star-rating";
import { submitReview } from "@/app/(dashboard)/direct/actions";
import { useRouter } from "next/navigation";

interface ReviewFormProps {
  professionalId: string;
}

export function ReviewForm({ professionalId }: ReviewFormProps) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await submitReview(professionalId, {
      rating,
      comment: comment || undefined,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setRating(0);
      setComment("");
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3">
      <h3 className="font-medium text-sm">Leave a Review</h3>

      <div>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>

      <Textarea
        placeholder="Share your experience (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading || rating === 0} size="sm">
        {loading ? "Submitting..." : "Submit Review"}
      </Button>
    </form>
  );
}
