import { Schema, model, type InferSchemaType } from "mongoose";
import { CampaignStatus, Platform } from "../config/constants";

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
    platform: { type: String, required: true, enum: Object.values(Platform) },
    budget: { type: Number, required: true, min: 1 },
    spent: { type: Number, required: true, default: 0, min: 0 },
    ladder: { type: [milestoneSchema], required: true },
    status: {
      type: String,
      required: true,
      default: CampaignStatus.Live,
      enum: Object.values(CampaignStatus),
    },
  },
  { timestamps: true },
);

export type CampaignDoc = InferSchemaType<typeof campaignSchema>;
export const Campaign = model("Campaign", campaignSchema);
