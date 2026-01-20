import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import * as Triple from "../controllers/tripleOt.controller.js";

export const tripleOtRouter = Router();

tripleOtRouter.get(
  "/",
  requireAuth,
  requirePermission("tripleOt.read"),
  Triple.list,
);

tripleOtRouter.post(
  "/",
  requireAuth,
  requirePermission("tripleOt.create"),
  validate(Triple.createSchema),
  Triple.create,
);

tripleOtRouter.delete(
  "/:id",
  requireAuth,
  requirePermission("tripleOt.delete"),
  Triple.remove,
);
