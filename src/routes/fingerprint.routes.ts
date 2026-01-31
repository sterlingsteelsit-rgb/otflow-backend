import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import * as Fingerprint from "../controllers/fingerprint.controller.js";
import multer from "multer";

export const fingerprintRouter = Router();
const upload = multer();

fingerprintRouter.post(
  "/process",
  requireAuth,
  requirePermission("fingerprint.process"),
  upload.single("file"),
  Fingerprint.processLogs,
);
