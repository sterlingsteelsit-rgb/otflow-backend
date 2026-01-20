import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import * as Users from "../controllers/users.controller.js";

export const usersRouter = Router();

usersRouter.get(
  "/",
  requireAuth,
  requirePermission("users.read"),
  validate(Users.listUsersSchema),
  Users.list,
);

usersRouter.post(
  "/",
  requireAuth,
  requirePermission("users.create"),
  validate(Users.createUserSchema),
  Users.create,
);

usersRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("users.update"),
  validate(Users.updateUserSchema),
  Users.update,
);

usersRouter.patch(
  "/:id/password",
  requireAuth,
  requirePermission("users.resetPassword"),
  validate(Users.resetPasswordSchema),
  Users.resetPassword,
);
