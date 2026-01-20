import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import * as OT from "../controllers/ot.controller.js";

export const otRouter = Router();

otRouter.get(
  "/notifications/pending",
  requireAuth,
  requirePermission("ot.approve"),
  OT.pendingNotifications,
);

otRouter.get(
  "/notifications/count",
  requireAuth,
  requirePermission("ot.approve"),
  OT.pendingCount,
);

otRouter.get(
  "/",
  requireAuth,
  requirePermission("ot.read"),
  validate(OT.listSchema),
  OT.list,
);

otRouter.post(
  "/bulk",
  requireAuth,
  requirePermission("ot.create"),
  validate(OT.bulkCreateSchema),
  OT.bulkCreate,
);

otRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("ot.update"),
  validate(OT.updateSchema),
  OT.update,
);

otRouter.patch(
  "/:id/approve",
  requireAuth,
  requirePermission("ot.approve"),
  validate(OT.decisionSchema),
  OT.approve,
);

otRouter.patch(
  "/:id/reject",
  requireAuth,
  requirePermission("ot.reject"),
  validate(OT.decisionSchema),
  OT.reject,
);

otRouter.get(
  "/stats/day",
  requireAuth,
  requirePermission("ot.stats.read"),
  OT.dayStats,
);

otRouter.get(
  "/stats/week",
  requireAuth,
  requirePermission("ot.stats.read"),
  OT.weekStats,
);
