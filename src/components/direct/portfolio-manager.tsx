"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "./image-upload";
import { Plus, Trash2 } from "lucide-react";
import {
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
} from "@/app/(dashboard)/direct/actions";
import type { PortfolioItem } from "@/lib/direct/types";

interface PortfolioManagerProps {
  professionalId: string;
  orgId: string;
  items: PortfolioItem[];
}

export function PortfolioManager({ professionalId, orgId, items }: PortfolioManagerProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await addPortfolioItem(professionalId, {
      title,
      description: description || undefined,
      image_url: imageUrl || undefined,
      sort_order: items.length,
    });
    setLoading(false);
    setAdding(false);
    setTitle("");
    setDescription("");
    setImageUrl("");
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    await deletePortfolioItem(id);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-4 flex gap-4">
            {item.image_url && (
              <img src={item.image_url} alt={item.title} className="w-24 h-24 rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm">{item.title}</h4>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-500 shrink-0"
              onClick={() => handleDelete(item.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      ))}

      {adding ? (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Image</Label>
                <ImageUpload orgId={orgId} onUploaded={setImageUrl} label="Upload Photo" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? "Adding..." : "Add Item"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Portfolio Item
        </Button>
      )}
    </div>
  );
}
