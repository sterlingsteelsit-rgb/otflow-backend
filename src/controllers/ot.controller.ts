import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as OT from "../services/ot.service.js";
import ExcelJS from "exceljs";
import { OtEntry } from "../models/otEntry.model.js";

type Scope = "daily" | "weekly" | "monthly" | "yearly";
type Mode = "records" | "summary";

export const logsExportSchema = z.object({
  query: z.object({
    scope: z.enum(["daily", "weekly", "monthly", "yearly"]).default("daily"),
    anchor: z.string().min(4), // your frontend sends normalized YYYY-MM-DD
    employeeId: z.string().optional().default(""),
    status: z
      .enum(["PENDING", "APPROVED", "REJECTED"])
      .optional()
      .default("" as any),
    mode: z.enum(["records", "summary"]).optional().default("records"),
  }),
});

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

export const logsSchema = z.object({
  query: z.object({
    employeeId: z.string().optional(),
    status: z.string().optional(),

    // if provided, used directly
    from: z.string().optional(),
    to: z.string().optional(),

    // OR use scope + anchor
    scope: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
    anchor: z.string().optional(), // YYYY-MM-DD (for daily/weekly), YYYY-MM (monthly), YYYY (yearly)

    page: z.any().optional(),
    limit: z.any().optional(),
  }),
  body: z.any(),
  params: z.any(),
});

export const logsSummarySchema = z.object({
  query: z.object({
    employeeId: z.string().optional(),
    status: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    scope: z.enum(["daily", "weekly", "monthly", "yearly"]).default("daily"),
    anchor: z.string().optional(),
  }),
  body: z.any(),
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

export async function logs(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await OT.logs(req.query);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function logsSummary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await OT.logsSummary(req.query);
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

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toYYYYMMDD(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseYYYYMMDD(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}
function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function lastDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function rangeFromScope(scope: Scope, anchor: string) {
  const a = parseYYYYMMDD(anchor);

  if (scope === "daily") {
    const from = anchor.slice(0, 10);
    const to = anchor.slice(0, 10);
    return { from, to };
  }

  if (scope === "weekly") {
    const ws = startOfWeekMonday(a);
    const we = addDays(ws, 6);
    return { from: toYYYYMMDD(ws), to: toYYYYMMDD(we) };
  }

  if (scope === "monthly") {
    const ms = new Date(a.getFullYear(), a.getMonth(), 1);
    const me = lastDayOfMonth(ms);
    return { from: toYYYYMMDD(ms), to: toYYYYMMDD(me) };
  }

  const ys = new Date(a.getFullYear(), 0, 1);
  const ye = new Date(a.getFullYear(), 11, 31);
  return { from: toYYYYMMDD(ys), to: toYYYYMMDD(ye) };
}

function safeFileName(s: string) {
  return s.replace(/[^\w\-]+/g, "_");
}

function minutesTotal(r: any) {
  return (
    (r.normalMinutes ?? 0) + (r.doubleMinutes ?? 0) + (r.tripleMinutes ?? 0)
  );
}

function autoWidth(ws: ExcelJS.Worksheet) {
  ws.columns?.forEach((col) => {
    let max = 10;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value as any;
      const len =
        typeof v === "string"
          ? v.length
          : typeof v === "number"
            ? String(v).length
            : v?.richText
              ? v.richText.map((x: any) => x.text).join("").length
              : v?.text
                ? String(v.text).length
                : v?.formula
                  ? 12
                  : 0;

      if (len > max) max = len;
    });
    col.width = Math.min(45, Math.max(10, max + 2));
  });
}

function boldRow(ws: ExcelJS.Worksheet, rowNum: number) {
  ws.getRow(rowNum).font = { bold: true };
}

function addTitleBlock(
  ws: ExcelJS.Worksheet,
  title: string,
  meta: Record<string, string>,
) {
  // Title (merged)
  ws.mergeCells("A1", "H1");
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { bold: true, size: 16 };
  t.alignment = { vertical: "middle", horizontal: "left" };

  // Meta block rows
  let r = 3;
  for (const [k, v] of Object.entries(meta)) {
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`A${r}`).font = { bold: true };
    ws.getCell(`B${r}`).value = v;
    r++;
  }

  ws.addRow([]);
}

export async function logsExport(req: Request, res: Response) {
  const scope = (req.query.scope as Scope) ?? "daily";
  const anchor = String(req.query.anchor ?? "");
  const employeeId = String(req.query.employeeId ?? "");
  const status = String(req.query.status ?? "");
  const mode = (String(req.query.mode ?? "records") as Mode) ?? "records";

  const { from, to } = rangeFromScope(scope, anchor);

  const match: any = {
    workDate: { $gte: from, $lte: to },
  };
  if (employeeId) match.employeeId = employeeId;
  if (status) match.status = status;

  const wb = new ExcelJS.Workbook();
  wb.creator = "HRMS";
  wb.created = new Date();

  // -------------------- fetch records once (we can build everything from it) --------------------
  const records = await OtEntry.find(match)
    .populate("employeeId", "empId name")
    .sort({ workDate: 1, createdAt: 1 })
    .lean();

  // -------------------- build computed totals --------------------
  const overall = {
    count: records.length,
    normalMinutes: 0,
    doubleMinutes: 0,
    tripleMinutes: 0,
    totalMinutes: 0,
    approvedTotalMinutes: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  };

  const byEmployee = new Map<
    string,
    {
      employeeId: string;
      empId: string;
      name: string;
      count: number;
      normalMinutes: number;
      doubleMinutes: number;
      tripleMinutes: number;
      totalMinutes: number;
      approvedTotalMinutes: number;
      rows: any[];
    }
  >();

  for (const r of records) {
    const emp: any = r.employeeId ?? {};
    const key = String(emp?._id ?? r.employeeId ?? "");

    const nm = r.normalMinutes ?? 0;
    const dm = r.doubleMinutes ?? 0;
    const tm = r.tripleMinutes ?? 0;
    const tot = nm + dm + tm;

    overall.normalMinutes += nm;
    overall.doubleMinutes += dm;
    overall.tripleMinutes += tm;
    overall.totalMinutes += tot;
    overall.approvedTotalMinutes += r.approvedTotalMinutes ?? 0;

    if (r.status === "PENDING") overall.pending += 1;
    if (r.status === "APPROVED") overall.approved += 1;
    if (r.status === "REJECTED") overall.rejected += 1;

    if (!byEmployee.has(key)) {
      byEmployee.set(key, {
        employeeId: key,
        empId: emp.empId ?? "",
        name: emp.name ?? "",
        count: 0,
        normalMinutes: 0,
        doubleMinutes: 0,
        tripleMinutes: 0,
        totalMinutes: 0,
        approvedTotalMinutes: 0,
        rows: [],
      });
    }

    const e = byEmployee.get(key)!;
    e.count += 1;
    e.normalMinutes += nm;
    e.doubleMinutes += dm;
    e.tripleMinutes += tm;
    e.totalMinutes += tot;
    e.approvedTotalMinutes += r.approvedTotalMinutes ?? 0;
    e.rows.push(r);
  }

  const meta = {
    Scope: scope.toUpperCase(),
    Period: `${from} → ${to}`,
    "Employee Filter": employeeId ? "Selected employee" : "All employees",
    "Status Filter": status ? status : "All",
    "Generated At": new Date().toLocaleString(),
    "Export Mode": mode,
  };

  // -------------------- Sheet 1: SUMMARY (always included) --------------------
  const wsSum = wb.addWorksheet("Summary");

  addTitleBlock(wsSum, "Overtime Report (OT)", meta);

  // Overall summary table
  wsSum.addRow(["Overall Summary"]);
  boldRow(wsSum, wsSum.lastRow!.number);

  wsSum.addRow(["Records", overall.count]);
  wsSum.addRow(["Pending", overall.pending]);
  wsSum.addRow(["Approved", overall.approved]);
  wsSum.addRow(["Rejected", overall.rejected]);
  wsSum.addRow([]);
  wsSum.addRow(["Normal (min)", overall.normalMinutes]);
  wsSum.addRow(["Double (min)", overall.doubleMinutes]);
  wsSum.addRow(["Triple (min)", overall.tripleMinutes]);
  wsSum.addRow(["Total (min)", overall.totalMinutes]);
  wsSum.addRow(["Approved Total (min)", overall.approvedTotalMinutes]);

  wsSum.addRow([]);
  wsSum.addRow(["Employee-wise Summary"]);
  boldRow(wsSum, wsSum.lastRow!.number);

  wsSum.addRow([
    "Emp ID",
    "Employee Name",
    "Count",
    "Normal (min)",
    "Double (min)",
    "Triple (min)",
    "Total (min)",
    "Approved (min)",
  ]);
  boldRow(wsSum, wsSum.lastRow!.number);

  const empList = Array.from(byEmployee.values()).sort((a, b) =>
    (a.empId || "").localeCompare(b.empId || ""),
  );

  for (const e of empList) {
    wsSum.addRow([
      e.empId,
      e.name,
      e.count,
      e.normalMinutes,
      e.doubleMinutes,
      e.tripleMinutes,
      e.totalMinutes,
      e.approvedTotalMinutes,
    ]);
  }

  wsSum.views = [{ state: "frozen", ySplit: 6 }];
  autoWidth(wsSum);

  // -------------------- Sheet 2: RECORDS (daily flat; weekly/monthly/yearly employee-wise blocks) --------------------
  const wsRec = wb.addWorksheet(
    mode === "summary" ? "Records (Detailed)" : "Records",
  );

  addTitleBlock(wsRec, "OT Records", meta);

  const isEmployeeWise = scope !== "daily"; // ✅ weekly/monthly/yearly employee-wise

  if (!isEmployeeWise) {
    // ---------- DAILY (flat list) ----------
    wsRec.addRow([
      "Work Date",
      "Emp ID",
      "Employee",
      "Shift",
      "In",
      "Out",
      "Normal (min)",
      "Double (min)",
      "Triple (min)",
      "Total (min)",
      "Approved (min)",
      "Status",
    ]);
    boldRow(wsRec, wsRec.lastRow!.number);

    for (const r of records) {
      const emp: any = r.employeeId ?? {};
      wsRec.addRow([
        r.workDate,
        emp.empId ?? "",
        emp.name ?? "",
        r.shift ?? "",
        r.inTime ?? "",
        r.outTime ?? "",
        r.normalMinutes ?? 0,
        r.doubleMinutes ?? 0,
        r.tripleMinutes ?? 0,
        minutesTotal(r),
        r.approvedTotalMinutes ?? 0,
        r.status ?? "",
      ]);
    }

    wsRec.autoFilter = {
      from: { row: wsRec.lastRow!.number - records.length, column: 1 },
      to: { row: wsRec.lastRow!.number - records.length, column: 12 },
    };
  } else {
    // ---------- WEEKLY / MONTHLY / YEARLY (employee-wise blocks) ----------
    for (const e of empList) {
      // Section header (merged)
      const startRow = wsRec.lastRow ? wsRec.lastRow.number + 1 : 1;
      wsRec.addRow([`Employee: ${e.empId} - ${e.name}`]);
      wsRec.mergeCells(`A${startRow}`, `L${startRow}`);
      wsRec.getCell(`A${startRow}`).font = { bold: true, size: 12 };
      wsRec.getCell(`A${startRow}`).alignment = {
        vertical: "middle",
        horizontal: "left",
      };

      // Column header for this employee
      wsRec.addRow([
        "Work Date",
        "Shift",
        "In",
        "Out",
        "Normal (min)",
        "Double (min)",
        "Triple (min)",
        "Total (min)",
        "Approved (min)",
        "Status",
      ]);
      boldRow(wsRec, wsRec.lastRow!.number);

      // Rows for employee
      for (const r of e.rows) {
        wsRec.addRow([
          r.workDate,
          r.shift ?? "",
          r.inTime ?? "",
          r.outTime ?? "",
          r.normalMinutes ?? 0,
          r.doubleMinutes ?? 0,
          r.tripleMinutes ?? 0,
          minutesTotal(r),
          r.approvedTotalMinutes ?? 0,
          r.status ?? "",
        ]);
      }

      // Subtotal row
      wsRec.addRow([
        "",
        "",
        "",
        "SUBTOTAL:",
        e.normalMinutes,
        e.doubleMinutes,
        e.tripleMinutes,
        e.totalMinutes,
        e.approvedTotalMinutes,
        "",
      ]);
      const subRow = wsRec.lastRow!.number;
      wsRec.getRow(subRow).font = { bold: true };
      wsRec.addRow([]); // spacing
    }
  }

  wsRec.views = [{ state: "frozen", ySplit: 6 }];
  autoWidth(wsRec);

  // -------------------- file + stream --------------------
  const filename = safeFileName(`ot_${scope}_${from}_to_${to}_${mode}.xlsx`);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  await wb.xlsx.write(res);
  res.end();
}
