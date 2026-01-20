import mongoose from "mongoose";
import { Employee } from "../models/employee.model.js";
import { env } from "../configs/env.js";

const TOTAL = 1_000;
const BATCH_SIZE = 1_000;

const firstNames = [
  "Amal",
  "Nimal",
  "Kamal",
  "Sunil",
  "Sahan",
  "Kasun",
  "Dilan",
  "Chamara",
  "Gayan",
  "Tharindu",
  "Nadeesha",
  "Sanduni",
  "Hiruni",
  "Dilani",
  "Madhavi",
  "Ishara",
  "Thilini",
  "Hansani",
  "Sewmini",
  "Kavindi",
] as const;

const lastNames = [
  "Perera",
  "Silva",
  "Fernando",
  "Jayasinghe",
  "Gunasekara",
  "Wijesinghe",
  "Herath",
  "Rathnayake",
  "Rajapaksha",
  "Bandara",
  "Dissanayake",
  "Kariyawasam",
  "Wickramasinghe",
  "Abeysekara",
  "Ekanayake",
  "Senanayake",
  "Weerasinghe",
  "Amarasinghe",
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function makeEmpId(i: number): string {
  // EMP000001 ... EMP100000 (unique)
  return `EMP${String(i).padStart(6, "0")}`;
}

function makeName(): string {
  return `${pick(firstNames)} ${pick(lastNames)}`;
}

function emailFromName(name: string, i: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, ".");
  return `${base}.${i}@example.com`;
}

async function seedEmployees() {
  // Adjust this to your env shape if needed
  const uri: string | undefined =
    // common patterns:
    (env as any)?.mongodbUri ??
    (env as any)?.mongoUri ??
    (env as any)?.MONGODB_URI ??
    process.env.MONGODB_URI;

  if (!uri)
    throw new Error("Missing MongoDB URI (env or process.env.MONGODB_URI)");

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  // Optional: wipe existing employees (uncomment if you want)
  // await Employee.deleteMany({});
  // console.log("Cleared Employee collection");

  let inserted = 0;

  for (let start = 1; start <= TOTAL; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, TOTAL);

    const docs: Array<{
      empId: string;
      name: string;
      email: string;
      isDeleted: boolean;
      deletedAt?: Date;
    }> = [];

    for (let i = start; i <= end; i++) {
      const name = makeName();
      docs.push({
        empId: makeEmpId(i),
        name,
        email: emailFromName(name, i),
        isDeleted: false,
        deletedAt: undefined,
      });
    }

    // ordered:false continues even if some docs fail (shouldn’t, but safer)
    await Employee.insertMany(docs, { ordered: false });

    inserted += docs.length;
    console.log(`Inserted ${inserted}/${TOTAL}`);
  }

  console.log("Done seeding employees.");
  await mongoose.disconnect();
}

seedEmployees().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
