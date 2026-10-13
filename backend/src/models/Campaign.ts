import { Schema, model, type InferSchemaType } from "mongoose";

const milestoneSchema = new Schema(
  {
    views: { type: Number, required: true },
    payout: { type: Number, required: true },
  },
  { _id: false },
);

const campaignSchema = new Schema(
  {
    brand: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    platform: { type: String, required: true, enum: ["instagram", "youtube"] },
    budget: { type: Number, required: true, min: 1 },
    // Monotonically increasing. Never exceeds budget — enforced by a guarded $inc.
    spent: { type: Number, required: true, default: 0, min: 0 },
    ladder: { type: [milestoneSchema], required: true },
    status: {
      type: String,
      required: true,
      default: "live",
      enum: ["live", "exhausted", "ended"],
    },
  },
  { timestamps: true },
);

export type CampaignDoc = InferSchemaType<typeof campaignSchema>;
export const Campaign = model("Campaign", campaignSchema);
