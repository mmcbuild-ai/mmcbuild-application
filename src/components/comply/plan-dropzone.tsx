"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2 } from "lucide-react";
import { uploadPlan } from "@/app/(dashboard)/comply/actions";

interface PlanDropzoneProps {
  projectId: string;
}

export function PlanDropzone({ projectId }: PlanDropzoneProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("File size must be under 50MB");
      return;
    }

    setSelectedFile(file);
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("file", file);

    const result = await uploadPlan(formData);

    setUploading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }, [projectId, router]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <Card
      className={`border-2 border-dashed transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        {uploading ? (
          <>
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">
              Uploading {selectedFile?.name}...
            </p>
            <p className="text-xs text-muted-foreground">
              The file will be processed automatically after upload
            </p>
          </>
        ) : selectedFile && !error ? (
          <>
            <FileText className="mb-3 h-10 w-10 text-green-600" />
            <p className="text-sm font-medium">{selectedFile.name} uploaded</p>
            <p className="text-xs text-muted-foreground">
              Processing will begin shortly
            </p>
          </>
        ) : (
          <>
            <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">
              Drag and drop your building plan PDF here
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              or click to browse (PDF only, max 50MB)
            </p>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                Browse Files
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleInputChange}
                />
              </label>
            </Button>
          </>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
