import type { CampaignDoc } from "../models/Campaign";
import type { SubmissionDoc } from "../models/Submission";

type WithId<T> = T & { _id: unknown };

/** `remaining` is derived on read — two stored copies of a budget drift apart. */
export function serialiseCampaign(c: WithId<CampaignDoc>) {
  return {
    id: String(c._id),
    name: c.name,
    platform: c.platform,
    budget: c.budget,
    spent: c.spent,
    remaining: c.budget - c.spent,
    ladder: c.ladder,
    status: c.status,
  };
}

type PopulatedCampaign = {
  _id: unknown;
  name: string;
  platform: string;
  status: string;
};

function isPopulated(value: unknown): value is PopulatedCampaign {
  return typeof value === "object" && value !== null && "name" in value;
}

export function serialiseSubmission(s: WithId<SubmissionDoc>) {
  return {
    id: String(s._id),
    url: s.url,
    views: s.views,
    paidAmount: s.paidAmount,
    flagged: s.flagged,
    campaign: isPopulated(s.campaign)
      ? {
          id: String(s.campaign._id),
          name: s.campaign.name,
          platform: s.campaign.platform,
          status: s.campaign.status,
        }
      : null,
  };
}
