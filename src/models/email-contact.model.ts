import { Schema, model, Document } from "mongoose";

export interface IEmailContact extends Document {
  name: string;
  email: string;
  department?: string;
  role?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const emailContactSchema = new Schema<IEmailContact>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

emailContactSchema.index({ name: "text", email: "text", department: "text" });

export const EmailContactModel = model<IEmailContact>(
  "EmailContact",
  emailContactSchema,
);
