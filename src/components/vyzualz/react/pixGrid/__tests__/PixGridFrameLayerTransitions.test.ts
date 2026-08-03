import { describe, expect, it } from 'vitest'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { pixGridCellTransitionMix } from '../PixGridCellTransitions'
import { createDefaultPixGridState } from '../PixGridDefaults'
import type { PixGridAudioFrame, PixGridLayer, PixGridLayerAnimation } from '../PixGridTypes'

function audio(overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  return {
    audioTime: 0,
    bass: 0,
    mid: 0,
    high: 0,
    volume: 0,
    beatHit: false,
    beatPhase: 0,
    isPlaying: true,
    beatIndex: 0,
    barIndex: 0,
    absoluteBar: 0,
    sectionType: 'verse',
    motionClockSectionType: 'verse',
    sectionProgress: 0.5,
    motionClockSectionProgress: 0.5,
    beatsSinceSectionStart: 0,
    barsSinceSectionStart: 0,
    motionClockSectionBeat: 0,
    motionClockSectionBar: 0,
    motionClockBeat: 0,
    motionClockBar: 0,
    motionClockTime: 0,
    motionMultiplier: 1,
    autoPerformanceEnabled: false,
    ...overrides,
  }
}

function frameLayer(animation: PixGridLayerAnimation): PixGridLayer {
  const base = createDefaultPixGridState().layers[0]!
  return {
    ...base,
    id: 'generic-frame-layer',
    assetId: 'pix-mascot-face',
    animations: [animation],
    seed: 917,
  }
}

function resolve(layer: PixGridLayer, frame: PixGridAudioFrame) {
  return resolvePixGridLayerAnimation(
    layer,
    PIX_GRID_BUILT_IN_ASSET_BY_ID.get(layer.assetId)!,
    frame,
    1,
  )
}

function frameCycle(overrides: Partial<PixGridLayerAnimation> = {}): PixGridLayerAnimation {
  return {
    mode: 'frameCycle',
    clock: 'bar',
    speed: 1,
    amount: 1,
    phase: 0,
    boundary: 'wrap',
    frameTransition: {
      type: 'crossfade',
      durationFraction: 0.25,
      easing: 'linear',
      seedMode: 'frame',
    },
    ...overrides,
  }
}

describe('generic PixGrid cell transition grammar', () => {
  it('resolves every supported transition deterministically', () => {
    const types = ['cut', 'crossfade', 'pixelDissolve', 'rowWipe', 'columnWipe', 'checkerWipe', 'radialReveal', 'paletteFade', 'powerOn', 'powerOff'] as const
    for (const type of types) {
      const first = Array.from({ length: 32 }, (_, index) => (
        pixGridCellTransitionMix(type, index % 8, Math.floor(index / 8), 8, 4, 0.5, 917)
      ))
      const second = Array.from({ length: 32 }, (_, index) => (
        pixGridCellTransitionMix(type, index % 8, Math.floor(index / 8), 8, 4, 0.5, 917)
      ))
      expect(second).toEqual(first)
      expect(first.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true)
    }
  })

  it('keeps power transitions coherent across the whole frame', () => {
    for (const type of ['powerOn', 'powerOff'] as const) {
      const values = Array.from({ length: 512 }, (_, index) => (
        pixGridCellTransitionMix(type, index % 32, Math.floor(index / 32), 32, 16, 0.5, 917)
      ))
      expect(new Set(values)).toEqual(new Set([0.5]))
    }
  })
})

describe('generic PixGrid frame-cycle transitions', () => {
  it('advances from the shared bar clock and crossfades between adjacent frames', () => {
    const layer = frameLayer(frameCycle())
    const result = resolve(layer, audio({ motionClockBar: 1.125 }))

    expect(result.previousFrameIndex).toBe(0)
    expect(result.frameIndex).toBe(1)
    expect(result.frameTransitionType).toBe('crossfade')
    expect(result.frameTransitionProgress).toBeCloseTo(0.5, 6)
    expect(result.frameTransitionCompletedState).toBe('target')
  })

  it('honors section-authored overrides without a preset-specific clock', () => {
    const layer = frameLayer(frameCycle({
      sectionFrameTransitions: {
        drop: {
          type: 'columnWipe',
          durationFraction: 0.5,
          easing: 'linear',
          seedMode: 'section',
          direction: 'reverse',
        },
      },
    }))
    const result = resolve(layer, audio({
      sectionType: 'drop',
      motionClockSectionType: 'drop',
      motionClockBar: 2.25,
      sectionOccurrence: 2,
    }))

    expect(result.frameTransitionType).toBe('columnWipe')
    expect(result.frameTransitionDirection).toBe('reverse')
    expect(result.frameTransitionProgress).toBeCloseTo(0.5, 6)
  })

  it('reconstructs on-section-entry power transitions from the section clock', () => {
    const layer = frameLayer(frameCycle({
      speed: 0,
      frameTransition: {
        type: 'powerOn',
        durationFraction: 0.5,
        easing: 'linear',
        seedMode: 'section',
        onSectionEntry: true,
      },
    }))
    const result = resolve(layer, audio({
      motionClockSectionBar: 0.25,
      barsSinceSectionStart: 0.25,
    }))

    expect(result.frameTransitionType).toBe('powerOn')
    expect(result.frameTransitionOnSectionEntry).toBe(true)
    expect(result.frameTransitionProgress).toBeCloseTo(0.5, 6)
  })

  it('preserves transparent hold-after-completion semantics for generic power-off', () => {
    const layer = frameLayer(frameCycle({
      speed: 0,
      frameTransition: {
        type: 'powerOff',
        durationFraction: 0.5,
        easing: 'linear',
        seedMode: 'section',
        onSectionEntry: true,
        holdAfterCompletion: true,
      },
    }))
    const result = resolve(layer, audio({
      motionClockSectionBar: 0.75,
      barsSinceSectionStart: 0.75,
    }))

    expect(result.frameTransitionProgress).toBe(1)
    expect(result.frameTransitionCompletedState).toBe('transparent')
  })

  it('keeps transition seeds deterministic across seek reconstruction', () => {
    const layer = frameLayer(frameCycle())
    const first = resolve(layer, audio({ motionClockBar: 3.125 }))
    const repeated = resolve(layer, audio({ motionClockBar: 3.125, timingDiscontinuity: true }))

    expect(repeated).toEqual(first)
  })
})
