import { HttpError } from "../utils/http.js";
import { Role } from "../models/role.model.js";
import { PERMISSIONS } from "../utils/permissions.js";

export async function listRoles() {
  return Role.find().sort({ name: 1 }).lean();
}

export async function createRole(name: string, permissions: string[]) {
  for (const p of permissions) {
    if (!PERMISSIONS.includes(p as any))
      throw new HttpError(400, `Unknown permission: ${p}`);
  }
  try {
    return await Role.create({ name, permissions });
  } catch (e: any) {
    if (e?.code === 11000) throw new HttpError(409, "Role name already exists");
    throw e;
  }
}

export async function updateRole(
  id: string,
  patch: { name?: string; permissions?: string[] },
) {
  if (patch.permissions) {
    for (const p of patch.permissions) {
      if (!PERMISSIONS.includes(p as any))
        throw new HttpError(400, `Unknown permission: ${p}`);
    }
  }
  const role = await Role.findByIdAndUpdate(id, patch, { new: true }).lean();
  if (!role) throw new HttpError(404, "Role not found");
  return role;
}
