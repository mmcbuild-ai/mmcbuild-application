"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteProject } from "@/app/(dashboard)/projects/actions";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/hooks/use-confirm";

interface DeleteProjectButtonProps {
  projectId: string;
  projectName: string;
}

export function DeleteProjectButton({
  projectId,
  projectName,
}: DeleteProjectButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete project?",
      description: `Delete "${projectName}"? This will permanently remove all plans, compliance checks, findings, and associated data. This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteProject(projectId);
      if (result.error) {
        alert(result.error);
      } else {
        router.push("/projects");
      }
    });
  }

  return (
    <>
      {dialog}
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        disabled={isPending}
        onClick={handleDelete}
      >
        <Trash2 className="mr-2 h-3.5 w-3.5" />
        {isPending ? "Deleting..." : "Delete"}
      </Button>
    </>
  );
}
