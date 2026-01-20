import mongoose, { Schema, type InferSchemaType } from "mongoose";

const roleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    permissions: { type: [String], required: true, default: [] },
  },
  { timestamps: true },
);

roleSchema.index({ name: 1 }, { unique: true });

export type RoleDoc = InferSchemaType<typeof roleSchema>;
export const Role = mongoose.model("Role", roleSchema);
