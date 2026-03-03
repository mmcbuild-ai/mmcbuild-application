"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ImageUploadProps {
  orgId: string;
  onUploaded: (url: string) => void;
  accept?: string;
  label?: string;
  currentUrl?: string;
}

export function ImageUpload({
  orgId,
  onUploaded,
  accept = "image/jpeg,image/png,image/webp",
  label = "Upload Image",
  currentUrl,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const supabase = createClient();
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${orgId}/${timestamp}_${safeName}`;

    const { error } = await supabase.storage
      .from("directory-uploads")
      .upload(filePath, file, { contentType: file.type });

    if (error) {
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("directory-uploads")
      .getPublicUrl(filePath);

    setPreview(urlData.publicUrl);
    onUploaded(urlData.publicUrl);
    setUploading(false);
  };

  const clear = () => {
    setPreview(null);
    onUploaded("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt="" className="w-24 h-24 rounded-lg object-cover" />
          <button
            type="button"
            onClick={clear}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? "Uploading..." : label}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
