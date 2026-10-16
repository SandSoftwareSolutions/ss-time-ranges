import assert from "node:assert/strict";
import { test } from "node:test";

import { byDay, concurrency, contains, formatClock, gaps, intersect, length, merge, minutesIn, overlaps, parseClock, peak, shift, splitAt, splitByDay, subtract, totalLength } from "./src/index.js";

const r = (start, end) => ({ start, end });

test("ranges are half-open: touching is not overlapping", () => {
  assert.equal(overlaps(r(9, 12), r(12, 15)), false);
  assert.equal(overlaps(r(9, 12), r(11, 15)), true);
  assert.equal(overlaps(r(9, 17), r(10, 11)), true);
  assert.equal(overlaps(r(5, 5), r(1, 10)), false); // an empty range overlaps nothing
  assert.deepEqual(intersect(r(9, 12), r(11, 15)), r(11, 12));
  assert.equal(intersect(r(9, 12), r(12, 15)), null);
  assert.equal(contains(r(9, 12), 9), true);
  assert.equal(contains(r(9, 12), 12), false);
  assert.equal(contains(r(9, 17), r(10, 12)), true);
  assert.equal(contains(r(9, 17), r(10, 18)), false);
  assert.equal(length(r(3, 10)), 7);
});

test("merge joins overlapping and touching ranges, optionally close ones", () => {
  assert.deepEqual(merge([r(10, 12), r(1, 3), r(2, 5), r(5, 6), r(8, 8)]), [r(1, 6), r(10, 12)]);
  assert.deepEqual(merge([r(1, 3), r(4, 6)], { gap: 1 }), [r(1, 6)]);
  assert.deepEqual(merge([r(1, 3), r(5, 6)], { gap: 1 }), [r(1, 3), r(5, 6)]);
  assert.deepEqual(merge([]), []);
});

test("subtract cuts pieces out, gaps finds the free time", () => {
  assert.deepEqual(subtract([r(9, 17)], [r(12, 13)]), [r(9, 12), r(13, 17)]);
  assert.deepEqual(subtract([r(9, 17)], [r(8, 10), r(16, 20)]), [r(10, 16)]);
  assert.deepEqual(subtract([r(9, 17)], [r(0, 100)]), []);
  assert.deepEqual(subtract([r(9, 17)], [r(20, 30)]), [r(9, 17)]);
  assert.deepEqual(subtract([r(1, 5), r(8, 12)], [r(4, 9)]), [r(1, 4), r(9, 12)]);
  assert.deepEqual(gaps([r(9, 11), r(13, 14)], r(8, 17)), [r(8, 9), r(11, 13), r(14, 17)]);
});

test("totalLength counts overlapping time once", () => {
  assert.equal(totalLength([r(0, 10), r(5, 15), r(20, 25)]), 20);
  assert.equal(totalLength([]), 0);
});

test("splitAt", () => {
  assert.deepEqual(splitAt(r(0, 10), [7, 3, 3, -5, 99, 0, 10]), [r(0, 3), r(3, 7), r(7, 10)]);
  assert.deepEqual(splitAt(r(0, 10), []), [r(0, 10)]);
});

test("concurrency: who is there at the same time", () => {
  const shifts = [r(9, 17), r(12, 20), r(12, 14), r(30, 31)];
  assert.deepEqual(concurrency(shifts), [{ start: 9, end: 12, count: 1 }, { start: 12, end: 14, count: 3 }, { start: 14, end: 17, count: 2 }, { start: 17, end: 20, count: 1 }, { start: 30, end: 31, count: 1 }]);
  assert.equal(peak(shifts), 3);
  assert.equal(peak([]), 0);
  assert.deepEqual(concurrency([r(1, 2), r(2, 3)]), [{ start: 1, end: 3, count: 1 }]);
});

test("Dates in, Dates out", () => {
  const a = { start: new Date("2026-10-17T09:00:00Z"), end: new Date("2026-10-17T17:00:00Z") };
  const b = { start: new Date("2026-10-17T12:00:00Z"), end: new Date("2026-10-17T13:00:00Z") };
  const pieces = subtract([a], [b]);
  assert.ok(pieces.every((p) => p.start instanceof Date && p.end instanceof Date));
  assert.deepEqual(pieces.map((p) => [p.start.toISOString(), p.end.toISOString()]), [["2026-10-17T09:00:00.000Z", "2026-10-17T12:00:00.000Z"], ["2026-10-17T13:00:00.000Z", "2026-10-17T17:00:00.000Z"]]);
  assert.equal(length(a), 8 * 3_600_000);
  assert.equal(contains(a, new Date("2026-10-17T10:00:00Z")), true);
  assert.ok(intersect(a, b).start instanceof Date);
});

test("splitting Dates at midnight, in UTC or in a fixed offset", () => {
  const night = { start: new Date("2026-10-17T22:00:00Z"), end: new Date("2026-10-18T02:00:00Z") };
  const utc = splitByDay(night);
  assert.deepEqual(utc.map((p) => [p.day, p.start.toISOString(), p.end.toISOString()]), [["2026-10-17", "2026-10-17T22:00:00.000Z", "2026-10-18T00:00:00.000Z"], ["2026-10-18", "2026-10-18T00:00:00.000Z", "2026-10-18T02:00:00.000Z"]]);
  const ams = splitByDay(night, { offsetMinutes: 120 }); // 00:00-04:00 local on 18 October
  assert.equal(ams.length, 1);
  assert.equal(ams[0].day, "2026-10-18");
  const long = splitByDay({ start: new Date("2026-10-17T12:00:00Z"), end: new Date("2026-10-20T12:00:00Z") });
  assert.deepEqual(long.map((p) => p.day), ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"]);
});

test("clock times and shifts over midnight", () => {
  assert.equal(parseClock("22:30"), 1350);
  assert.equal(parseClock("9:05"), 545);
  assert.equal(parseClock("24:00"), 1440);
  for (const bad of ["25:00", "12:60", "noon", "", "24:01", "1230"]) assert.throws(() => parseClock(bad), /time|more than/, bad);
  assert.equal(formatClock(1350), "22:30");
  assert.equal(formatClock(1500), "01:00");
  assert.equal(formatClock(0), "00:00");
  assert.throws(() => formatClock(-1), RangeError);
  assert.deepEqual(shift("09:00", "17:00"), r(540, 1020));
  assert.deepEqual(shift("22:00", "02:00"), r(1320, 1560));
  assert.deepEqual(shift("08:00", "08:00"), r(480, 1920));
  assert.deepEqual(byDay(shift("22:00", "02:00")), [{ day: 0, start: 1320, end: 1440 }, { day: 1, start: 0, end: 120 }]);
  assert.deepEqual(byDay(r(0, 1440)), [{ day: 0, start: 0, end: 1440 }]);
});

test("minutesIn: night hours of a shift (for an allowance)", () => {
  assert.equal(minutesIn(shift("20:00", "03:00"), "22:00", "06:00"), 300);
  assert.equal(minutesIn(shift("09:00", "17:00"), "22:00", "06:00"), 0);
  assert.equal(minutesIn(shift("04:00", "12:00"), "22:00", "06:00"), 120);
  assert.equal(minutesIn(shift("22:00", "06:00"), "22:00", "06:00"), 480);
  assert.equal(minutesIn(r(0, 3 * 1440), "22:00", "06:00"), 1440); // three days: 0-6 on day 0, the nights of day 0 and 1, and 22-24 on day 2
});

test("random ranges: merge, subtract and total length agree with a point-by-point check", () => {
  let seed = 31337;
  const rand = (n) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
  const make = () => Array.from({ length: rand(6) }, () => { const s = rand(30); return r(s, s + rand(8)); });
  const points = (ranges) => new Set(ranges.flatMap(({ start, end }) => Array.from({ length: end - start }, (_, i) => start + i)));
  for (let round = 0; round < 400; round++) {
    const a = make();
    const b = make();
    const union = points(a);
    assert.deepEqual(points(merge(a)), union, `merge ${round}`);
    assert.equal(totalLength(a), union.size, `total ${round}`);
    const expected = new Set([...union].filter((p) => !points(b).has(p)));
    assert.deepEqual(points(subtract(a, b)), expected, `subtract ${round}`);
    const merged = merge(a);
    for (let i = 1; i < merged.length; i++) assert.ok(merged[i].start > merged[i - 1].end, `disjoint ${round}`);
    const peakCount = Math.max(0, ...Array.from({ length: 40 }, (_, p) => a.filter((x) => x.start <= p && p < x.end).length));
    assert.equal(peak(a), peakCount, `peak ${round}`);
  }
});

test("bad ranges are refused", () => {
  assert.throws(() => overlaps(r(5, 1), r(1, 2)), RangeError);
  assert.throws(() => overlaps({ start: "a", end: 2 }, r(1, 2)), TypeError);
  assert.throws(() => merge([null]), TypeError);
  assert.throws(() => merge([r(1, 2)], { gap: -1 }), RangeError);
});
