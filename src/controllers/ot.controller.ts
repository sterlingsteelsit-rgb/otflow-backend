import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as OT from "../services/ot.service.js";

export const listSchema = z.object({
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    status: z.string().optional(),
    employeeId: z.string().optional(),
    page: z.any().optional(),
    limit: z.any().optional(),
  }),
  body: z.any(),
  params: z.any(),
});

export const bulkCreateSchema = z.object({
  body: z.object({
    workDate: z.string().min(10),
    rows: z
      .array(
        z
          .object({
            employeeId: z.string().min(1),

            // allow NO_SHIFT
            shift: z.string().min(1),

            // allow optional (only required if shift != NO_SHIFT)
            inTime: z.string().optional(),
            outTime: z.string().optional(),

            reason: z.string().optional(),
          })
          .superRefine((val, ctx) => {
            if (val.shift !== "NO_SHIFT") {
              if (!val.inTime || val.inTime.length < 4) {
                ctx.addIssue({
                  code: "custom",
                  path: ["inTime"],
                  message: "inTime required",
                });
              }
              if (!val.outTime || val.outTime.length < 4) {
                ctx.addIssue({
                  code: "custom",
                  path: ["outTime"],
                  message: "outTime required",
                });
              }
            }
          }),
      )
      .min(1, "At least one row is required"),
  }),
  query: z.any(),
  params: z.any(),
});

export const updateSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    shift: z.string().optional(),
    inTime: z.string().optional(),
    outTime: z.string().optional(),
    reason: z.string().optional(),
  }),
  query: z.any(),
});

export const decisionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    reason: z.string().optional(),
    approvedNormalMinutes: z.number().int().min(0).optional(),
    approvedDoubleMinutes: z.number().int().min(0).optional(),
    approvedTripleMinutes: z.number().int().min(0).optional(),
  }),
  query: z.any(),
});

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await OT.listOt(req.query);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function pendingCount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await OT.pendingCount();
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function pendingNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const limit = Math.min(Number(req.query.limit ?? 8), 20);
    const data = await OT.getPendingNotifications({ limit });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function bulkCreate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { workDate, rows } = (req as any).parsed.body;

    const result = await OT.createBulk({
      workDate,
      rows,
      actorUserId: req.user!.id,
      meta: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        route: req.originalUrl,
      },
    });

    console.log("bulkCreate", { workDate, rowsLen: rows?.length });
    if (!rows?.length) {
      return res
        .status(400)
        .json({ message: "No rows provided", insertedCount: 0 });
    }

    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = (req as any).parsed.params;
    const patch = (req as any).parsed.body;

    const updated = await OT.updateOt({
      id,
      patch,
      actorUserId: req.user!.id,
      meta: { route: req.originalUrl },
    });

    res.json({ ok: true, item: updated });
  } catch (e) {
    next(e);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = (req as any).parsed.params;
    const {
      reason,
      approvedNormalMinutes,
      approvedDoubleMinutes,
      approvedTripleMinutes,
    } = (req as any).parsed.body;

    const updated = await OT.approveOt({
      id,
      reason,
      actorUserId: req.user!.id,
      approvedNormalMinutes,
      approvedDoubleMinutes,
      approvedTripleMinutes,
      meta: { route: req.originalUrl },
    });

    res.json({ ok: true, item: updated });
  } catch (e) {
    next(e);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = (req as any).parsed.params;
    const { reason } = (req as any).parsed.body;

    const updated = await OT.rejectOt({
      id,
      reason,
      actorUserId: req.user!.id,
      meta: { route: req.originalUrl },
    });

    res.json({ ok: true, item: updated });
  } catch (e) {
    next(e);
  }
}

export async function dayStats(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const date = String(req.query.date);
    const stats = await OT.dayStats(date);
    res.json(stats);
  } catch (e) {
    next(e);
  }
}

export async function weekStats(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const from = String(req.query.from);
    const to = String(req.query.to);
    const stats = await OT.weekStats(from, to);
    res.json({ items: stats });
  } catch (e) {
    next(e);
  }
}
