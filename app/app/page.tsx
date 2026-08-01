import { VidsloomWorkbench } from "@/app/components/vidsloom-workbench";
import { hasValidSessionFromNextCookies } from "@/lib/auth";
import { toPublicCampaign } from "@/lib/public-campaign";
import { listCampaigns } from "@/lib/storage";
import { redirect } from "next/navigation";

export default async function CampaignEnginePage() {
  if (!(await hasValidSessionFromNextCookies())) {
    redirect("/login?next=/app");
  }

  const campaigns = await listCampaigns();
  return <VidsloomWorkbench initialCampaigns={campaigns.map(toPublicCampaign)} />;
}
