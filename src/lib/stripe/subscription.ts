import { db } from "@/lib/supabase/db";
import { PLANS, TRIAL_RUN_LIMIT, TRIAL_DAYS } from "./plans";

export type SubscriptionStatus = {
  tier: "trial" | "basic" | "professional" | "enterprise" | "expired";
  status: "active" | "past_due" | "canceled" | "trialing" | "expired" | "incomplete";
  usageCount: number;
  usageLimit: number;
  canRunCheck: boolean;
  trialEndsAt: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number | null;
};

export async function getSubscriptionStatus(orgId: string): Promise<SubscriptionStatus> {
  const admin = db();

  // Check for active subscription
  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("org_id", orgId)
    .in("status", ["active", "past_due", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (sub) {
    const plan = PLANS[sub.plan_id as keyof typeof PLANS];
    const usageLimit = plan?.runLimit ?? 10;

    return {
      tier: sub.plan_id as SubscriptionStatus["tier"],
      status: sub.status,
      usageCount: sub.usage_count,
      usageLimit,
      canRunCheck: sub.status === "active" && sub.usage_count < usageLimit,
      trialEndsAt: null,
      periodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      daysRemaining: sub.current_period_end
        ? Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    };
  }

  // No subscription — check trial status
  const { data: org } = await admin
    .from("organisations")
    .select("trial_started_at, trial_ends_at, trial_usage_count")
    .eq("id", orgId)
    .single();

  if (!org) {
    return {
      tier: "expired",
      status: "expired",
      usageCount: 0,
      usageLimit: 0,
      canRunCheck: false,
      trialEndsAt: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      daysRemaining: null,
    };
  }

  const trialEndsAt = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const trialExpired = trialEndsAt ? trialEndsAt < new Date() : true;
  const trialUsage = org.trial_usage_count ?? 0;
  const trialDaysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  if (trialExpired || trialUsage >= TRIAL_RUN_LIMIT) {
    return {
      tier: "expired",
      status: "expired",
      usageCount: trialUsage,
      usageLimit: TRIAL_RUN_LIMIT,
      canRunCheck: false,
      trialEndsAt: org.trial_ends_at,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      daysRemaining: 0,
    };
  }

  return {
    tier: "trial",
    status: "trialing",
    usageCount: trialUsage,
    usageLimit: TRIAL_RUN_LIMIT,
    canRunCheck: true,
    trialEndsAt: org.trial_ends_at,
    periodEnd: null,
    cancelAtPeriodEnd: false,
    daysRemaining: trialDaysRemaining,
  };
}

export async function checkAndIncrementUsage(orgId: string): Promise<{
  allowed: boolean;
  newCount: number;
  limit: number;
  tier: string;
}> {
  const status = await getSubscriptionStatus(orgId);

  if (!status.canRunCheck) {
    return {
      allowed: false,
      newCount: status.usageCount,
      limit: status.usageLimit,
      tier: status.tier,
    };
  }

  // Atomic increment via SQL function
  const admin = db();
  const { data: newCount } = await admin.rpc("increment_usage", { p_org_id: orgId });

  return {
    allowed: true,
    newCount: newCount ?? status.usageCount + 1,
    limit: status.usageLimit,
    tier: status.tier,
  };
}
