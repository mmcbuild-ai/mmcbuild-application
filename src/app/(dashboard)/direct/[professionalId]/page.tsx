import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileHeader } from "@/components/direct/profile-header";
import { PortfolioGallery } from "@/components/direct/portfolio-gallery";
import { ReviewList } from "@/components/direct/review-list";
import { ReviewForm } from "@/components/direct/review-form";
import { EnquiryForm } from "@/components/direct/enquiry-form";
import { getProfessionalProfile } from "../actions";
import { createClient } from "@/lib/supabase/server";

export default async function ProfessionalProfilePage({
  params,
}: {
  params: Promise<{ professionalId: string }>;
}) {
  const { professionalId } = await params;
  const professional = await getProfessionalProfile(professionalId);

  if (!professional) notFound();

  // Check if this is the viewer's own listing
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isOwnOrg = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .single();
    isOwnOrg = profile?.org_id === professional.org_id;
  }

  // Guard: only approved or own org
  if (professional.status !== "approved" && !isOwnOrg) notFound();

  return (
    <div className="space-y-6">
      <Link href="/direct" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" />
        Back to Directory
      </Link>

      {professional.status !== "approved" && isOwnOrg && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-700">
            This listing is <strong>{professional.status}</strong> and not yet visible to other users.
          </p>
        </div>
      )}

      <ProfileHeader
        professional={professional}
        contactButton={
          !isOwnOrg ? (
            <EnquiryForm
              professionalId={professional.id}
              companyName={professional.company_name}
            />
          ) : undefined
        }
      />

      {professional.specialisations && professional.specialisations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {professional.specialisations.map((s: { id: string; label: string }) => (
            <Badge key={s.id} variant="outline" className="text-amber-700 border-amber-300">
              {s.label}
            </Badge>
          ))}
        </div>
      )}

      <Tabs defaultValue="about">
        <TabsList>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({professional.review_count})</TabsTrigger>
        </TabsList>

        <TabsContent value="about" className="space-y-4 mt-4">
          {professional.description ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{professional.description}</p>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">No description provided.</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {professional.years_experience && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Experience</p>
                  <p className="font-semibold">{professional.years_experience} years</p>
                </CardContent>
              </Card>
            )}
            {professional.licence_number && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Licence</p>
                  <p className="font-semibold">{professional.licence_number}</p>
                </CardContent>
              </Card>
            )}
            {professional.abn && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">ABN</p>
                  <p className="font-semibold">{professional.abn}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="portfolio" className="mt-4">
          <PortfolioGallery items={professional.portfolio || []} />
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4 mt-4">
          {!isOwnOrg && <ReviewForm professionalId={professional.id} />}
          <ReviewList reviews={professional.reviews || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
