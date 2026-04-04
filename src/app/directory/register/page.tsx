"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitPublicListing } from "./actions";

const TRADE_CATEGORIES = [
  "Structural Engineer",
  "Building Designer",
  "Architect",
  "Building Surveyor",
  "SIP Manufacturer",
  "CLT Supplier",
  "Steel Fabricator",
  "Timber Frame Manufacturer",
  "Modular Builder",
  "Electrician",
  "Plumber",
  "HVAC Specialist",
  "Fire Engineer",
  "Energy Assessor",
  "Quantity Surveyor",
  "Project Manager",
  "Other",
];

const AU_REGIONS = [
  "Sydney",
  "Melbourne",
  "Brisbane",
  "Perth",
  "Adelaide",
  "Hobart",
  "Darwin",
  "Canberra",
  "Regional NSW",
  "Regional VIC",
  "Regional QLD",
  "Regional WA",
  "Regional SA",
  "Regional TAS",
  "Nationwide",
];

export default function PublicDirectoryRegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function toggleRegion(region: string) {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);

    const result = await submitPublicListing({
      company_name: form.get("company_name") as string,
      abn: (form.get("abn") as string) || undefined,
      categories: selectedCategories,
      contact_name: form.get("contact_name") as string,
      contact_email: form.get("contact_email") as string,
      contact_phone: (form.get("contact_phone") as string) || undefined,
      location: (form.get("location") as string) || undefined,
      service_area: selectedRegions,
      licences_held: (form.get("licences_held") as string) || undefined,
      description: (form.get("description") as string) || undefined,
      honeypot: (form.get("website_url") as string) || undefined,
    });

    setLoading(false);

    if ("error" in result) {
      setError(result.error ?? "Unknown error");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center text-center py-12">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold">Submission Received!</h2>
            <p className="text-muted-foreground mt-2">
              We&apos;ll review your listing and notify you by email once it&apos;s approved.
              This usually takes 1-2 business days.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Join the MMC Build Directory</h1>
          <p className="text-muted-foreground mt-2">
            Register your company to be found by builders and developers using Modern Methods of Construction.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>
              No account required. Fill in your details and we&apos;ll review your listing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Honeypot — invisible to humans, bots auto-fill it */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
                <label htmlFor="website_url">Website URL</label>
                <input
                  type="text"
                  id="website_url"
                  name="website_url"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Company info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input id="company_name" name="company_name" required />
                </div>
                <div>
                  <Label htmlFor="abn">ABN</Label>
                  <Input id="abn" name="abn" placeholder="XX XXX XXX XXX" />
                </div>
              </div>

              {/* Categories */}
              <div>
                <Label>Trade Categories *</Label>
                <p className="text-xs text-muted-foreground mb-2">Select all that apply</p>
                <div className="flex flex-wrap gap-1.5">
                  {TRADE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        selectedCategories.includes(cat)
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {selectedCategories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedCategories.map((c) => (
                      <Badge key={c} variant="secondary" className="bg-amber-100 text-amber-800">
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contact_name">Contact Name *</Label>
                  <Input id="contact_name" name="contact_name" required />
                </div>
                <div>
                  <Label htmlFor="contact_email">Contact Email *</Label>
                  <Input id="contact_email" name="contact_email" type="email" required />
                </div>
              </div>
              <div>
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input id="contact_phone" name="contact_phone" />
              </div>

              {/* Location */}
              <div>
                <Label htmlFor="location">Business Location</Label>
                <Input id="location" name="location" placeholder="e.g. Sydney CBD, NSW" />
              </div>

              <div>
                <Label>Service Areas</Label>
                <p className="text-xs text-muted-foreground mb-2">Where do you operate?</p>
                <div className="flex flex-wrap gap-1.5">
                  {AU_REGIONS.map((region) => (
                    <button
                      key={region}
                      type="button"
                      onClick={() => toggleRegion(region)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        selectedRegions.includes(region)
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>

              {/* Licences + Description */}
              <div>
                <Label htmlFor="licences_held">Licences Held</Label>
                <Input
                  id="licences_held"
                  name="licences_held"
                  placeholder="e.g. NSW Builder Licence #12345, RPEQ"
                />
              </div>

              <div>
                <Label htmlFor="description">Company Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="Tell us about your company and MMC capabilities..."
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700"
                disabled={loading || selectedCategories.length === 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Listing"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
