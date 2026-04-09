import { Schema, model, Document } from "mongoose";

export type EmailSendStatus = "PENDING" | "SENT" | "FAILED";

export interface IEmailAudit extends Document {
  requestedByUserId?: string;
  requestedByEmail?: string;
  fromEmail: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyPreview: string;
  status: EmailSendStatus;
  provider: "M365_GRAPH";
  errorMessage?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const emailAuditSchema = new Schema<IEmailAudit>(
  {
    requestedByUserId: { type: String },
    requestedByEmail: { type: String },
    fromEmail: { type: String, required: true },
    to: [{ type: String, required: true }],
    cc: [{ type: String }],
    bcc: [{ type: String }],
    subject: { type: String, required: true, trim: true },
    bodyPreview: { type: String, required: true },
    status: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED"],
      default: "PENDING",
    },
    provider: {
      type: String,
      enum: ["M365_GRAPH"],
      default: "M365_GRAPH",
    },
    errorMessage: { type: String },
    sentAt: { type: Date },
  },
  { timestamps: true },
);

export const EmailAuditModel = model<IEmailAudit>(
  "EmailAudit",
  emailAuditSchema,
);
