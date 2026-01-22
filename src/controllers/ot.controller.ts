import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import ExcelJS from "exceljs";
import * as OT from "../services/ot.service.js";
import { OtEntry } from "../models/otEntry.model.js";
import { logo } from "../assets/sterling_logo.js";

type Scope = "daily" | "weekly" | "monthly" | "yearly";
type Mode = "records" | "summary";

function minToHours(min: number) {
  return Math.round((min / 60) * 100) / 100;
}

function nz(v: number) {
  return v === 0 ? "" : v;
}

function addBorders(ws: ExcelJS.Worksheet) {
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });
}

function headerRow(ws: ExcelJS.Worksheet, rowNum: number) {
  const row = ws.getRow(rowNum);
  row.font = { bold: true };
  row.alignment = { horizontal: "center", vertical: "middle" };
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFEFEF" },
    };
  });
}

/* -------------------- schemas -------------------- */

export const logsExportSchema = z.object({
  query: z.object({
    scope: z.enum(["daily", "weekly", "monthly", "yearly"]).default("daily"),
    anchor: z.string().min(4), // normalized YYYY-MM-DD
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
            shift: z.string().min(1), // allow NO_SHIFT
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

    // direct range
    from: z.string().optional(),
    to: z.string().optional(),

    // OR scope + anchor
    scope: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
    anchor: z.string().optional(),

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

/* -------------------- basic endpoints -------------------- */

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await OT.listOt(req.query);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function pendingCount(
  _req: Request,
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

    // ✅ IMPORTANT: service must set approvedTotalMinutes in DB.
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

/* -------------------- export helpers -------------------- */

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

/**
 * ✅ FIX: Use ONLY the model field approvedTotalMinutes.
 * No fallback. No recompute. Exactly what you asked.
 */
function approvedTotal(r: any) {
  return Number(r.approvedTotalMinutes ?? 0) || 0;
}

function autoWidth(ws: ExcelJS.Worksheet) {
  ws.columns?.forEach((col) => {
    if (!col.eachCell) return;
    let max = 10;

    col.eachCell({ includeEmpty: true }, (cell) => {
      const v: any = cell.value;
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
  ws.mergeCells("A1", "H1");
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { bold: true, size: 16 };
  t.alignment = { vertical: "middle", horizontal: "left" };

  let r = 3;
  for (const [k, v] of Object.entries(meta)) {
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`A${r}`).font = { bold: true };
    ws.getCell(`B${r}`).value = v;
    r++;
  }

  ws.addRow([]);
}

/* -------------------- EXPORT API -------------------- */

export async function logsExport(req: Request, res: Response) {
  const scope = (req.query.scope as Scope) ?? "daily";
  const anchor = String(req.query.anchor ?? "");
  const employeeId = String(req.query.employeeId ?? "");
  const status = String(req.query.status ?? "");
  const mode = (String(req.query.mode ?? "records") as Mode) ?? "records";

  const { from, to } = rangeFromScope(scope, anchor);

  const match: any = { workDate: { $gte: from, $lte: to } };
  if (employeeId) match.employeeId = employeeId;
  if (status) match.status = status;

  const wb = new ExcelJS.Workbook();
  wb.creator = "HRMS";
  wb.created = new Date();

  const records = await OtEntry.find(match)
    .populate("employeeId", "empId name")
    .sort({ workDate: 1, createdAt: 1 })
    .lean();

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
    overall.approvedTotalMinutes += approvedTotal(r);

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
    e.approvedTotalMinutes += approvedTotal(r);
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

  const logoBase64 = logo;

  /* ---------- Helper function for styling ---------- */
  function applyTableStyle(
    worksheet: any,
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number,
  ) {
    // Header styling
    const headerRow = worksheet.getRow(startRow);
    headerRow.eachCell((cell: any, colNumber: number) => {
      if (colNumber >= startCol && colNumber <= endCol) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2E5B9A" }, // Professional blue
        };
        cell.font = {
          bold: true,
          color: { argb: "FFFFFFFF" },
          size: 11,
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF2E5B9A" } },
          left: { style: "thin", color: { argb: "FF2E5B9A" } },
          bottom: { style: "thin", color: { argb: "FF2E5B9A" } },
          right: { style: "thin", color: { argb: "FF2E5B9A" } },
        };
      }
    });

    // Data rows styling
    for (let row = startRow + 1; row <= endRow; row++) {
      const dataRow = worksheet.getRow(row);
      dataRow.eachCell((cell: any, colNumber: number) => {
        if (colNumber >= startCol && colNumber <= endCol) {
          // Alternate row coloring
          const fillColor = row % 2 === 0 ? "FFF2F2F2" : "FFFFFFFF";

          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fillColor },
          };
          cell.font = {
            size: 10,
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: "left",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFD9D9D9" } },
            left: { style: "thin", color: { argb: "FFD9D9D9" } },
            bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
            right: { style: "thin", color: { argb: "FFD9D9D9" } },
          };

          // Center align numeric columns
          const colLetter = worksheet.getColumn(colNumber).letter;
          if (["D", "E", "F", "G", "H", "I"].includes(colLetter)) {
            cell.alignment.horizontal = "center";
          }
        }
      });
    }
  }

  /* ---------- Sheet 1: SUMMARY ---------- */
  const wsSum = wb.addWorksheet("Summary");

  // Add logo (Row 1-3)
  const logoId = wb.addImage({
    base64: logoBase64,
    extension: "png",
  });

  // Simplified image addition without type issues
  wsSum.addImage(logoId, "A1:C3");

  // Title block with styling
  wsSum.mergeCells("D1", "H2");
  const titleCell = wsSum.getCell("D1");
  titleCell.value = "OVERTIME REPORT - SUMMARY";
  titleCell.font = {
    bold: true,
    size: 16,
    color: { argb: "FF2E5B9A" },
  };
  titleCell.alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  // Add metadata block
  let metaRow = 4;
  for (const [key, value] of Object.entries(meta)) {
    const keyCell = wsSum.getCell(`A${metaRow}`);
    keyCell.value = key;
    keyCell.font = { bold: true, size: 10 };

    const valueCell = wsSum.getCell(`B${metaRow}`);
    valueCell.value = value;
    valueCell.font = { size: 10 };
    metaRow++;
  }

  // Add empty row
  metaRow++;

  // Overall Summary
  const overallStartRow = metaRow;
  wsSum.mergeCells(`A${overallStartRow}`, `C${overallStartRow}`);
  const overallTitleCell = wsSum.getCell(`A${overallStartRow}`);
  overallTitleCell.value = "OVERALL SUMMARY";
  overallTitleCell.font = {
    bold: true,
    size: 12,
    color: { argb: "FF2E5B9A" },
  };

  const overallDataStart = overallStartRow + 1;
  wsSum.getCell(`A${overallDataStart}`).value = "Records";
  wsSum.getCell(`B${overallDataStart}`).value = overall.count;

  wsSum.getCell(`A${overallDataStart + 1}`).value = "Pending";
  wsSum.getCell(`B${overallDataStart + 1}`).value = overall.pending;

  wsSum.getCell(`A${overallDataStart + 2}`).value = "Approved";
  wsSum.getCell(`B${overallDataStart + 2}`).value = overall.approved;

  wsSum.getCell(`A${overallDataStart + 3}`).value = "Rejected";
  wsSum.getCell(`B${overallDataStart + 3}`).value = overall.rejected;

  wsSum.getCell(`A${overallDataStart + 5}`).value = "Normal";
  wsSum.getCell(`B${overallDataStart + 5}`).value = nz(
    minToHours(overall.normalMinutes),
  );

  wsSum.getCell(`A${overallDataStart + 6}`).value = "Double";
  wsSum.getCell(`B${overallDataStart + 6}`).value = nz(
    minToHours(overall.doubleMinutes),
  );

  wsSum.getCell(`A${overallDataStart + 7}`).value = "Triple";
  wsSum.getCell(`B${overallDataStart + 7}`).value = nz(
    minToHours(overall.tripleMinutes),
  );

  wsSum.getCell(`A${overallDataStart + 8}`).value = "Total";
  wsSum.getCell(`B${overallDataStart + 8}`).value = nz(
    minToHours(overall.totalMinutes),
  );

  wsSum.getCell(`A${overallDataStart + 9}`).value = "Approved Total";
  wsSum.getCell(`B${overallDataStart + 9}`).value = nz(
    minToHours(overall.approvedTotalMinutes),
  );

  // Style overall summary
  for (let i = 0; i <= 9; i++) {
    const rowNum = overallDataStart + i;
    wsSum.getCell(`A${rowNum}`).font = { bold: true, size: 10 };
    const bCell = wsSum.getCell(`B${rowNum}`);
    bCell.font = { size: 10 };
    bCell.alignment = { horizontal: "right" };
  }

  // Employee-wise Summary
  const empStartRow = overallStartRow + 12;
  wsSum.mergeCells(`A${empStartRow}`, `H${empStartRow}`);
  const empTitleCell = wsSum.getCell(`A${empStartRow}`);
  empTitleCell.value = "EMPLOYEE-WISE SUMMARY";
  empTitleCell.font = {
    bold: true,
    size: 12,
    color: { argb: "FF2E5B9A" },
  };
  empTitleCell.alignment = { horizontal: "center" };

  // Employee table headers
  const headerRowNum = empStartRow + 1;
  wsSum.getCell(`A${headerRowNum}`).value = "Emp ID";
  wsSum.getCell(`B${headerRowNum}`).value = "Employee Name";
  wsSum.getCell(`C${headerRowNum}`).value = "Count";
  wsSum.getCell(`D${headerRowNum}`).value = "Normal (Hrs)";
  wsSum.getCell(`E${headerRowNum}`).value = "Double (Hrs)";
  wsSum.getCell(`F${headerRowNum}`).value = "Triple (Hrs)";
  wsSum.getCell(`G${headerRowNum}`).value = "Total (Hrs)";
  wsSum.getCell(`H${headerRowNum}`).value = "Approved (Hrs)";

  const empList = Array.from(byEmployee.values()).sort((a, b) =>
    (a.empId || "").localeCompare(b.empId || ""),
  );

  // Add employee data
  let dataRow = headerRowNum + 1;
  for (const e of empList) {
    wsSum.getCell(`A${dataRow}`).value = e.empId;
    wsSum.getCell(`B${dataRow}`).value = e.name;
    wsSum.getCell(`C${dataRow}`).value = e.count;
    wsSum.getCell(`D${dataRow}`).value = nz(minToHours(e.normalMinutes));
    wsSum.getCell(`E${dataRow}`).value = nz(minToHours(e.doubleMinutes));
    wsSum.getCell(`F${dataRow}`).value = nz(minToHours(e.tripleMinutes));
    wsSum.getCell(`G${dataRow}`).value = nz(minToHours(e.totalMinutes));
    wsSum.getCell(`H${dataRow}`).value = nz(minToHours(e.approvedTotalMinutes));
    dataRow++;
  }

  // Apply table styling to employee summary
  applyTableStyle(wsSum, headerRowNum, dataRow - 1, 1, 8);

  // Auto width for all columns
  autoWidth(wsSum);

  // Set column widths specifically
  wsSum.getColumn(1).width = 12;
  wsSum.getColumn(2).width = 25;
  wsSum.getColumn(3).width = 8;
  wsSum.getColumn(4).width = 12;
  wsSum.getColumn(5).width = 12;
  wsSum.getColumn(6).width = 12;
  wsSum.getColumn(7).width = 12;
  wsSum.getColumn(8).width = 12;

  /* ---------- Sheet 2: RECORDS ---------- */
  const wsRec = wb.addWorksheet(
    mode === "summary" ? "Records (Detailed)" : "Records",
  );

  // Add logo to records sheet too
  wsRec.addImage(logoId, "A1:C3");

  // Title for records sheet
  wsRec.mergeCells("D1", "H2");
  const recTitleCell = wsRec.getCell("D1");
  recTitleCell.value = "OVERTIME RECORDS - DETAILED";
  recTitleCell.font = {
    bold: true,
    size: 16,
    color: { argb: "FF2E5B9A" },
  };
  recTitleCell.alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  // Add metadata to records sheet
  let recMetaRow = 4;
  for (const [key, value] of Object.entries(meta)) {
    const keyCell = wsRec.getCell(`A${recMetaRow}`);
    keyCell.value = key;
    keyCell.font = { bold: true, size: 10 };

    const valueCell = wsRec.getCell(`B${recMetaRow}`);
    valueCell.value = value;
    valueCell.font = { size: 10 };
    recMetaRow++;
  }

  recMetaRow++; // Empty row

  const isEmployeeWise = scope !== "daily";

  if (!isEmployeeWise) {
    // Headers for non-employee-wise view
    const headersStart = recMetaRow;
    wsRec.getCell(`A${headersStart}`).value = "Work Date";
    wsRec.getCell(`B${headersStart}`).value = "Emp ID";
    wsRec.getCell(`C${headersStart}`).value = "Employee";
    wsRec.getCell(`D${headersStart}`).value = "Shift";
    wsRec.getCell(`E${headersStart}`).value = "In Time";
    wsRec.getCell(`F${headersStart}`).value = "Out Time";
    wsRec.getCell(`G${headersStart}`).value = "Normal (Hrs)";
    wsRec.getCell(`H${headersStart}`).value = "Double (Hrs)";
    wsRec.getCell(`I${headersStart}`).value = "Triple (Hrs)";
    wsRec.getCell(`J${headersStart}`).value = "Total (Hrs)";
    wsRec.getCell(`K${headersStart}`).value = "Approved (Hrs)";
    wsRec.getCell(`L${headersStart}`).value = "Status";

    // Add records data
    let dataRowNum = headersStart + 1;
    for (const r of records) {
      const emp: any = r.employeeId ?? {};
      wsRec.getCell(`A${dataRowNum}`).value = r.workDate;
      wsRec.getCell(`B${dataRowNum}`).value = emp.empId ?? "";
      wsRec.getCell(`C${dataRowNum}`).value = emp.name ?? "";
      wsRec.getCell(`D${dataRowNum}`).value = r.shift ?? "";
      wsRec.getCell(`E${dataRowNum}`).value = r.inTime ?? "";
      wsRec.getCell(`F${dataRowNum}`).value = r.outTime ?? "";
      wsRec.getCell(`G${dataRowNum}`).value = nz(
        minToHours(r.normalMinutes ?? 0),
      );
      wsRec.getCell(`H${dataRowNum}`).value = nz(
        minToHours(r.doubleMinutes ?? 0),
      );
      wsRec.getCell(`I${dataRowNum}`).value = nz(
        minToHours(r.tripleMinutes ?? 0),
      );
      wsRec.getCell(`J${dataRowNum}`).value = nz(minToHours(minutesTotal(r)));
      wsRec.getCell(`K${dataRowNum}`).value = nz(minToHours(approvedTotal(r)));
      wsRec.getCell(`L${dataRowNum}`).value = r.status ?? "";
      dataRowNum++;
    }

    // Apply table styling
    applyTableStyle(wsRec, headersStart, dataRowNum - 1, 1, 12);
  } else {
    // Employee-wise grouping
    let currentRow = recMetaRow;

    for (const e of empList) {
      // Employee header
      wsRec.mergeCells(`A${currentRow}`, `L${currentRow}`);
      const empHeader = wsRec.getCell(`A${currentRow}`);
      empHeader.value = `EMPLOYEE: ${e.empId} - ${e.name}`;
      empHeader.font = {
        bold: true,
        size: 12,
        color: { argb: "FF2E5B9A" },
      };
      empHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8F0FE" },
      };
      empHeader.alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      currentRow++;

      // Sub-headers
      const subHeadersStart = currentRow;
      wsRec.getCell(`A${subHeadersStart}`).value = "Work Date";
      wsRec.getCell(`B${subHeadersStart}`).value = "Shift";
      wsRec.getCell(`C${subHeadersStart}`).value = "In Time";
      wsRec.getCell(`D${subHeadersStart}`).value = "Out Time";
      wsRec.getCell(`E${subHeadersStart}`).value = "Normal (Hrs)";
      wsRec.getCell(`F${subHeadersStart}`).value = "Double (Hrs)";
      wsRec.getCell(`G${subHeadersStart}`).value = "Triple (Hrs)";
      wsRec.getCell(`H${subHeadersStart}`).value = "Total (Hrs)";
      wsRec.getCell(`I${subHeadersStart}`).value = "Approved (Hrs)";
      wsRec.getCell(`J${subHeadersStart}`).value = "Status";
      currentRow++;

      // Add employee records
      const dataStartRow = currentRow;
      for (const r of e.rows) {
        wsRec.getCell(`A${currentRow}`).value = r.workDate;
        wsRec.getCell(`B${currentRow}`).value = r.shift ?? "";
        wsRec.getCell(`C${currentRow}`).value = r.inTime ?? "";
        wsRec.getCell(`D${currentRow}`).value = r.outTime ?? "";
        wsRec.getCell(`E${currentRow}`).value = nz(
          minToHours(r.normalMinutes ?? 0),
        );
        wsRec.getCell(`F${currentRow}`).value = nz(
          minToHours(r.doubleMinutes ?? 0),
        );
        wsRec.getCell(`G${currentRow}`).value = nz(
          minToHours(r.tripleMinutes ?? 0),
        );
        wsRec.getCell(`H${currentRow}`).value = nz(minToHours(minutesTotal(r)));
        wsRec.getCell(`I${currentRow}`).value = nz(
          minToHours(approvedTotal(r)),
        );
        wsRec.getCell(`J${currentRow}`).value = r.status ?? "";
        currentRow++;
      }

      // Subtotal row
      const subtotalCell = wsRec.getCell(`D${currentRow}`);
      subtotalCell.value = "SUBTOTAL:";
      subtotalCell.font = { bold: true };
      wsRec.getCell(`E${currentRow}`).value = nz(minToHours(e.normalMinutes));
      wsRec.getCell(`F${currentRow}`).value = nz(minToHours(e.doubleMinutes));
      wsRec.getCell(`G${currentRow}`).value = nz(minToHours(e.tripleMinutes));
      wsRec.getCell(`H${currentRow}`).value = nz(minToHours(e.totalMinutes));
      wsRec.getCell(`I${currentRow}`).value = nz(
        minToHours(e.approvedTotalMinutes),
      );

      // Style the subtotal row
      const subtotalRow = wsRec.getRow(currentRow);
      subtotalRow.eachCell((cell: any) => {
        if (cell.value) {
          cell.font = { bold: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF2F8FF" },
          };
        }
      });

      currentRow += 2; // Add spacing between employees

      // Apply table styling for this employee's section
      applyTableStyle(wsRec, subHeadersStart, currentRow - 3, 1, 10);
    }
  }

  // Auto width for records sheet
  autoWidth(wsRec);

  const filename = safeFileName(`ot_${scope}_${from}_to_${to}_${mode}.xlsx`);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  await wb.xlsx.write(res);
  res.end();
}
