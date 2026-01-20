import mongoose, { Schema, type InferSchemaType, Types } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },

    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    canApprove: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.index({ email: "text", username: "text" });
userSchema.index({ roleId: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: Types.ObjectId;
};
export const User = mongoose.model("User", userSchema);
