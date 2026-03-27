export const PLANS = {
  basic: {
    id: "basic",
    name: "Basic",
    price: 149,
    currency: "aud",
    interval: "month" as const,
    runLimit: 10,
    features: [
      "All modules included",
      "10 compliance runs per month",
      "Standard processing",
      "Email support",
    ],
    stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || "",
  },
  professional: {
    id: "professional",
    name: "Professional",
    price: 399,
    currency: "aud",
    interval: "month" as const,
    runLimit: 30,
    features: [
      "All modules included",
      "30 compliance runs per month",
      "Priority processing",
      "Tier 2 cross-validation",
      "Priority support",
    ],
    stripePriceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || "",
    popular: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: null,
    currency: "aud",
    interval: "month" as const,
    runLimit: Infinity,
    features: [
      "All modules included",
      "Unlimited compliance runs",
      "Custom knowledge bases",
      "Dedicated support",
      "API access",
    ],
    stripePriceId: "",
    isCustom: true,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export const TRIAL_RUN_LIMIT = 3;
export const TRIAL_DAYS = 60;

export function getPlanByPriceId(priceId: string) {
  return Object.values(PLANS).find((p) => p.stripePriceId === priceId);
}
