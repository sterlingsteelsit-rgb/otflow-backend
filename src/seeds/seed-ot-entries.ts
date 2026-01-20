import mongoose, { Types } from "mongoose";
import { env } from "../configs/env.js"; // <-- adjust path if needed
import { Employee } from "../models/employee.model.js"; // <-- adjust
import { OtEntry } from "../models/otEntry.model.js"; // <-- adjust

// Tune these
const DAYS = 10; // generate entries for last N days
const BATCH_SIZE = 5_000;

// If true: each employee gets an OT entry for every day (100k * 30 = 3M docs) -> HUGE
// If false: only a % of employees get an entry per day
const ALL_EMPLOYEES_EVERY_DAY = false;
const DAILY_EMPLOYEE_PERCENT = 100; // 10% of employees per day if not ALL_EMPLOYEES_EVERY_DAY

const shifts = ["DAY", "NIGHT", "EVENING"] as const;
const statuses = ["PENDING", "APPROVED", "REJECTED"] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// workDate is String in schema; use YYYY-MM-DD
function dateToYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function randomInt(min: number, max: number): number {
  // inclusive
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function minutesBetween(
  h1: number,
  m1: number,
  h2: number,
  m2: number,
): number {
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

function formatTime(h: number, m: number): string {
  return `${pad2(h)}:${pad2(m)}`;
}

function buildRandomOtTimes(shift: string) {
  // Simple, plausible times. You can tweak.
  if (shift === "NIGHT") {
    // OT: 20:00 -> 23:00 (night flag true sometimes)
    const inH = randomInt(19, 21);
    const inM = pick([0, 15, 30, 45] as const);
    const duration = randomInt(60, 240); // 1-4 hours
    const outTotal = inH * 60 + inM + duration;
    const outH = Math.min(23, Math.floor(outTotal / 60));
    const outM = outTotal % 60;
    return {
      inTime: formatTime(inH, inM),
      outTime: formatTime(outH, outM),
      isNight: true,
    };
  }

  // DAY / EVENING
  const inH = randomInt(17, 20);
  const inM = pick([0, 15, 30, 45] as const);
  const duration = randomInt(30, 240);
  const outTotal = Math.min(23 * 60 + 59, inH * 60 + inM + duration);
  const outH = Math.floor(outTotal / 60);
  const outM = outTotal % 60;
  return {
    inTime: formatTime(inH, inM),
    outTime: formatTime(outH, outM),
    isNight: false,
  };
}

function splitMinutes(total: number) {
  // Rough distribution
  const normal = Math.floor(total * 0.7);
  const remaining = total - normal;
  const double = Math.floor(remaining * 0.7);
  const triple = remaining - double;
  return {
    normalMinutes: normal,
    doubleMinutes: double,
    tripleMinutes: triple,
  };
}

async function seedOtEntries() {
  const uri: string | undefined =
    (env as any)?.mongodbUri ??
    (env as any)?.mongoUri ??
    (env as any)?.MONGODB_URI ??
    process.env.MONGODB_URI;

  if (!uri)
    throw new Error("Missing MongoDB URI (env or process.env.MONGODB_URI)");

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  // Load employees (only _id is needed)
  const employees: Array<{ _id: Types.ObjectId }> = await Employee.find(
    {},
    { _id: 1 },
    { lean: true },
  );

  if (employees.length === 0) {
    throw new Error("No employees found. Seed employees first.");
  }

  console.log(`Employees found: ${employees.length}`);

  // Optional: clear old OT entries
  await OtEntry.deleteMany({});
  console.log("Cleared OtEntry collection");

  const today = new Date();
  let buffer: any[] = [];
  let totalInserted = 0;

  for (let dayOffset = 0; dayOffset < DAYS; dayOffset++) {
    const d = addDays(today, -dayOffset);
    const workDate = dateToYMD(d);

    // Decide which employees to include for that day
    let chosenEmployees: Array<{ _id: Types.ObjectId }>;

    if (ALL_EMPLOYEES_EVERY_DAY) {
      chosenEmployees = employees;
    } else {
      const count = Math.max(
        1,
        Math.floor((employees.length * DAILY_EMPLOYEE_PERCENT) / 100),
      );

      // pick random subset (fast enough for 100k with a simple shuffle-lite)
      chosenEmployees = [];
      const used = new Set<number>();

      while (chosenEmployees.length < count) {
        const idx = randomInt(0, employees.length - 1);
        if (!used.has(idx)) {
          used.add(idx);
          chosenEmployees.push(employees[idx]!);
        }
      }
    }

    for (const emp of chosenEmployees) {
      const shift = pick(shifts);
      const { inTime, outTime, isNight } = buildRandomOtTimes(shift);

      // compute total minutes roughly from times
      const [inH, inM] = inTime.split(":").map(Number);
      const [outH, outM] = outTime.split(":").map(Number);
      const totalMinutes = Math.max(
        0,
        minutesBetween(inH!, inM!, outH!, outM!),
      );

      const { normalMinutes, doubleMinutes, tripleMinutes } =
        splitMinutes(totalMinutes);

      const status = pick(statuses);

      buffer.push({
        employeeId: emp._id,
        workDate,
        shift,
        inTime,
        outTime,
        reason: status === "PENDING" ? "Testing seed data" : undefined,
        normalMinutes,
        doubleMinutes,
        tripleMinutes,
        isNight,
        status,
        // decidedBy/decidedAt omitted since you may not want fake Users
      });

      if (buffer.length >= BATCH_SIZE) {
        // ordered:false helps keep going even if a duplicate slips in
        const res = await OtEntry.insertMany(buffer, { ordered: false });
        totalInserted += res.length;
        console.log(`Inserted: ${totalInserted}`);
        buffer = [];
      }
    }

    console.log(
      `Prepared workDate=${workDate} entries=${chosenEmployees.length}`,
    );
  }

  if (buffer.length > 0) {
    const res = await OtEntry.insertMany(buffer, { ordered: false });
    totalInserted += res.length;
  }

  console.log(`Done. Total OT entries inserted: ${totalInserted}`);
  await mongoose.disconnect();
}

seedOtEntries().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
