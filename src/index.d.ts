export interface Range<T extends number | Date = number> {
  start: T;
  end: T;
}

export type Any = Range<number> | Range<Date>;

export function overlaps(a: Any, b: Any): boolean;
export function intersect<T extends Any>(a: T, b: Any): T | null;
export function contains(range: Any, inner: number | Date | Any): boolean;
export function length(range: Any): number;
export function merge<T extends Any>(ranges: readonly T[], options?: { gap?: number }): T[];
export function subtract<T extends Any>(ranges: readonly T[], removals: readonly Any[]): T[];
export function gaps<T extends Any>(ranges: readonly Any[], within: T): T[];
export function totalLength(ranges: readonly Any[]): number;
export function splitAt<T extends Any>(range: T, points: readonly (number | Date)[]): T[];
export function concurrency<T extends Any>(ranges: readonly T[]): (T & { count: number })[];
export function peak(ranges: readonly Any[]): number;
export function splitByDay(range: Range<Date>, options?: { offsetMinutes?: number; /** IANA name such as "Europe/Amsterdam"; cannot be combined with offsetMinutes. */ timeZone?: string }): (Range<Date> & { day: string })[];

export function parseClock(text: string): number;
export function formatClock(minutes: number): string;
export function shift(startClock: string, endClock: string): Range<number>;
export function byDay(range: Range<number>): { day: number; start: number; end: number }[];
export function minutesIn(shiftRange: Range<number>, windowStart: string, windowEnd: string): number;
