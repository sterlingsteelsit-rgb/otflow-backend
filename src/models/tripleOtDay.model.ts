import mongoose, { Schema, type InferSchemaType, Types } from "mongoose";

const tripleOtDaySchema = new Schema(
  {
    date: { type: String, required: true, unique: true, trim: true }, // YYYY-MM-DD
    note: { type: String, required: false, trim: true },
  },
  { timestamps: true },
);

tripleOtDaySchema.index({ date: 1 }, { unique: true });

export type TripleOtDayDoc = InferSchemaType<typeof tripleOtDaySchema> & {
  _id: Types.ObjectId;
};
export const TripleOtDay = mongoose.model("TripleOtDay", tripleOtDaySchema);
