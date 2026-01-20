type DayType = "WEEKDAY" | "SATURDAY" | "SUNDAY";

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesDiff(start: number, end: number) {
  if (end < start) return end + 24 * 60 - start; // cross midnight
  return end - start;
}

function dayTypeFromDate(dateYYYYMMDD: string): DayType {
  const d = new Date(dateYYYYMMDD + "T00:00:00Z");
  const day = d.getUTCDay();
  if (day === 0) return "SUNDAY";
  if (day === 6) return "SATURDAY";
  return "WEEKDAY";
}

function shiftType(shift: string): "SHIFT_0630" | "SHIFT_0830" | "OTHER" {
  const s = shift.toLowerCase().trim();

  // Match your system values EXACTLY
  if (s === "shift 1" || s.includes("6:30") || s.includes("0630"))
    return "SHIFT_0630";
  if (s === "shift 2" || s.includes("8:30") || s.includes("0830"))
    return "SHIFT_0830";

  return "OTHER";
}

// Round DOWN to nearest 15 minutes
function floorTo15(mins: number) {
  return Math.floor(mins / 15) * 15;
}

// OPTIONAL break rule (REMOVE if you don't want it)
const BREAK_DEDUCT_MIN = 60; // 1 hour
const BREAK_APPLIES_AT_MIN = 6 * 60; // if OT/work >= 6h

function applyBreakDeduction(mins: number) {
  if (mins >= BREAK_APPLIES_AT_MIN) return Math.max(0, mins - BREAK_DEDUCT_MIN);
  return mins;
}

export function calcOtMinutes(params: {
  workDate: string; // YYYY-MM-DD
  shift: string;
  inTime: string;
  outTime: string;
  isTripleDay: boolean;
}) {
  const inMin = toMinutes(params.inTime);
  const outMin = toMinutes(params.outTime);

  // adjusted out time for midnight crossing
  const outAdjusted = outMin < inMin ? outMin + 24 * 60 : outMin;

  // Night flag: true only at 21:01+
  const NIGHT_START = 21 * 60; // 21:00
  const isNight = outAdjusted > NIGHT_START;

  const rawWorked = minutesDiff(inMin, outMin);

  // TRIPLE day: all worked is TRIPLE
  if (params.isTripleDay) {
    const triple = floorTo15(applyBreakDeduction(rawWorked));
    return {
      normalMinutes: 0,
      doubleMinutes: 0,
      tripleMinutes: triple,
      isNight,
    };
  }

  const dayType = dayTypeFromDate(params.workDate);

  // SUNDAY: all worked is DOUBLE
  if (dayType === "SUNDAY") {
    const dbl = floorTo15(applyBreakDeduction(rawWorked));
    return { normalMinutes: 0, doubleMinutes: dbl, tripleMinutes: 0, isNight };
  }

  const st = shiftType(params.shift);

  // OT start based on day + shift
  let otStart: number;

  if (dayType === "SATURDAY") {
    // Saturday
    otStart = st === "SHIFT_0630" ? toMinutes("11:30") : toMinutes("13:30");
  } else {
    // Weekday
    otStart = st === "SHIFT_0630" ? toMinutes("15:30") : toMinutes("17:30");
  }

  // OT = from max(inTime, otStart) -> out
  const start = Math.max(inMin, otStart);
  const rawOt = Math.max(0, outAdjusted - start);

  const normalOt = floorTo15(applyBreakDeduction(rawOt));

  // WEEKDAY + SATURDAY: normal only
  return {
    normalMinutes: normalOt,
    doubleMinutes: 0,
    tripleMinutes: 0,
    isNight,
  };
}
