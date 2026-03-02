import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar } from "lucide-react";

interface ProjectHeaderProps {
  name: string;
  status: string;
  address: string | null;
  createdAt: string;
}

export function ProjectHeader({
  name,
  status,
  address,
  createdAt,
}: ProjectHeaderProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{name}</h1>
        <Badge variant="secondary" className="capitalize">
          {status}
        </Badge>
      </div>
      {address && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{address}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span>
          Created {new Date(createdAt).toLocaleDateString("en-AU")}
        </span>
      </div>
    </div>
  );
}
