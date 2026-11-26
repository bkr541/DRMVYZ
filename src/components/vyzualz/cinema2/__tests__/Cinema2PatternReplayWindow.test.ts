import { describe, expect, it } from 'vitest'
import { Cinema2PatternEventLatch } from '../conductor/Cinema2PatternEventLatch'
import { Cinema2MainframePatternController } from '../modules/mainframe/Cinema2MainframePatternController'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity } from '../modules/Cinema2AfterhoursNativeModule'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'

describe('QA-06 shared trigger authority', () => {
  it('rejects nonconsecutive replay after manual selection, but allows a new transport epoch', () => {
    const controller = new Cinema2MainframePatternController(['a', 'b', 'c'] as const, 'a')
    const base = { authoredPattern: 'a' as const, patternChange: true, trigger: 'kick' as const, absoluteBeat: 0 }
    controller.update({ ...base, triggerEventId: null })
    expect(controller.update({ ...base, triggerEventId: 'first' }).activePattern).toBe('b')
    expect(controller.update({ ...base, triggerEventId: 'second' }).activePattern).toBe('c')
    const manual = { ...base, authoredPattern: 'b' as const }
    expect(controller.update({ ...manual, triggerEventId: null }).activePattern).toBe('b')
    expect(controller.update({ ...manual, triggerEventId: 'first' }).activePattern).toBe('b')
    expect(controller.update({ ...manual, triggerEventId: 'third' }).activePattern).toBe('c')
    controller.reset()
    controller.update({ ...manual, triggerEventId: null })
    expect(controller.update({ ...manual, triggerEventId: 'first' }).activePattern).toBe('c')
  })

  it('keeps independent bounded trigger histories and resets explicitly', () => {
    const latch = new Cinema2PatternEventLatch<string>()
    for (const trigger of CINEMA2_AFTERHOURS_TRIGGER_IDS) {
      expect(latch.observe(trigger, 'a')).toBe(true)
      expect(latch.observe(trigger, 'b')).toBe(true)
      expect(latch.observe(trigger, null)).toBe(false)
      expect(latch.observe(trigger, 'a')).toBe(false)
    }
    for (let i = 0; i < 64; i++) expect(latch.observe('kick', `new-${i}`)).toBe(true)
    expect(latch.observe('kick', 'a')).toBe(true)
    expect(latch.observe('beat', 'a')).toBe(false)
    latch.reset()
    expect(latch.observe('beat', 'a')).toBe(true)
  })

  it.each(CINEMA2_AFTERHOURS_TRIGGER_IDS)('routes %s from the canonical event and rejects pause/no-source', trigger => {
    const event = { id: 'event' }
    const frame = { transport: { sourcePresent: true, playing: true, paused: false }, audio: {
      upstream: { timeSec: 16 }, rhythm: { beat: event, kick: event, snare: event, downbeat: event,
        beatIndex: { available: true, value: 32 }, barIndex: { available: true, value: 8 },
        fixedClocks: { 4: { boundary: event }, 16: { boundary: event } } },
      structure: { analyzedPhrases: { available: true, value: [{ id: 'phrase', timeSec: 16 }] },
        semanticMoments: { available: true, value: [{ id: 'drop', type: 'drop', timeSec: 16 }] } },
    } } as unknown as Cinema2ModuleFrameReadContext
    expect(resolveCinema2AfterhoursTriggerEventIdentity(frame, trigger, 15.9)).toBe(
      trigger === 'phrase' || trigger === 'drop' ? trigger : trigger === 'bar4' || trigger === 'bar8' ? `event:${trigger}:8` : 'event')
    expect(resolveCinema2AfterhoursTriggerEventIdentity({ ...frame, transport: { ...frame.transport!, paused: true } }, trigger, 15.9)).toBeNull()
    expect(resolveCinema2AfterhoursTriggerEventIdentity({ ...frame, transport: { ...frame.transport!, sourcePresent: false } }, trigger, 15.9)).toBeNull()
    const quiet = { ...frame, audio: { ...frame.audio!, rhythm: { ...frame.audio!.rhythm, beat: null, kick: null, snare: null, downbeat: null,
      fixedClocks: { 4: { boundary: null }, 16: { boundary: null } } }, structure: { ...frame.audio!.structure,
      analyzedPhrases: { available: true, value: [] }, semanticMoments: { available: true, value: [] } } } } as unknown as Cinema2ModuleFrameReadContext
    expect(resolveCinema2AfterhoursTriggerEventIdentity(quiet, trigger, 15.9)).toBeNull()
  })
})
