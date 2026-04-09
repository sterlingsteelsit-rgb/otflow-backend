import mongoose from "mongoose";
import { EmailContactModel } from "../models/email-contact.model.js";
import { EmailTemplateModel } from "../models/email-template.model.js";
import { env } from "../configs/env.js";

async function run() {
  await mongoose.connect(env.mongodbUri || "");

  await EmailContactModel.deleteMany({});
  await EmailTemplateModel.deleteMany({});

  await EmailContactModel.insertMany([
    {
      name: "Production Engineer",
      email: "supun.miyuru@sterlingsteels.com",
      department: "Production",
      role: "Engineer",
    },
    {
      name: "HR Team",
      email: "hr@sterlingsteels.com",
      department: "HR",
      role: "Team",
    },
    {
      name: "IT Support 1",
      email: "vidun.hettiarachchi@sterlingsteels.com",
      department: "IT",
      role: "Support",
    },{
      name: "IT Support 2",
      email: "hettividun@gmail.com",
      department: "IT",
      role: "Support",
    },
  ]);

  await EmailTemplateModel.insertMany([
    {
      title: "Production Team Approval",
      subject: "Production Team Approval",
      body: "Dear Production Team,\n\nKindly approve added OT recordings in the system.\n\nThank you.",
      category: "approval",
      isDefault: true,
    },
    {
      title: "Test Email",
      subject: "Test Email",
      body: "Something",
      category: "general",
      isDefault: true,
    },
  ]);

  console.log("Seed completed");
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
