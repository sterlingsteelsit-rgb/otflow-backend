import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import * as Audit from "../controllers/audit.controller.js";

export const auditRouter = Router();

auditRouter.get("/", requireAuth, requirePermission("audit.read"), Audit.list);
