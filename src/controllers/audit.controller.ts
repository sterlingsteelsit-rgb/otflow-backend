import type { Request, Response, NextFunction } from "express";
import { normalizePagination } from "../utils/pagination.js";
import { AuditLog } from "../models/auditLog.model.js";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, skip } = normalizePagination(
      req.query.page,
      req.query.limit,
    );

    const filter: any = {};
    if (req.query.entityType) filter.entityType = req.query.entityType;
    if (req.query.entityId) filter.entityId = req.query.entityId;
    if (req.query.actorUserId) filter.actorUserId = req.query.actorUserId;

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("actorUserId", "username email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ page, limit, total, items });
  } catch (e) {
    next(e);
  }
}
