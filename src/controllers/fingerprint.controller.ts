import { Request, Response } from "express";

type Log = {
  empId: string;
  date: string;
  time: string;
  datetime: Date;
  type: "IN" | "OUT";
};

export async function processLogs(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const rawData = req.file.buffer.toString("utf-8");
    const lines = rawData.split("\n").filter(Boolean);

    const rawLogs = lines.map((line) => {
      const [empId, date, time] = line.trim().split(/\s+/);
      return { empId, date, time, datetime: new Date(`${date}T${time}`) };
    });

    rawLogs.sort((a, b) => {
      if (a.empId !== b.empId) return a.empId.localeCompare(b.empId);
      return a.datetime.getTime() - b.datetime.getTime();
    });

    const logs: Log[] = [];
    const lastTypeMap = new Map<string, "IN" | "OUT">();

    for (const log of rawLogs) {
      const lastType = lastTypeMap.get(log.empId);
      let type: "IN" | "OUT";

      if (!lastType) {
        // First punch of this employee → assume OUT (came from previous day)
        type = "OUT";
      } else {
        // Alternate
        type = lastType === "IN" ? "OUT" : "IN";
      }

      logs.push({ ...log, type });
      lastTypeMap.set(log.empId, type);
    }

    const csvContent = [
      "EmpID,Date,Time,Type",
      ...logs.map((l) => `${l.empId},${l.date},${l.time},${l.type}`),
    ].join("\n");

    res.json({ logs, csv: csvContent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error processing file" });
  }
}
