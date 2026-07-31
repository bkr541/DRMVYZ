import type { ReactPalette, ReactPreset } from '../ReactTypes'
import { resolvePixGridLayerAnimation } from './PixGridAnimation'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID, samplePixGridBuiltInAsset, type PixGridAssetSample } from './PixGridArtwork'
import type {
  PixGridAudioFrame,
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
import { PixGridReactionRuntime, resolveLegacyPixGridLayerAudioReactivity } from './PixGridAudioRouting'
import { applyPixGridGroupReactions, resolvePixGridLayerReactionFrame } from './PixGridReactions'
import { pixGridMaskHasCell } from './PixGridGroups'
import { applyPixGridGroupFrameEffects, type PixGridGroupFrameEffect } from './PixGridFrameEffects'
import type { PixGridResolvedTransition } from './PixGridActionCues'
import { PixGridFrameGroupCompiler } from './PixGridGroupCompiler'
import {
  applyPixGridOutputAssignments,
  resolvePixGridAuthoredAssignmentState,
  resolvePixGridTransitionAssignment,
} from './PixGridAssignmentApplication'
import {
  applyPixGridVisualEffectStack,
  createPixGridVisualEffectScratch,
} from './PixGridVisualEffectStack'
import type { PixGridStructuralChoreography } from './PixGridStructuralChoreographer'
import { pixGridCellTransitionMix } from './PixGridCellTransitions'

export interface PixGridLogicalFrame {
  width: number
  height: number
  pixels: Uint8Array
  visibleLayerCount: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function composedLayerScale(authoredScale: number, audioScale: number): number {
  return authoredScale * audioScale
}

/**
 * Post-composite operators only need transient working memory, so a single
 * module-scoped scratch avoids per-frame allocation without holding frame state.
 */
const visualEffectScratch = createPixGridVisualEffectScratch()

function fract(value: number): number {
  return value - Math.floor(value)
}

function hexToRgb(hex: string): readonly [number, number, number] {
  const safe = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#ffffff'
  return [Number.parseInt(safe.slice(1, 3), 16), Number.parseInt(safe.slice(3, 5), 16), Number.parseInt(safe.slice(5, 7), 16)]
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

function sceneFor(preset: ReactPreset, state: PixGridState): PixGridSceneSettings {
  const fallback: PixGridSceneSettings = {
    density: 1,
    motionMultiplier: 1,
    paletteOffset: 0,
  }
  const sceneId = state.selectedSceneId
  return sceneId ? (preset.pixGridSettings?.sceneSettings?.[sceneId] ?? fallback) : fallback
}

function effectiveOpacity(layer: PixGridLayer, scene: PixGridSceneSettings, frame: PixGridAudioFrame): number {
  let opacity = scene.layerOpacity?.[layer.id] ?? layer.opacity
  const reactive = layer.audioReactivity
  if (reactive?.brightnessSource && reactive.brightnessAmount != null) {
    const response = resolveLegacyPixGridLayerAudioReactivity(frame, reactive.brightnessSource, reactive.brightnessAmount)
    opacity *= clamp01(1 - reactive.brightnessAmount + response * 1.35)
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
  return 1 + resolveLegacyPixGridLayerAudioReactivity(frame, reactive.scaleSource, reactive.scaleAmount)
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
  const radians = (-rotationDegrees * Math.PI) / 180
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

function revealContains(value: number, progress: number, from: 'start' | 'end' | 'center'): boolean {
  const amount = clamp01(progress)
  if (from === 'end') return value >= 1 - amount
  if (from === 'center') return Math.abs(value - 0.5) <= amount * 0.5
  return value <= amount
}

function sampleLayerFrame(
  layer: PixGridLayer,
  u: number,
  v: number,
  frameIndex: number,
): PixGridAssetSample {
  const sample = samplePixGridBuiltInAsset(layer.assetId, u, v, frameIndex, layer.seed)
  if (!layer.maskAssetId || sample.alpha <= 0) return sample
  const maskAlpha = samplePixGridBuiltInAsset(layer.maskAssetId, u, v, frameIndex, layer.seed + 101).alpha
  return maskAlpha >= 1 ? sample : { ...sample, alpha: sample.alpha * maskAlpha }
}

function transparentSample(reference: PixGridAssetSample): PixGridAssetSample {
  return { alpha: 0, role: reference.role, ...(reference.color ? { color: reference.color } : {}) }
}

function interpolateColor(
  source: readonly [number, number, number],
  target: readonly [number, number, number],
  mix: number,
): readonly [number, number, number] {
  return [
    Math.round(source[0] + (target[0] - source[0]) * mix),
    Math.round(source[1] + (target[1] - source[1]) * mix),
    Math.round(source[2] + (target[2] - source[2]) * mix),
  ]
}

function renderLayer(
  pixels: Uint8Array,
  width: number,
  height: number,
  layer: PixGridLayer,
  palette: ReactPalette,
  frame: PixGridAudioFrame,
  scene: PixGridSceneSettings,
  groupCompiler?: PixGridFrameGroupCompiler,
): void {
  const asset = PIX_GRID_BUILT_IN_ASSET_BY_ID.get(layer.assetId)
  if (!asset) return
  const animation = resolvePixGridLayerAnimation(layer, asset, frame, scene.motionMultiplier)
  const audioScale = effectiveScale(layer, frame)
  const scaleX = composedLayerScale(animation.scaleX, audioScale)
  const scaleY = composedLayerScale(animation.scaleY, audioScale)
  const finalLayerOpacity = effectiveOpacity(layer, scene, frame)
  const layerOpacity = clamp01(animation.opacity * finalLayerOpacity)

  for (let y = 0; y < height; y += 1) {
    const outputV = (y + 0.5) / height
    for (let x = 0; x < width; x += 1) {
      const outputU = (x + 0.5) / width
      const [u, v] = localCoordinates(outputU, outputV, layer, animation.positionX, animation.positionY, scaleX, scaleY, animation.rotation)
      if (layer.clipMode === 'clip' && (u < 0 || u >= 1 || v < 0 || v >= 1)) continue

      // Canonical semantic membership follows the resolved transform and sign
      // frame, but intentionally precedes blink, reveal, checker, and animated
      // opacity gates. Recruitment can therefore restore the exact component
      // color even while authored animation currently hides the cell.
      const canonicalSample = sampleLayerFrame(layer, u, v, animation.frameIndex)
      if (canonicalSample.alpha > 0) {
        const canonicalRole = resolveRole(layer, canonicalSample.role, scene.paletteOffset + animation.paletteOffset)
        const canonicalColor = canonicalSample.color ?? resolveColor(palette, canonicalRole)
        groupCompiler?.recordPixel(layer.id, y * width + x, canonicalColor, canonicalSample.alpha * finalLayerOpacity, 'canonical')
      }
      if (layerOpacity <= 0) continue
      if (
        !revealContains(v, animation.revealRow, animation.revealRowFrom) ||
        !revealContains(u, animation.revealColumn, animation.revealColumnFrom)
      )
        continue
      if (animation.checkerAlternate && (Math.floor(u * asset.nativeSize.width) + Math.floor(v * asset.nativeSize.height)) % 2 !== 0)
        continue

      let target = sampleLayerFrame(layer, u, v, animation.frameIndex)
      let source = target
      let mix = 1
      const transitionComplete = animation.frameTransitionProgress >= 1
      const usesTransitionSamples = animation.frameTransitionType !== 'cut' && (
        !transitionComplete || animation.frameTransitionCompletedState === 'transparent'
      )
      if (usesTransitionSamples) {
        source = animation.frameTransitionType === 'powerOn'
          ? transparentSample(target)
          : sampleLayerFrame(layer, u, v, animation.previousFrameIndex)
        if (animation.frameTransitionType === 'powerOff') {
          source = target
          target = transparentSample(target)
        }
        mix = pixGridCellTransitionMix(
          animation.frameTransitionType,
          x,
          y,
          width,
          height,
          animation.frameTransitionProgress,
          animation.frameTransitionSeed,
          animation.frameTransitionDirection,
          animation.frameTransitionOrigin,
        )
      }

      let alpha: number
      let color: readonly [number, number, number]
      if (usesTransitionSamples && animation.frameTransitionType === 'paletteFade' && mix > 0 && mix < 1) {
        alpha = (source.alpha + (target.alpha - source.alpha) * mix) * layerOpacity
        const sourceRole = resolveRole(layer, source.role, scene.paletteOffset + animation.paletteOffset)
        const targetRole = resolveRole(layer, target.role, scene.paletteOffset + animation.paletteOffset)
        const sourceColor = source.color ?? resolveColor(palette, sourceRole)
        const targetColor = target.color ?? resolveColor(palette, targetRole)
        color = interpolateColor(sourceColor, targetColor, mix)
      } else {
        const sample = mix >= 0.5 ? target : source
        alpha = sample.alpha * layerOpacity
        const role = resolveRole(layer, sample.role, scene.paletteOffset + animation.paletteOffset)
        color = sample.color ?? resolveColor(palette, role)
      }
      if (alpha <= 0) continue
      const index = y * width + x
      groupCompiler?.recordPixel(layer.id, index, color, alpha)
      blendPixel(pixels, index * 4, color, alpha, layer.blendMode)
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
  groupCompiler?: PixGridFrameGroupCompiler,
): void {
  const animation = resolvePixGridLayerAnimation(layer, PIX_GRID_BUILT_IN_ASSET_BY_ID.get(layer.assetId)!, frame, scene.motionMultiplier)
  const audioScale = effectiveScale(layer, frame)
  const scaleX = composedLayerScale(animation.scaleX, audioScale)
  const scaleY = composedLayerScale(animation.scaleY, audioScale)
  const finalLayerOpacity = effectiveOpacity(layer, scene, frame)
  const opacity = clamp01(animation.opacity * finalLayerOpacity)
  for (let y = 0; y < height; y += 1) {
    const outputV = (y + 0.5) / height
    for (let x = 0; x < width; x += 1) {
      const outputU = (x + 0.5) / width
      const [u, v] = localCoordinates(outputU, outputV, layer, animation.positionX, animation.positionY, scaleX, scaleY, animation.rotation)
      if (layer.clipMode === 'clip' && (u < 0 || u >= 1 || v < 0 || v >= 1)) continue
      const sx = Math.max(0, Math.min(preparedAsset.width - 1, Math.floor(u * preparedAsset.width)))
      const sy = Math.max(0, Math.min(preparedAsset.height - 1, Math.floor(v * preparedAsset.height)))
      const sourceOffset = (sy * preparedAsset.width + sx) * 4
      const sourceAlpha = preparedAsset.pixels[sourceOffset + 3] / 255
      const color = [
        preparedAsset.pixels[sourceOffset],
        preparedAsset.pixels[sourceOffset + 1],
        preparedAsset.pixels[sourceOffset + 2],
      ] as const
      if (sourceAlpha > 0) groupCompiler?.recordPixel(layer.id, y * width + x, color, sourceAlpha * finalLayerOpacity, 'canonical')
      if (opacity <= 0) continue
      if (
        !revealContains(v, animation.revealRow, animation.revealRowFrom) ||
        !revealContains(u, animation.revealColumn, animation.revealColumnFrom)
      )
        continue
      if (animation.checkerAlternate && (Math.floor(u * preparedAsset.width) + Math.floor(v * preparedAsset.height)) % 2 !== 0) continue
      const alpha = sourceAlpha * opacity
      if (alpha <= 0) continue
      const index = y * width + x
      groupCompiler?.recordPixel(layer.id, index, color, alpha)
      blendPixel(pixels, index * 4, color, alpha, layer.blendMode)
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

function composePixGridBaseFrame(
  preset: ReactPreset,
  rawState: PixGridState,
  frame: PixGridAudioFrame,
  reusable?: Uint8Array,
  preparedAsset?: PixGridPreparedAsset | ReadonlyMap<string, PixGridPreparedAsset> | null,
  reactionRuntime?: PixGridReactionRuntime,
  groupEffects: readonly PixGridGroupFrameEffect[] = [],
  groupCompiler?: PixGridFrameGroupCompiler,
  choreography?: PixGridStructuralChoreography | null,
): PixGridLogicalFrame {
  const normalizedState = normalizePixGridState(rawState)
  const state = reactionRuntime
    ? resolvePixGridAuthoredAssignmentState(normalizedState, frame, reactionRuntime)
    : normalizedState
  const width = state.matrixWidth
  const height = state.matrixHeight
  const required = width * height * 4
  const pixels = reusable?.length === required ? reusable : new Uint8Array(required)
  pixels.fill(0)
  const authoredScene = sceneFor(preset, state)
  const motionScale = Number.isFinite(choreography?.motionScale ?? NaN)
    ? Math.max(0, choreography!.motionScale)
    : 1
  const scene = motionScale === 1
    ? authoredScene
    : { ...authoredScene, motionMultiplier: authoredScene.motionMultiplier * motionScale }
  const hidden = new Set(scene.hiddenLayerIds ?? [])
  const activeScene = state.scenes.find((candidate) => candidate.id === state.selectedSceneId) ?? state.scenes[0]
  const orderedLayerIds = activeScene?.layerIds ?? state.layers.map((layer) => layer.id)
  const activeLayerIds = new Set(orderedLayerIds)
  const layerOrder = new Map(orderedLayerIds.map((id, index) => [id, index]))
  const visibleLayers = state.layers
    .filter((layer) => activeLayerIds.has(layer.id) && layer.visible && !hidden.has(layer.id) && layer.densityRank <= scene.density)
    .sort((a, b) => (layerOrder.get(a.id) ?? a.zIndex) - (layerOrder.get(b.id) ?? b.zIndex) || a.id.localeCompare(b.id))
    .slice(0, MAX_PIX_GRID_VISIBLE_LAYERS)
  const compiler = groupCompiler ?? new PixGridFrameGroupCompiler()
  const visibleLayerIds = new Set(visibleLayers.map((layer) => layer.id))
  compiler.beginFrame(state.groups, width, height, visibleLayerIds)

  const hasReactions = state.audioAssignments.some(assignment => assignment.enabled)
    || state.groups.some((group) => group.enabled && group.reactions.some((assignment) => assignment.enabled))
  const runtime = reactionRuntime
  for (const layer of visibleLayers) {
    const layerFrame = runtime
      ? resolvePixGridLayerReactionFrame(layer, state.groups, frame, runtime, state.editor.previewReactionAssignmentId)
      : frame
    const mediaAsset = layer.mediaId ? preparedAssetFor(preparedAsset, layer.mediaId) : null
    if (mediaAsset) renderPreparedAssetLayer(pixels, width, height, layer, mediaAsset, layerFrame, scene, compiler)
    else if (!layer.mediaId) renderLayer(pixels, width, height, layer, preset.palette, layerFrame, scene, compiler)
  }

  if (
    state.conversion.selectedMediaId &&
    preparedAsset != null &&
    isPreparedAsset(preparedAsset) &&
    preparedAsset.mediaId === state.conversion.selectedMediaId &&
    preparedAsset.width === width &&
    preparedAsset.height === height
  ) {
    for (let offset = 0; offset < preparedAsset.pixels.length; offset += 4) {
      const alpha = preparedAsset.pixels[offset + 3] / 255
      if (alpha <= 0) continue
      const color = [preparedAsset.pixels[offset], preparedAsset.pixels[offset + 1], preparedAsset.pixels[offset + 2]] as const
      compiler.recordPixel(null, offset / 4, color, alpha, 'canonical')
      compiler.recordPixel(null, offset / 4, color, alpha)
      blendPixel(pixels, offset, color, alpha, 'normal')
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
    const overrideColor = hexToRgb(color)
    compiler.recordPixel(null, y * width + x, overrideColor, opacity, 'canonical')
    compiler.recordPixel(null, y * width + x, overrideColor, opacity)
    blendPixel(pixels, offset, overrideColor, opacity, 'normal')
  }

  const persistentEffects = groupEffects.filter((effect) => effect.stage === 'persistent')
  const finalEffects = groupEffects.filter((effect) => effect.stage !== 'persistent')
  applyPixGridGroupFrameEffects(pixels, width, height, state.groups, persistentEffects, preset.palette, frame, visibleLayerIds, compiler)

  if (runtime && hasReactions) {
    applyPixGridGroupReactions(
      pixels,
      width,
      height,
      state.groups,
      frame,
      runtime,
      preset.palette,
      state.editor.previewReactionAssignmentId,
      visibleLayerIds,
      compiler,
      state.audioAssignments,
    )
  }
  applyPixGridGroupFrameEffects(pixels, width, height, state.groups, finalEffects, preset.palette, frame, visibleLayerIds, compiler)

  for (const group of state.groups) {
    if (group.contentVisible !== false) continue
    const mask = compiler.compile(group, 'canonical')
    for (let index = 0; index < width * height; index += 1) {
      if (!pixGridMaskHasCell(mask.bits, index)) continue
      const offset = index * 4
      pixels[offset] = 0
      pixels[offset + 1] = 0
      pixels[offset + 2] = 0
      pixels[offset + 3] = 0
    }
  }

  if (runtime && state.audioAssignments.length > 0) {
    applyPixGridOutputAssignments(pixels, state, frame, runtime, preset.palette)
  }

  return { width, height, pixels, visibleLayerCount: visibleLayers.length }
}

function applyLogicalTransition(
  target: Uint8Array,
  source: Uint8Array,
  width: number,
  height: number,
  transition: PixGridResolvedTransition,
): void {
  const progress = clamp01(transition.progress)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const mix = pixGridCellTransitionMix(transition.type, x, y, width, height, progress, transition.seed)
      if (mix >= 1) continue
      const offset = (y * width + x) * 4
      if (mix <= 0) {
        target[offset] = source[offset]
        target[offset + 1] = source[offset + 1]
        target[offset + 2] = source[offset + 2]
        target[offset + 3] = source[offset + 3]
        continue
      }
      target[offset] = Math.round(source[offset] + (target[offset] - source[offset]) * mix)
      target[offset + 1] = Math.round(source[offset + 1] + (target[offset + 1] - source[offset + 1]) * mix)
      target[offset + 2] = Math.round(source[offset + 2] + (target[offset + 2] - source[offset + 2]) * mix)
      target[offset + 3] = Math.round(source[offset + 3] + (target[offset + 3] - source[offset + 3]) * mix)
    }
  }
}

function applyStructuralVisualEffects(
  logical: PixGridLogicalFrame,
  choreography?: PixGridStructuralChoreography | null,
): void {
  const ops = choreography?.visualEffects
  if (!ops || ops.length === 0) return
  applyPixGridVisualEffectStack(logical.pixels, logical.width, logical.height, ops, visualEffectScratch)
}

export function composePixGridLogicalFrame(
  preset: ReactPreset,
  rawState: PixGridState,
  frame: PixGridAudioFrame,
  reusable?: Uint8Array,
  preparedAsset?: PixGridPreparedAsset | ReadonlyMap<string, PixGridPreparedAsset> | null,
  reactionRuntime?: PixGridReactionRuntime,
  transition?: PixGridResolvedTransition | null,
  groupEffects: readonly PixGridGroupFrameEffect[] = [],
  groupCompiler?: PixGridFrameGroupCompiler,
  choreography?: PixGridStructuralChoreography | null,
): PixGridLogicalFrame {
  const normalizedTargetState = normalizePixGridState(rawState)
  const normalizedSourceState = transition ? normalizePixGridState(transition.fromState) : null
  const hasAssignments = normalizedTargetState.audioAssignments.some(assignment => assignment.enabled)
    || normalizedTargetState.groups.some(group => group.enabled && group.reactions.some(assignment => assignment.enabled))
    || Boolean(normalizedSourceState?.audioAssignments.some(assignment => assignment.enabled))
    || Boolean(normalizedSourceState?.groups.some(group => group.enabled && group.reactions.some(assignment => assignment.enabled)))
  const runtime = reactionRuntime ?? (hasAssignments ? new PixGridReactionRuntime() : undefined)
  runtime?.beginFrame(frame)
  const effectiveTransition = runtime
    ? resolvePixGridTransitionAssignment(transition, normalizedTargetState, frame, runtime)
    : transition
  const target = composePixGridBaseFrame(preset, normalizedTargetState, frame, reusable, preparedAsset, runtime, groupEffects, groupCompiler, choreography)
  if (!effectiveTransition || effectiveTransition.type === 'cut' || effectiveTransition.progress >= 1) {
    applyStructuralVisualEffects(target, choreography)
    return target
  }
  const source = composePixGridBaseFrame(
    preset,
    effectiveTransition.fromState,
    frame,
    undefined,
    preparedAsset,
    runtime,
    [],
    new PixGridFrameGroupCompiler(),
    choreography,
  )
  if (source.width === target.width && source.height === target.height) {
    applyLogicalTransition(target.pixels, source.pixels, target.width, target.height, effectiveTransition)
  }
  applyStructuralVisualEffects(target, choreography)
  return target
}
