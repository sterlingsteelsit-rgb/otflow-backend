import { Router } from "express";
import {
  sendEmailController,
  getEmailAuditController,
} from "../controllers/mail.controller.js";
import {
  createEmailContactController,
  getEmailContactsController,
} from "../controllers/mail-contact.controller.js";
import {
  createEmailTemplateController,
  getEmailTemplatesController,
} from "../controllers/mail-template.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";

export const emailRouter = Router();

emailRouter.post(
  "/send",
  requireAuth,
  requirePermission("email.send"),
  sendEmailController,
);
emailRouter.get(
  "/audit",
  requireAuth,
  requirePermission("email.audit"),
  getEmailAuditController,
);

emailRouter.get(
  "/contacts",
  requireAuth,
  requirePermission("email.contacts"),
  getEmailContactsController,
);
emailRouter.post(
  "/contacts",
  requireAuth,
  requirePermission("email.contacts"),
  createEmailContactController,
);

emailRouter.get(
  "/templates",
  requireAuth,
  requirePermission("email.templates"),
  getEmailTemplatesController,
);
emailRouter.post(
  "/templates",
  requireAuth,
  requirePermission("email.templates"),
  createEmailTemplateController,
);

export default emailRouter;
