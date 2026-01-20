import { HttpError } from "../utils/http.js";
import { normalizePagination } from "../utils/pagination.js";
import { OtEntry } from "../models/otEntry.model.js";
import { TripleOtDay } from "../models/tripleOtDay.model.js";
import { calcOtMinutes } from "../utils/otCalc.js";
import { writeAudit } from "./audit.service.js";

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
        inTime: next.inTime,
        outTime: next.outTime,
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

  const approvedNormalMinutes =
    params.approvedNormalMinutes ?? existing.normalMinutes ?? 0;
  const approvedDoubleMinutes =
    params.approvedDoubleMinutes ?? existing.doubleMinutes ?? 0;
  const approvedTripleMinutes =
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
