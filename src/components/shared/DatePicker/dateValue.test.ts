import { describe, expect, it } from 'vitest'
import { addDays, addMonths, clampDate, formatDateTimeValue, formatDateValue, isSelectable, monthGrid, parseDateValue, rangeFromValues, startOfWeek, weekdayOf } from './dateValue'

describe('dateValue', () => {
  it('reads native-input values and rejects things that are not real dates or times', () => {
    expect(parseDateValue('2026-11-23')).toEqual({ date: { year: 2026, month: 11, day: 23 }, time: null })
    expect(parseDateValue('2026-11-23T18:05')).toEqual({ date: { year: 2026, month: 11, day: 23 }, time: { hour: 18, minute: 5 } })
    for (const bad of ['', 'soon', '2026-02-30', '2026-13-01', '2026-11-23T24:00', '2026-11-23T10:60']) expect(parseDateValue(bad)).toBeNull()
    expect(parseDateValue('2028-02-29')).not.toBeNull()
    expect(parseDateValue('2027-02-29')).toBeNull()
  })

  it('writes the same strings a native input does', () => {
    expect(formatDateValue({ year: 2026, month: 3, day: 4 })).toBe('2026-03-04')
    expect(formatDateTimeValue({ year: 2026, month: 3, day: 4 }, { hour: 9, minute: 7 })).toBe('2026-03-04T09:07')
  })

  it('moves by days and months across month and year ends, clamping a day the month does not have', () => {
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 })
    expect(addDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({ year: 2026, month: 2, day: 28 })
    expect(addMonths({ year: 2026, month: 1, day: 31 }, 1)).toEqual({ year: 2026, month: 2, day: 28 })
    expect(addMonths({ year: 2026, month: 1, day: 15 }, -1)).toEqual({ year: 2025, month: 12, day: 15 })
    expect(addMonths({ year: 2026, month: 11, day: 15 }, 14)).toEqual({ year: 2028, month: 1, day: 15 })
  })

  it('lays a month out as six whole weeks starting on the chosen weekday', () => {
    const sunday = monthGrid(2026, 11, 0)
    expect(sunday).toHaveLength(42)
    expect(weekdayOf(sunday[0]!)).toBe(0)
    expect(sunday.find(date => date.month === 11 && date.day === 1)).toEqual({ year: 2026, month: 11, day: 1 })
    const monday = monthGrid(2026, 11, 1)
    expect(weekdayOf(monday[0]!)).toBe(1)
    expect(startOfWeek({ year: 2026, month: 11, day: 23 }, 1)).toEqual({ year: 2026, month: 11, day: 23 })
  })

  it('limits to a range and clamps to its nearest end', () => {
    const range = rangeFromValues('2026-11-10', '2026-11-20')
    expect(isSelectable({ year: 2026, month: 11, day: 10 }, range)).toBe(true)
    expect(isSelectable({ year: 2026, month: 11, day: 9 }, range)).toBe(false)
    expect(isSelectable({ year: 2026, month: 11, day: 21 }, range)).toBe(false)
    expect(clampDate({ year: 2026, month: 1, day: 1 }, range)).toEqual({ year: 2026, month: 11, day: 10 })
    expect(clampDate({ year: 2027, month: 1, day: 1 }, range)).toEqual({ year: 2026, month: 11, day: 20 })
  })
})
