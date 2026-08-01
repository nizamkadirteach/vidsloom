import { ArrowLeft, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CustomerPortal } from "@/app/components/customer-portal";
import { authorizeCustomerPortal, ensureCustomerPortalAccess, planDeliveryProfile } from "@/lib/customer-access";
import { toPublicCampaign } from "@/lib/public-campaign";
import {
  getBillingCustomerByCheckoutSessionId,
  getCampaign,
  getCustomerOnboardingByCustomerId,
  listCustomerAssetsForCustomer,
  listSocialConnections,
  listCustomerCampaignReviewsForCustomer,
  saveBillingCustomer
} from "@/lib/storage";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PortalPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sessionId = singleParam(params.session_id);
  if (sessionId) {
    const sessionCustomer = await getBillingCustomerByCheckoutSessionId(sessionId);
    if (sessionCustomer) {
      const portalCustomer = await ensureCustomerPortalAccess(sessionCustomer);
      redirect(`/portal?customer=${encodeURIComponent(portalCustomer.id)}&token=${encodeURIComponent(portalCustomer.portalAccessToken)}`);
    }
  }

  const customerId = singleParam(params.customer);
  const accessToken = singleParam(params.token);
  const customer =
    customerId && accessToken ? await authorizeCustomerPortal({ customerId, accessToken }) : null;

  if (!customer) {
    return (
      <main className="siteShell portalPage">
        <header className="siteNav" aria-label="Primary navigation">
          <Link className="siteBrand" href="/">
            <Image src="/brand/VIDSLOOM_Logo.png" alt="VIDSLOOM logo" width={36} height={36} priority unoptimized />
            <span>VIDSLOOM</span>
          </Link>
          <nav>
            <Link href="/">
              <ArrowLeft size={16} />
              Home
            </Link>
            <Link className="navAction" href="/growth-audit">
              <Sparkles size={17} />
              Contact
            </Link>
          </nav>
        </header>
        <section className="portalInvalid">
          <p className="siteEyebrow">Customer Portal</p>
          <h1>This portal link is not available.</h1>
          <p>Use the link from your VIDSLOOM checkout confirmation or contact VIDSLOOM for a fresh onboarding link.</p>
          <Link className="siteButton primarySiteButton" href="/growth-audit">
            Contact VIDSLOOM
          </Link>
        </section>
      </main>
    );
  }

  const now = new Date().toISOString();
  const accessedCustomer = await saveBillingCustomer({
    ...customer,
    portalLastAccessAt: now
  });
  const onboarding = await getCustomerOnboardingByCustomerId(customer.id);
  const generatedCampaigns = await Promise.all(
    (onboarding?.generatedCampaignIds ?? []).slice(0, 3).map(async (id) => {
      const campaign = await getCampaign(id);
      return campaign ? { id, campaign: toPublicCampaign(campaign) } : null;
    })
  );
  const campaignReviews = await listCustomerCampaignReviewsForCustomer(customer.id, 20);
  const socialConnections = await listSocialConnections({ customerId: customer.id });
  const customerAssets = await listCustomerAssetsForCustomer(customer.id, 200);

  return (
    <main className="siteShell portalPage">
      <header className="siteNav" aria-label="Primary navigation">
        <Link className="siteBrand" href="/">
          <Image src="/brand/VIDSLOOM_Logo.png" alt="VIDSLOOM logo" width={36} height={36} priority unoptimized />
          <span>VIDSLOOM</span>
        </Link>
        <nav>
          <Link href="/">
            <ArrowLeft size={16} />
            Home
          </Link>
          <Link className="navAction" href="/growth-audit">
            <Sparkles size={17} />
            Contact
          </Link>
        </nav>
      </header>
      <CustomerPortal
        accessToken={accessToken}
        customer={{
          id: accessedCustomer.id,
          businessName: accessedCustomer.businessName,
          contactName: accessedCustomer.contactName,
          email: accessedCustomer.email,
          phone: accessedCustomer.phone,
          plan: accessedCustomer.plan,
          status: accessedCustomer.status,
          onboardingStatus: accessedCustomer.onboardingStatus,
          amountTotal: accessedCustomer.amountTotal,
          currency: accessedCustomer.currency,
          createdAt: accessedCustomer.createdAt
        }}
        initialOnboarding={onboarding}
        initialCampaigns={generatedCampaigns.filter(Boolean) as NonNullable<(typeof generatedCampaigns)[number]>[]}
        initialReviews={campaignReviews}
        initialAssets={customerAssets}
        initialSocialConnections={socialConnections.map((connection) => ({
          id: connection.id,
          platform: connection.platform,
          status: connection.status,
          handle: connection.handle,
          accountName: connection.accountName,
          autoPublish: connection.autoPublish,
          scopes: connection.scopes,
          expiresAt: connection.expiresAt,
          updatedAt: connection.updatedAt
        }))}
        planProfile={planDeliveryProfile(accessedCustomer.plan)}
      />
    </main>
  );
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}
