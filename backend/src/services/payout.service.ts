import mongoose from "mongoose";
import { AppError } from "../app";
import { Campaign } from "../models/Campaign";
import { Submission } from "../models/Submission";
import { computePayout } from "../domain/payout";

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
 *
 * Two guarantees, by two different mechanisms:
 *  - No double-pay: the amount is derived from stored `paidAmount`, so replaying
 *    an identical update computes toPay = 0. Idempotent by construction.
 *  - No overspend: the campaign's `spent` is raised by a conditional $inc that
 *    only matches while spent + toPay <= budget, inside a transaction so the
 *    submission's paidAmount and the campaign's spent move together or not at all.
 */
export async function applyViewUpdate(
  submissionId: string,
  incomingViews: number,
): Promise<ViewUpdateResult> {
  const session = await mongoose.startSession();

  try {
    let result!: ViewUpdateResult;

    // withTransaction retries automatically on TransientTransactionError,
    // which is what a concurrent write to the same campaign produces.
    await session.withTransaction(async () => {
      const sub = await Submission.findById(submissionId).session(session);
      if (!sub) throw new AppError(404, "NOT_FOUND", "Submission not found");

      const campaign = await Campaign.findById(sub.campaign).session(session);
      if (!campaign) throw new AppError(404, "NOT_FOUND", "Campaign not found");

      // Views are monotonic: a stale or lower reading never triggers a clawback.
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

        // Redundant inside a transaction, kept so that a future refactor which
        // drops the transaction still cannot overspend.
        if (res.modifiedCount !== 1) {
          throw new AppError(
            409,
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
      if (status === "live" && newSpent >= campaign.budget) {
        status = "exhausted";
        await Campaign.updateOne(
          { _id: campaign._id },
          { $set: { status: "exhausted" } },
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
