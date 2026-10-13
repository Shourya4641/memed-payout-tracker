import { Router } from "express";
import { z } from "zod";
import { AppError } from "../errors/errors";
import { Campaign } from "../models/Campaign";
import { Submission } from "../models/Submission";
import { ladderSchema } from "../domain/ladder";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { validateObjectId } from "../middleware/validateObjectId";
import { asyncHandler } from "../middleware/asyncHandler";
import { serialiseCampaign, serialiseSubmission } from "../http/serialisers";

const createCampaignSchema = z.object({
  name: z.string().min(1).max(120),
  platform: z.enum(["instagram", "youtube"]),
  budget: z.number().int().positive(),
  ladder: ladderSchema,
});

const createSubmissionSchema = z.object({
  url: z.url(),
});

export const campaignRouter = Router();

/** Brand: create a campaign. */
campaignRouter.post(
  "/",
  requireAuth,
  requireRole("brand"),
  validateBody(createCampaignSchema),
  asyncHandler(async (req, res) => {
    const { name, platform, budget, ladder } = req.body;

    // A top milestone above the budget can never be fully paid.
    const topPayout = Math.max(
      ...ladder.map((m: { payout: number }) => m.payout),
    );
    if (topPayout > budget) {
      throw new AppError(
        400,
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
    res.status(201).json({ campaign: serialiseCampaign(campaign) });
  }),
);

/** Brand: own campaigns with spend figures. */
campaignRouter.get(
  "/mine",
  requireAuth,
  requireRole("brand"),
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
  requireRole("creator"),
  asyncHandler(async (_req, res) => {
    const campaigns = await Campaign.find({ status: "live" })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ campaigns: campaigns.map(serialiseCampaign) });
  }),
);

/** Creator: submit a post to a campaign. */
campaignRouter.post(
  "/:id/submissions",
  requireAuth,
  requireRole("creator"),
  validateObjectId(),
  validateBody(createSubmissionSchema),
  async (req, res, next) => {
    try {
      const campaign = await Campaign.findById(req.params.id);
      if (!campaign) throw new AppError(404, "NOT_FOUND", "Campaign not found");
      if (campaign.status !== "live") {
        throw new AppError(
          409,
          "CAMPAIGN_NOT_LIVE",
          `Campaign is ${campaign.status}`,
        );
      }

      const submission = await Submission.create({
        campaign: campaign._id,
        creator: req.user!.id,
        url: req.body.url,
      });
      res.status(201).json({ submission: serialiseSubmission(submission) });
    } catch (err) {
      // Unique index on { campaign, url } — duplicate link.
      if ((err as { code?: number }).code === 11000) {
        return next(
          new AppError(
            409,
            "DUPLICATE_SUBMISSION",
            "That link is already submitted",
          ),
        );
      }
      next(err);
    }
  },
);

