import { connectDb } from "./configs/db";
import { env } from "./configs/env";
import { Role } from "./models/role.model";
import { User } from "./models/user.model";
import { hashPassword } from "./utils/password";
import { PERMISSIONS } from "./utils/permissions";
import { logger } from "./configs/logger";

async function seed() {
  await connectDb();

  const adminRole = await Role.findOneAndUpdate(
    { name: "admin" },
    { name: "admin", permissions: [...PERMISSIONS] },
    { upsert: true, new: true },
  );

  await Role.findOneAndUpdate(
    { name: "manager" },
    { name: "manager", permissions: ["dashboard.view", "users.read"] },
    { upsert: true, new: true },
  );

  await Role.findOneAndUpdate(
    { name: "supervisor" },
    { name: "supervisor", permissions: ["dashboard.view"] },
    { upsert: true, new: true },
  );

  const existing = await User.findOne({
    email: env.seedAdminEmail.toLowerCase(),
  });
  if (!existing) {
    const passwordHash = await hashPassword(env.seedAdminPassword);
    await User.create({
      email: env.seedAdminEmail.toLowerCase(),
      username: env.seedAdminUsername,
      passwordHash,
      roleId: (adminRole as any)._id,
      canApprove: true,
      isActive: true,
    });
    logger.info("Seeded admin user");
  } else {
    logger.info("Admin user already exists");
  }

  logger.info("Seed complete");
  process.exit(0);
}

seed().catch((e) => {
  logger.error({ e }, "Seed failed");
  process.exit(1);
});
