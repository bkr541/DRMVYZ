import { describe, expect, it } from 'vitest'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../modules/Cinema2AfterhoursNativeModule'
import {
  CINEMA2_MAINFRAME_TRIGGER_IDS,
  Cinema2MainframePatternController,
  createCinema2MainframePatternCycle,
  nextCinema2MainframePattern,
  type Cinema2MainframePatternControllerInput,
} from '../modules/mainframe/Cinema2MainframePatternController'
import {
  CINEMA2_MAINFRAME_PATTERN_IDS,
  type Cinema2MainframePatternId,
} from '../modules/mainframe/Cinema2MainframePatternEngine'

const cycle = createCinema2MainframePatternCycle(index => [0.82, 0.14, 0.63, 0.31, 0.47][index] ?? 0)
const base: Cinema2MainframePatternControllerInput = {
  authoredPattern: 'outward-bus',
  patternChange: false,
  trigger: 'bar4',
  triggerEventId: null,
  absoluteBeat: 0,
}

describe('Mainframe Stage 5 pattern controller', () => {
  it('builds a deterministic six-pattern permutation and never immediately repeats', () => {
    expect(createCinema2MainframePatternCycle(index => [0.82, 0.14, 0.63, 0.31, 0.47][index] ?? 0)).toEqual(cycle)
    expect(new Set(cycle)).toEqual(new Set(CINEMA2_MAINFRAME_PATTERN_IDS))
    expect(cycle).toHaveLength(6)
    for (const pattern of CINEMA2_MAINFRAME_PATTERN_IDS) expect(nextCinema2MainframePattern(cycle, pattern)).not.toBe(pattern)
  })

  it('makes manual Pattern edits immediately authoritative while automatic changes are off', () => {
    const controller = new Cinema2MainframePatternController(cycle)
    expect(controller.update({ ...base, absoluteBeat: 7.5 })).toMatchObject({ activePattern: 'outward-bus', patternStartBeat: 0 })
    expect(controller.update({ ...base, authoredPattern: 'radar-sweep', triggerEventId: 'ignored', absoluteBeat: 8 })).toEqual({
      activePattern: 'radar-sweep', patternStartBeat: 8, changed: true,
    })
    expect(controller.update({ ...base, authoredPattern: 'radar-sweep', triggerEventId: 'another', absoluteBeat: 9 }).activePattern).toBe('radar-sweep')
  })

  it('advances exactly once for every canonical Afterhours trigger option', () => {
    expect(CINEMA2_MAINFRAME_TRIGGER_IDS).toBe(CINEMA2_AFTERHOURS_TRIGGER_IDS)
    const controller = new Cinema2MainframePatternController(cycle)
    controller.update(base)
    controller.update({ ...base, patternChange: true, triggerEventId: 'present-on-toggle', absoluteBeat: 1 })

    let active: Cinema2MainframePatternId = 'outward-bus'
    CINEMA2_MAINFRAME_TRIGGER_IDS.forEach((trigger, index) => {
      const boundaryBeat = index + 2
      const selected = controller.update({ ...base, patternChange: true, trigger, triggerEventId: null, absoluteBeat: boundaryBeat })
      expect(selected.activePattern).toBe(active)
      const eventId = `${trigger}-${index}`
      const advanced = controller.update({ ...base, patternChange: true, trigger, triggerEventId: eventId, absoluteBeat: boundaryBeat + 0.25 })
      expect(advanced.activePattern).toBe(nextCinema2MainframePattern(cycle, active))
      expect(advanced.activePattern).not.toBe(active)
      expect(advanced.patternStartBeat).toBe(boundaryBeat + 0.25)
      expect(controller.update({ ...base, patternChange: true, trigger, triggerEventId: eventId, absoluteBeat: boundaryBeat + 0.5 })).toMatchObject({
        activePattern: advanced.activePattern, changed: false,
      })
      active = advanced.activePattern
    })
  })

  it('suppresses stale events across toggle, trigger edits, pause/resume, and reset boundaries', () => {
    const controller = new Cinema2MainframePatternController(cycle)
    controller.update(base)
    const toggled = controller.update({ ...base, patternChange: true, triggerEventId: 'beat-1', absoluteBeat: 4 })
    expect(toggled.activePattern).toBe('outward-bus')
    const advanced = controller.update({ ...base, patternChange: true, triggerEventId: 'beat-2', absoluteBeat: 4.5 })
    expect(advanced.activePattern).not.toBe('outward-bus')
    expect(controller.update({ ...base, patternChange: true, triggerEventId: null, absoluteBeat: 4.5 }).activePattern).toBe(advanced.activePattern)
    expect(controller.update({ ...base, patternChange: true, triggerEventId: 'beat-2', absoluteBeat: 4.5 }).activePattern).toBe(advanced.activePattern)
    expect(controller.update({ ...base, patternChange: true, trigger: 'drop', triggerEventId: 'drop-current', absoluteBeat: 5 }).activePattern).toBe(advanced.activePattern)

    const edited = controller.update({ ...base, authoredPattern: 'system-surge', patternChange: true, trigger: 'drop', triggerEventId: 'drop-current', absoluteBeat: 6 })
    expect(edited).toEqual({ activePattern: 'system-surge', patternStartBeat: 6, changed: true })
    expect(controller.update({ ...base, authoredPattern: 'system-surge', patternChange: true, trigger: 'drop', triggerEventId: 'drop-current', absoluteBeat: 6.5 }).activePattern).toBe('system-surge')

    const reset = controller.update({ ...base, authoredPattern: 'radar-sweep', patternChange: true, triggerEventId: 'beat-current', absoluteBeat: 12, reset: true })
    expect(reset).toEqual({ activePattern: 'radar-sweep', patternStartBeat: 12, changed: true })
    expect(controller.update({ ...base, authoredPattern: 'radar-sweep', patternChange: true, triggerEventId: 'beat-current', absoluteBeat: 12.25 }).activePattern).toBe('radar-sweep')
  })
})
