import { Request, Response } from "express";
import { z } from "zod";
import {
  createEmailTemplate,
  getEmailTemplates,
} from "../services/mail-template.service.js";

const createEmailTemplateSchema = z.object({
  title: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  category: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export async function getEmailTemplatesController(
  _req: Request,
  res: Response,
) {
  const data = await getEmailTemplates();

  return res.status(200).json({
    success: true,
    message: "Email templates fetched successfully",
    data,
  });
}

export async function createEmailTemplateController(
  req: Request,
  res: Response,
) {
  const body = createEmailTemplateSchema.parse(req.body);
  const data = await createEmailTemplate(body);

  return res.status(201).json({
    success: true,
    message: "Email template created successfully",
    data,
  });
}
