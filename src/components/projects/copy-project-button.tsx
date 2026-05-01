"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Copy, Loader2 } from "lucide-react";
import { copyProject } from "@/app/(dashboard)/projects/actions";

interface CopyProjectButtonProps {
  projectId: string;
  variant?: "icon" | "menu";
  /** Stop click events from bubbling (used inside Link cards). */
  stopPropagation?: boolean;
}

export function CopyProjectButton({
  projectId,
  variant = "icon",
  stopPropagation = false,
}: CopyProjectButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick(e: React.MouseEvent) {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    startTransition(async () => {
      setError(null);
      const result = await copyProject(projectId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.projectId) {
        router.push(`/projects/${result.projectId}`);
      }
    });
  }

  if (variant === "menu") {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Copy className="mr-1 h-4 w-4" />
          )}
          Copy
        </Button>
        {error && <span className="ml-2 text-xs text-destructive">{error}</span>}
      </>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-primary"
      onClick={handleClick}
      disabled={pending}
      title="Copy project"
      aria-label="Copy project"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}
