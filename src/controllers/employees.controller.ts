import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as Employees from "../services/employees.service.js";

export const listEmployeesSchema = z.object({
  query: z.object({
    page: z.any().optional(),
    limit: z.any().optional(),
    search: z.any().optional(),
    includeDeleted: z.any().optional(),
  }),
  body: z.any(),
  params: z.any(),
});

export const createEmployeeSchema = z.object({
  body: z.object({
    empId: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email().optional(),
  }),
  query: z.any(),
  params: z.any(),
});

export const updateEmployeeSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
  }),
  query: z.any(),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.any(),
  query: z.any(),
});

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await Employees.listEmployees(req.query);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req as any).parsed.body;
    const doc = await Employees.createEmployee(input);
    res.status(201).json({ id: String((doc as any)._id) });
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = (req as any).parsed.params;
    const patch = (req as any).parsed.body;
    const doc = await Employees.updateEmployee(id, patch);
    res.json({ ok: true, employee: doc });
  } catch (e) {
    next(e);
  }
}

export async function softDelete(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = (req as any).parsed.params;
    const doc = await Employees.softDeleteEmployee(id);
    res.json({ ok: true, employee: doc });
  } catch (e) {
    next(e);
  }
}

export async function restore(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = (req as any).parsed.params;
    const doc = await Employees.restoreEmployee(id);
    res.json({ ok: true, employee: doc });
  } catch (e) {
    next(e);
  }
}
