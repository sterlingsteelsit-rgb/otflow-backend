import { HttpError } from "../utils/http.js";
import { normalizePagination } from "../utils/pagination.js";
import { OtEntry } from "../models/otEntry.model.js";
import { TripleOtDay } from "../models/tripleOtDay.model.js";
import { calcOtMinutes } from "../utils/otCalc.js";
import { writeAudit } from "./audit.service.js";
import mongoose from "mongoose";

function minutesToHours(min: number) {
  return Math.round((min / 60) * 100) / 100; // 2 decimals
}

export async function listOt(query: any) {
  const { page, limit, skip } = normalizePagination(query.page, query.limit);

  const filter: any = {};
  if (query.employeeId) filter.employeeId = query.employeeId;
  if (query.status) filter.status = query.status;

  // from/to (inclusive)
  if (query.from || query.to) {
    filter.workDate = {};
    if (query.from) filter.workDate.$gte = String(query.from);
    if (query.to) filter.workDate.$lte = String(query.to);
  }

  const [items, total] = await Promise.all([
    OtEntry.find(filter)
      .populate("employeeId", "empId name")
      .sort({ workDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    OtEntry.countDocuments(filter),
  ]);

  return { page, limit, total, items };
}

export async function pendingCount() {
  // fast count using index
  const pending = await OtEntry.countDocuments({ status: "PENDING" });
  return { pending };
}

export async function getPendingNotifications({ limit }: { limit: number }) {
  const filter = { status: "PENDING" as const };

  const [pendingCount, latest] = await Promise.all([
    OtEntry.countDocuments(filter),
    OtEntry.find(filter)
      .select("workDate shift inTime outTime createdAt employeeId")
      .populate("employeeId", "empId name")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const items = latest.map((x: any) => ({
    id: String(x._id),
    createdAt: x.createdAt,
    workDate: x.workDate,
    shift: x.shift,
    inTime: x.inTime,
    outTime: x.outTime,
    employee: x.employeeId
      ? { empId: x.employeeId.empId, name: x.employeeId.name }
      : null,
  }));

  return { pendingCount, items };
}

export async function createBulk(params: {
  workDate: string;
  rows: Array<{
    employeeId: string;
    shift: string;
    inTime?: string;
    outTime?: string;
    reason?: string;
  }>;
  actorUserId: string;
  meta?: any;
}) {
  const isTriple = await TripleOtDay.exists({ date: params.workDate });

  const docs = params.rows.map((r) => {
    const isNoShift = r.shift === "NO_SHIFT";

    const calc = isNoShift
      ? { normalMinutes: 0, doubleMinutes: 0, tripleMinutes: 0, isNight: false }
      : calcOtMinutes({
          workDate: params.workDate,
          shift: r.shift,
          inTime: r.inTime!, // safe because zod ensures
          outTime: r.outTime!, // safe because zod ensures
          isTripleDay: !!isTriple,
        });

    return {
      employeeId: r.employeeId,
      workDate: params.workDate,
      shift: r.shift,

      inTime: isNoShift ? "" : r.inTime!,
      outTime: isNoShift ? "" : r.outTime!,

      reason: r.reason,
      ...calc,
      status: "PENDING",
      createdBy: params.actorUserId,
      updatedBy: params.actorUserId,
    };
  });

  try {
    const inserted = await OtEntry.insertMany(docs, { ordered: false }); // continues on duplicates
    // audit per inserted doc (kept small; you can also batch later)
    await Promise.all(
      inserted.map((d: any) =>
        writeAudit({
          entityType: "OT",
          entityId: String(d._id),
          action: "CREATE",
          actorUserId: params.actorUserId,
          diff: {
            after: {
              employeeId: d.employeeId,
              workDate: d.workDate,
              shift: d.shift,
            },
          },
          meta: params.meta,
        }),
      ),
    );
    return { insertedCount: inserted.length };
  } catch (e: any) {
    // If duplicates happen, Mongo throws bulk write error. We still want a friendly response.
    // We'll return a conflict summary.
    if (e?.writeErrors?.length) {
      return {
        insertedCount: e.result?.nInserted ?? 0,
        duplicates: e.writeErrors.length,
        errors: e.writeErrors
          .slice(0, 5)
          .map((x: any) => x.errmsg ?? x.message),
      };
    }
    throw e;
  }
}

export async function updateOt(params: {
  id: string;
  patch: { shift?: string; inTime?: string; outTime?: string; reason?: string };
  actorUserId: string;
  meta?: any;
}) {
  const existing = await OtEntry.findById(params.id).lean();
  if (!existing) throw new HttpError(404, "OT entry not found");
  if (existing.status !== "PENDING")
    throw new HttpError(409, "Only pending entries can be edited");

  const workDate = existing.workDate;
  const isTriple = await TripleOtDay.exists({ date: workDate });

  const next = {
    shift: params.patch.shift ?? existing.shift,
    inTime: params.patch.inTime ?? existing.inTime,
    outTime: params.patch.outTime ?? existing.outTime,
    reason: params.patch.reason ?? existing.reason,
  };

  const isNoShift = next.shift === "NO_SHIFT";

  const calc = isNoShift
    ? { normalMinutes: 0, doubleMinutes: 0, tripleMinutes: 0, isNight: false }
    : calcOtMinutes({
        workDate,
        shift: next.shift,
        inTime: next.inTime ?? "",
        outTime: next.outTime ?? "",
        isTripleDay: !!isTriple,
      });

  // (optional) if NO_SHIFT, wipe times
  const next2 = isNoShift ? { ...next, inTime: "", outTime: "" } : next;

  const updated = await OtEntry.findByIdAndUpdate(
    params.id,
    { ...next2, ...calc, updatedBy: params.actorUserId },
    { new: true },
  ).lean();

  await writeAudit({
    entityType: "OT",
    entityId: params.id,
    action: "UPDATE",
    actorUserId: params.actorUserId,
    diff: {
      before: {
        shift: existing.shift,
        inTime: existing.inTime,
        outTime: existing.outTime,
        reason: existing.reason,
      },
      after: next,
    },
    meta: params.meta,
  });

  return updated;
}

export async function approveOt(params: {
  id: string;
  reason?: string;
  actorUserId: string;
  approvedNormalMinutes?: number;
  approvedDoubleMinutes?: number;
  approvedTripleMinutes?: number;
  meta?: any;
}) {
  const existing = await OtEntry.findById(params.id).lean();
  if (!existing) throw new HttpError(404, "OT entry not found");
  if (existing.status !== "PENDING")
    throw new HttpError(409, "Already decided");

  const hasOverride =
    params.approvedNormalMinutes != null ||
    params.approvedDoubleMinutes != null ||
    params.approvedTripleMinutes != null;

  const approvedNormalMinutes: number =
    params.approvedNormalMinutes ?? existing.normalMinutes ?? 0;
  const approvedDoubleMinutes: number =
    params.approvedDoubleMinutes ?? existing.doubleMinutes ?? 0;
  const approvedTripleMinutes: number =
    params.approvedTripleMinutes ?? existing.tripleMinutes ?? 0;

  const approvedTotalMinutes =
    approvedNormalMinutes + approvedDoubleMinutes + approvedTripleMinutes;

  const updated = await OtEntry.findByIdAndUpdate(
    params.id,
    {
      status: "APPROVED",
      decisionReason: params.reason,
      decidedBy: params.actorUserId,
      decidedAt: new Date(),
      updatedBy: params.actorUserId,

      approvedNormalMinutes,
      approvedDoubleMinutes,
      approvedTripleMinutes,
      approvedTotalMinutes,
      isApprovedOverride: hasOverride,
    },
    { new: true },
  ).lean();

  await writeAudit({
    entityType: "OT",
    entityId: params.id,
    action: "APPROVE",
    actorUserId: params.actorUserId,
    diff: {
      before: {
        status: "PENDING",
        normalMinutes: existing.normalMinutes,
        doubleMinutes: existing.doubleMinutes,
        tripleMinutes: existing.tripleMinutes,
      },
      after: {
        status: "APPROVED",
        decisionReason: params.reason,
        approvedNormalMinutes,
        approvedDoubleMinutes,
        approvedTripleMinutes,
        approvedTotalMinutes,
        isApprovedOverride: hasOverride,
      },
    },
    meta: params.meta,
  });

  return updated;
}

export async function rejectOt(params: {
  id: string;
  reason: string;
  actorUserId: string;
  meta?: any;
}) {
  const existing = await OtEntry.findById(params.id).lean();
  if (!existing) throw new HttpError(404, "OT entry not found");
  if (existing.status !== "PENDING")
    throw new HttpError(409, "Already decided");
  if (!params.reason?.trim())
    throw new HttpError(400, "Rejection reason required");

  const updated = await OtEntry.findByIdAndUpdate(
    params.id,
    {
      status: "REJECTED",
      decisionReason: params.reason,
      decidedBy: params.actorUserId,
      decidedAt: new Date(),
      updatedBy: params.actorUserId,
    },
    { new: true },
  ).lean();

  await writeAudit({
    entityType: "OT",
    entityId: params.id,
    action: "REJECT",
    actorUserId: params.actorUserId,
    diff: {
      before: { status: "PENDING" },
      after: { status: "REJECTED", decisionReason: params.reason },
    },
    meta: params.meta,
  });

  return updated;
}

export async function dayStats(date: string) {
  const match = { workDate: date };
  const agg = await OtEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        normalMinutes: { $sum: "$normalMinutes" },
        doubleMinutes: { $sum: "$doubleMinutes" },
        tripleMinutes: { $sum: "$tripleMinutes" },
      },
    },
  ]);

  const base = {
    date,
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    hours: { normal: 0, double: 0, triple: 0 },
  };

  for (const r of agg) {
    const status = String(r._id);
    base.total += r.count;
    base.hours.normal += minutesToHours(r.normalMinutes);
    base.hours.double += minutesToHours(r.doubleMinutes);
    base.hours.triple += minutesToHours(r.tripleMinutes);

    if (status === "PENDING") base.pending = r.count;
    if (status === "APPROVED") base.approved = r.count;
    if (status === "REJECTED") base.rejected = r.count;
  }

  return base;
}

export async function weekStats(from: string, to: string) {
  // returns stats per day in range
  const agg = await OtEntry.aggregate([
    { $match: { workDate: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { workDate: "$workDate", status: "$status" },
        count: { $sum: 1 },
        normalMinutes: { $sum: "$normalMinutes" },
        doubleMinutes: { $sum: "$doubleMinutes" },
        tripleMinutes: { $sum: "$tripleMinutes" },
      },
    },
  ]);

  const map: Record<string, any> = {};
  function ensure(date: string) {
    if (!map[date]) {
      map[date] = {
        date,
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        hours: { normal: 0, double: 0, triple: 0 },
      };
    }
    return map[date];
  }

  for (const r of agg) {
    const date = r._id.workDate;
    const status = r._id.status;
    const obj = ensure(date);

    obj.total += r.count;
    obj.hours.normal += minutesToHours(r.normalMinutes);
    obj.hours.double += minutesToHours(r.doubleMinutes);
    obj.hours.triple += minutesToHours(r.tripleMinutes);

    if (status === "PENDING") obj.pending += r.count;
    if (status === "APPROVED") obj.approved += r.count;
    if (status === "REJECTED") obj.rejected += r.count;
  }

  return Object.values(map).sort((a: any, b: any) =>
    a.date.localeCompare(b.date),
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// WorkDate is stored as "YYYY-MM-DD" string, so string compare works.
function monthRange(yyyyMM: string) {
  const [y, m] = yyyyMM.split("-").map(Number);
  const start = `${y}-${pad2(m)}-01`;
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${pad2(m + 1)}-01`;
  // inclusive end => take day before nextMonth
  const endDate = new Date(nextMonth + "T00:00:00Z");
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const end = `${endDate.getUTCFullYear()}-${pad2(endDate.getUTCMonth() + 1)}-${pad2(
    endDate.getUTCDate(),
  )}`;
  return { from: start, to: end };
}

function yearRange(yyyy: string) {
  return { from: `${yyyy}-01-01`, to: `${yyyy}-12-31` };
}

function weekRangeFromAnchor(anchorYYYYMMDD: string) {
  // Monday-Sunday (UTC)
  const d = new Date(anchorYYYYMMDD + "T00:00:00Z");
  const day = d.getUTCDay(); // 0 Sun ... 6 Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMon);
  const from = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  const d2 = new Date(d);
  d2.setUTCDate(d2.getUTCDate() + 6);
  const to = `${d2.getUTCFullYear()}-${pad2(d2.getUTCMonth() + 1)}-${pad2(d2.getUTCDate())}`;
  return { from, to };
}

function resolveRange(query: any) {
  // If from/to provided, use them
  if (query.from || query.to) {
    return {
      from: query.from ? String(query.from) : "0000-01-01",
      to: query.to ? String(query.to) : "9999-12-31",
    };
  }

  const scope = String(query.scope || "daily");
  const anchor = String(query.anchor || "");

  // Defaults if no anchor:
  // - daily/weekly: today
  // - monthly: current YYYY-MM
  // - yearly: current YYYY
  const now = new Date();
  const today = `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
  const curMonth = `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}`;
  const curYear = `${now.getUTCFullYear()}`;

  if (scope === "daily") {
    const d = anchor && anchor.length >= 10 ? anchor : today;
    return { from: d, to: d };
  }
  if (scope === "weekly") {
    const d = anchor && anchor.length >= 10 ? anchor : today;
    return weekRangeFromAnchor(d);
  }
  if (scope === "monthly") {
    const m = anchor && anchor.length >= 7 ? anchor : curMonth;
    return monthRange(m);
  }
  if (scope === "yearly") {
    const y = anchor && anchor.length >= 4 ? anchor : curYear;
    return yearRange(y);
  }
  return { from: "0000-01-01", to: "9999-12-31" };
}

export async function logs(query: any) {
  const { page, limit, skip } = normalizePagination(query.page, query.limit);
  const { from, to } = resolveRange(query);

  const filter: any = { workDate: { $gte: from, $lte: to } };
  if (query.employeeId) filter.employeeId = query.employeeId;
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    OtEntry.find(filter)
      .populate("employeeId", "empId name")
      .populate("createdBy", "username email")
      .populate("updatedBy", "username email")
      .populate("decidedBy", "username email")
      .sort({ workDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    OtEntry.countDocuments(filter),
  ]);

  return { page, limit, total, from, to, items };
}

// summary grouped by period (daily/weekly/monthly/yearly)
export async function logsSummary(query: any) {
  const { from, to } = resolveRange(query);

  const match: any = { workDate: { $gte: from, $lte: to } };
  if (query.employeeId)
    match.employeeId = new mongoose.Types.ObjectId(query.employeeId);
  if (query.status) match.status = query.status;

  const scope = String(query.scope || "daily");

  // group key based on string slicing
  // daily: YYYY-MM-DD (full)
  // monthly: YYYY-MM
  // yearly: YYYY
  // weekly: compute ISO week key by converting workDate -> date (more work). We'll do weekly by "weekStart" via $dateTrunc.
  if (scope === "weekly") {
    return await OtEntry.aggregate([
      {
        $addFields: {
          workDateObj: {
            $dateFromString: { dateString: "$workDate", format: "%Y-%m-%d" },
          },
        },
      },
      { $match: match },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: "$workDateObj",
              unit: "week",
              startOfWeek: "Mon",
            },
          },
          count: { $sum: 1 },
          normalMinutes: { $sum: "$normalMinutes" },
          doubleMinutes: { $sum: "$doubleMinutes" },
          tripleMinutes: { $sum: "$tripleMinutes" },
          approvedTotalMinutes: { $sum: "$approvedTotalMinutes" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  const sliceLen = scope === "yearly" ? 4 : scope === "monthly" ? 7 : 10;

  const agg = await OtEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $substrBytes: ["$workDate", 0, sliceLen] },
        count: { $sum: 1 },
        normalMinutes: { $sum: "$normalMinutes" },
        doubleMinutes: { $sum: "$doubleMinutes" },
        tripleMinutes: { $sum: "$tripleMinutes" },
        approvedTotalMinutes: { $sum: "$approvedTotalMinutes" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return { from, to, scope, items: agg };
}
