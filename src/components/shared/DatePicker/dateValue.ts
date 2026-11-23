/**
 * Date maths for the shared DatePicker. Values are the same strings a native date input holds: `YYYY-MM-DD`, or
 * `YYYY-MM-DDTHH:mm` (local time) for a date and time. Everything works in local calendar dates, so no time zone can
 * move a day.
 */

export interface CalendarDate { year: number; month: number; day: number }
export interface TimeOfDay { hour: number; minute: number }
export interface DateValue { date: CalendarDate; time: TimeOfDay | null }

export const pad2 = (value: number) => String(value).padStart(2, '0')

const VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/

export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate()

/** Reads a native-input-style value. Anything that is not a real calendar date (or a real time) is `null`. */
export function parseDateValue(value: string): DateValue | null {
  const match = VALUE_PATTERN.exec(value.trim())
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  if (match[4] === undefined) return { date: { year, month, day }, time: null }
  const hour = Number(match[4]), minute = Number(match[5])
  if (hour > 23 || minute > 59) return null
  return { date: { year, month, day }, time: { hour, minute } }
}

export const formatDateValue = (date: CalendarDate) => `${String(date.year).padStart(4, '0')}-${pad2(date.month)}-${pad2(date.day)}`
export const formatDateTimeValue = (date: CalendarDate, time: TimeOfDay) => `${formatDateValue(date)}T${pad2(time.hour)}:${pad2(time.minute)}`

/** A number that sorts calendar dates the way the calendar does. */
export const dateKey = (date: CalendarDate) => date.year * 10000 + date.month * 100 + date.day
export const sameDate = (a: CalendarDate, b: CalendarDate) => dateKey(a) === dateKey(b)
export const fromJsDate = (date: Date): CalendarDate => ({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() })
export const timeFromJsDate = (date: Date): TimeOfDay => ({ hour: date.getHours(), minute: date.getMinutes() })
export const toJsDate = (date: CalendarDate, time?: TimeOfDay | null) => new Date(date.year, date.month - 1, date.day, time?.hour ?? 0, time?.minute ?? 0)

export const addDays = (date: CalendarDate, days: number): CalendarDate => fromJsDate(new Date(date.year, date.month - 1, date.day + days))
/** Moves by whole months; a day the target month does not have (31 Jan + 1 month) becomes its last day. */
export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const index = date.year * 12 + (date.month - 1) + months
  const year = Math.floor(index / 12), month = (index % 12 + 12) % 12 + 1
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) }
}

/** 0 is Sunday. */
export const weekdayOf = (date: CalendarDate) => new Date(date.year, date.month - 1, date.day).getDay()
export const startOfWeek = (date: CalendarDate, weekStartsOn: number) => addDays(date, -((weekdayOf(date) - weekStartsOn + 7) % 7))

/** The six weeks that show a month: 42 days, starting on the week's first day, spilling into the months either side. */
export function monthGrid(year: number, month: number, weekStartsOn: number): CalendarDate[] {
  const first = startOfWeek({ year, month, day: 1 }, weekStartsOn)
  return Array.from({ length: 42 }, (_, index) => addDays(first, index))
}

export interface DateRange { min: CalendarDate | null; max: CalendarDate | null }
export const rangeFromValues = (min?: string, max?: string): DateRange => ({ min: min ? parseDateValue(min)?.date ?? null : null, max: max ? parseDateValue(max)?.date ?? null : null })
export const isSelectable = (date: CalendarDate, range: DateRange) => (!range.min || dateKey(date) >= dateKey(range.min)) && (!range.max || dateKey(date) <= dateKey(range.max))
/** The nearest selectable date to `date`. */
export function clampDate(date: CalendarDate, range: DateRange): CalendarDate {
  if (range.min && dateKey(date) < dateKey(range.min)) return range.min
  if (range.max && dateKey(date) > dateKey(range.max)) return range.max
  return date
}

/** The date (and time) as the trigger shows it, in the viewer's own format. */
export function formatForDisplay(value: DateValue, withTime: boolean, locale?: string): string {
  const date = toJsDate(value.date, value.time)
  return withTime
    ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
    : new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

export const monthName = (month: number, style: 'long' | 'short', locale?: string) => new Intl.DateTimeFormat(locale, { month: style }).format(new Date(2000, month - 1, 1))
export const weekdayName = (weekday: number, style: 'long' | 'narrow' | 'short', locale?: string) => new Intl.DateTimeFormat(locale, { weekday: style }).format(new Date(2000, 0, 2 + weekday))
export const fullDateLabel = (date: CalendarDate, locale?: string) => new Intl.DateTimeFormat(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(toJsDate(date))

/** Whether the viewer's locale reads the clock as 12 hours with AM and PM. */
export const usesTwelveHourClock = (locale?: string) => new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 === true
