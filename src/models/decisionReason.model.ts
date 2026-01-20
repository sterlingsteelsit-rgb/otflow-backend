import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    type: { type: String, enum: ["APPROVE", "REJECT"], required: true },
    label: { type: String, required: true },
    active: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const DecisionReason = mongoose.model("DecisionReason", schema);
