import type { ReactPalette, ReactPreset } from '../ReactTypes'
import { resolvePixGridLayerAnimation } from './PixGridAnimation'
import {
  PIX_GRID_BUILT_IN_ASSET_BY_ID,
  samplePixGridBuiltInAsset,
} from './PixGridArtwork'
import type {
  PixGridAudioFrame,
  PixGridAudioSource,
  PixGridBlendMode,
  PixGridLayer,
  PixGridPaletteRole,
  PixGridSceneSettings,
  PixGridState,
} from './PixGridTypes'
import { normalizePixGridState } from './PixGridValidation'
import { MAX_PIX_GRID_VISIBLE_LAYERS } from './PixGridLimits'
import type { PixGridPreparedAsset } from './PixGridAssetPreparation'
import { unpackPixGridOverride } from './PixGridAuthoring'

export interface PixGridLogicalFrame {
  width: number
  height: number
  pixels: Uint8Array
  visibleLayerCount: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function fract(value: number): number {
  return value - Math.floor(value)
}

function hexToRgb(hex: string): readonly [number, number, number] {
  const safe = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#ffffff'
  return [
    Number.parseInt(safe.slice(1, 3), 16),
    Number.parseInt(safe.slice(3, 5), 16),
    Number.parseInt(safe.slice(5, 7), 16),
  ]
}

function roleOrder(role: PixGridPaletteRole): number {
  if (role === 'secondary') return 1
  if (role === 'accent') return 2
  if (role === 'highlight') return 3
  if (role === 'background') return 4
  return 0
}

const PALETTE_ROLES: readonly PixGridPaletteRole[] = ['primary', 'secondary', 'accent', 'highlight', 'background']

function resolveRole(layer: PixGridLayer, source: PixGridPaletteRole, offset: number): PixGridPaletteRole {
  const mapped = layer.paletteMap[source] ?? source
  const index = (roleOrder(mapped) + Math.round(offset)) % PALETTE_ROLES.length
  return PALETTE_ROLES[index < 0 ? index + PALETTE_ROLES.length : index]
}

function resolveColor(palette: ReactPalette, role: PixGridPaletteRole): readonly [number, number, number] {
  return hexToRgb(palette[role])
}

function audioValue(frame: PixGridAudioFrame, source: PixGridAudioSource): number {
  if (source === 'kick') return (frame.kickHit ?? frame.beatHit) ? 1 : 0
  if (source === 'snare') return frame.snareHit ? 1 : 0
  if (source === 'hat') return frame.hatHit ? 1 : 0
  if (source === 'mid') return clamp01(frame.mid)
  if (source === 'high') return clamp01(frame.high)
  if (source === 'volume') return clamp01(frame.volume)
  return clamp01(frame.bass)
}

function sceneFor(preset: ReactPreset, state: PixGridState): PixGridSceneSettings {
  const fallback: PixGridSceneSettings = { density: 1, motionMultiplier: 1, paletteOffset: 0 }
  const sceneId = state.selectedSceneId
  return sceneId ? preset.pixGridSettings?.sceneSettings?.[sceneId] ?? fallback : fallback
}

function effectiveOpacity(layer: PixGridLayer, scene: PixGridSceneSettings, frame: PixGridAudioFrame): number {
  let opacity = scene.layerOpacity?.[layer.id] ?? layer.opacity
  const reactive = layer.audioReactivity
  if (reactive?.brightnessSource && reactive.brightnessAmount != null) {
    const level = audioValue(frame, reactive.brightnessSource)
    opacity *= clamp01(1 - reactive.brightnessAmount + level * reactive.brightnessAmount * 1.35)
  }
  if (reactive?.beatImpact) {
    const beat = frame.beatHit ? 1 : Math.max(0, 1 - frame.beatPhase * 4)
    opacity *= 1 + beat * reactive.beatImpact
  }
  return clamp01(opacity)
}

function effectiveScale(layer: PixGridLayer, frame: PixGridAudioFrame): number {
  const reactive = layer.audioReactivity
  if (!reactive?.scaleSource || reactive.scaleAmount == null) return 1
  return 1 + audioValue(frame, reactive.scaleSource) * reactive.scaleAmount
}

function blendPixel(
  pixels: Uint8Array,
  offset: number,
  source: readonly [number, number, number],
  alpha: number,
  mode: PixGridBlendMode,
): void {
  const a = clamp01(alpha)
  if (a <= 0) return
  const dr = pixels[offset]
  const dg = pixels[offset + 1]
  const db = pixels[offset + 2]
  const da = pixels[offset + 3] / 255
  const [sr, sg, sb] = source

  if (mode === 'add') {
    pixels[offset] = Math.min(255, Math.round(dr + sr * a))
    pixels[offset + 1] = Math.min(255, Math.round(dg + sg * a))
    pixels[offset + 2] = Math.min(255, Math.round(db + sb * a))
    pixels[offset + 3] = Math.round(Math.max(da, a) * 255)
    return
  }

  if (mode === 'multiply' && da > 0) {
    pixels[offset] = Math.round(dr * (1 - a + (sr / 255) * a))
    pixels[offset + 1] = Math.round(dg * (1 - a + (sg / 255) * a))
    pixels[offset + 2] = Math.round(db * (1 - a + (sb / 255) * a))
    pixels[offset + 3] = Math.round(Math.max(da, a) * 255)
    return
  }

  const outAlpha = a + da * (1 - a)
  const denominator = Math.max(0.0001, outAlpha)
  pixels[offset] = Math.round((sr * a + dr * da * (1 - a)) / denominator)
  pixels[offset + 1] = Math.round((sg * a + dg * da * (1 - a)) / denominator)
  pixels[offset + 2] = Math.round((sb * a + db * da * (1 - a)) / denominator)
  pixels[offset + 3] = Math.round(outAlpha * 255)
}

function localCoordinates(
  outputU: number,
  outputV: number,
  layer: PixGridLayer,
  positionX: number,
  positionY: number,
  scaleX: number,
  scaleY: number,
  rotationDegrees: number,
): readonly [number, number] {
  const dx = outputU - positionX
  const dy = outputV - positionY
  const radians = -rotationDegrees * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const rotatedX = dx * cosine - dy * sine
  const rotatedY = dx * sine + dy * cosine
  let u = rotatedX / Math.max(0.001, scaleX) + 0.5
  let v = rotatedY / Math.max(0.001, scaleY) + 0.5
  if (layer.clipMode === 'wrap') {
    u = fract(u)
    v = fract(v)
  }
  if (layer.flipX) u = 1 - u
  if (layer.flipY) v = 1 - v
  return [u, v]
}

function renderLayer(
  pixels: Uint8Array,
  width: number,
  height: number,
  layer: PixGridLayer,
  palette: ReactPalette,
  frame: PixGridAudioFrame,
  scene: PixGridSceneSettings,
): void {
  const asset = PIX_GRID_BUILT_IN_ASSET_BY_ID.get(layer.assetId)
  if (!asset) return
  const animation = resolvePixGridLayerAnimation(layer, asset, frame, scene.motionMultiplier)
  const audioScale = effectiveScale(layer, frame)
  const scaleX = animation.scaleX * audioScale
  const scaleY = animation.scaleY * audioScale
  const layerOpacity = clamp01(animation.opacity * effectiveOpacity(layer, scene, frame))
  if (layerOpacity <= 0) return

  for (let y = 0; y < height; y += 1) {
    const outputV = (y + 0.5) / height
    for (let x = 0; x < width; x += 1) {
      const outputU = (x + 0.5) / width
      const [u, v] = localCoordinates(
        outputU,
        outputV,
        layer,
        animation.positionX,
        animation.positionY,
        scaleX,
        scaleY,
        animation.rotation,
      )
      if (layer.clipMode === 'clip' && (u < 0 || u >= 1 || v < 0 || v >= 1)) continue
      if (v > animation.revealRow || u > animation.revealColumn) continue
      if (animation.checkerAlternate && (Math.floor(u * asset.nativeSize.width) + Math.floor(v * asset.nativeSize.height)) % 2 !== 0) continue

      const sample = samplePixGridBuiltInAsset(layer.assetId, u, v, animation.frameIndex, layer.seed)
      if (sample.alpha <= 0) continue
      let alpha = sample.alpha * layerOpacity
      if (layer.maskAssetId) {
        alpha *= samplePixGridBuiltInAsset(layer.maskAssetId, u, v, animation.frameIndex, layer.seed + 101).alpha
      }
      if (alpha <= 0) continue
      const role = resolveRole(layer, sample.role, scene.paletteOffset + animation.paletteOffset)
      const color = resolveColor(palette, role)
      blendPixel(pixels, (y * width + x) * 4, color, alpha, layer.blendMode)
    }
  }
}

function renderPreparedAssetLayer(
  pixels: Uint8Array,
  width: number,
  height: number,
  layer: PixGridLayer,
  preparedAsset: PixGridPreparedAsset,
  frame: PixGridAudioFrame,
  scene: PixGridSceneSettings,
): void {
  const animation = resolvePixGridLayerAnimation(layer, PIX_GRID_BUILT_IN_ASSET_BY_ID.get(layer.assetId)!, frame, scene.motionMultiplier)
  const audioScale = effectiveScale(layer, frame)
  const scaleX = animation.scaleX * audioScale
  const scaleY = animation.scaleY * audioScale
  const opacity = clamp01(animation.opacity * effectiveOpacity(layer, scene, frame))
  if (opacity <= 0) return
  for (let y = 0; y < height; y += 1) {
    const outputV = (y + 0.5) / height
    for (let x = 0; x < width; x += 1) {
      const outputU = (x + 0.5) / width
      const [u, v] = localCoordinates(outputU, outputV, layer, animation.positionX, animation.positionY, scaleX, scaleY, animation.rotation)
      if (layer.clipMode === 'clip' && (u < 0 || u >= 1 || v < 0 || v >= 1)) continue
      const sx = Math.max(0, Math.min(preparedAsset.width - 1, Math.floor(u * preparedAsset.width)))
      const sy = Math.max(0, Math.min(preparedAsset.height - 1, Math.floor(v * preparedAsset.height)))
      const sourceOffset = (sy * preparedAsset.width + sx) * 4
      const alpha = preparedAsset.pixels[sourceOffset + 3] / 255 * opacity
      if (alpha <= 0) continue
      blendPixel(pixels, (y * width + x) * 4, [
        preparedAsset.pixels[sourceOffset],
        preparedAsset.pixels[sourceOffset + 1],
        preparedAsset.pixels[sourceOffset + 2],
      ], alpha, layer.blendMode)
    }
  }
}

function isPreparedAsset(source: PixGridPreparedAsset | ReadonlyMap<string, PixGridPreparedAsset>): source is PixGridPreparedAsset {
  return 'mediaId' in source
}

function preparedAssetFor(
  source: PixGridPreparedAsset | ReadonlyMap<string, PixGridPreparedAsset> | null | undefined,
  mediaId: string,
): PixGridPreparedAsset | null {
  if (!source) return null
  if (isPreparedAsset(source)) return source.mediaId === mediaId ? source : null
  return source.get(mediaId) ?? null
}

export function composePixGridLogicalFrame(
  preset: ReactPreset,
  rawState: PixGridState,
  frame: PixGridAudioFrame,
  reusable?: Uint8Array,
  preparedAsset?: PixGridPreparedAsset | ReadonlyMap<string, PixGridPreparedAsset> | null,
): PixGridLogicalFrame {
  const state = normalizePixGridState(rawState)
  const width = state.matrixWidth
  const height = state.matrixHeight
  const required = width * height * 4
  const pixels = reusable?.length === required ? reusable : new Uint8Array(required)
  pixels.fill(0)
  const scene = sceneFor(preset, state)
  const hidden = new Set(scene.hiddenLayerIds ?? [])
  const activeScene = state.scenes.find(candidate => candidate.id === state.selectedSceneId) ?? state.scenes[0]
  const orderedLayerIds = activeScene?.layerIds ?? state.layers.map(layer => layer.id)
  const activeLayerIds = new Set(orderedLayerIds)
  const layerOrder = new Map(orderedLayerIds.map((id, index) => [id, index]))
  const visibleLayers = state.layers
    .filter(layer => activeLayerIds.has(layer.id) && layer.visible && !hidden.has(layer.id) && layer.densityRank <= scene.density)
    .sort((a, b) => (layerOrder.get(a.id) ?? a.zIndex) - (layerOrder.get(b.id) ?? b.zIndex) || a.id.localeCompare(b.id))
    .slice(0, MAX_PIX_GRID_VISIBLE_LAYERS)

  for (const layer of visibleLayers) {
    const mediaAsset = layer.mediaId ? preparedAssetFor(preparedAsset, layer.mediaId) : null
    if (mediaAsset) renderPreparedAssetLayer(pixels, width, height, layer, mediaAsset, frame, scene)
    else if (!layer.mediaId) renderLayer(pixels, width, height, layer, preset.palette, frame, scene)
  }

  if (
    state.conversion.selectedMediaId
    && preparedAsset != null
    && isPreparedAsset(preparedAsset)
    && preparedAsset.mediaId === state.conversion.selectedMediaId
    && preparedAsset.width === width
    && preparedAsset.height === height
  ) {
    for (let offset = 0; offset < preparedAsset.pixels.length; offset += 4) {
      const alpha = preparedAsset.pixels[offset + 3] / 255
      if (alpha <= 0) continue
      blendPixel(
        pixels,
        offset,
        [preparedAsset.pixels[offset], preparedAsset.pixels[offset + 1], preparedAsset.pixels[offset + 2]],
        alpha,
        'normal',
      )
    }
  }

  const overrides = activeScene?.pixelOverrides ?? state.pixelOverrides
  for (const override of overrides) {
    const [x, y, mode, color, opacity] = unpackPixGridOverride(override)
    const offset = (y * width + x) * 4
    if (mode === 0) {
      pixels[offset] = 0
      pixels[offset + 1] = 0
      pixels[offset + 2] = 0
      pixels[offset + 3] = 0
      continue
    }
    blendPixel(pixels, offset, hexToRgb(color), opacity, 'normal')
  }

  return { width, height, pixels, visibleLayerCount: visibleLayers.length }
}
