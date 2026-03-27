import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/projects");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-xl font-bold tracking-tight">MMC Build</span>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center rounded-full border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
            AI-Powered Construction Intelligence for Australia
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            NCC Compliance in Minutes,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500">
              Not Weeks
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your plans and certifications. Get automated NCC compliance
            checks, design optimisation, cost estimation, and a network of
            MMC-capable trades — all powered by AI.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-md border px-8 text-sm font-medium shadow-sm hover:bg-accent transition-colors"
            >
              Sign In
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            60-day free trial &middot; 3 compliance runs &middot; No credit card required
          </p>
        </div>
      </section>

      {/* Modules */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl mb-4">
          Six Modules. One Platform.
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
          Everything an Australian residential builder needs — from compliance to costing to crew.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              name: "MMC Comply",
              description:
                "Automated NCC compliance checking with AI cross-validation. Upload plans, get findings in minutes.",
              color: "from-blue-500 to-blue-600",
            },
            {
              name: "MMC Build",
              description:
                "AI design optimisation for modular and prefab construction. Reduce waste, improve buildability.",
              color: "from-teal-500 to-teal-600",
            },
            {
              name: "MMC Quote",
              description:
                "Agentic cost estimation with 70+ Australian rate benchmarks. Traditional vs MMC cost comparison.",
              color: "from-violet-500 to-violet-600",
            },
            {
              name: "MMC Direct",
              description:
                "Find MMC-capable trades across Australia. Verified professionals with reviews and portfolios.",
              color: "from-orange-500 to-orange-600",
            },
            {
              name: "MMC Train",
              description:
                "AI-generated training modules for your team. Upskill on modern methods of construction.",
              color: "from-pink-500 to-pink-600",
            },
            {
              name: "Billing & Usage",
              description:
                "Pay-per-run pricing with clear usage tracking. Basic, Professional, and Enterprise plans.",
              color: "from-emerald-500 to-emerald-600",
            },
          ].map((mod) => (
            <div
              key={mod.name}
              className="group rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div
                className={`mb-3 h-1.5 w-10 rounded-full bg-gradient-to-r ${mod.color}`}
              />
              <h3 className="font-semibold text-lg">{mod.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {mod.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Start with a free trial. Upgrade when you&apos;re ready.
          </p>
          <div className="grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
            {[
              {
                plan: "Basic",
                price: "$149",
                runs: "10 compliance runs/mo",
                features: [
                  "NCC compliance checking",
                  "Design optimisation",
                  "Cost estimation",
                  "Email support",
                ],
              },
              {
                plan: "Professional",
                price: "$399",
                runs: "30 compliance runs/mo",
                features: [
                  "Everything in Basic",
                  "AI cross-validation",
                  "Trade directory access",
                  "Training modules",
                  "Priority support",
                ],
                featured: true,
              },
              {
                plan: "Enterprise",
                price: "Custom",
                runs: "Unlimited runs",
                features: [
                  "Everything in Professional",
                  "Custom integrations",
                  "Dedicated account manager",
                  "On-premise option",
                  "SLA guarantee",
                ],
              },
            ].map((tier) => (
              <div
                key={tier.plan}
                className={`rounded-xl border bg-card p-6 shadow-sm ${
                  tier.featured
                    ? "ring-2 ring-primary shadow-md relative"
                    : ""
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <h3 className="font-semibold text-lg">{tier.plan}</h3>
                <div className="mt-3">
                  <span className="text-3xl font-bold">{tier.price}</span>
                  {tier.price !== "Custom" && (
                    <span className="text-muted-foreground">/mo</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tier.runs}
                </p>
                <ul className="mt-6 space-y-2">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm"
                    >
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-6 inline-flex h-10 w-full items-center justify-center rounded-md text-sm font-medium transition-colors ${
                    tier.featured
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border hover:bg-accent"
                  }`}
                >
                  {tier.price === "Custom" ? "Contact Us" : "Start Free Trial"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Ready to modernise your compliance workflow?
        </h2>
        <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
          Join Australian builders who are saving weeks on NCC compliance with AI-powered automation.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-flex h-11 items-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          Start Your Free Trial
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} MMC Build Pty Ltd. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
