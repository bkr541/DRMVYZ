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
import { pixGridNeonMarqueeComponentContainsCell } from '../PixGridNeonMarqueeMasks'
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
    rgba[cell * 4 + 3] = rgb[cell * 3] || rgb[cell * 3 + 1] || rgb[cell * 3 + 2] ? 255 : 0
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

  it('keeps the source frame exact while exposing the Stage 1 layered canonical graph', () => {
    const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)
    expect(preset).toBeDefined()
    const applied = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, preset?.pixGridSettings)
    const state = { ...applied, selectedSceneId: `${PRESET_ID}-drop` }

    expect(state.quality).toBe('high')
    expect(state.qualityMode).toBe('fixed')
    expect(state.matrixWidth).toBe(160)
    expect(state.matrixHeight).toBe(90)
    expect(state.performance.enabled).toBe(true)
    expect(state.performance.sharedPerformanceProgramId).toBe('pix-grid-neon-marquee-performance')
    expect(state.layers).toHaveLength(12)
    expect(state.groups).toHaveLength(14)
    expect(state.layers.map(layer => layer.id)).not.toContain('neon-marquee-frame')
    expect(state.layers[0]).toMatchObject({
      id: 'marquee-structure',
      assetId: 'pix-neon-marquee-structure',
      position: { x: 0.5, y: 0.5 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      opacity: 1,
      blendMode: 'normal',
      animations: [{ mode: 'frameCycle', clock: 'sectionBar', speed: 1, amount: 1, stepped: true }],
    })

    const logical = composePixGridLogicalFrame(preset!, state, STATIC_FRAME)
    const source = rgbaFromRgb(getPixGridNeonMarqueeFrames()[0])
    let structureMismatches = 0
    let authoredLightDifferences = 0
    for (let cell = 0; cell < PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT; cell += 1) {
      const x = cell % PIX_GRID_NEON_MARQUEE_FRAME_WIDTH
      const y = Math.floor(cell / PIX_GRID_NEON_MARQUEE_FRAME_WIDTH)
      const offset = cell * 4
      const differs = logical.pixels[offset] !== source[offset]
        || logical.pixels[offset + 1] !== source[offset + 1]
        || logical.pixels[offset + 2] !== source[offset + 2]
        || logical.pixels[offset + 3] !== source[offset + 3]
      if (pixGridNeonMarqueeComponentContainsCell('structure', 0, x, y)) {
        if (differs) structureMismatches += 1
      } else if (differs) authoredLightDifferences += 1
    }
    expect(logical.width).toBe(160)
    expect(logical.height).toBe(90)
    expect(structureMismatches).toBe(0)
    expect(authoredLightDifferences).toBeGreaterThan(0)
    expect(validatePixGridState(state, { builtInPresetId: PRESET_ID }).errors).toEqual([])
  })

  it('exposes all four distinct source frames through nearest-cell built-in sampling', () => {
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
