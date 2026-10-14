import { Schema, model, type InferSchemaType } from "mongoose";

const submissionSchema = new Schema(
  {
    campaign: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    url: { type: String, required: true, trim: true },
    views: { type: Number, required: true, default: 0, min: 0 },
    paidAmount: { type: Number, required: true, default: 0, min: 0 },
    flagged: { type: Boolean, required: true, default: false },
    lastViewsAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One submission per post per campaign.
submissionSchema.index({ campaign: 1, url: 1 }, { unique: true });

export type SubmissionDoc = InferSchemaType<typeof submissionSchema>;
export const Submission = model("Submission", submissionSchema);
