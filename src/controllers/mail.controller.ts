import { Request, Response } from "express";
import { z } from "zod";
import {
  sendEmailWithAudit,
  getEmailAuditList,
} from "../services/mail.service.js";

const sendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
});

export async function sendEmailController(req: Request, res: Response) {
  const body = sendEmailSchema.parse(req.body);

  const result = await sendEmailWithAudit({
    ...body,
    // adjust according to your auth middleware
    requestedByUserId: (req as any).user?.id,
    requestedByEmail: (req as any).user?.email,
  });

  return res.status(200).json({
    success: true,
    message: result.message,
    data: result,
  });
}

export async function getEmailAuditController(req: Request, res: Response) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);

  const result = await getEmailAuditList(page, limit);

  return res.status(200).json({
    success: true,
    message: "Email audit list fetched successfully",
    data: result,
  });
}
