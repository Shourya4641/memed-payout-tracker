import { z } from "zod";

export const milestoneSchema = z.object({
  views: z.number().int().positive(),
  payout: z.number().int().positive(),
});

export const ladderSchema = z
  .array(milestoneSchema)
  .min(1, "Ladder needs at least one milestone")
  .superRefine((ladder, ctx) => {
    const sorted = [...ladder].sort((a, b) => a.views - b.views);

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].views === sorted[i - 1].views) {
        ctx.addIssue({ code: "custom", message: "Duplicate view thresholds" });
      }
      if (sorted[i].payout <= sorted[i - 1].payout) {
        ctx.addIssue({
          code: "custom",
          message: "Payouts must increase with view thresholds",
        });
      }
    }
  });
