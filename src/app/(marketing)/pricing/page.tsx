import type { Metadata } from "next";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = {
  title: "MMC Build Pricing — Plans for Every Construction Professional",
  description:
    "Transparent pricing for MMC Build platform. Choose the plan that fits your needs — from individual professionals to enterprise teams. First month free.",
};

export default function PricingPage() {
  return <PricingClient />;
}
