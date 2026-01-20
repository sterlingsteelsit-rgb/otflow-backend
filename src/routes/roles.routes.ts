import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import * as Roles from "../controllers/roles.controller.js";

export const rolesRouter = Router();

rolesRouter.get("/", requireAuth, requirePermission("roles.read"), Roles.list);
rolesRouter.get(
  "/permissions",
  requireAuth,
  requirePermission("roles.read"),
  Roles.permissions,
);

rolesRouter.post(
  "/",
  requireAuth,
  requirePermission("roles.create"),
  validate(Roles.createRoleSchema),
  Roles.create,
);

rolesRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("roles.update"),
  validate(Roles.updateRoleSchema),
  Roles.update,
);
