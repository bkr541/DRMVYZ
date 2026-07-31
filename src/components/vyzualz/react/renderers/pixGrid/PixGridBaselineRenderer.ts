import type { ReactPreset } from '../../ReactTypes'
import { composePixGridLogicalFrame } from '../../pixGrid/PixGridCompositor'
import type { PixGridStructuralChoreography } from '../../pixGrid/PixGridStructuralChoreographer'
import { createDefaultPixGridState } from '../../pixGrid/PixGridDefaults'
import { applyPixGridPresetSettings } from '../../pixGrid/PixGridState'
import type { PixGridAudioFrame, PixGridState } from '../../pixGrid/PixGridTypes'
import type { PixGridPreparedAsset } from '../../pixGrid/PixGridAssetPreparation'
import { normalizePixGridState } from '../../pixGrid/PixGridValidation'
import type { PixGridReactionRuntime } from '../../pixGrid/PixGridAudioRouting'
import type { PixGridResolvedTransition } from '../../pixGrid/PixGridActionCues'
import type { PixGridGroupFrameEffect } from '../../pixGrid/PixGridFrameEffects'
import type { PixGridFrameGroupCompiler } from '../../pixGrid/PixGridGroupCompiler'
import { buildPixGridRendererSemanticPlan, type PixGridRendererSemanticPlan } from '../../pixGrid/PixGridValidationAudit'
import type { PixGridUnifiedRuntimeDiagnostics } from '../../pixGrid/PixGridUnifiedPerformanceRuntime'
import { resolvePixGridPresentation } from '../../pixGrid/PixGridPresentation'


export function buildPixGridCanvasSemanticPlan(
  state: PixGridState,
  audioFrame: PixGridAudioFrame,
  runtime: PixGridUnifiedRuntimeDiagnostics,
): PixGridRendererSemanticPlan {
  return buildPixGridRendererSemanticPlan(state, audioFrame, runtime)
}

export interface PixGridBaselineRenderFrame extends PixGridAudioFrame {
  width: number
  height: number
  motion: number
  intensity: number
  glow: number
  bassReactivity: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function resolveBackground(preset: ReactPreset, state: PixGridState): string {
  if (state.backgroundMode === 'black') return '#000000'
  if (state.backgroundMode === 'custom') return state.backgroundColor
  return preset.palette.background
}

let fallbackImageDataCache = new WeakMap<HTMLCanvasElement, ImageData>()

function fallbackImageData(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): ImageData {
  const cached = fallbackImageDataCache.get(canvas)
  if (cached && cached.width === width && cached.height === height) return cached
  const created = context.createImageData(width, height)
  fallbackImageDataCache.set(canvas, created)
  return created
}

function roundedCellPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  if (radius <= 0 || typeof ctx.roundRect !== 'function') {
    ctx.rect(x, y, width, height)
    return
  }
  ctx.roundRect(x, y, width, height, radius)
}

export function createPixGridStateForPreset(preset: ReactPreset): PixGridState {
  return applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
}

export function renderPixGridBaseline(
  ctx: CanvasRenderingContext2D,
  frame: PixGridBaselineRenderFrame,
  preset: ReactPreset,
  rawState: PixGridState,
  preparedAsset?: PixGridPreparedAsset | ReadonlyMap<string, PixGridPreparedAsset> | null,
  reactionRuntime?: PixGridReactionRuntime,
  transition?: PixGridResolvedTransition | null,
  groupEffects: readonly PixGridGroupFrameEffect[] = [],
  groupCompiler?: PixGridFrameGroupCompiler,
  choreography?: PixGridStructuralChoreography | null,
): void {
  const state = normalizePixGridState(rawState)
  const logical = composePixGridLogicalFrame(
    preset,
    state,
    frame,
    undefined,
    preparedAsset,
    reactionRuntime,
    transition,
    groupEffects,
    groupCompiler,
    choreography,
  )
  const W = Math.max(1, frame.width)
  const H = Math.max(1, frame.height)
  const matrixAspect = state.matrixWidth / state.matrixHeight
  const outputAspect = W / H
  const drawWidth = outputAspect > matrixAspect ? H * matrixAspect : W
  const drawHeight = outputAspect > matrixAspect ? H : W / matrixAspect
  const offsetX = (W - drawWidth) * 0.5
  const offsetY = (H - drawHeight) * 0.5
  const cellWidth = drawWidth / state.matrixWidth
  const cellHeight = drawHeight / state.matrixHeight
  const gapX = Math.min(cellWidth * 0.45, cellWidth * state.cellGap)
  const gapY = Math.min(cellHeight * 0.45, cellHeight * state.cellGap)
  const pixelWidth = Math.max(0.2, cellWidth - gapX * 2)
  const pixelHeight = Math.max(0.2, cellHeight - gapY * 2)
  const radius = Math.min(pixelWidth, pixelHeight) * state.cellRoundness
  const presentation = resolvePixGridPresentation(state, frame)
  const intensity = presentation.resolvedOutputIntensity

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = resolveBackground(preset, state)
  ctx.globalAlpha = state.backgroundBrightness
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 1
  ctx.filter = presentation.diffusion > 0.01
    ? `blur(${Math.max(0.1, presentation.diffusion * Math.min(cellWidth, cellHeight) * 0.35)}px)`
    : 'none'

  for (let y = 0; y < state.matrixHeight; y += 1) {
    for (let x = 0; x < state.matrixWidth; x += 1) {
      const offset = (y * state.matrixWidth + x) * 4
      const alpha = logical.pixels[offset + 3] / 255
      if (alpha <= 0.01) continue
      const r = Math.round(logical.pixels[offset] * intensity)
      const g = Math.round(logical.pixels[offset + 1] * intensity)
      const b = Math.round(logical.pixels[offset + 2] * intensity)
      const px = offsetX + x * cellWidth + gapX
      const py = offsetY + y * cellHeight + gapY
      if (presentation.glow > 0.02 && alpha > 0.45) {
        ctx.shadowColor = `rgba(${r},${g},${b},${presentation.glow})`
        ctx.shadowBlur = Math.min(18, Math.max(cellWidth, cellHeight) * (1 + presentation.haloRadius * 3))
      } else {
        ctx.shadowBlur = 0
      }
      ctx.beginPath()
      roundedCellPath(ctx, px, py, pixelWidth, pixelHeight, radius)
      ctx.fillStyle = `rgba(${r},${g},${b},${clamp01(alpha)})`
      ctx.fill()
    }
  }

  ctx.shadowBlur = 0
  ctx.filter = 'none'
  if (state.diagnostics.showMatrixBounds) {
    ctx.strokeStyle = preset.palette.highlight
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 1
    ctx.strokeRect(offsetX + 0.5, offsetY + 0.5, drawWidth - 1, drawHeight - 1)
  }
  ctx.restore()
}

export function disposePixGridBaselineRenderer(): void {
  fallbackImageDataCache = new WeakMap<HTMLCanvasElement, ImageData>()
}

export interface PixGridCanvasFallbackTarget {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
}

export function renderPixGridCanvasFallback(
  output: CanvasRenderingContext2D,
  logicalTarget: PixGridCanvasFallbackTarget,
  frame: PixGridBaselineRenderFrame,
  preset: ReactPreset,
  rawState: PixGridState,
  preparedAsset?: PixGridPreparedAsset | ReadonlyMap<string, PixGridPreparedAsset> | null,
  reactionRuntime?: PixGridReactionRuntime,
  transition?: PixGridResolvedTransition | null,
  groupEffects: readonly PixGridGroupFrameEffect[] = [],
  groupCompiler?: PixGridFrameGroupCompiler,
  choreography?: PixGridStructuralChoreography | null,
): Readonly<{ logicalWidth: number; logicalHeight: number; logicalFrame: ReturnType<typeof composePixGridLogicalFrame> }> {
  const requested = normalizePixGridState(rawState)
  const state = requested.quality === 'draft' ? normalizePixGridState({ ...requested, quality: 'low' }) : requested
  const logicalCanvas = logicalTarget.canvas
  const logicalContext = logicalTarget.context
  if (logicalCanvas.width !== state.matrixWidth) logicalCanvas.width = state.matrixWidth
  if (logicalCanvas.height !== state.matrixHeight) logicalCanvas.height = state.matrixHeight

  const logical = composePixGridLogicalFrame(
    preset,
    state,
    frame,
    undefined,
    preparedAsset,
    reactionRuntime,
    transition,
    groupEffects,
    groupCompiler,
    choreography,
  )
  const image = fallbackImageData(logicalCanvas, logicalContext, state.matrixWidth, state.matrixHeight)
  const presentation = resolvePixGridPresentation(state, frame)
  const intensity = presentation.resolvedOutputIntensity
  for (let offset = 0; offset < logical.pixels.length; offset += 4) {
    image.data[offset] = Math.round(logical.pixels[offset] * intensity)
    image.data[offset + 1] = Math.round(logical.pixels[offset + 1] * intensity)
    image.data[offset + 2] = Math.round(logical.pixels[offset + 2] * intensity)
    image.data[offset + 3] = logical.pixels[offset + 3]
  }
  logicalContext.putImageData(image, 0, 0)

  const W = Math.max(1, frame.width)
  const H = Math.max(1, frame.height)
  const matrixAspect = state.matrixWidth / state.matrixHeight
  const outputAspect = W / H
  const drawWidth = outputAspect > matrixAspect ? H * matrixAspect : W
  const drawHeight = outputAspect > matrixAspect ? H : W / matrixAspect
  const offsetX = (W - drawWidth) * 0.5
  const offsetY = (H - drawHeight) * 0.5
  output.save()
  output.imageSmoothingEnabled = false
  output.globalCompositeOperation = 'source-over'
  output.globalAlpha = 1
  output.clearRect(0, 0, W, H)
  output.fillStyle = resolveBackground(preset, state)
  output.globalAlpha = state.backgroundBrightness
  output.fillRect(0, 0, W, H)
  output.globalAlpha = 1
  if (presentation.glow > 0.02) {
    output.save()
    output.globalCompositeOperation = 'lighter'
    output.globalAlpha = presentation.glow * 0.55
    output.filter = `blur(${Math.max(0.5, Math.max(drawWidth / state.matrixWidth, drawHeight / state.matrixHeight) * presentation.haloRadius * 2.5)}px)`
    output.drawImage(logicalCanvas, offsetX, offsetY, drawWidth, drawHeight)
    output.restore()
  }
  output.filter = presentation.diffusion > 0.01
    ? `blur(${Math.max(0.1, presentation.diffusion * 0.75)}px)`
    : 'none'
  output.drawImage(logicalCanvas, offsetX, offsetY, drawWidth, drawHeight)
  output.filter = 'none'
  if (state.diagnostics.showMatrixBounds) {
    output.strokeStyle = preset.palette.highlight
    output.globalAlpha = 0.7
    output.lineWidth = 1
    output.strokeRect(offsetX + 0.5, offsetY + 0.5, drawWidth - 1, drawHeight - 1)
  }
  output.restore()
  return { logicalWidth: state.matrixWidth, logicalHeight: state.matrixHeight, logicalFrame: logical }
}
