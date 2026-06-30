import { beforeEach, describe, expect, it } from 'vitest'
import type { MusicIntelligenceFrame } from '../../musicIntelligence/types'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxSettings,
  DEFAULT_BEAM_MOTION,
  DEFAULT_BEAM_SEQUENCE,
  DEFAULT_LAUNCH_SETTINGS,
  type LaserDmxMatrixBeam,
} from '../../../components/vyzualz/react/ReactTypes'
import {
  compileLaserDmxFrame,
  resetLaserDmxCompilerState,
} from '../../../components/vyzualz/react/renderers/LaserDmxCompiler'
import {
  compileLaserDmxBeamMatrix,
  resetBeamMatrixCompilerState,
} from '../../../components/vyzualz/react/renderers/LaserDmxBeamMatrixCompiler'
import type { BrandKit, BrandPalette } from '../BrandKitTypes'
import {
  personalizeRgbw,
  resolveLaserDmxPersonalization,
} from '../laserDmxPersonalization'
import { hexToRgb } from '../paletteColorSpace'

const PALETTE: BrandPalette = {
  primary: '#F02060',
  secondary: '#20C0F0',
  accent: '#60E040',
  background: '#05070A',
  highlight: '#F8F0D0',
  text: '#FFFFFF',
}

function makeKit(mode: 'original' | 'hybrid' | 'brand' | 'custom' = 'brand'): BrandKit {
  return {
    id: 'kit-1', userId: 'user-a', name: 'Stage Identity', palette: PALETTE,
    extractedPalette: null, extractionMetadata: null, defaultStrength: 1,
    engineRules: {
      laserDmx: {
        mode,
        strength: 1,
        preserveTriggerSemantics: true,
        customPalette: mode === 'custom' ? { ...PALETTE, primary: '#1122EE' } : undefined,
      },
    },
    presetRules: {}, useForAppAccent: false, autoApply: true,
    createdAt: '', updatedAt: '',
  }
}

function makeMi(overrides: Partial<MusicIntelligenceFrame> = {}): MusicIntelligenceFrame {
  return {
    frameId: 1,
    bands: { sub: 0.2, bass: 0.6, lowMid: 0.3, mid: 0.25, high: 0.2, air: 0.1, volume: 0.5,
      normalizedSub: 0.2, normalizedBass: 0.6, normalizedLowMid: 0.3, normalizedMid: 0.25,
      normalizedHigh: 0.2, normalizedAir: 0.1 },
    rhythm: { beatHit: false, kickHit: false, snareHit: false, hatHit: false, downbeatHit: false,
      phrase4Hit: false, phrase8Hit: false, phrase16Hit: false, phrase32Hit: false,
      beatPhase: 0.25, bpm: 128, transient: 0.2, kickStrength: 0, snareStrength: 0, hatStrength: 0,
      barIndex: 0, beatInBar: 0 },
    energy: { instant: 0.5, shortTerm: 0.4, longTerm: 0.3, spectralFlux: 0.2, tension: 0.2,
      complexity: 0.3, buildProgress: 0.2, dropImpact: 0, rms: 0.4, peak: 0.6, crestFactor: 8,
      percentile: 0.5, delta: 0.1, spectralCentroid: 0.4, spectralSpread: 0.3,
      spectralRolloff: 0.5, spectralFlatness: 0.2 },
    harmonic: { pitchHz: null, keyConfidence: 0, chordConfidence: 0, chordChanged: false, mode: null },
    stems: { vocals: 0, drums: 0.5, bass: 0.4, instruments: 0.2, other: 0,
      bassStemEnergy: 0.4, instrumentEnergy: 0.2, otherStemEnergy: 0, vocalEnergy: 0,
      drumEnergy: 0.5, vocalActivity: 0, drumTransient: false, bassStemTransient: false },
    lyrics: { vocalActivity: 0, lyricLineProgress: 0, phraseConfidence: 0, wordHit: false,
      activeLine: null, activeWord: null },
    semantics: { buildConfidence: 0, dropConfidence: 0, fakeoutConfidence: 0,
      vocalHookConfidence: 0, mood: null },
    section: { type: 'unknown', progress: 0, intensity: 0, label: '', startSec: 0, endSec: 60,
      confidence: 0, source: 'heuristic' },
    ...overrides,
  } as MusicIntelligenceFrame
}

function compileSpatial(settings = createDefaultLaserDmxSettings(), kit: BrandKit | null = null) {
  resetLaserDmxCompilerState()
  return compileLaserDmxFrame({
    settings, mi: makeMi(), time: 30, timeSec: 0.5, canvasWidth: 1280, canvasHeight: 720,
    personalization: resolveLaserDmxPersonalization(kit, 'laser-preset'),
  })
}

function makeBeam(id: string, groupId: string | null, useGroupColor = false): LaserDmxMatrixBeam {
  return {
    id, name: id, enabled: true, sequenceIndex: 0,
    origin: { column: 2, row: 2, z: 0 },
    target: { kind: 'grid', column: 12, row: 8, z: 0 },
    groupId, useGroupColor,
    color: { red: 20, green: 40, blue: 80, white: 12, alpha: 0.65 },
    appearance: { dimmer: 1, shutterOpen: true, width: 1.2, focus: 0.8, strobeRate: 0.15,
      flickerAmount: 0, divergence: 0.2, glow: 0.7, geometry: 'line' },
    motion: { ...DEFAULT_BEAM_MOTION, mode: 'static' },
    modulationRoutes: [],
  }
}

function compileMatrix(kit: BrandKit | null, withGroup = false) {
  const settings = createDefaultLaserDmxBeamMatrixSettings()
  const group = settings.groups[0]
  group.name = 'Kick Group'
  group.colorOverrideEnabled = true
  group.color = { red: 90, green: 20, blue: 30, white: 0, alpha: 0.8 }
  group.sequence = { ...DEFAULT_BEAM_SEQUENCE, enabled: false }
  group.launch = { ...DEFAULT_LAUNCH_SETTINGS, trigger: 'kick' }
  group.modulationRoutes = []
  settings.beams = [makeBeam(withGroup ? 'group-beam' : 'ungrouped-beat', withGroup ? group.id : null, withGroup)]
  settings.groups = withGroup ? [group] : []
  settings.globalModulationRoutes = []
  resetBeamMatrixCompilerState()
  return { settings, result: compileLaserDmxBeamMatrix({
    settings, mi: makeMi(), time: 30, timeSec: 0.5, canvasWidth: 1280, canvasHeight: 720,
    personalization: resolveLaserDmxPersonalization(kit, 'laser-preset'),
  }) }
}

beforeEach(() => {
  resetLaserDmxCompilerState()
  resetBeamMatrixCompilerState()
})

describe('LaserDMX Brand Kit adaptation', () => {
  it('keeps Spatial Original mode byte-for-byte equivalent', () => {
    const settings = createDefaultLaserDmxSettings()
    const legacy = compileSpatial(settings, null)
    const original = compileSpatial(settings, makeKit('original'))
    expect(original).toEqual(legacy)
  })

  it.each(['fixed', 'palette', 'music'] as const)('maps Spatial %s colors while preserving white and alpha intent', mode => {
    const settings = createDefaultLaserDmxSettings()
    settings.fixtures = [structuredClone(settings.fixtures[2])]
    const fixture = settings.fixtures[0]
    fixture.id = `fixture-${mode}`
    fixture.name = 'Kick Bass Fixture'
    fixture.modulationRoutes = []
    fixture.color = { ...fixture.color, mode, red: 10, green: 20, blue: 30, white: 71, alpha: 0.62,
      paletteId: 'rainbowLaser', colorCycleSpeed: mode === 'palette' ? 1 : 0 }
    const before = structuredClone(settings)
    const frame = compileSpatial(settings, makeKit('brand')).fixtures[0]
    const primary = hexToRgb(PALETTE.primary)
    expect(frame.visual.rgba).toMatchObject({ r: primary.r, g: primary.g, b: primary.b })
    expect(frame.channels.ch12).toBe(71)
    expect(frame.visual.rgba.a).toBeGreaterThan(0)
    expect(settings).toEqual(before)
  })

  it('produces a deterministic perceptual Hybrid tint', () => {
    const context = resolveLaserDmxPersonalization(makeKit('hybrid'))!
    const first = personalizeRgbw({ red: 12, green: 98, blue: 210, white: 33, alpha: 0.4 }, 'snare', context)
    const second = personalizeRgbw({ red: 12, green: 98, blue: 210, white: 33, alpha: 0.4 }, 'snare', context)
    expect(first).toEqual(second)
    expect(first).not.toMatchObject({ red: 12, green: 98, blue: 210 })
    expect(first.white).toBe(33)
    expect(first.alpha).toBe(0.4)
  })

  it('adapts ungrouped and group-override Beam Matrix colors without mutating settings', () => {
    const ungrouped = compileMatrix(makeKit('brand'), false)
    const grouped = compileMatrix(makeKit('brand'), true)
    const groupedBefore = structuredClone(grouped.settings)
    const primary = hexToRgb(PALETTE.primary)
    const accent = hexToRgb(PALETTE.accent)
    expect(ungrouped.result.beams[0].rgba).toMatchObject({ r: accent.r + 12, g: accent.g + 12, b: accent.b + 12, a: 0.65 })
    expect(grouped.result.beams[0].rgba).toMatchObject({ r: primary.r + 12, g: primary.g + 12, b: primary.b + 12, a: 0.8 })
    expect(grouped.settings).toEqual(groupedBefore)
  })

  it('keeps trigger semantics recognizable and supports disabling semantic distinctions', () => {
    const kit = makeKit('brand')
    const context = resolveLaserDmxPersonalization(kit)!
    const bass = personalizeRgbw({ red: 0, green: 0, blue: 0, white: 0, alpha: 1 }, 'bass', context)
    const snare = personalizeRgbw({ red: 0, green: 0, blue: 0, white: 0, alpha: 1 }, 'snare', context)
    expect(bass).not.toEqual(snare)

    kit.engineRules.laserDmx!.preserveTriggerSemantics = false
    const collapsed = resolveLaserDmxPersonalization(kit)!
    expect(personalizeRgbw({ red: 0, green: 0, blue: 0, white: 0, alpha: 1 }, 'snare', collapsed)).toEqual(
      personalizeRgbw({ red: 0, green: 0, blue: 0, white: 0, alpha: 1 }, 'bass', collapsed),
    )
  })

  it('keeps Beam Matrix Original colors and all non-color output unchanged', () => {
    const legacy = compileMatrix(null, true).result
    const original = compileMatrix(makeKit('original'), true).result
    expect(original).toEqual(legacy)

    const branded = compileMatrix(makeKit('brand'), true).result
    expect(branded.output).toEqual(legacy.output)
    expect(branded.fog).toEqual(legacy.fog)
    const omitColor = ({ rgba: _rgba, colorCss: _css, ...rest }: typeof branded.beams[number]) => rest
    expect(omitColor(branded.beams[0])).toEqual(omitColor(legacy.beams[0]))
  })

  it('honors preset Original and Custom overrides before the engine rule', () => {
    const kit = makeKit('brand')
    kit.presetRules['laser-preset'] = { mode: 'original' }
    expect(resolveLaserDmxPersonalization(kit, 'laser-preset')).toBeNull()

    kit.presetRules['laser-preset'] = { mode: 'custom', strength: 1, palette: { ...PALETTE, primary: '#1122EE' } }
    expect(resolveLaserDmxPersonalization(kit, 'laser-preset')?.palette.primary).toBe('#1122EE')
    expect(resolveLaserDmxPersonalization(kit, 'other-preset')?.palette.primary).toBe(PALETTE.primary)
  })
})
