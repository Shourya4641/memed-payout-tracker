import { Router } from "express";
import { z } from "zod";
import { Submission } from "../models/Submission";
import { applyViewUpdate } from "../services/payout.service";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { AppError } from "../errors/errors";
import { validateObjectId } from "../middleware/validateObjectId";
import { asyncHandler } from "../middleware/asyncHandler";
import { serialiseSubmission } from "../http/serialisers";

const updateViewsSchema = z.object({
  views: z.number().int().nonnegative(),
});

export const submissionRouter = Router();

/**
 * Simulates a platform webhook. Deliberately unauthenticated per the brief —
 * in production this would be service-to-service authenticated and rate limited.
 */
submissionRouter.patch(
  "/:id/views",
  validateObjectId(),
  validateBody(updateViewsSchema),
  asyncHandler(async (req, res) => {
    res.json(await applyViewUpdate(String(req.params.id), req.body.views));
  }),
);

/** Creator: own submissions and total earnings. */
submissionRouter.get(
  "/mine",
  requireAuth,
  requireRole("creator"),
  asyncHandler(async (req, res) => {
    const submissions = await Submission.find({ creator: req.user!.id })
      .populate("campaign", "name platform status")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      submissions: submissions.map(serialiseSubmission),
      totalEarnings: submissions.reduce((sum, s) => sum + s.paidAmount, 0),
    });
  }),
);
