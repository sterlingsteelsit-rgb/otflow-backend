import { AuditLog } from "../models/auditLog.model.js";

export async function writeAudit(params: {
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string;
  diff?: { before?: any; after?: any };
  meta?: { ip?: string; userAgent?: string; route?: string };
}) {
  await AuditLog.create({
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    actorUserId: params.actorUserId,
    diff: params.diff,
    meta: params.meta,
  });
}
