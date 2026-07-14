import { describe, expect, it } from 'vitest'
import type { ReactTrackSection } from '../../components/vyzualz/react/ReactTypes'
import {
  resolveAuthoritativeTimeline,
  resolveSectionAtTime,
  timelineRevision,
} from './authoritativeTimeline'

function section(overrides: Partial<ReactTrackSection> = {}): ReactTrackSection {
  return {
    id: 'auto-a',
    label: 'Verse',
    type: 'verse',
    startSec: 0,
    endSec: 16,
    intensity: 0.6,
    confidence: 0.75,
    source: 'auto',
    ...overrides,
  }
}

describe('resolveAuthoritativeTimeline', () => {
  it('applies authority deterministically and carves lower-priority sections without overlaps', () => {
    const result = resolveAuthoritativeTimeline({
      durationSec: 32,
      analyzedSections: [
        section({ id: 'auto-a', startSec: 0, endSec: 16, type: 'verse' }),
        section({ id: 'auto-b', startSec: 16, endSec: 32, type: 'drop' }),
      ],
      importedSections: [
        section({ id: 'imported', startSec: 8, endSec: 24, type: 'build', source: 'imported' }),
      ],
      manualSections: [
        section({ id: 'created', startSec: 12, endSec: 20, type: 'breakdown', source: 'user-created' }),
        section({ id: 'locked', startSec: 14, endSec: 18, type: 'preDrop', source: 'manual', locked: true }),
      ],
    })

    expect(result.map(item => [item.startSec, item.endSec, item.provenance?.authority])).toEqual([
      [0, 8, 'automatic'],
      [8, 12, 'imported'],
      [12, 14, 'user_created'],
      [14, 18, 'locked_user'],
      [18, 20, 'user_created'],
      [20, 24, 'imported'],
      [24, 32, 'automatic'],
    ])
    for (let index = 1; index < result.length; index++) {
      expect(result[index].startSec).toBe(result[index - 1].endSec)
    }
  })

  it('removes suppressed automatic sections and emits a safe fallback instead', () => {
    const result = resolveAuthoritativeTimeline({
      durationSec: 20,
      analyzedSections: [section({ id: 'auto-a', endSec: 20 })],
      suppressedIds: ['auto-a'],
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: 'unknown',
      startSec: 0,
      endSec: 20,
      source: 'fallback',
      provenance: { authority: 'fallback' },
    })
  })

  it('lets manual replacements win by original automatic section identity', () => {
    const result = resolveAuthoritativeTimeline({
      durationSec: 24,
      analyzedSections: [section({ id: 'auto-a', endSec: 24, type: 'verse' })],
      manualSections: [section({
        id: 'replacement-a',
        label: 'Corrected Build',
        type: 'build',
        startSec: 0,
        endSec: 24,
        source: 'user-edited-auto',
        provenance: {
          authority: 'manual_replacement',
          originalId: 'auto-a',
          analysisSource: 'manual',
        },
      })],
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'replacement-a',
      type: 'build',
      label: 'Corrected Build',
      provenance: { authority: 'manual_replacement', originalId: 'auto-a' },
    })
  })

  it('clamps invalid ranges, fills gaps, and resolves final-boundary playback safely', () => {
    const result = resolveAuthoritativeTimeline({
      durationSec: 30,
      analyzedSections: [
        section({ id: 'first', startSec: -5, endSec: 10, type: 'intro' }),
        section({ id: 'last', startSec: 20, endSec: 50, type: 'outro' }),
        section({ id: 'invalid', startSec: 18, endSec: 12 }),
      ],
    })

    expect(result.map(item => [item.startSec, item.endSec, item.type])).toEqual([
      [0, 10, 'intro'],
      [10, 20, 'unknown'],
      [20, 30, 'outro'],
    ])
    expect(resolveSectionAtTime(result, 10)?.type).toBe('unknown')
    expect(resolveSectionAtTime(result, 30)?.type).toBe('outro')
  })


  it('keeps imported locks below user authority and promotes locked replacements without reviving their automatic source', () => {
    const result = resolveAuthoritativeTimeline({
      durationSec: 24,
      analyzedSections: [section({ id: 'auto-a', endSec: 24, type: 'verse' })],
      importedSections: [section({ id: 'imported', endSec: 24, type: 'drop', source: 'imported', locked: true })],
      manualSections: [section({
        id: 'replacement',
        startSec: 8,
        endSec: 16,
        type: 'build',
        source: 'user-edited-auto',
        locked: true,
        provenance: { authority: 'locked_user', originalId: 'auto-a', analysisSource: 'manual' },
      })],
    })

    expect(result.map(item => [item.startSec, item.endSec, item.type, item.provenance?.authority])).toEqual([
      [0, 8, 'drop', 'imported'],
      [8, 16, 'build', 'locked_user'],
      [16, 24, 'drop', 'imported'],
    ])
    expect(result.some(item => item.provenance?.authority === 'automatic')).toBe(false)
  })

  it('keeps near-adjacent boundaries gap-free and produces unique stable ids for duplicate source ids', () => {
    const result = resolveAuthoritativeTimeline({
      durationSec: 20,
      analyzedSections: [
        section({ id: 'duplicate', startSec: 0, endSec: 10, type: 'intro' }),
        section({ id: 'duplicate', startSec: 10.0000005, endSec: 20, type: 'outro' }),
      ],
    })

    expect(result[0].startSec).toBe(0)
    expect(result[result.length - 1].endSec).toBe(20)
    for (let index = 1; index < result.length; index++) {
      expect(result[index].startSec).toBe(result[index - 1].endSec)
    }
    expect(new Set(result.map(item => item.id)).size).toBe(result.length)
    expect(resolveAuthoritativeTimeline({
      durationSec: 20,
      analyzedSections: [
        section({ id: 'duplicate', startSec: 0, endSec: 10, type: 'intro' }),
        section({ id: 'duplicate', startSec: 10.0000005, endSec: 20, type: 'outro' }),
      ],
    })).toEqual(result)
  })

  it('produces stable output and revisions regardless of source array order', () => {
    const a = section({ id: 'a', startSec: 0, endSec: 16, confidence: 0.8 })
    const b = section({ id: 'b', startSec: 0, endSec: 16, confidence: 0.7 })
    const first = resolveAuthoritativeTimeline({ durationSec: 16, analyzedSections: [a, b] })
    const second = resolveAuthoritativeTimeline({ durationSec: 16, analyzedSections: [b, a] })

    expect(second).toEqual(first)
    expect(timelineRevision(second)).toBe(timelineRevision(first))
  })
})
