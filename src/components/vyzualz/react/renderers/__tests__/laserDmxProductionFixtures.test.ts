import { beforeEach, describe, expect, it } from 'vitest'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import type { LaserDmxPersonalizationContext } from '../../../../../features/personalization/laserDmxPersonalization'
import {
  DEFAULT_PRODUCTION_FLASH_PATTERN,
  normalizeLaserDmxSettings,
  normalizeLegacyLaserDmxFixture,
} from '../../LaserDmxProductionRig'
import { createDefaultLaserDmxSettings, type LaserDmxFixture } from '../../ReactTypes'
import { compileLaserDmxFrame, resetLaserDmxCompilerState } from '../LaserDmxCompiler'
import {
  buildProductionChaseOrder,
  evaluateLedSegmentFrame,
  evaluateProductionFlashPattern,
  quantizeProductionFlashTime,
  resolveProductionFlashRetrigger,
} from '../LaserDmxFlashPatternEngine'

const MI = { rhythm: { bpm: 120 } } as MusicIntelligenceFrame

function fixture(profileId: LaserDmxFixture['dmx']['profileId'], id: string = profileId): LaserDmxFixture {
  const base = structuredClone(createDefaultLaserDmxSettings().fixtures[0])
  return normalizeLegacyLaserDmxFixture({
    ...base,
    id,
    name: id,
    fixtureKind: undefined,
    dmx: { ...base.dmx, profileId },
    color: { ...base.color, mode: 'fixed', red: 12, green: 24, blue: 36, white: 0, colorCycleSpeed: 0 },
    beam: { ...base.beam, strobeRate: 0 },
    modulationRoutes: [],
  })
}

function compile(fixtures: LaserDmxFixture[], timeSec = 0.1, personalization?: LaserDmxPersonalizationContext | null) {
  resetLaserDmxCompilerState()
  return compileLaserDmxFrame({
    settings: normalizeLaserDmxSettings({ ...createDefaultLaserDmxSettings(), fixtures }),
    mi: MI,
    time: timeSec * 60,
    timeSec,
    canvasWidth: 1280,
    canvasHeight: 720,
    personalization,
  })
}

beforeEach(() => resetLaserDmxCompilerState())

describe('LaserDMX production flash patterns and chases', () => {
  it('quantizes triggers and applies retrigger policy deterministically', () => {
    expect(quantizeProductionFlashTime(0.26, 120, 'sixteenth')).toBeCloseTo(0.375)
    expect(quantizeProductionFlashTime(0.26, 120, 'eighth')).toBeCloseTo(0.5)
    expect(resolveProductionFlashRetrigger(
      { ...DEFAULT_PRODUCTION_FLASH_PATTERN, retriggerPolicy: 'ignoreWhileActive' },
      0,
      0.2,
      0.5,
      120,
    )).toBeNull()
    expect(resolveProductionFlashRetrigger(
      { ...DEFAULT_PRODUCTION_FLASH_PATTERN, retriggerPolicy: 'queueNextQuantized', quantize: 'beat' },
      0,
      0.2,
      0.63,
      120,
    )).toBeCloseTo(1)
  })

  it('evaluates hit, burst, whiteout, and blackout timing from transport time', () => {
    const base = { ...DEFAULT_PRODUCTION_FLASH_PATTERN, enabled: true, quantize: 'none' as const }
    const single = evaluateProductionFlashPattern({ settings: { ...base, pattern: 'singleHit' }, timeSec: 0.01, bpm: 120 })
    const doubleSecondHit = evaluateProductionFlashPattern({ settings: { ...base, pattern: 'doubleHit' }, timeSec: 0.12, bpm: 120 })
    const whiteout = evaluateProductionFlashPattern({ settings: { ...base, pattern: 'fullStageWhiteout' }, timeSec: 0.1, bpm: 120 })
    const blackout = evaluateProductionFlashPattern({ settings: { ...base, pattern: 'flashThenBlackout' }, timeSec: 0.2, bpm: 120 })
    expect(single.visible).toBe(true)
    expect(doubleSecondHit.visible).toBe(true)
    expect(whiteout).toMatchObject({ active: true, visible: true, whiteAccent: true })
    expect(blackout).toMatchObject({ active: true, visible: false, blackout: true })
  })

  it('clamps sustained flash frequency and reports high-frequency comfort warnings', () => {
    const result = evaluateProductionFlashPattern({
      settings: {
        ...DEFAULT_PRODUCTION_FLASH_PATTERN,
        enabled: true,
        pattern: 'sustainedStrobe',
        rateHz: 20,
        durationBeats: 16,
        repeat: { mode: 'loop', count: 1, intervalBeats: 16 },
        quantize: 'none',
      },
      comfort: { disableStrobe: false, maxFlashHz: 8, warningThresholdHz: 6, maxContinuousFlashSec: 4 },
      timeSec: 0.02,
      bpm: 120,
    })
    expect(result).toMatchObject({ requestedHz: 20, effectiveHz: 8, comfortLimited: true, warning: true })
  })

  it('is seek-safe and pause/resume-safe because output is a pure function of transport time', () => {
    const settings = {
      ...DEFAULT_PRODUCTION_FLASH_PATTERN,
      enabled: true,
      pattern: 'randomizedFlicker' as const,
      durationBeats: 16,
      repeat: { mode: 'loop' as const, count: 1, intervalBeats: 16 },
      quantize: 'none' as const,
      seed: 404,
    }
    const first = evaluateProductionFlashPattern({ settings, timeSec: 1.375, bpm: 128, fixtureIndex: 2, fixtureCount: 8 })
    evaluateProductionFlashPattern({ settings, timeSec: 4.2, bpm: 128, fixtureIndex: 2, fixtureCount: 8 })
    const afterSeek = evaluateProductionFlashPattern({ settings, timeSec: 1.375, bpm: 128, fixtureIndex: 2, fixtureCount: 8 })
    expect(afterSeek).toEqual(first)
  })

  it('builds every fixture chase order, including deterministic random order', () => {
    expect(buildProductionChaseOrder(5, 'forward')).toEqual([0, 1, 2, 3, 4])
    expect(buildProductionChaseOrder(5, 'reverse')).toEqual([4, 3, 2, 1, 0])
    expect(buildProductionChaseOrder(5, 'alternate')).toEqual([0, 2, 4, 1, 3])
    expect(buildProductionChaseOrder(5, 'centerOut')).toEqual([2, 1, 3, 0, 4])
    expect(buildProductionChaseOrder(5, 'outsideIn')).toEqual([0, 4, 1, 3, 2])
    expect(buildProductionChaseOrder(8, 'randomized', 77)).toEqual(buildProductionChaseOrder(8, 'randomized', 77))
    expect(new Set(buildProductionChaseOrder(8, 'randomized', 77)).size).toBe(8)
  })

  it('bounds LED segment rendering and supports deterministic segmented patterns', () => {
    const frame = evaluateLedSegmentFrame({
      count: 200,
      pattern: 'sparkle',
      primary: [255, 0, 0],
      secondary: [0, 0, 255],
      chase: { enabled: true, order: 'centerOut', stepBeats: 0.5, width: 2, seed: 8 },
      timeSec: 1.25,
      bpm: 120,
      seed: 8,
    })
    expect(frame.colors).toHaveLength(32)
    expect(frame.intensities).toHaveLength(32)
    expect(frame).toEqual(evaluateLedSegmentFrame({
      count: 200,
      pattern: 'sparkle',
      primary: [255, 0, 0],
      secondary: [0, 0, 255],
      chase: { enabled: true, order: 'centerOut', stepBeats: 0.5, width: 2, seed: 8 },
      timeSec: 1.25,
      bpm: 120,
      seed: 8,
    }))
  })
})

describe('LaserDMX non-laser fixture compilation', () => {
  it('filters unsupported authored state by fixture capability', () => {
    const wash = normalizeLegacyLaserDmxFixture({
      ...fixture('genericStaticWash', 'wash'),
      movingHead: { panDeg: 90 },
      flashPattern: { ...DEFAULT_PRODUCTION_FLASH_PATTERN, enabled: true },
      ledBar: { mode: 'segments', segmentCount: 16, pattern: 'chase' },
    })
    expect(wash.fixtureKind).toBe('staticWash')
    expect(wash.movingHead).toBeUndefined()
    expect(wash.flashPattern).toBeUndefined()
    expect(wash.ledBar).toBeUndefined()
    expect(wash.wash).toBeDefined()
  })

  it('compiles strobes as flash panels, washes as regions, and LED bars as bounded segments', () => {
    const strobe = fixture('genericWhiteStrobe', 'strobe')
    strobe.flashPattern = {
      ...DEFAULT_PRODUCTION_FLASH_PATTERN,
      enabled: true,
      pattern: 'fullStageWhiteout',
      quantize: 'none',
    }
    const wash = fixture('genericStaticWash', 'wash')
    const led = fixture('genericLedBar', 'led')
    led.ledBar = { mode: 'segments', segmentCount: 24, pattern: 'gradient', secondaryColor: { red: 200, green: 0, blue: 120, white: 0 }, chase: { enabled: false, order: 'forward', stepBeats: 0.5, width: 1, seed: 1 } }
    const result = compile([strobe, wash, led], 0.01)
    expect(result.fixtures.find(frame => frame.fixtureId === 'strobe')?.visual.flash?.pattern).toBe('fullStageWhiteout')
    expect(result.fixtures.find(frame => frame.fixtureId === 'wash')?.visual.wash).toBeDefined()
    expect(result.fixtures.find(frame => frame.fixtureId === 'led')?.visual.ledBar?.segmentColors).toHaveLength(24)
    expect(result.outputFrame.fixtures.map(output => output.fixtureKind)).toEqual(['strobe', 'staticWash', 'ledBar'])
  })

  it('reserves RGBW white output for impact or explicit continuous policy', () => {
    const wash = fixture('genericStaticWash', 'white-policy-wash')
    wash.color = { ...wash.color, white: 200, colorCycleSpeed: 0 }
    wash.colorPolicy = { whiteAccentPolicy: 'impactOnly', whiteAccentIntensity: 1, preserveFixedColor: true }
    const impactOnly = compile([wash], 0.1)
    expect(impactOnly.fixtures[0].channels.ch6).toBe(0)

    wash.colorPolicy = { ...wash.colorPolicy, whiteAccentPolicy: 'continuous' }
    const continuous = compile([wash], 0.1)
    expect(continuous.fixtures[0].channels.ch6).toBe(200)
  })

  it('caps LED segment count by renderer quality tier', () => {
    const led = fixture('genericLedBar', 'led-quality')
    led.ledBar = {
      mode: 'segments',
      segmentCount: 24,
      pattern: 'chase',
      secondaryColor: { red: 0, green: 120, blue: 255, white: 0 },
      chase: { enabled: true, order: 'forward', stepBeats: 0.5, width: 2, seed: 7 },
    }
    const defaults = createDefaultLaserDmxSettings()
    const lowQuality = normalizeLaserDmxSettings({
      ...defaults,
      productionStage: {
        ...defaults.productionStage,
        editor: { ...defaults.productionStage?.editor, qualityTier: 'low' },
      },
      fixtures: [led],
    })
    const result = compileLaserDmxFrame({ settings: lowQuality, mi: MI, time: 6, timeSec: 0.1, canvasWidth: 1280, canvasHeight: 720 })
    expect(result.fixtures[0].visual.ledBar?.segmentColors).toHaveLength(8)
  })

  it('retains Brand Kit color mapping for RGBW fixtures while preserving fixed amber and white emitters', () => {
    const context: LaserDmxPersonalizationContext = {
      kitId: 'kit',
      kitName: 'Kit',
      mode: 'brand',
      strength: 1,
      palette: { primary: '#EE1144', secondary: '#22BBEE', accent: '#44EE66', background: '#05070A', highlight: '#F0D040', text: '#FFFFFF' },
      preserveTriggerSemantics: false,
      semanticRoleMapping: { bass: 'primary', snare: 'secondary', beat: 'accent', other: 'highlight', white: 'highlight' },
      paletteFingerprint: 'test',
    }
    const wash = fixture('genericStaticWash', 'wash')
    const blinder = fixture('genericAudienceBlinder', 'blinder')
    const strobe = fixture('genericWhiteStrobe', 'strobe')
    const result = compile([wash, blinder, strobe], 0.1, context)
    expect(result.fixtures.find(frame => frame.fixtureId === 'wash')?.visual.rgba).toMatchObject({ r: 238, g: 17, b: 68 })
    expect(result.fixtures.find(frame => frame.fixtureId === 'blinder')?.visual.rgba).toMatchObject({ r: 255, g: 208, b: 154 })
    expect(result.fixtures.find(frame => frame.fixtureId === 'strobe')?.visual.rgba).toMatchObject({ r: 255, g: 254, b: 250 })
  })

  it('allows an authored fixed-color fixture to opt into Brand Kit recoloring', () => {
    const context: LaserDmxPersonalizationContext = {
      kitId: 'kit',
      kitName: 'Kit',
      mode: 'brand',
      strength: 1,
      palette: { primary: '#EE1144', secondary: '#22BBEE', accent: '#44EE66', background: '#05070A', highlight: '#F0D040', text: '#FFFFFF' },
      preserveTriggerSemantics: false,
      semanticRoleMapping: { bass: 'primary', snare: 'secondary', beat: 'accent', other: 'highlight', white: 'highlight' },
      paletteFingerprint: 'test',
    }
    const blinder = fixture('genericAudienceBlinder', 'brand-blinder')
    blinder.colorPolicy = { ...blinder.colorPolicy!, preserveFixedColor: false }
    const result = compile([blinder], 0.1, context)
    expect(result.fixtures[0].visual.rgba).toMatchObject({ r: 238, g: 17, b: 68 })
  })

  it('honors global disable-strobe without removing steady washes or LED output', () => {
    const strobe = fixture('genericWhiteStrobe', 'strobe')
    strobe.flashPattern = { ...DEFAULT_PRODUCTION_FLASH_PATTERN, enabled: true, pattern: 'sustainedStrobe', quantize: 'none' }
    const wash = fixture('genericStaticWash', 'wash')
    wash.flashPattern = { ...DEFAULT_PRODUCTION_FLASH_PATTERN, enabled: true, pattern: 'sustainedStrobe', quantize: 'none' }
    const led = fixture('genericLedBar', 'led')
    led.flashPattern = { ...DEFAULT_PRODUCTION_FLASH_PATTERN, enabled: true, pattern: 'sustainedStrobe', quantize: 'none' }
    const settings = normalizeLaserDmxSettings({
      ...createDefaultLaserDmxSettings(),
      visualComfort: { disableStrobe: true, maxFlashHz: 12, warningThresholdHz: 7, maxContinuousFlashSec: 4 },
      fixtures: [strobe, wash, led],
    })
    const result = compileLaserDmxFrame({ settings, mi: MI, time: 3, timeSec: 0.05, canvasWidth: 1280, canvasHeight: 720 })
    expect(result.fixtures.find(frame => frame.fixtureId === 'strobe')?.visual).toMatchObject({ strobeVisible: false, intensity: 0 })
    expect(result.fixtures.find(frame => frame.fixtureId === 'wash')?.visual).toMatchObject({ strobeVisible: true })
    expect(result.fixtures.find(frame => frame.fixtureId === 'led')?.visual).toMatchObject({ strobeVisible: true })
  })
})
