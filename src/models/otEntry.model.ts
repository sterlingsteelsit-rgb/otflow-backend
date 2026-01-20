import mongoose, { Schema, type InferSchemaType, Types } from "mongoose";

const otEntrySchema = new Schema(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    workDate: { type: String, required: true, index: true },

    shift: { type: String, required: true, trim: true },
    inTime: {
      type: String,
      required: function (this: any) {
        return this.shift !== "NO_SHIFT";
      },
      trim: true,
    },
    outTime: {
      type: String,
      required: function (this: any) {
        return this.shift !== "NO_SHIFT";
      },
      trim: true,
    },
    reason: { type: String, required: false, trim: true },

    normalMinutes: { type: Number, required: true, default: 0 },
    doubleMinutes: { type: Number, required: true, default: 0 },
    tripleMinutes: { type: Number, required: true, default: 0 },
    isNight: { type: Boolean, required: true, default: false },

    approvedNormalMinutes: { type: Number, required: true, default: 0 },
    approvedDoubleMinutes: { type: Number, required: true, default: 0 },
    approvedTripleMinutes: { type: Number, required: true, default: 0 },
    approvedTotalMinutes: { type: Number, required: true, default: 0 },

    isApprovedOverride: { type: Boolean, required: true, default: false },

    status: { type: String, required: true, default: "PENDING", index: true },
    decisionReason: { type: String, required: false, trim: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
    decidedAt: { type: Date, required: false },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
  },
  { timestamps: true },
);

otEntrySchema.index({ employeeId: 1, workDate: 1 }, { unique: true });
otEntrySchema.index({ workDate: 1, status: 1 });
otEntrySchema.index({ status: 1, createdAt: -1 });
otEntrySchema.index({ status: 1, workDate: -1, createdAt: -1 });
otEntrySchema.index({ workDate: -1, createdAt: -1 });
otEntrySchema.index({ employeeId: 1, workDate: -1 });

export type OtEntryDoc = InferSchemaType<typeof otEntrySchema> & {
  _id: Types.ObjectId;
};
export const OtEntry = mongoose.model("OtEntry", otEntrySchema);
