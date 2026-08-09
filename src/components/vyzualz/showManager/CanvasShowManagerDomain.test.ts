import { describe, expect, it } from 'vitest'
import {
  CANVAS_SHOW_MANAGER_DEFAULT_SECTION_DURATION_SEC,
  CANVAS_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE,
  cloneCanvasShowManagerShow,
  createCanvasShowManagerShow,
  getCanvasShowManagerSectionRanges,
  getCanvasShowManagerTotalDuration,
  normalizeCanvasShowManagerShow,
  normalizeCanvasShowManagerShows,
  updateCanvasShowManagerSectionDuration,
  validateCanvasShowManagerShow,
} from './CanvasShowManagerDomain'

describe('Canvas Show Manager Stage 1 domain', () => {
  it('creates the exact seven-section, 56-second no-audio template', () => {
    const show = createCanvasShowManagerShow('  First   Canvas Show  ')

    expect(show.name).toBe('First Canvas Show')
    expect(show.sections.map(section => [section.type, section.label, section.durationSec])).toEqual(
      CANVAS_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE.map(([type, label]) => [
        type,
        label,
        CANVAS_SHOW_MANAGER_DEFAULT_SECTION_DURATION_SEC,
      ]),
    )
    expect(new Set(show.sections.map(section => section.id)).size).toBe(7)
    expect(getCanvasShowManagerTotalDuration(show)).toBe(56)
    expect(validateCanvasShowManagerShow(show)).toEqual({ valid: true, issues: [] })
  })

  it('derives contiguous boundaries and reports deterministic ripple information', () => {
    const show = createCanvasShowManagerShow('Ripple')
    const build = show.sections[2]!
    const result = updateCanvasShowManagerSectionDuration(show, build.id, 12.5)!
    const ranges = getCanvasShowManagerSectionRanges(result.show)

    expect(result).toMatchObject({
      sectionId: build.id,
      previousDurationSec: 8,
      newDurationSec: 12.5,
      downstreamShiftSec: 4.5,
      previousRange: { startSec: 16, endSec: 24 },
      newRange: { startSec: 16, endSec: 28.5 },
    })
    expect(ranges.map(range => [range.startSec, range.endSec])).toEqual([
      [0, 8], [8, 16], [16, 28.5], [28.5, 36.5], [36.5, 44.5], [44.5, 52.5], [52.5, 60.5],
    ])
    expect(ranges.every((range, index) => index === 0 || range.startSec === ranges[index - 1]!.endSec)).toBe(true)
  })

  it('normalizes malformed durations and repairs duplicate section IDs without changing unrelated values', () => {
    const normalized = normalizeCanvasShowManagerShow({
      schemaVersion: 999,
      id: 'legacy-canvas',
      name: ' Legacy ',
      sections: [
        { id: 'duplicate', durationSec: 4 },
        { id: 'duplicate', durationSec: Number.NaN },
        { durationSec: -2 },
        { durationSec: '10' },
      ],
    })

    expect(normalized.schemaVersion).toBe(1)
    expect(normalized.name).toBe('Legacy')
    expect(normalized.sections).toHaveLength(7)
    expect(new Set(normalized.sections.map(section => section.id)).size).toBe(7)
    expect(normalized.sections.map(section => section.durationSec)).toEqual([4, 8, 8, 10, 8, 8, 8])
    expect(validateCanvasShowManagerShow(normalized).valid).toBe(true)
  })

  it('repairs duplicate Show IDs and names deterministically while preserving valid unique identities', () => {
    const first = createCanvasShowManagerShow('Duplicate')
    const normalized = normalizeCanvasShowManagerShows([
      first,
      { ...cloneCanvasShowManagerShow(first) },
      { ...cloneCanvasShowManagerShow(first), id: 'unique-id', name: 'Unique' },
    ])

    expect(normalized.map(show => show.id)).toEqual([first.id, `${first.id}-2`, 'unique-id'])
    expect(normalized.map(show => show.name)).toEqual(['Duplicate', 'Duplicate (2)', 'Unique'])
    expect(normalized[0]!.sections.map(section => section.id)).toEqual(first.sections.map(section => section.id))
  })
})
