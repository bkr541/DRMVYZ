import { describe, expect, it } from 'vitest'
import {
  ELECTRIC_STORM_DEFAULTS,
  type ElectricStormSettings,
  type ElectricStormThunderTrigger,
} from '../../../CinematicWorldSettings'
import type { CinematicFrameContext } from '../../CinematicWorldRenderer'
import { ElectricStormThunderController } from './ElectricStormThunder'

type ClockName = keyof NonNullable<CinematicFrameContext['canonicalMusic']>['clocks']

function thunderFrame(input: {
  frameIndex?: number
  deltaTimeSec?: number
  clock?: ClockName
  clockHit?: boolean
  clockEventId?: string
  downbeat?: boolean
  downbeatEventId?: string
  drop?: boolean
  dropEventId?: string
  energy?: number
  playing?: boolean
} = {}): CinematicFrameContext {
  const frameIndex = input.frameIndex ?? 0
  const clock = (name: ClockName, spanBeats: number) => ({
    available: true,
    spanBeats,
    index: input.clock === name ? frameIndex : 0,
    phase: 0,
    hit: input.clock === name && (input.clockHit ?? true),
    eventId: input.clock === name && (input.clockHit ?? true) ? (input.clockEventId ?? `${name}-${frameIndex}`) : null,
  })
  return {
    frameIndex,
    deltaTimeSec: input.deltaTimeSec ?? 1 / 60,
    presetId: 'preset-electric-storm',
    isPlaying: input.playing ?? true,
    audio: { smoothed: { volume: input.energy ?? 0.4 } },
    musicalAudio: {
      trackId: 'thunder-test-track',
      values: { overallEnergy: input.energy ?? 0.4 },
    },
    canonicalMusic: {
      impulses: {
        beat: { active: false, eventId: null },
        downbeat: { active: input.downbeat ?? false, eventId: input.downbeat ? (input.downbeatEventId ?? `downbeat-${frameIndex}`) : null },
        kick: { active: false, eventId: null },
        snare: { active: false, eventId: null },
        transient: { active: false, eventId: null },
        sectionStart: { active: false, eventId: null },
        dropStart: { active: input.drop ?? false, eventId: input.drop ? (input.dropEventId ?? `drop-${frameIndex}`) : null },
      },
      clocks: {
        beat: clock('beat', 1),
        beat2: clock('beat2', 2),
        beat4: clock('beat4', 4),
        bar: clock('bar', 4),
        bar4: clock('bar4', 16),
        bar8: clock('bar8', 32),
        phrase: clock('phrase', 32),
      },
      section: { id: 'section-a', type: 'verse', progress: 0.4 },
    },
  } as unknown as CinematicFrameContext
}

function settings(overrides: Partial<ElectricStormSettings> = {}): ElectricStormSettings {
  return { ...ELECTRIC_STORM_DEFAULTS, ...overrides }
}

describe('Electric Storm thunder controller', () => {
  it('defaults to 4 Bars and starts exactly once for each canonical 4-bar event', () => {
    const controller = new ElectricStormThunderController()
    expect(ELECTRIC_STORM_DEFAULTS.thunderTrigger).toBe('bar4')

    expect(controller.update(thunderFrame({ frameIndex: 1, clock: 'bar4', clockEventId: 'bar4-a' }), settings()).started).toBe(true)
    expect(controller.update(thunderFrame({ frameIndex: 2, clock: 'bar4', clockEventId: 'bar4-a' }), settings()).started).toBe(false)
    expect(controller.update(thunderFrame({ frameIndex: 3 }), settings()).started).toBe(false)
    expect(controller.update(thunderFrame({ frameIndex: 4, clock: 'bar4', clockEventId: 'bar4-b' }), settings()).started).toBe(true)
  })

  const discreteCases: Array<[ElectricStormThunderTrigger, Partial<Parameters<typeof thunderFrame>[0]>]> = [
    ['beat', { clock: 'beat', clockEventId: 'beat-7' }],
    ['bar8', { clock: 'bar8', clockEventId: 'bar8-2' }],
    ['drop', { drop: true, dropEventId: 'drop-3' }],
  ]

  it.each(discreteCases)('fires %s on its matching canonical identity with no probability gate', (trigger, event) => {
    const controller = new ElectricStormThunderController()
    const configured = settings({ thunderTrigger: trigger })
    expect(controller.update(thunderFrame({ frameIndex: 10, ...event }), configured).started).toBe(true)
    expect(controller.update(thunderFrame({ frameIndex: 11, ...event }), configured).started).toBe(false)
  })

  it('fires every distinct discrete beat event instead of applying a random gate', () => {
    const controller = new ElectricStormThunderController()
    const configured = settings({ thunderTrigger: 'beat' })
    for (let index = 0; index < 12; index += 1) {
      expect(controller.update(thunderFrame({ frameIndex: index, clock: 'beat', clockEventId: `beat-${index}` }), configured).started).toBe(true)
    }
  })

  it('supports canonical downbeat identity and energy threshold re-arming', () => {
    const downbeat = new ElectricStormThunderController()
    expect(downbeat.update(thunderFrame({ downbeat: true, downbeatEventId: 'downbeat-1' }), settings({ thunderTrigger: 'downbeat' })).started).toBe(true)

    const energy = new ElectricStormThunderController()
    const energySettings = settings({ thunderTrigger: 'energy' })
    expect(energy.update(thunderFrame({ frameIndex: 1, energy: 0.8 }), energySettings).started).toBe(true)
    expect(energy.update(thunderFrame({ frameIndex: 2, energy: 0.9 }), energySettings).started).toBe(false)
    expect(energy.update(thunderFrame({ frameIndex: 3, energy: 0.4 }), energySettings).started).toBe(false)
    expect(energy.update(thunderFrame({ frameIndex: 4, energy: 0.8 }), energySettings).started).toBe(true)
  })

  it('makes flash intensity, duration, and decay independently observable', () => {
    const lowIntensity = new ElectricStormThunderController()
    const highIntensity = new ElectricStormThunderController()
    const event = thunderFrame({ clock: 'bar4', clockEventId: 'flash-start' })
    expect(lowIntensity.update(event, settings({ flashIntensity: 0.2 })).illumination).toBeCloseTo(0.2)
    expect(highIntensity.update(event, settings({ flashIntensity: 0.9 })).illumination).toBeCloseTo(0.9)

    const shortDuration = new ElectricStormThunderController()
    const longDuration = new ElectricStormThunderController()
    shortDuration.update(event, settings({ flashDuration: 0, flashDecay: 0.5 }))
    longDuration.update(event, settings({ flashDuration: 1, flashDecay: 0.5 }))
    const shortAtPoint = shortDuration.update(thunderFrame({ frameIndex: 2, deltaTimeSec: 0.2 }), settings({ flashDuration: 0, flashDecay: 0.5 })).illumination
    const longAtPoint = longDuration.update(thunderFrame({ frameIndex: 2, deltaTimeSec: 0.2 }), settings({ flashDuration: 1, flashDecay: 0.5 })).illumination
    expect(longAtPoint).toBeGreaterThan(shortAtPoint)

    const quickDecay = new ElectricStormThunderController()
    const slowDecay = new ElectricStormThunderController()
    quickDecay.update(event, settings({ flashDuration: 0, flashDecay: 0 }))
    slowDecay.update(event, settings({ flashDuration: 0, flashDecay: 1 }))
    const quickAtPoint = quickDecay.update(thunderFrame({ frameIndex: 3, deltaTimeSec: 0.1 }), settings({ flashDuration: 0, flashDecay: 0 })).illumination
    const slowAtPoint = slowDecay.update(thunderFrame({ frameIndex: 3, deltaTimeSec: 0.1 }), settings({ flashDuration: 0, flashDecay: 1 })).illumination
    expect(slowAtPoint).toBeGreaterThan(quickAtPoint)
  })
})
