export const PERMISSIONS = [
  // Dashboard
  "dashboard.view",

  // Users
  "users.read",
  "users.create",
  "users.update",
  "users.disable",
  "users.resetPassword",

  // Roles
  "roles.read",
  "roles.create",
  "roles.update",

  // Employees
  "employees.read",
  "employees.create",
  "employees.update",
  "employees.delete",
  "employees.restore",

  // OT
  "ot.read",
  "ot.create",
  "ot.update",
  "ot.approve",
  "ot.reject",

  // Reasons
  "reasons.read",
  "reasons.create",
  "reasons.update",
  "reasons.delete",

  // OT stats
  "ot.stats.read",

  // Triple OT config
  "tripleOt.read",
  "tripleOt.create",
  "tripleOt.delete",

  // Audit
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
