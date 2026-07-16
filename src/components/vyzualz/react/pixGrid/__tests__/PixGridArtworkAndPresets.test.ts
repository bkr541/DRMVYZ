import { describe, expect, it } from 'vitest'
import { fingerprintReactPresetThumbnail } from '../../renderers/ReactPresetThumbnailRenderer'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import {
  PIX_GRID_BUILT_IN_ASSET_BY_ID,
  PIX_GRID_BUILT_IN_ASSETS,
} from '../PixGridArtwork'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import {
  MAX_PIX_GRID_ANIMATIONS_PER_LAYER,
  MAX_PIX_GRID_LAYERS,
  MAX_PIX_GRID_VISIBLE_LAYERS,
} from '../PixGridLimits'
import { PIX_GRID_PRESETS } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import type {
  PixGridAudioFrame,
  PixGridLayer,
  PixGridQualityTier,
  PixGridState,
} from '../PixGridTypes'
import { normalizePixGridLayers, normalizePixGridState } from '../PixGridValidation'

const FRAME: PixGridAudioFrame = {
  audioTime: 12.75,
  bass: 0.82,
  mid: 0.54,
  high: 0.36,
  volume: 0.7,
  beatHit: true,
  kickHit: true,
  snareHit: false,
  hatHit: false,
  beatPhase: 0.04,
  beatIndex: 36,
  isPlaying: true,
}

const AUTHORED_SECTION_TYPES = ['intro', 'verse', 'build', 'drop', 'breakdown', 'outro'] as const

function cloneLayer(layer: PixGridLayer, overrides: Partial<PixGridLayer> = {}): PixGridLayer {
  return {
    ...layer,
    position: { ...layer.position },
    scale: { ...layer.scale },
    paletteMap: { ...layer.paletteMap },
    animations: layer.animations.map(animation => ({ ...animation })),
    ...(layer.audioReactivity ? { audioReactivity: { ...layer.audioReactivity } } : {}),
    ...overrides,
  }
}

function stateForPreset(index: number, section = 'drop', quality: PixGridQualityTier = 'low'): PixGridState {
  const preset = PIX_GRID_PRESETS[index]
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
  const sceneId = preset.sectionMappings.find(mapping => mapping.sectionType === section)?.sceneId ?? null
  return normalizePixGridState({ ...applied, quality, selectedSceneId: sceneId })
}

function frameHash(pixels: Uint8Array): number {
  let hash = 2_166_136_261
  for (const value of pixels) {
    hash ^= value
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

function alphaCount(pixels: Uint8Array): number {
  let count = 0
  for (let offset = 3; offset < pixels.length; offset += 4) {
    if (pixels[offset] > 0) count += 1
  }
  return count
}

function alphaCountInColumns(pixels: Uint8Array, width: number, height: number, start: number, end: number): number {
  let count = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = start; x < end; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 0) count += 1
    }
  }
  return count
}

function alphaBounds(pixels: Uint8Array, width: number, height: number) {
  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  return { minX, maxX, minY, maxY }
}

describe('PixGrid built-in artwork manifest', () => {
  it('contains a typed, unique, internally generated starter library', () => {
    const ids = PIX_GRID_BUILT_IN_ASSETS.map(asset => asset.id)
    expect(PIX_GRID_BUILT_IN_ASSETS).toHaveLength(15)
    expect(new Set(ids).size).toBe(ids.length)
    expect(PIX_GRID_BUILT_IN_ASSET_BY_ID.size).toBe(ids.length)

    for (const asset of PIX_GRID_BUILT_IN_ASSETS) {
      expect(asset.name.trim()).not.toBe('')
      expect(asset.nativeSize.width).toBeGreaterThan(0)
      expect(asset.nativeSize.height).toBeGreaterThan(0)
      expect(asset.aspectRatio).toBeCloseTo(asset.nativeSize.width / asset.nativeSize.height, 8)
      expect(asset.defaultPaletteRoles.length).toBeGreaterThan(0)
      expect(asset.animationCapabilities).toContain('static')
      if (asset.kind === 'frameBased' || asset.animationCapabilities.includes('frameCycle')) {
        expect(asset.frameCount).toBeGreaterThan(1)
      }
    }

    const serialized = JSON.stringify(PIX_GRID_BUILT_IN_ASSETS).toLowerCase()
    for (const forbidden of ['http://', 'https://', 'data:image', 'mario', 'pac-man', 'pokemon', 'sonic']) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it('keeps every preset layer and optional mask bound to a manifest asset', () => {
    for (const preset of PIX_GRID_PRESETS) {
      const layers = preset.pixGridSettings?.layers ?? []
      expect(layers.length).toBeGreaterThan(0)
      for (const layer of layers) {
        expect(PIX_GRID_BUILT_IN_ASSET_BY_ID.has(layer.assetId)).toBe(true)
        if (layer.maskAssetId) expect(PIX_GRID_BUILT_IN_ASSET_BY_ID.has(layer.maskAssetId)).toBe(true)
      }
    }
  })
})

describe('PixGrid bounded compositor inputs', () => {
  it('enforces total, visible, and per-layer animation ceilings', () => {
    const template = PIX_GRID_PRESETS[0].pixGridSettings!.layers![0]
    const oversized = Array.from({ length: MAX_PIX_GRID_LAYERS + 4 }, (_, index) => cloneLayer(template, {
      id: `limit-layer-${index}`,
      visible: true,
      animations: Array.from({ length: MAX_PIX_GRID_ANIMATIONS_PER_LAYER + 3 }, (__, animationIndex) => ({
        mode: 'pulse' as const,
        speed: animationIndex + 1,
        amount: 0.1,
        phase: 0,
        boundary: 'clamp' as const,
      })),
    }))
    const normalized = normalizePixGridLayers(oversized, [])

    expect(normalized).toHaveLength(MAX_PIX_GRID_LAYERS)
    expect(normalized.filter(layer => layer.visible)).toHaveLength(MAX_PIX_GRID_VISIBLE_LAYERS)
    expect(normalized.every(layer => layer.animations.length <= MAX_PIX_GRID_ANIMATIONS_PER_LAYER)).toBe(true)
  })

  it('clips still layers at the logical edge and wraps them only when requested', () => {
    const sourcePreset = PIX_GRID_PRESETS[1]
    const template = sourcePreset.pixGridSettings!.layers![0]
    const edgeLayer = cloneLayer(template, {
      id: 'edge-checker',
      assetId: 'pix-checkerboard',
      position: { x: 0.96, y: 0.5 },
      scale: { x: 0.3, y: 0.6 },
      animations: [],
      audioReactivity: undefined,
      blendMode: 'normal',
      opacity: 1,
      densityRank: 0,
    })
    const baseState = normalizePixGridState({
      ...stateForPreset(1),
      selectedSceneId: null,
      layers: [cloneLayer(edgeLayer, { clipMode: 'clip' })],
    })
    const clipped = composePixGridLogicalFrame(sourcePreset, baseState, FRAME)
    const wrapped = composePixGridLogicalFrame(sourcePreset, {
      ...baseState,
      layers: [cloneLayer(edgeLayer, { clipMode: 'wrap' })],
    }, FRAME)

    expect(alphaCountInColumns(clipped.pixels, clipped.width, clipped.height, 0, 8)).toBe(0)
    expect(alphaCountInColumns(wrapped.pixels, wrapped.width, wrapped.height, 0, 8)).toBeGreaterThan(0)
    expect(alphaCount(wrapped.pixels)).toBeGreaterThan(alphaCount(clipped.pixels))
  })
})

describe('PixGrid deterministic animation', () => {
  it('reconstructs identical seek and pause frames from audio time alone', () => {
    const preset = PIX_GRID_PRESETS[2]
    const state = stateForPreset(2)
    const firstAtA = composePixGridLogicalFrame(preset, state, { ...FRAME, audioTime: 8.25 })
    const atB = composePixGridLogicalFrame(preset, state, { ...FRAME, audioTime: 19.5 })
    const secondAtA = composePixGridLogicalFrame(preset, state, { ...FRAME, audioTime: 8.25 })
    const pausedAtA = composePixGridLogicalFrame(preset, state, { ...FRAME, audioTime: 8.25, isPlaying: false })

    expect(frameHash(firstAtA.pixels)).toBe(frameHash(secondAtA.pixels))
    expect(frameHash(firstAtA.pixels)).toBe(frameHash(pausedAtA.pixels))
    expect(frameHash(atB.pixels)).not.toBe(frameHash(firstAtA.pixels))
  })

  it('steps beat movement from the canonical beat index rather than render cadence', () => {
    const asset = PIX_GRID_BUILT_IN_ASSET_BY_ID.get('pix-five-point-star')!
    const source = PIX_GRID_PRESETS[2].pixGridSettings!.layers!.find(layer => layer.assetId === asset.id)!
    const layer = cloneLayer(source, {
      animations: [{ mode: 'beatStepMovement', speed: 1, amount: 0.08, phase: 0, boundary: 'wrap', axis: 'x' }],
    })
    const earlyInBeat = resolvePixGridLayerAnimation(layer, asset, { ...FRAME, audioTime: 8.01, beatIndex: 24 }, 1)
    const lateInBeat = resolvePixGridLayerAnimation(layer, asset, { ...FRAME, audioTime: 8.49, beatIndex: 24 }, 1)
    const nextBeat = resolvePixGridLayerAnimation(layer, asset, { ...FRAME, audioTime: 8.51, beatIndex: 25 }, 1)

    expect(lateInBeat.positionX).toBe(earlyInBeat.positionX)
    expect(nextBeat.positionX).not.toBe(earlyInBeat.positionX)
  })

  it('keeps frame cycles in bounds for negative phases and arbitrary seek times', () => {
    const asset = PIX_GRID_BUILT_IN_ASSET_BY_ID.get('pix-mascot-face')!
    const source = PIX_GRID_PRESETS[2].pixGridSettings!.layers!.find(layer => layer.assetId === asset.id)!
    const layer = cloneLayer(source, {
      animations: [{ mode: 'frameCycle', speed: 3, amount: 1, phase: -13.75, boundary: 'wrap' }],
    })

    for (const audioTime of [0, 0.001, 2.5, 9999.25]) {
      const resolved = resolvePixGridLayerAnimation(layer, asset, { ...FRAME, audioTime }, 1)
      expect(resolved.frameIndex).toBeGreaterThanOrEqual(0)
      expect(resolved.frameIndex).toBeLessThan(asset.frameCount!)
    }
  })
})

describe('PixGrid finished presets', () => {
  it('authors six meaningfully different section mappings for every preset', () => {
    for (const preset of PIX_GRID_PRESETS) {
      expect(preset.sectionMappings.map(mapping => mapping.sectionType)).toEqual(AUTHORED_SECTION_TYPES)
      const settings = preset.pixGridSettings!.sceneSettings!
      const mappedSettings = preset.sectionMappings.map(mapping => settings[mapping.sceneId])
      expect(mappedSettings.every(Boolean)).toBe(true)
      expect(new Set(mappedSettings.map(value => JSON.stringify(value))).size).toBeGreaterThanOrEqual(4)
    }
  })

  it('produces three unique drop compositions and thumbnail fingerprints', () => {
    const frameHashes = PIX_GRID_PRESETS.map((preset, index) => frameHash(
      composePixGridLogicalFrame(preset, stateForPreset(index), FRAME).pixels,
    ))
    const thumbnailFingerprints = PIX_GRID_PRESETS.map(fingerprintReactPresetThumbnail)

    expect(new Set(frameHashes).size).toBe(PIX_GRID_PRESETS.length)
    expect(new Set(thumbnailFingerprints).size).toBe(PIX_GRID_PRESETS.length)
  })

  it('routes kick, snare, and hat transients to distinct Bass Beacon roles', () => {
    const preset = PIX_GRID_PRESETS[0]
    const state = stateForPreset(0)
    const energy = (layerId: string, inactive: PixGridAudioFrame, active: PixGridAudioFrame) => {
      const source = preset.pixGridSettings!.layers!.find(layer => layer.id === layerId)!
      const isolated = normalizePixGridState({ ...state, selectedSceneId: 'test-isolated-scene', layers: [cloneLayer(source)] })
      const sum = (frame: PixGridAudioFrame) => composePixGridLogicalFrame(preset, isolated, frame).pixels
        .reduce((total, value) => total + value, 0)
      return [sum(inactive), sum(active)] as const
    }

    const quiet = { ...FRAME, beatHit: false, kickHit: false, snareHit: false, hatHit: false }
    const [kickQuiet, kickActive] = energy('bass-burst', quiet, { ...quiet, kickHit: true })
    const [snareQuiet, snareActive] = energy('bass-outline', quiet, { ...quiet, snareHit: true })
    const [hatQuiet, hatActive] = energy('bass-sparkles', quiet, { ...quiet, hatHit: true })

    expect(kickActive).toBeGreaterThan(kickQuiet)
    expect(snareActive).toBeGreaterThan(snareQuiet)
    expect(hatActive).toBeGreaterThan(hatQuiet)
  })

  it('keeps the central BASS word readable at both 96 × 54 and 160 × 90', () => {
    const preset = PIX_GRID_PRESETS[0]
    const word = preset.pixGridSettings!.layers!.find(layer => layer.id === 'bass-word')!

    for (const quality of ['low', 'high'] as const) {
      const state = normalizePixGridState({
        ...stateForPreset(0, 'drop', quality),
        selectedSceneId: null,
        layers: [cloneLayer(word, { animations: [], audioReactivity: undefined })],
      })
      const logical = composePixGridLogicalFrame(preset, state, { ...FRAME, beatHit: false })
      const bounds = alphaBounds(logical.pixels, logical.width, logical.height)
      expect(bounds.maxX - bounds.minX + 1).toBeGreaterThan(logical.width * 0.45)
      expect(bounds.maxY - bounds.minY + 1).toBeGreaterThan(logical.height * 0.2)
      expect(alphaCount(logical.pixels)).toBeGreaterThan(logical.width * 0.7)
    }
  })
})
