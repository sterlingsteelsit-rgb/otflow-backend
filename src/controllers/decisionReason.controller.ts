import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { DecisionReason } from "../models/decisionReason.model.js";

export const listSchema = z.object({
  query: z.object({
    type: z.enum(["APPROVE", "REJECT"]).optional(),
    active: z.string().optional(), // "true"/"false" optional
  }),
  body: z.any(),
  params: z.any(),
});

export const createSchema = z.object({
  body: z.object({
    type: z.enum(["APPROVE", "REJECT"]),
    label: z.string().min(1),
    active: z.boolean().optional(),
    sort: z.number().optional(),
  }),
  query: z.any(),
  params: z.any(),
});

export const updateSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    label: z.string().min(1).optional(),
    active: z.boolean().optional(),
    sort: z.number().optional(),
  }),
  query: z.any(),
});

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const filter: any = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.active === "true") filter.active = true;
    if (req.query.active === "false") filter.active = false;

    const items = await DecisionReason.find(filter)
      .sort({ sort: 1, label: 1 })
      .lean();

    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { type, label, active, sort } = (req as any).parsed.body;
    const doc = await DecisionReason.create({
      type,
      label,
      active: active ?? true,
      sort: sort ?? 0,
    });
    res.status(201).json({ id: String(doc._id) });
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = (req as any).parsed.params;
    const patch = (req as any).parsed.body;

    const doc = await DecisionReason.findByIdAndUpdate(id, patch, {
      new: true,
    }).lean();

    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await DecisionReason.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
