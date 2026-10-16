const isDate = (v) => v instanceof Date;
const num = (v) => (isDate(v) ? v.getTime() : v);

function check(range, name = "range") {
  if (range === null || typeof range !== "object") throw new TypeError(`time-ranges: ${name} must be { start, end }`);
  const start = num(range.start);
  const end = num(range.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new TypeError(`time-ranges: ${name} needs a numeric or Date start and end`);
  if (end < start) throw new RangeError(`time-ranges: ${name} ends before it starts`);
  return { start, end };
}

// Results keep the kind of value you gave: Dates in, Dates out.
const like = (sample) => (isDate(sample?.start) ? (n) => new Date(n) : (n) => n);
const make = (start, end, wrap) => ({ start: wrap(start), end: wrap(end) });

/**
 * Ranges are half-open: `start` is in, `end` is out. So 09:00-12:00 and 12:00-15:00 touch but do not overlap, and a range of
 * length 0 is empty. Values are numbers (minutes, milliseconds...) or Dates; the results come back in the same kind.
 */
export function overlaps(a, b) {
  const x = check(a, "a");
  const y = check(b, "b");
  return x.start < x.end && y.start < y.end && x.start < y.end && y.start < x.end; // an empty range overlaps nothing
}

/** The part two ranges share, or `null`. */
export function intersect(a, b) {
  const x = check(a, "a");
  const y = check(b, "b");
  const start = Math.max(x.start, y.start);
  const end = Math.min(x.end, y.end);
  return start < end ? make(start, end, like(a)) : null;
}

/** Whether a point (or a whole range) lies inside a range. */
export function contains(range, inner) {
  const r = check(range);
  if (inner !== null && typeof inner === "object" && !isDate(inner)) {
    const i = check(inner, "inner");
    return i.start >= r.start && i.end <= r.end;
  }
  const point = num(inner);
  return point >= r.start && point < r.end;
}

/** The length (`end - start`; in milliseconds for Dates). */
export const length = (range) => {
  const r = check(range);
  return r.end - r.start;
};

/** Sorts ranges and joins the ones that overlap (or lie within `gap` of each other). Empty ranges are dropped. */
export function merge(ranges, { gap = 0 } = {}) {
  if (!(gap >= 0)) throw new RangeError("time-ranges: gap cannot be negative");
  const list = ranges.map((r) => ({ ...check(r), wrap: like(r) })).filter((r) => r.end > r.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  for (const r of list) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + gap) last.end = Math.max(last.end, r.end);
    else out.push({ start: r.start, end: r.end, wrap: r.wrap });
  }
  return out.map((r) => make(r.start, r.end, r.wrap));
}

/** What is left of `ranges` after taking `removals` out: `subtract([{start: 9, end: 17}], [{start: 12, end: 13}])` gives 9-12 and 13-17. */
export function subtract(ranges, removals) {
  const cut = merge(removals).map((r) => check(r));
  const out = [];
  for (const source of merge(ranges)) {
    const wrap = like(source);
    let { start, end } = check(source);
    for (const c of cut) {
      if (c.end <= start || c.start >= end) continue;
      if (c.start > start) out.push(make(start, c.start, wrap));
      start = Math.max(start, c.end);
      if (start >= end) break;
    }
    if (start < end) out.push(make(start, end, wrap));
  }
  return out;
}

/** The free time inside `within` that none of `ranges` uses. */
export function gaps(ranges, within) {
  return subtract([within], ranges);
}

/** Total length of the union of the ranges: overlapping parts count once. */
export function totalLength(ranges) {
  return merge(ranges).reduce((sum, r) => sum + (num(r.end) - num(r.start)), 0);
}

/** Cuts a range at the given points: `splitAt({start: 0, end: 10}, [3, 7])` gives 0-3, 3-7, 7-10. Points outside the range are ignored. */
export function splitAt(range, points) {
  const r = check(range);
  const wrap = like(range);
  const cuts = [...new Set(points.map(num))].filter((p) => p > r.start && p < r.end).sort((a, b) => a - b);
  const edges = [r.start, ...cuts, r.end];
  return edges.slice(0, -1).map((s, i) => make(s, edges[i + 1], wrap));
}

/**
 * Who is there at the same time? Returns the stretches where the number of overlapping ranges stays the same:
 * `[{ start, end, count }]` (count 0 is left out). `peak(ranges)` is the highest count: how many people at the busiest moment.
 */
export function concurrency(ranges) {
  const events = [];
  const wraps = ranges.length ? like(ranges[0]) : (n) => n;
  for (const r of ranges) {
    const { start, end } = check(r);
    if (end > start) events.push([start, 1], [end, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = [];
  let count = 0;
  let from = null;
  for (const [time, delta] of events) {
    if (from !== null && time > from && count > 0) {
      const last = out[out.length - 1];
      if (last && last.end === from && last.count === count) last.end = time;
      else out.push({ start: from, end: time, count });
    }
    count += delta;
    from = time;
  }
  return out.map((s) => ({ ...make(s.start, s.end, wraps), count: s.count }));
}

export const peak = (ranges) => concurrency(ranges).reduce((max, s) => Math.max(max, s.count), 0);

/** Splits a range of Dates at midnight in UTC (default), or at midnight of a fixed offset in minutes (`offsetMinutes: 120` for UTC+2). Each piece has the `day` ("YYYY-MM-DD") it belongs to. */
export function splitByDay(range, { offsetMinutes = 0 } = {}) {
  const r = check(range);
  const offset = offsetMinutes * 60_000;
  const wrap = like(range);
  const out = [];
  let start = r.start;
  while (start < r.end) {
    const dayStart = Math.floor((start + offset) / 86_400_000) * 86_400_000 - offset;
    const end = Math.min(r.end, dayStart + 86_400_000);
    out.push({ ...make(start, end, wrap), day: new Date(start + offset).toISOString().slice(0, 10) });
    start = end;
  }
  return out;
}

// ---- Clock times (a day is 1440 minutes) ----

/** `"22:30"` to minutes since midnight (1350). `"24:00"` is allowed as the end of a day. */
export function parseClock(text) {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(String(text).trim());
  if (!m) throw new TypeError(`time-ranges: "${text}" is not a time like 22:30`);
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  if (minutes > 1440) throw new RangeError(`time-ranges: "${text}" is more than 24:00`);
  return minutes;
}

/** 1350 to `"22:30"`; minutes past 1440 wrap to the next day (1500 gives `"01:00"`). */
export function formatClock(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0) throw new RangeError("time-ranges: minutes must be a whole number, 0 or more");
  const m = minutes % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * A shift from `"22:00"` to `"02:00"` is 22:00 until 02:00 the next day: `{ start: 1320, end: 1560 }` (minutes since midnight of the
 * first day). An end that is not after the start means "the next day". The same start and end give a full 24 hours.
 */
export function shift(startClock, endClock) {
  const start = parseClock(startClock);
  let end = parseClock(endClock);
  if (end <= start) end += 1440;
  return { start, end };
}

/** Splits minute-based ranges at every midnight: a shift 22:00-02:00 becomes 22:00-24:00 on day 0 and 00:00-02:00 on day 1. */
export function byDay(range) {
  const r = check(range);
  const out = [];
  for (let start = r.start; start < r.end; ) {
    const day = Math.floor(start / 1440);
    const end = Math.min(r.end, (day + 1) * 1440);
    out.push({ day, start: start - day * 1440, end: end - day * 1440 });
    start = end;
  }
  return out;
}

/**
 * How many minutes of a shift fall in a recurring daily window, such as the night hours for a night allowance:
 * `minutesIn(shift("20:00", "03:00"), "22:00", "06:00")` is 300. Works over midnight and for shifts longer than a day.
 */
export function minutesIn(shiftRange, windowStart, windowEnd) {
  const r = check(shiftRange);
  const w = shift(windowStart, windowEnd);
  let total = 0;
  const firstDay = Math.floor(r.start / 1440) - 1;
  const lastDay = Math.floor(r.end / 1440);
  for (let day = firstDay; day <= lastDay; day++) {
    const overlap = intersect(r, { start: w.start + day * 1440, end: w.end + day * 1440 });
    if (overlap) total += overlap.end - overlap.start;
  }
  return total;
}
