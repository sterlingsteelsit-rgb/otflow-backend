import mongoose, { Schema, type InferSchemaType, Types } from "mongoose";

const auditLogSchema = new Schema(
  {
    entityType: { type: String, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },

    action: { type: String, required: true },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    diff: {
      before: { type: Schema.Types.Mixed, required: false },
      after: { type: Schema.Types.Mixed, required: false },
    },

    meta: {
      ip: { type: String, required: false },
      userAgent: { type: String, required: false },
      route: { type: String, required: false },
    },
  },
  { timestamps: true },
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema> & {
  _id: Types.ObjectId;
};
export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
