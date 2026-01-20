import { Employee } from "../models/employee.model.js";
import { HttpError } from "../utils/http.js";
import { normalizePagination } from "../utils/pagination.js";

export async function listEmployees(query: any) {
  const { page, limit, skip } = normalizePagination(query.page, query.limit);

  const filter: any = {};
  const includeDeleted = String(query.includeDeleted ?? "false") === "true";
  if (!includeDeleted) filter.isDeleted = false;

  const search = String(query.search ?? "").trim();
  if (search) filter.$text = { $search: search };

  const [items, total] = await Promise.all([
    Employee.find(filter)
      .select("empId name email isDeleted deletedAt createdAt")
      .sort(search ? { score: { $meta: "textScore" } } : { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Employee.countDocuments(filter),
  ]);

  return { page, limit, total, items };
}

export async function createEmployee(input: {
  empId: string;
  name: string;
  email?: string;
}) {
  try {
    const doc = await Employee.create({
      empId: input.empId.trim(),
      name: input.name.trim(),
      email: input.email?.trim()?.toLowerCase() || undefined,
    });
    return doc;
  } catch (e: any) {
    if (e?.code === 11000) throw new HttpError(409, "empId already exists");
    throw e;
  }
}

export async function updateEmployee(
  id: string,
  patch: { name?: string; email?: string },
) {
  const safePatch: any = {};
  const existing = await Employee.findById(id).lean();
  if (!existing) throw new HttpError(404, "Employee not found");
  if (existing.isDeleted)
    throw new HttpError(409, "Employee is deleted. Restore first.");
  if (patch.name !== undefined) safePatch.name = patch.name.trim();
  if (patch.email !== undefined) {
    const v = patch.email.trim();
    safePatch.email = v ? v.toLowerCase() : undefined;
  }

  const doc = await Employee.findByIdAndUpdate(id, safePatch, {
    new: true,
  }).lean();
  if (!doc) throw new HttpError(404, "Employee not found");
  return doc;
}

export async function softDeleteEmployee(id: string) {
  const doc = await Employee.findByIdAndUpdate(
    id,
    { isDeleted: true, deletedAt: new Date() },
    { new: true },
  ).lean();

  if (!doc) throw new HttpError(404, "Employee not found");
  return doc;
}

export async function restoreEmployee(id: string) {
  const doc = await Employee.findByIdAndUpdate(
    id,
    { isDeleted: false, deletedAt: undefined },
    { new: true },
  ).lean();

  if (!doc) throw new HttpError(404, "Employee not found");
  return doc;
}
