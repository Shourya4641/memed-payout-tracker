import { Router } from "express";
import { z } from "zod";
import { Submission } from "../models/Submission";
import { applyViewUpdate } from "../services/payout.service";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { isValidObjectId } from "mongoose";
import { AppError } from "../app";
import { validateObjectId } from "../middleware/validateObjectId";

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
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      res.json(await applyViewUpdate(id, req.body.views));
    } catch (err) {
      next(err);
    }
  },
);

/** Creator: own submissions and total earnings. */
submissionRouter.get(
  "/mine",
  requireAuth,
  requireRole("creator"),
  async (req, res, next) => {
    try {
      const submissions = await Submission.find({ creator: req.user!.id })
        .populate("campaign", "name platform status")
        .sort({ createdAt: -1 });

      res.json({
        submissions,
        totalEarnings: submissions.reduce((sum, s) => sum + s.paidAmount, 0),
      });
    } catch (err) {
      next(err);
    }
  },
);
