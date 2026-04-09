import { Request, Response } from "express";
import { z } from "zod";
import {
  createEmailContact,
  getEmailContacts,
} from "../services/mail-contact.service.js";

const createEmailContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  department: z.string().optional(),
  role: z.string().optional(),
});

export async function getEmailContactsController(req: Request, res: Response) {
  const search = String(req.query.search || "");
  const data = await getEmailContacts(search);

  return res.status(200).json({
    success: true,
    message: "Email contacts fetched successfully",
    data,
  });
}

export async function createEmailContactController(
  req: Request,
  res: Response,
) {
  const body = createEmailContactSchema.parse(req.body);
  const data = await createEmailContact(body);

  return res.status(201).json({
    success: true,
    message: "Email contact created successfully",
    data,
  });
}
