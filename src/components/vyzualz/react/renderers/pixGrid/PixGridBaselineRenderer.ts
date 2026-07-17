import type { ReactPreset } from '../../ReactTypes'
import { composePixGridLogicalFrame } from '../../pixGrid/PixGridCompositor'
import { createDefaultPixGridState } from '../../pixGrid/PixGridDefaults'
import { applyPixGridPresetSettings } from '../../pixGrid/PixGridState'
import type { PixGridAudioFrame, PixGridState } from '../../pixGrid/PixGridTypes'
import type { PixGridPreparedAsset } from '../../pixGrid/PixGridAssetPreparation'
import { normalizePixGridState } from '../../pixGrid/PixGridValidation'
import type { PixGridReactionRuntime } from '../../pixGrid/PixGridAudioRouting'
import type { PixGridResolvedTransition } from '../../pixGrid/PixGridActionCues'
import type { PixGridGroupFrameEffect } from '../../pixGrid/PixGridFrameEffects'
import type { PixGridFrameGroupCompiler } from '../../pixGrid/PixGridGroupCompiler'

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
  const intensity = clamp01(frame.intensity * state.globalIntensity * state.cellBrightness)
  const glow = clamp01((frame.glow + state.glowAmount) * 0.5)

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
      if (glow > 0.02 && alpha > 0.45) {
        ctx.shadowColor = `rgb(${r},${g},${b})`
        ctx.shadowBlur = Math.min(18, Math.max(cellWidth, cellHeight) * (1 + glow * 4))
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
  if (state.diagnostics.showMatrixBounds) {
    ctx.strokeStyle = preset.palette.highlight
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 1
    ctx.strokeRect(offsetX + 0.5, offsetY + 0.5, drawWidth - 1, drawHeight - 1)
  }
  ctx.restore()
}

export function disposePixGridBaselineRenderer(): void {
  // The fallback compositor owns only frame-local typed arrays.
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
): Readonly<{ logicalWidth: number; logicalHeight: number }> {
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
  )
  const image = logicalContext.createImageData(state.matrixWidth, state.matrixHeight)
  const intensity = clamp01(frame.intensity * state.globalIntensity * state.cellBrightness)
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
  output.drawImage(logicalCanvas, offsetX, offsetY, drawWidth, drawHeight)
  if (state.diagnostics.showMatrixBounds) {
    output.strokeStyle = preset.palette.highlight
    output.globalAlpha = 0.7
    output.lineWidth = 1
    output.strokeRect(offsetX + 0.5, offsetY + 0.5, drawWidth - 1, drawHeight - 1)
  }
  output.restore()
  return { logicalWidth: state.matrixWidth, logicalHeight: state.matrixHeight }
}
