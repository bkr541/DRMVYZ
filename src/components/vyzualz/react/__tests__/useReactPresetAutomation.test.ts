/**
 * Tests for the resolveActiveCue pure helper from useReactPresetAutomation.
 *
 * Covers:
 *  - Forward playback crossing a cue boundary
 *  - Seeking past multiple cues — last one before position wins
 *  - Rewinding past all cues — returns null
 *  - Disabled cues are skipped
 *  - Cues referencing a missing preset are skipped
 *  - Edge: position exactly on a cue's timeSec is included (<=)
 *  - Edge: empty cue list returns null
 *  - Multiple cues at the same timeSec — last one in sorted order wins
 */

import { describe, it, expect } from 'vitest'
import { resolveActiveCue } from '../useReactPresetAutomation'
import type { ReactPresetAutomationCue } from '../ReactTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────

let _counter = 0
function cue(overrides: Partial<ReactPresetAutomationCue> & { timeSec: number; id: string }): ReactPresetAutomationCue {
  _counter++
  return {
    presetId:     `preset-${_counter}`,
    label:        `Cue ${_counter}`,
    enabled:      true,
    transitionMs: 0,
    ...overrides,
  }
}

const ALL = new Set(['preset-1', 'preset-2', 'preset-3', 'p-a', 'p-b', 'p-c', 'p-d', 'p-e'])

// ── Empty cue list ────────────────────────────────────────────────────────────

describe('resolveActiveCue — empty list', () => {
  it('returns null when no cues exist', () => {
    expect(resolveActiveCue([], 60, ALL)).toBeNull()
  })
})

// ── Forward playback ──────────────────────────────────────────────────────────

describe('resolveActiveCue — forward crossing', () => {
  it('returns null when position is before the first cue', () => {
    const cues = [cue({ id: 'c1', timeSec: 30, presetId: 'p-a' })]
    expect(resolveActiveCue(cues, 29, new Set(['p-a']))).toBeNull()
  })

  it('returns the cue when position exactly equals its timeSec', () => {
    const cues = [cue({ id: 'c1', timeSec: 30, presetId: 'p-a' })]
    expect(resolveActiveCue(cues, 30, new Set(['p-a']))?.id).toBe('c1')
  })

  it('returns the cue when position is beyond its timeSec', () => {
    const cues = [cue({ id: 'c1', timeSec: 30, presetId: 'p-a' })]
    expect(resolveActiveCue(cues, 45, new Set(['p-a']))?.id).toBe('c1')
  })

  it('returns the last cue crossed when multiple cues precede the position', () => {
    const cues = [
      cue({ id: 'c1', timeSec: 10, presetId: 'p-a' }),
      cue({ id: 'c2', timeSec: 30, presetId: 'p-b' }),
      cue({ id: 'c3', timeSec: 60, presetId: 'p-c' }),
    ]
    const valid = new Set(['p-a', 'p-b', 'p-c'])
    expect(resolveActiveCue(cues, 45, valid)?.id).toBe('c2')
    expect(resolveActiveCue(cues, 90, valid)?.id).toBe('c3')
  })
})

// ── Seek / rewind ─────────────────────────────────────────────────────────────

describe('resolveActiveCue — seek / rewind', () => {
  const cues = [
    cue({ id: 'c1', timeSec: 10,  presetId: 'p-a' }),
    cue({ id: 'c2', timeSec: 30,  presetId: 'p-b' }),
    cue({ id: 'c3', timeSec: 60,  presetId: 'p-c' }),
    cue({ id: 'c4', timeSec: 120, presetId: 'p-d' }),
  ]
  const valid = new Set(['p-a', 'p-b', 'p-c', 'p-d'])

  it('seeking to start returns null when no cue is at 0', () => {
    expect(resolveActiveCue(cues, 0, valid)).toBeNull()
  })

  it('rewinding past all cues returns null', () => {
    expect(resolveActiveCue(cues, 5, valid)).toBeNull()
  })

  it('seeking backwards into the middle resolves correctly', () => {
    // Was at 90s (c3 active), seeks back to 20s — c1 should be active
    expect(resolveActiveCue(cues, 20, valid)?.id).toBe('c1')
  })

  it('seeking forward past multiple cues applies only the last crossed cue', () => {
    // Was at 0, seeks to 90s — c1, c2, c3 all precede; c3 wins
    expect(resolveActiveCue(cues, 90, valid)?.id).toBe('c3')
  })

  it('seeking exactly to a later cue applies that cue', () => {
    expect(resolveActiveCue(cues, 120, valid)?.id).toBe('c4')
  })
})

// ── Disabled cues ─────────────────────────────────────────────────────────────

describe('resolveActiveCue — disabled cues', () => {
  it('skips a disabled cue and falls back to the previous enabled one', () => {
    const cues = [
      cue({ id: 'c1', timeSec: 10, presetId: 'p-a' }),
      cue({ id: 'c2', timeSec: 30, presetId: 'p-b', enabled: false }),
      cue({ id: 'c3', timeSec: 60, presetId: 'p-c' }),
    ]
    const valid = new Set(['p-a', 'p-b', 'p-c'])
    // Position at 45s: c1 and c2 precede, but c2 is disabled — c1 wins
    expect(resolveActiveCue(cues, 45, valid)?.id).toBe('c1')
  })

  it('returns null when the only cue before the position is disabled', () => {
    const cues = [cue({ id: 'c1', timeSec: 10, presetId: 'p-a', enabled: false })]
    expect(resolveActiveCue(cues, 30, new Set(['p-a']))).toBeNull()
  })

  it('returns null when all cues before the position are disabled', () => {
    const cues = [
      cue({ id: 'c1', timeSec: 10, presetId: 'p-a', enabled: false }),
      cue({ id: 'c2', timeSec: 20, presetId: 'p-b', enabled: false }),
    ]
    expect(resolveActiveCue(cues, 25, new Set(['p-a', 'p-b']))).toBeNull()
  })
})

// ── Missing presets ───────────────────────────────────────────────────────────

describe('resolveActiveCue — missing preset', () => {
  it('skips a cue whose presetId is not in validPresetIds', () => {
    const cues = [
      cue({ id: 'c1', timeSec: 10, presetId: 'p-exists'  }),
      cue({ id: 'c2', timeSec: 30, presetId: 'p-deleted' }),
    ]
    const valid = new Set(['p-exists'])  // 'p-deleted' is absent
    expect(resolveActiveCue(cues, 45, valid)?.id).toBe('c1')
  })

  it('returns null when all cues before position reference deleted presets', () => {
    const cues = [
      cue({ id: 'c1', timeSec: 10, presetId: 'p-gone-1' }),
      cue({ id: 'c2', timeSec: 20, presetId: 'p-gone-2' }),
    ]
    expect(resolveActiveCue(cues, 30, new Set())).toBeNull()
  })

  it('applies an enabled cue after a deleted-preset cue', () => {
    const cues = [
      cue({ id: 'c1', timeSec: 10, presetId: 'p-gone' }),
      cue({ id: 'c2', timeSec: 30, presetId: 'p-alive' }),
    ]
    expect(resolveActiveCue(cues, 45, new Set(['p-alive']))?.id).toBe('c2')
  })
})

// ── Edge: cues at identical timeSec ───────────────────────────────────────────

describe('resolveActiveCue — ties at same timeSec', () => {
  it('when two cues share timeSec the last one in array order wins', () => {
    const cues = [
      cue({ id: 'early-inserted', timeSec: 30, presetId: 'p-a' }),
      cue({ id: 'late-inserted',  timeSec: 30, presetId: 'p-b' }),
    ]
    const valid = new Set(['p-a', 'p-b'])
    expect(resolveActiveCue(cues, 30, valid)?.id).toBe('late-inserted')
  })
})
