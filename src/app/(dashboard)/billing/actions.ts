"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/db";
import { stripe } from "@/lib/stripe/client";
import { PLANS, type PlanId } from "@/lib/stripe/plans";
import { getSubscriptionStatus } from "@/lib/stripe/subscription";
import { redirect } from "next/navigation";

async function getOrgWithStripeCustomer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) throw new Error("Profile not found");

  const admin = db();
  const { data: org } = await admin
    .from("organisations")
    .select("id, name, stripe_customer_id")
    .eq("id", profile.org_id)
    .single();

  if (!org) throw new Error("Organisation not found");

  // Create Stripe customer if needed
  if (!org.stripe_customer_id) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: org.name,
      metadata: { org_id: org.id },
    });

    await admin
      .from("organisations")
      .update({ stripe_customer_id: customer.id })
      .eq("id", org.id);

    return { ...org, stripe_customer_id: customer.id };
  }

  return org;
}

export async function createCheckoutSession(planId: PlanId) {
  const plan = PLANS[planId];
  if (!plan || ("isCustom" in plan && plan.isCustom)) {
    return { error: "Invalid plan" };
  }

  if (!plan.stripePriceId) {
    return { error: "Plan not configured in Stripe" };
  }

  const org = await getOrgWithStripeCustomer();

  const session = await stripe.checkout.sessions.create({
    customer: org.stripe_customer_id,
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing?canceled=true`,
    metadata: { org_id: org.id, plan_id: planId },
    subscription_data: {
      metadata: { org_id: org.id, plan_id: planId },
    },
  });

  return { clientSecret: session.client_secret, sessionId: session.id };
}

export async function createPortalSession() {
  const org = await getOrgWithStripeCustomer();

  if (!org.stripe_customer_id) {
    return { error: "No active subscription" };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing`,
  });

  redirect(session.url);
}

export async function getBillingStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return null;

  return getSubscriptionStatus(profile.org_id);
}
