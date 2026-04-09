import { EmailTemplateModel } from "../models/email-template.model.js";

export async function getEmailTemplates() {
  return EmailTemplateModel.find({ isActive: true })
    .sort({ isDefault: -1, title: 1 })
    .lean();
}

export async function createEmailTemplate(payload: {
  title: string;
  subject: string;
  body: string;
  category?: string;
  isDefault?: boolean;
}) {
  return EmailTemplateModel.create(payload);
}
