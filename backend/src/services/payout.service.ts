import mongoose from "mongoose";
import { AppError } from "../errors/errors";
import { Campaign } from "../models/Campaign";
import { Submission } from "../models/Submission";
import { computePayout } from "../domain/payout";
import { CampaignStatus, HttpStatus } from "../config/constants";

export interface ViewUpdateResult {
  submissionId: string;
  views: number;
  paidNow: number;
  totalPaid: number;
  shortfall: number;
  campaignStatus: string;
}

/**
 * Applies a view update and pays any newly-owed amount.
 */
export async function applyViewUpdate(
  submissionId: string,
  incomingViews: number,
): Promise<ViewUpdateResult> {
  const session = await mongoose.startSession();

  try {
    let result!: ViewUpdateResult;

    await session.withTransaction(async () => {
      const sub = await Submission.findById(submissionId).session(session);
      if (!sub)
        throw new AppError(
          HttpStatus.NotFound,
          "NOT_FOUND",
          "Submission not found",
        );

      const campaign = await Campaign.findById(sub.campaign).session(session);
      if (!campaign)
        throw new AppError(
          HttpStatus.NotFound,
          "NOT_FOUND",
          "Campaign not found",
        );

      const views = Math.max(sub.views, incomingViews);

      const { toPay, shortfall } = computePayout({
        views,
        ladder: campaign.ladder,
        alreadyPaid: sub.paidAmount,
        remainingBudget: campaign.budget - campaign.spent,
      });

      if (toPay > 0) {
        const res = await Campaign.updateOne(
          {
            _id: campaign._id,
            $expr: { $lte: [{ $add: ["$spent", toPay] }, "$budget"] },
          },
          { $inc: { spent: toPay } },
          { session },
        );

        if (res.modifiedCount !== 1) {
          throw new AppError(
            HttpStatus.Conflict,
            "BUDGET_CONFLICT",
            "Budget changed concurrently; retry",
          );
        }
      }

      sub.views = views;
      sub.paidAmount += toPay;
      sub.lastViewsAt = new Date();
      await sub.save({ session });

      const newSpent = campaign.spent + toPay;
      let status = campaign.status;
      if (status === CampaignStatus.Live && newSpent >= campaign.budget) {
        status = CampaignStatus.Exhausted;
        await Campaign.updateOne(
          { _id: campaign._id },
          { $set: { status: CampaignStatus.Exhausted } },
          { session },
        );
      }

      result = {
        submissionId: String(sub._id),
        views,
        paidNow: toPay,
        totalPaid: sub.paidAmount,
        shortfall,
        campaignStatus: status,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}
