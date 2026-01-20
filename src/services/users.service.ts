import { HttpError } from "../utils/http.js";
import { User } from "../models/user.model.js";
import { Role } from "../models/role.model.js";
import { hashPassword } from "../utils/password.js";
import { normalizePagination } from "../utils/pagination.js";

export async function listUsers(query: any) {
  const { page, limit, skip } = normalizePagination(query.page, query.limit);

  const filter: any = {};
  if (query.isActive !== undefined) filter.isActive = query.isActive === "true";
  if (query.roleId) filter.roleId = query.roleId;

  const search = String(query.search ?? "").trim();
  if (search) {
    // Uses text index (fast)
    filter.$text = { $search: search };
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select("email username roleId canApprove isActive createdAt")
      .populate("roleId", "name permissions")
      .sort(search ? { score: { $meta: "textScore" } } : { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return { page, limit, total, items };
}

export async function createUser(input: {
  email: string;
  username: string;
  password: string;
  roleId: string;
  canApprove: boolean;
}) {
  const role = await Role.findById(input.roleId);
  if (!role) throw new HttpError(400, "Invalid roleId");

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await User.create({
      email: input.email.toLowerCase(),
      username: input.username,
      passwordHash,
      roleId: input.roleId,
      canApprove: input.canApprove ?? false,
      isActive: true,
    });
    return user;
  } catch (e: any) {
    if (e?.code === 11000)
      throw new HttpError(409, "Email or username already exists");
    throw e;
  }
}

export async function updateUser(id: string, patch: any) {
  if (patch.email) patch.email = String(patch.email).toLowerCase();
  if (patch.roleId) {
    const role = await Role.findById(patch.roleId);
    if (!role) throw new HttpError(400, "Invalid roleId");
  }

  const user = await User.findByIdAndUpdate(id, patch, { new: true }).lean();
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

export async function resetPassword(id: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);
  const user = await User.findByIdAndUpdate(
    id,
    { passwordHash },
    { new: true },
  ).lean();
  if (!user) throw new HttpError(404, "User not found");
  return true;
}
