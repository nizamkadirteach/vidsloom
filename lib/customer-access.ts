import "server-only";

import crypto from "node:crypto";

import type { BillingCustomer, CustomerPortalAccess } from "@/lib/schemas";
import { getBillingCustomer, saveBillingCustomer } from "@/lib/storage";

export function createPortalAccessToken() {
  return `portal_${crypto.randomBytes(32).toString("hex")}`;
}

export async function ensureCustomerPortalAccess(customer: BillingCustomer) {
  if (customer.portalAccessToken) return customer;

  return saveBillingCustomer({
    ...customer,
    updatedAt: new Date().toISOString(),
    portalAccessToken: createPortalAccessToken()
  });
}

export async function authorizeCustomerPortal(input: CustomerPortalAccess) {
  const customer = await getBillingCustomer(input.customerId);
  if (!customer?.portalAccessToken) return null;
  if (!timingSafeEqual(customer.portalAccessToken, input.accessToken)) return null;

  return customer;
}

export function buildCustomerPortalUrl(origin: string, customer: BillingCustomer) {
  const url = new URL("/portal", origin);
  url.searchParams.set("customer", customer.id);
  url.searchParams.set("token", customer.portalAccessToken);
  return url.toString();
}

export function planDeliveryProfile(plan: BillingCustomer["plan"]) {
  if (plan === "growth") {
    return {
      label: "Growth",
      videosPerMonth: 10,
      platforms: 2,
      cadence: "5 posts/week" as const,
      reviewRhythm: "Monthly production queue with trend refresh"
    };
  }

  if (plan === "managed") {
    return {
      label: "Managed",
      videosPerMonth: 20,
      platforms: 6,
      cadence: "Launch sprint" as const,
      reviewRhythm: "Managed planning and reporting"
    };
  }

  return {
    label: "Starter",
    videosPerMonth: 4,
    platforms: 1,
    cadence: "3 posts/week" as const,
    reviewRhythm: "Approval-first monthly queue"
  };
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
