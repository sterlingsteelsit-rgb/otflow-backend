import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as Users from "../services/users.service.js";

export const listUsersSchema = z.object({
  query: z.object({
    page: z.any().optional(),
    limit: z.any().optional(),
    search: z.any().optional(),
    roleId: z.any().optional(),
    isActive: z.any().optional(),
  }),
  body: z.any(),
  params: z.any(),
});

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    username: z.string().min(3),
    password: z.string().min(8),
    roleId: z.string().min(1),
    canApprove: z.boolean().optional().default(false),
  }),
  query: z.any(),
  params: z.any(),
});

export const updateUserSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    email: z.string().email().optional(),
    username: z.string().min(3).optional(),
    roleId: z.string().min(1).optional(),
    canApprove: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
  query: z.any(),
});

export const resetPasswordSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ password: z.string().min(8) }),
  query: z.any(),
});

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await Users.listUsers(req.query);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req as any).parsed.body;
    const user = await Users.createUser(input);
    res.status(201).json({ id: String((user as any)._id) });
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = (req as any).parsed.params;
    const patch = (req as any).parsed.body;
    const user = await Users.updateUser(id, patch);
    res.json({ ok: true, user });
  } catch (e) {
    next(e);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = (req as any).parsed.params;
    const { password } = (req as any).parsed.body;
    await Users.resetPassword(id, password);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
