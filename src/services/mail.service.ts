import { EmailAuditModel } from "../models/email-audit.model.js";
import { env } from "../configs/env.js";
import { getGraphClient } from "../configs/graph.js";

export interface SendEmailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  requestedByUserId?: string;
  requestedByEmail?: string;
}

function mapRecipients(emails: string[]) {
  return emails.map((email) => ({
    emailAddress: { address: email },
  }));
}

function stripHtmlForPreview(html: string, maxLength = 300): string {
  const plain = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength)}...` : plain;
}

export async function sendEmailWithAudit(input: SendEmailInput) {
  const audit = await EmailAuditModel.create({
    requestedByUserId: input.requestedByUserId,
    requestedByEmail: input.requestedByEmail,
    fromEmail: env.microsoft.senderEmail,
    to: input.to,
    cc: input.cc || [],
    bcc: input.bcc || [],
    subject: input.subject,
    bodyPreview: stripHtmlForPreview(input.html),
    status: "PENDING",
    provider: "M365_GRAPH",
  });

  try {
    const client = await getGraphClient();

    await client.api(`/users/${env.microsoft.senderEmail}/sendMail`).post({
      message: {
        subject: input.subject,
        body: {
          contentType: "HTML",
          content: input.html,
        },
        toRecipients: mapRecipients(input.to),
        ccRecipients: mapRecipients(input.cc || []),
        bccRecipients: mapRecipients(input.bcc || []),
      },
      saveToSentItems: true,
    });

    audit.status = "SENT";
    audit.sentAt = new Date();
    await audit.save();

    return {
      success: true,
      auditId: audit._id,
      message: "Email sent successfully",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown email send error";

    audit.status = "FAILED";
    audit.errorMessage = errorMessage;
    await audit.save();

    throw error;
  }
}

export async function getEmailAuditList(page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    EmailAuditModel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    EmailAuditModel.countDocuments(),
  ]);

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
