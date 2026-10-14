import { Schema, model, type InferSchemaType } from "mongoose";
import { Role } from "../config/constants";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: Object.values(Role) },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
