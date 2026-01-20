import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { TripleOtDay } from "../models/tripleOtDay.model.js";

export const createSchema = z.object({
  body: z.object({
    date: z.string().min(10),
    note: z.string().optional(),
  }),
  query: z.any(),
  params: z.any(),
});

export async function list(_req: Request, res: Response) {
  const items = await TripleOtDay.find().sort({ date: 1 }).lean();
  res.json({ items });
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, note } = (req as any).parsed.body;
    const doc = await TripleOtDay.create({ date, note });
    res.status(201).json({ id: String(doc._id) });
  } catch (e) {
    next(e);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await TripleOtDay.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
