import { ExplainerVideo } from "@/components/shared/explainer-video";
import { ProfessionalCard } from "@/components/direct/professional-card";
import { DirectorySearch } from "@/components/direct/directory-search";
import { DirectoryPagination } from "@/components/direct/directory-pagination";
import { searchProfessionals } from "./actions";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Professional, Specialisation } from "@/lib/direct/types";

export default async function DirectPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; trade?: string; region?: string; spec?: string; page?: string }>;
}) {
  const params = await searchParams;
  const result = await searchProfessionals({
    query: params.q,
    trade_type: params.trade,
    region: params.region,
    specialisation: params.spec,
    page: params.page ? parseInt(params.page) : 1,
  });

  return (
    <div className="space-y-6">
      <ExplainerVideo module="direct" videoUrl="/videos/direct-explainer.mp4" />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Trade Directory</h2>
            <p className="text-sm text-muted-foreground">
              {result.total} professional{result.total !== 1 ? "s" : ""} found
            </p>
          </div>
          <Link href="/direct/register">
            <Button className="bg-amber-600 hover:bg-amber-700">
              Register Your Business
            </Button>
          </Link>
        </div>

        <DirectorySearch />

        {result.professionals.length > 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {result.professionals.map((pro: Professional & { professional_specialisations?: Specialisation[] }) => (
                <ProfessionalCard key={pro.id} professional={pro} />
              ))}
            </div>
            <DirectoryPagination page={result.page ?? 1} totalPages={result.totalPages ?? 1} />
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="font-semibold text-lg">No professionals found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your search filters or check back later.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
