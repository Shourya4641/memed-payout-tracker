import { Router } from "express";
import { AppError } from "../errors/errors";
import { Campaign } from "../models/Campaign";
import { Submission } from "../models/Submission";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { validateObjectId } from "../middleware/validateObjectId";
import { asyncHandler } from "../middleware/asyncHandler";
import { serialiseCampaign, serialiseSubmission } from "../http/serialisers";
import {
  createCampaignSchema,
  createSubmissionSchema,
} from "../schemas/zod.schemas";
import { CampaignStatus, HttpStatus, Role } from "../config/constants";

export const campaignRouter = Router();

/** Brand: create a campaign. */
campaignRouter.post(
  "/",
  requireAuth,
  requireRole(Role.Brand),
  validateBody(createCampaignSchema),
  asyncHandler(async (req, res) => {
    const { name, platform, budget, ladder } = req.body;

    const topPayout = Math.max(
      ...ladder.map((m: { payout: number }) => m.payout),
    );

    if (topPayout > budget) {
      throw new AppError(
        HttpStatus.BadRequest,
        "LADDER_EXCEEDS_BUDGET",
        `Top milestone (${topPayout}) exceeds the campaign budget (${budget})`,
      );
    }

    const campaign = await Campaign.create({
      brand: req.user!.id,
      name,
      platform,
      budget,
      ladder,
    });

    res
      .status(HttpStatus.Created)
      .json({ campaign: serialiseCampaign(campaign) });
  }),
);

/** Brand: own campaigns with spend figures. */
campaignRouter.get(
  "/mine",
  requireAuth,
  requireRole(Role.Brand),
  asyncHandler(async (req, res) => {
    const campaigns = await Campaign.find({ brand: req.user!.id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ campaigns: campaigns.map(serialiseCampaign) });
  }),
);

/** Creator: browse live campaigns. */
campaignRouter.get(
  "/",
  requireAuth,
  requireRole(Role.Creator),
  asyncHandler(async (_req, res) => {
    const campaigns = await Campaign.find({ status: CampaignStatus.Live })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ campaigns: campaigns.map(serialiseCampaign) });
  }),
);

/** Creator: submit a post to a campaign. */
campaignRouter.post(
  "/:id/submissions",
  requireAuth,
  requireRole(Role.Creator),
  validateObjectId(),
  validateBody(createSubmissionSchema),
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign)
      throw new AppError(
        HttpStatus.NotFound,
        "NOT_FOUND",
        "Campaign not found",
      );
    if (campaign.status !== CampaignStatus.Live) {
      throw new AppError(
        HttpStatus.Conflict,
        "CAMPAIGN_NOT_LIVE",
        `Campaign is ${campaign.status}`,
      );
    }

    let submission;
    try {
      submission = await Submission.create({
        campaign: campaign._id,
        creator: req.user!.id,
        url: req.body.url,
      });
    } catch (err) {
      // Unique index on (campaign, url)
      if ((err as { code?: number }).code === 11000) {
        throw new AppError(
          HttpStatus.Conflict,
          "DUPLICATE_SUBMISSION",
          "That link is already submitted",
        );
      }
      throw err;
    }

    res
      .status(HttpStatus.Created)
      .json({ submission: serialiseSubmission(submission) });
  }),
);
