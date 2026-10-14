/**
 * NGX session clock. Africa/Lagos is UTC+1 all year, so wall-clock
 * conversion uses a fixed offset.
 *
 * Monday–Friday 09:30–16:00 WAT refreshes on the half hour, and the
 * 16:00 print is kept until 09:30 the next business morning. Friday's
 * close is kept until Monday 09:30. Saturday and Sunday do not open
 * a new window.
 */

const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const OPEN_MINUTES = 9 * 60 + 30;
const CLOSE_MINUTES = 16 * 60;

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

type Wat = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  minutes: number;
};

function readWat(now: Date): Wat {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const value: Record<string, string> = {};
  for (const part of parts) value[part.type] = part.value;

  const weekday = WEEKDAYS[value.weekday];
  if (weekday === undefined) {
    throw new Error(`Unrecognised Lagos weekday: ${value.weekday}`);
  }

  let hour = Number(value.hour);
  if (hour === 24) hour = 0;

  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    weekday,
    minutes: hour * 60 + Number(value.minute),
  };
}

function wallToUtc(year: number, month: number, day: number, minutes: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, minutes) - LAGOS_OFFSET_MS);
}

function addDays(wat: Wat, days: number): Pick<Wat, "year" | "month" | "day"> {
  const shifted = new Date(Date.UTC(wat.year, wat.month - 1, wat.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function atOpen(date: Pick<Wat, "year" | "month" | "day">): Date {
  return wallToUtc(date.year, date.month, date.day, OPEN_MINUTES);
}

/** When the snapshot taken at `now` should be replaced. */
export function nextRefreshAt(now: Date): Date {
  const wat = readWat(now);
  const weekend = wat.weekday === 0 || wat.weekday === 6;

  if (weekend) {
    const days = wat.weekday === 6 ? 2 : 1;
    return atOpen(addDays(wat, days));
  }

  if (wat.minutes >= CLOSE_MINUTES) {
    const days = wat.weekday === 5 ? 3 : 1;
    return atOpen(addDays(wat, days));
  }

  if (wat.minutes < OPEN_MINUTES) {
    return atOpen(wat);
  }

  const nextSlot = Math.floor(wat.minutes / 30) * 30 + 30;
  return wallToUtc(wat.year, wat.month, wat.day, Math.min(nextSlot, CLOSE_MINUTES));
}
