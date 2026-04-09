import { FilterQuery } from "mongoose";
import {
  EmailContactModel,
  IEmailContact,
} from "../models/email-contact.model.js";

export async function getEmailContacts(search?: string) {
  const query: FilterQuery<IEmailContact> = {
    isActive: true,
  };

  if (search?.trim()) {
    const keyword = search.trim();
    query.$or = [
      { name: { $regex: keyword, $options: "i" } },
      { email: { $regex: keyword, $options: "i" } },
      { department: { $regex: keyword, $options: "i" } },
    ];
  }

  return EmailContactModel.find(query).sort({ name: 1 }).limit(20).lean();
}

export async function createEmailContact(payload: {
  name: string;
  email: string;
  department?: string;
  role?: string;
}) {
  return EmailContactModel.create(payload);
}
