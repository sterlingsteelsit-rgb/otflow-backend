import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import * as Employees from "../controllers/employees.controller.js";

export const employeesRouter = Router();

employeesRouter.get(
  "/",
  requireAuth,
  requirePermission("employees.read"),
  validate(Employees.listEmployeesSchema),
  Employees.list,
);

employeesRouter.post(
  "/",
  requireAuth,
  requirePermission("employees.create"),
  validate(Employees.createEmployeeSchema),
  Employees.create,
);

employeesRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("employees.update"),
  validate(Employees.updateEmployeeSchema),
  Employees.update,
);

employeesRouter.patch(
  "/:id/delete",
  requireAuth,
  requirePermission("employees.delete"),
  validate(Employees.idParamSchema),
  Employees.softDelete,
);

employeesRouter.patch(
  "/:id/restore",
  requireAuth,
  requirePermission("employees.restore"),
  validate(Employees.idParamSchema),
  Employees.restore,
);
