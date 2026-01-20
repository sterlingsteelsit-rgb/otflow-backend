import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as Roles from "../services/roles.service.js";
import { PERMISSIONS } from "../utils/permissions.js";

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    permissions: z.array(z.string()).default([]),
  }),
  query: z.any(),
  params: z.any(),
});

export const updateRoleSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(2).optional(),
    permissions: z.array(z.string()).optional(),
  }),
  query: z.any(),
});

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await Roles.listRoles();
    res.json({ items: roles });
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, permissions } = (req as any).parsed.body;
    const role = await Roles.createRole(name, permissions);
    res.status(201).json({ id: String((role as any)._id) });
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = (req as any).parsed.params;
    const patch = (req as any).parsed.body;
    const role = await Roles.updateRole(id, patch);
    res.json({ ok: true, role });
  } catch (e) {
    next(e);
  }
}

export async function permissions(_req: Request, res: Response) {
  res.json({ items: PERMISSIONS });
}
