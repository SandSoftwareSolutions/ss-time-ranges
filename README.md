# @sandsoftwaresolutions/time-ranges

[![CI](https://github.com/SandSoftwareSolutions/ss-time-ranges/actions/workflows/ci.yml/badge.svg)](https://github.com/SandSoftwareSolutions/ss-time-ranges/actions/workflows/ci.yml)

Work with blocks of time: do two shifts overlap, who is working at the same time, what is free, how many night hours are in a shift. Ranges of numbers (minutes) or of Dates, including shifts that go past midnight. No dependencies.

## Install

```bash
npm install @sandsoftwaresolutions/time-ranges
```

## Usage

```js
import { overlaps, merge, subtract, gaps, concurrency, peak, shift, byDay, minutesIn, parseClock, formatClock } from "@sandsoftwaresolutions/time-ranges";

// Ranges are { start, end }: numbers (for example minutes) or Dates
overlaps({ start: 9, end: 12 }, { start: 12, end: 15 });   // false: they touch, they do not overlap
merge([{ start: 1, end: 3 }, { start: 2, end: 5 }]);        // [{ start: 1, end: 5 }]
subtract([{ start: 9, end: 17 }], [{ start: 12, end: 13 }]);   // 9-12 and 13-17  (a shift minus a break)
gaps(bookings, { start: 8, end: 22 });                      // the free time of a room or a table

// Who is working at the same time?
concurrency(shifts);   // [{ start, end, count }, ...]
peak(shifts);          // 3 people at the busiest moment

// Shifts over midnight, in clock times
const night = shift("22:00", "02:00");       // { start: 1320, end: 1560 }: it ends the next day
byDay(night);                                 // [{ day: 0, start: 1320, end: 1440 }, { day: 1, start: 0, end: 120 }]
minutesIn(shift("20:00", "03:00"), "22:00", "06:00");   // 300 minutes in the night window, for a night allowance
formatClock(1500);                            // "01:00"
```

## Rules

- **Half-open ranges.** `start` is in, `end` is out. 09:00-12:00 and 12:00-15:00 touch but do not overlap, and a range of length zero is empty. This is what makes sums come out right: two back-to-back shifts add up, and a break at 12:00-13:00 leaves exactly 9-12 and 13-17.
- **Dates in, Dates out.** Give Dates and you get Dates back (lengths are in milliseconds); give numbers and you get numbers.
- `splitByDay(range, { offsetMinutes | timeZone })` cuts a Date range at midnight in UTC, at the midnight of a fixed offset such as `120` for UTC+2, or at local midnight in an IANA zone: with `timeZone: "Europe/Amsterdam"` the pieces on 29 March 2026 and 25 October 2026 are 23 and 25 hours long. Each piece is labelled with its day. `splitByDay` and `byDay` throw a `RangeError` for a range of more than 100 000 days.
- Clock times are `"HH:MM"`; `"24:00"` is allowed as an end. A shift whose end is not after its start runs to the next day; the same start and end means 24 hours.
- `totalLength` counts overlapping time once. `splitAt`, `intersect`, `contains`, `length` are there too.
- Wrong input (an end before the start, text instead of numbers) throws a clear error and is never "fixed" silently.

The clock-time helpers (`shift`, `byDay`, `minutesIn`, `parseClock`) count minutes on a 1440-minute day and know nothing about clock changes: a night shift 22:00-06:00 is 480 minutes, also on the night the clock changes (when it really lasts 7 or 9 hours). For real durations on those nights, work with Dates and cut them with `splitByDay(range, { timeZone })`.
