import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import * as R from "../controllers/decisionReason.controller.js";

export const decisionReasonRouter = Router();

decisionReasonRouter.get(
  "/",
  requireAuth,
  requirePermission("reasons.read"),
  validate(R.listSchema),
  R.list,
);

decisionReasonRouter.post(
  "/",
  requireAuth,
  requirePermission("reasons.create"),
  validate(R.createSchema),
  R.create,
);

decisionReasonRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("reasons.update"),
  validate(R.updateSchema),
  R.update,
);

decisionReasonRouter.delete(
  "/:id",
  requireAuth,
  requirePermission("reasons.delete"),
  R.remove,
);
