import { describe, expect, it } from 'vitest'
import { DEFAULT_REACT_PRESETS } from '../../ReactTypes'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID, samplePixGridBuiltInAsset } from '../PixGridArtwork'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import {
  getPixGridNeonMarqueeFrames,
  PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT,
  PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT,
  PIX_GRID_NEON_MARQUEE_FRAME_ORDER,
  PIX_GRID_NEON_MARQUEE_FRAME_WIDTH,
} from '../PixGridNeonMarqueeFrames'
import { PIX_GRID_PRESET_BY_ID, PIX_GRID_PRESET_IDS } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import type { PixGridAudioFrame } from '../PixGridTypes'
import { validatePixGridState } from '../PixGridValidationAudit'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const ASSET_ID = 'pix-neon-marquee-cycle'
const EXPECTED_RGB_HASHES = [1_258_759_203, 1_052_486_525, 1_066_057_709, 3_831_826_189] as const

const STATIC_FRAME: PixGridAudioFrame = {
  audioTime: 0,
  bass: 0,
  mid: 0,
  high: 0,
  volume: 0,
  beatHit: false,
  beatPhase: 0,
  isPlaying: false,
}

function fnv1a(bytes: Uint8Array): number {
  let hash = 2_166_136_261
  for (const value of bytes) {
    hash ^= value
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

function rgbaFromRgb(rgb: Uint8Array): Uint8Array {
  const rgba = new Uint8Array(PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT * 4)
  for (let cell = 0; cell < PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT; cell += 1) {
    rgba[cell * 4] = rgb[cell * 3]
    rgba[cell * 4 + 1] = rgb[cell * 3 + 1]
    rgba[cell * 4 + 2] = rgb[cell * 3 + 2]
    rgba[cell * 4 + 3] = 255
  }
  return rgba
}

describe('PixGrid Neon Marquee Cycle native preset foundation', () => {
  it('registers a fixed High-quality built-in preset and native four-frame asset', () => {
    expect(PIX_GRID_PRESET_IDS).toContain(PRESET_ID)
    expect(DEFAULT_REACT_PRESETS.some(preset => preset.id === PRESET_ID && preset.engine === 'pixGrid')).toBe(true)

    const asset = PIX_GRID_BUILT_IN_ASSET_BY_ID.get(ASSET_ID)
    expect(asset).toMatchObject({
      nativeSize: { width: 160, height: 90 },
      kind: 'frameBased',
      frameCount: 4,
    })
    expect(asset?.animationCapabilities).toContain('frameCycle')
    expect(PIX_GRID_NEON_MARQUEE_FRAME_ORDER.map(frame => frame.id)).toEqual(['base', 'rise', 'peak', 'release'])
  })

  it('decodes four exact 160 × 90 opaque RGB logical frames in deterministic order', () => {
    const frames = getPixGridNeonMarqueeFrames()
    expect(frames).toHaveLength(4)
    expect(PIX_GRID_NEON_MARQUEE_FRAME_WIDTH).toBe(160)
    expect(PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT).toBe(90)
    expect(PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT).toBe(14_400)

    expect(frames.map(frame => frame.length)).toEqual([43_200, 43_200, 43_200, 43_200])
    expect(frames.map(fnv1a)).toEqual(EXPECTED_RGB_HASHES)
    expect(new Set(frames.map(fnv1a)).size).toBe(4)
  })

  it('keeps the Stage 1 native frame exact at the stopped baseline while attaching Stage 2 programming', () => {
    const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)
    expect(preset).toBeDefined()
    const state = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, preset?.pixGridSettings)
    const layer = state.layers[0]

    expect(state.quality).toBe('high')
    expect(state.qualityMode).toBe('fixed')
    expect(state.matrixWidth).toBe(160)
    expect(state.matrixHeight).toBe(90)
    expect(state.performance.enabled).toBe(false)
    expect(state.performance.sharedPerformanceProgramId).toBeNull()
    expect(state.groups).toEqual([])
    expect(state.audioAssignments.map(assignment => assignment.id)).toEqual([
      'neon-marquee-bass-breath',
      'neon-marquee-build-lift',
      'neon-marquee-kick-impact',
      'neon-marquee-snare-edge',
      'neon-marquee-downbeat-structure',
      'neon-marquee-drop-impact',
    ])
    expect(layer).toMatchObject({
      assetId: ASSET_ID,
      position: { x: 0.5, y: 0.5 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      opacity: 1,
      blendMode: 'normal',
      animations: [{ mode: 'frameCycle', clock: 'beat', speed: 1, amount: 1, stepped: true }],
    })

    const logical = composePixGridLogicalFrame(preset!, state, STATIC_FRAME)
    expect(logical.width).toBe(160)
    expect(logical.height).toBe(90)
    expect(logical.pixels).toEqual(rgbaFromRgb(getPixGridNeonMarqueeFrames()[0]))
    expect(validatePixGridState(state, { builtInPresetId: PRESET_ID }).errors).toEqual([])
  })

  it('exposes all four distinct frames through nearest-cell built-in sampling for Stage 2', () => {
    const sampleCoordinates = [
      [0.1, 0.1],
      [0.5, 0.5],
      [0.82, 0.42],
      [0.63, 0.78],
    ] as const

    const signatures = [0, 1, 2, 3].map(frameIndex => sampleCoordinates.map(([u, v]) => {
      const sample = samplePixGridBuiltInAsset(ASSET_ID, u, v, frameIndex)
      return `${sample.alpha}:${sample.color?.join(',')}`
    }).join('|'))

    expect(new Set(signatures).size).toBe(4)
    expect(samplePixGridBuiltInAsset(ASSET_ID, 0.5, 0.5, 4).color)
      .toEqual(samplePixGridBuiltInAsset(ASSET_ID, 0.5, 0.5, 0).color)
  })
})
