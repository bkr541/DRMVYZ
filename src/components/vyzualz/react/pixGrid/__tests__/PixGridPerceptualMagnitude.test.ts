import { describe, expect, it } from 'vitest'
import type { ReactSectionType } from '../../ReactTypes'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PIX_GRID_PRESETS } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import { PixGridStructuralChoreographer } from '../PixGridStructuralChoreographer'
import type { PixGridAudioFrame } from '../PixGridTypes'
import {
  applyPixGridVisualEffectStack,
  measurePixGridFrameChange,
  measurePixGridMeanLuminance,
} from '../PixGridVisualEffectStack'

/**
 * Existing PixGrid tests assert structure: that routes compile, that assignments
 * resolve, that state migrates. They all passed while the engine rendered a
 * near-black, near-static frame, because none of them asserted *magnitude*.
 *
 * These are perceptual acceptance thresholds. They are deliberately expressed as
 * bands rather than exact values so authoring stays free to move, but a
 * regression back into sub-perceptual territory fails the suite.
 */

const FPS = 60
/** Reference tempo for tests that don't care about tempo (arc ordering, envelope shape, determinism). */
const REFERENCE_BPM = 128

/**
 * DRMVYZ is used across genres with very different tempos: halftime dubstep
 * sits around 70 BPM (a half-time feel over a ~140 BPM track), house/techno in
 * the 120-130 range, and DNB/hyperpop up to 174-180 BPM. The choreographer's
 * envelope half-lives are defined in wall-clock seconds and retrigger off real
 * audio-frame events rather than an assumed tempo, so magnitude should hold
 * across this whole range rather than just at one reference BPM.
 */
const GENRE_BPM_RANGE = [70, 90, 110, 128, 140, 160, 174, 180] as const

/** Measured floor for a frame to read as lit rather than near-black on an LED wall. */
const MIN_DROP_MEAN_LUMINANCE = 80
const MIN_SUSTAINED_MEAN_LUMINANCE = 55
/** Below this a drop does not read as a drop; above it the frame becomes noise. */
const MIN_DROP_FRAME_CHANGE = 0.25
const MAX_DROP_FRAME_CHANGE = 0.6

function audioFrame(
  audioTime: number,
  sectionType: ReactSectionType,
  patch: Partial<PixGridAudioFrame> = {},
  bpm: number = REFERENCE_BPM,
): PixGridAudioFrame {
  const beatPosition = (audioTime * bpm) / 60
  const beatIndex = Math.floor(beatPosition)
  // Beat-hit window scales with tempo so "on beat" still means "this frame",
  // rather than shrinking at high BPM and never firing.
  const beatWindow = Math.max(0.02, (bpm / 60 / FPS) * 0.9)
  const onBeat = Math.abs(beatPosition - beatIndex) < beatWindow
  return {
    audioTime,
    bass: 0.8,
    mid: 0.6,
    high: 0.45,
    volume: 0.75,
    beatHit: onBeat,
    beatPhase: beatPosition - beatIndex,
    isPlaying: true,
    sectionType,
    beatIndex,
    barIndex: Math.floor(beatIndex / 4),
    kickHit: onBeat,
    barEntry: onBeat && beatIndex % 4 === 0,
    energy: 0.7,
    trackRelativeEnergy: 0.7,
    deltaTimeSec: 1 / FPS,
    ...patch,
  }
}

function presetFixture(presetId: string, sectionType: ReactSectionType) {
  const preset = PIX_GRID_PRESETS.find((candidate) => candidate.id === presetId)
  if (!preset?.pixGridSettings) throw new Error(`Missing PixGrid preset ${presetId}`)
  const base = applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
  return { preset, state: { ...base, selectedSceneId: `${presetId}-${sectionType}` } }
}

interface SectionMeasurement {
  meanLuminanceWithChoreography: number
  meanLuminanceWithoutChoreography: number
  frameChange: number
}

function measureSection(
  presetId: string,
  sectionType: ReactSectionType,
  bpm: number = REFERENCE_BPM,
): SectionMeasurement {
  const { preset, state } = presetFixture(presetId, sectionType)
  const choreographer = new PixGridStructuralChoreographer()
  let previous: Uint8Array | null = null
  let withChoreography = 0
  let withoutChoreography = 0
  let change = 0
  let samples = 0

  for (let index = 0; index < 90; index += 1) {
    const audioTime = 40 + index / FPS
    const frame = audioFrame(
      audioTime,
      sectionType,
      sectionType === 'drop' && index === 20 ? { dropImpactHit: true } : {},
      bpm,
    )
    const choreography = choreographer.evaluate(frame)
    const composed = composePixGridLogicalFrame(
      preset, state, frame, undefined, null, undefined, null, [], undefined, choreography,
    )
    // Warm-up frames are skipped so envelopes and motion clocks have settled.
    if (index > 30) {
      withChoreography += measurePixGridMeanLuminance(composed.pixels)
      const bare = composePixGridLogicalFrame(
        preset, state, frame, undefined, null, undefined, null, [], undefined, null,
      )
      withoutChoreography += measurePixGridMeanLuminance(bare.pixels)
      if (previous) change += measurePixGridFrameChange(previous, composed.pixels)
      samples += 1
    }
    previous = composed.pixels.slice()
  }

  return {
    meanLuminanceWithChoreography: withChoreography / samples,
    meanLuminanceWithoutChoreography: withoutChoreography / samples,
    frameChange: change / Math.max(1, samples - 1),
  }
}

describe('PixGrid perceptual magnitude', () => {
  for (const presetId of ['pix-grid-bass-beacon', 'pix-grid-geometric-reactor', 'pix-grid-pixel-parade']) {
    describe(presetId, () => {
      it('renders a drop above the perceptual luminance floor', () => {
        const measured = measureSection(presetId, 'drop')
        expect(measured.meanLuminanceWithChoreography).toBeGreaterThan(MIN_DROP_MEAN_LUMINANCE)
      })

      it('moves enough during a drop to read as a drop', () => {
        const measured = measureSection(presetId, 'drop')
        expect(measured.frameChange).toBeGreaterThan(MIN_DROP_FRAME_CHANGE)
        expect(measured.frameChange).toBeLessThan(MAX_DROP_FRAME_CHANGE)
      })

      it('keeps verse and build lit rather than near-black', () => {
        for (const sectionType of ['verse', 'build'] as ReactSectionType[]) {
          const measured = measureSection(presetId, sectionType)
          expect(measured.meanLuminanceWithChoreography).toBeGreaterThan(MIN_SUSTAINED_MEAN_LUMINANCE)
        }
      })

      it('gains substantial magnitude from the choreography', () => {
        const measured = measureSection(presetId, 'drop')
        expect(measured.meanLuminanceWithChoreography).toBeGreaterThan(
          measured.meanLuminanceWithoutChoreography * 1.4,
        )
      })

      it.each(GENRE_BPM_RANGE)('holds drop magnitude at %d BPM', (bpm: number) => {
        const measured = measureSection(presetId, 'drop', bpm)
        expect(measured.meanLuminanceWithChoreography).toBeGreaterThan(MIN_DROP_MEAN_LUMINANCE)
        expect(measured.frameChange).toBeGreaterThan(MIN_DROP_FRAME_CHANGE)
        expect(measured.frameChange).toBeLessThan(MAX_DROP_FRAME_CHANGE)
      })

      it.each(GENRE_BPM_RANGE)('keeps verse lit at %d BPM', (bpm: number) => {
        const measured = measureSection(presetId, 'verse', bpm)
        expect(measured.meanLuminanceWithChoreography).toBeGreaterThan(MIN_SUSTAINED_MEAN_LUMINANCE)
      })
    })
  }

  describe('genre tempo range (70-180 BPM)', () => {
    /**
     * 70 covers halftime dubstep (a half-time feel layered over a faster
     * underlying track), 90-128 covers house/hip-hop/techno, 140-160 covers
     * dubstep/trap at full tempo, and 174-180 covers DNB and hyperpop. The
     * magnitude fix must not be a 128-BPM special case.
     */
    it('does not drift by more than 15% across the tempo range for any preset', () => {
      for (const presetId of ['pix-grid-bass-beacon', 'pix-grid-geometric-reactor', 'pix-grid-pixel-parade']) {
        const luminances = GENRE_BPM_RANGE.map((bpm) => measureSection(presetId, 'drop', bpm).meanLuminanceWithChoreography)
        const min = Math.min(...luminances)
        const max = Math.max(...luminances)
        expect(max - min).toBeLessThan(min * 0.15)
      }
    })
  })

  it('orders the structural energy arc so the drop is the peak', () => {
    const choreographer = new PixGridStructuralChoreographer()
    const motionFor = (sectionType: ReactSectionType): number => {
      choreographer.reset()
      let motionScale = 0
      for (let index = 0; index < 30; index += 1) {
        motionScale = choreographer.evaluate(audioFrame(10 + index / FPS, sectionType)).motionScale
      }
      return motionScale
    }

    const drop = motionFor('drop')
    const build = motionFor('build')
    const verse = motionFor('verse')
    const breakdown = motionFor('breakdown')
    const intro = motionFor('intro')
    const outro = motionFor('outro')
    const preDrop = motionFor('preDrop')

    expect(drop).toBeGreaterThan(build)
    expect(build).toBeGreaterThan(verse)
    expect(verse).toBeGreaterThan(breakdown)
    expect(breakdown).toBeGreaterThan(intro)
    expect(intro).toBeGreaterThan(outro)
    expect(outro).toBeGreaterThan(preDrop)
  })

  it('decays event envelopes instead of emitting single-frame spikes', () => {
    const choreographer = new PixGridStructuralChoreographer()
    const impacts: number[] = []
    for (let index = 0; index < 40; index += 1) {
      const frame = audioFrame(20 + index / FPS, 'drop', index === 0 ? { dropImpactHit: true } : {})
      impacts.push(choreographer.evaluate(frame).impact)
    }
    expect(impacts[0]).toBeGreaterThan(0.6)
    expect(impacts[20]).toBeGreaterThan(0.2)
    expect(impacts[20]).toBeLessThan(impacts[0])
  })

  it('leaves fully transparent cells untouched and stays in range', () => {
    const pixels = new Uint8Array(4 * 4 * 4)
    pixels[0] = 20
    pixels[1] = 30
    pixels[2] = 40
    pixels[3] = 255
    applyPixGridVisualEffectStack(pixels, 4, 4, [
      { id: 'exposure', kind: 'exposure', amount: 1 },
      { id: 'contrast', kind: 'contrast', amount: 1 },
      { id: 'strobe', kind: 'strobe', amount: 0.5 },
    ])
    expect(pixels[0]).toBeGreaterThan(20)
    for (let offset = 4; offset < pixels.length; offset += 4) {
      expect(pixels[offset]).toBe(0)
      expect(pixels[offset + 3]).toBe(0)
    }
    for (const value of pixels) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(255)
    }
  })

  it('produces identical output for identical inputs', () => {
    const first = measureSection('pix-grid-bass-beacon', 'drop')
    const second = measureSection('pix-grid-bass-beacon', 'drop')
    expect(first.meanLuminanceWithChoreography).toBeCloseTo(second.meanLuminanceWithChoreography, 6)
    expect(first.frameChange).toBeCloseTo(second.frameChange, 6)
  })
})
