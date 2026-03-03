import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Star, Eye, TrendingUp } from "lucide-react";
import type { Professional } from "@/lib/direct/types";

interface DashboardStatsProps {
  professional: Professional;
  enquiryCount: number;
}

export function DashboardStats({ professional, enquiryCount }: DashboardStatsProps) {
  const stats = [
    {
      label: "Enquiries",
      value: enquiryCount,
      icon: MessageSquare,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Avg Rating",
      value: professional.avg_rating > 0 ? Number(professional.avg_rating).toFixed(1) : "—",
      icon: Star,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      label: "Reviews",
      value: professional.review_count,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Status",
      value: professional.status.charAt(0).toUpperCase() + professional.status.slice(1),
      icon: Eye,
      color: professional.status === "approved" ? "text-green-600" : "text-amber-600",
      bg: professional.status === "approved" ? "bg-green-50" : "bg-amber-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`${stat.bg} p-2 rounded-lg`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
