import type { ReactPreset } from '../../ReactTypes'
import { createDefaultPixGridState } from '../../pixGrid/PixGridDefaults'
import { applyPixGridPresetSettings } from '../../pixGrid/PixGridState'
import type { PixGridAudioFrame, PixGridPatternId, PixGridState } from '../../pixGrid/PixGridTypes'
import { normalizePixGridState } from '../../pixGrid/PixGridValidation'

export interface PixGridBaselineRenderFrame extends PixGridAudioFrame {
  width: number
  height: number
  motion: number
  intensity: number
  glow: number
  bassReactivity: number
}

interface Rgb {
  r: number
  g: number
  b: number
}

const RGB_CACHE = new Map<string, Rgb>()

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function hexToRgb(hex: string): Rgb {
  const cached = RGB_CACHE.get(hex)
  if (cached) return cached
  const safe = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#ffffff'
  const rgb = {
    r: Number.parseInt(safe.slice(1, 3), 16),
    g: Number.parseInt(safe.slice(3, 5), 16),
    b: Number.parseInt(safe.slice(5, 7), 16),
  }
  RGB_CACHE.set(hex, rgb)
  return rgb
}

function mixColor(a: string, b: string, amount: number, alpha = 1): string {
  const ar = hexToRgb(a)
  const br = hexToRgb(b)
  const t = clamp01(amount)
  return `rgba(${Math.round(ar.r + (br.r - ar.r) * t)},${Math.round(ar.g + (br.g - ar.g) * t)},${Math.round(ar.b + (br.b - ar.b) * t)},${clamp01(alpha)})`
}

function resolveBackground(preset: ReactPreset, state: PixGridState): string {
  if (state.backgroundMode === 'black') return '#000000'
  if (state.backgroundMode === 'custom') return state.backgroundColor
  return preset.palette.background
}

function resolvePattern(preset: ReactPreset): PixGridPatternId {
  return preset.pixGridSettings?.pattern ?? 'bassBeacon'
}

function patternValue(
  pattern: PixGridPatternId,
  x: number,
  y: number,
  state: PixGridState,
  frame: PixGridBaselineRenderFrame,
): { value: number; colorMix: number; accent: number } {
  const nx = (x + 0.5) / state.matrixWidth * 2 - 1
  const ny = (y + 0.5) / state.matrixHeight * 2 - 1
  const aspectX = nx * (state.matrixWidth / state.matrixHeight) / (16 / 9)
  const time = frame.audioTime * Math.max(0.08, frame.motion)
  const beat = frame.beatHit ? 1 : Math.max(0, 1 - frame.beatPhase * 3.2)

  if (pattern === 'geometricReactor') {
    const angle = time * 0.8
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const rx = aspectX * c - ny * s
    const ry = aspectX * s + ny * c
    const diamond = Math.abs(rx) + Math.abs(ry)
    const rings = 0.5 + 0.5 * Math.cos((diamond * 13 - time * 4.2) * Math.PI)
    const diagonals = Math.max(0, 1 - Math.min(Math.abs(rx - ry), Math.abs(rx + ry)) * 18)
    const core = Math.max(0, 1 - Math.hypot(aspectX, ny) * (5.5 - frame.bass * 1.8))
    return {
      value: clamp01(rings * 0.55 + diagonals * 0.45 + core * (0.65 + frame.bass * 0.6) + beat * core * 0.6),
      colorMix: clamp01((Math.atan2(ny, aspectX) / Math.PI + 1) * 0.5 + rings * 0.18),
      accent: clamp01(core + diagonals * beat),
    }
  }

  if (pattern === 'pixelParade') {
    const lane = Math.floor((y / state.matrixHeight) * 7)
    const direction = lane % 2 === 0 ? 1 : -1
    const march = (x + direction * time * (12 + frame.high * 12) + lane * 9) % 26
    const normalizedMarch = march < 0 ? march + 26 : march
    const body = normalizedMarch < 8 ? 1 : normalizedMarch < 10 ? 0.5 : 0
    const step = ((x + lane * 3 + Math.floor(time * 6)) % 11 === 0) ? 0.65 : 0
    const lanePulse = 0.45 + 0.55 * Math.sin((lane + 1) * 1.7 + time * 2.3)
    return {
      value: clamp01(body * (0.52 + lanePulse * 0.35) + step + beat * body * 0.45),
      colorMix: (lane % 4) / 3,
      accent: clamp01((lane === 2 || lane === 5 ? body : 0) + beat * step),
    }
  }

  const radius = Math.hypot(aspectX, ny)
  const theta = Math.atan2(ny, aspectX)
  const pulseRadius = 0.16 + frame.bass * frame.bassReactivity * 0.28 + beat * 0.08
  const ringDistance = Math.abs(radius - pulseRadius - (0.5 + 0.5 * Math.sin(time * 2.4)) * 0.16)
  const ring = Math.max(0, 1 - ringDistance * 24)
  const beacon = Math.max(0, 1 - radius * (4.3 - frame.bass * 1.4))
  const spokes = Math.max(0, Math.cos(theta * 8 + time * 2.2)) ** 9 * Math.max(0, 1 - radius * 1.35)
  return {
    value: clamp01(beacon * (0.7 + frame.bass * 0.8) + ring * 0.8 + spokes * (0.28 + beat * 0.5)),
    colorMix: clamp01(radius * 0.7 + 0.25 * Math.sin(theta * 4 + time)),
    accent: clamp01(beacon * beat + ring * frame.high * 0.7),
  }
}

function roundedCellPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
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
): void {
  const state = normalizePixGridState(rawState)
  const W = Math.max(1, frame.width)
  const H = Math.max(1, frame.height)
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = resolveBackground(preset, state)
  ctx.fillRect(0, 0, W, H)

  const matrixAspect = 16 / 9
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
  const pattern = resolvePattern(preset)
  const intensity = clamp01(frame.intensity * state.globalIntensity * state.cellBrightness)
  const glow = clamp01((frame.glow + state.glowAmount) * 0.5)

  const overrides = new Map(state.pixelOverrides.map(override => [`${override[0]}:${override[1]}`, override] as const))

  for (let y = 0; y < state.matrixHeight; y += 1) {
    for (let x = 0; x < state.matrixWidth; x += 1) {
      const override = overrides.get(`${x}:${y}`)
      const sample = patternValue(pattern, x, y, state, frame)
      const value = override ? override[3] : sample.value
      const alpha = clamp01((value <= 0.025 && !override ? 0.035 : 0.06 + value * 0.94) * intensity)
      const baseColor = override?.[2] ?? mixColor(preset.palette.primary, preset.palette.secondary, sample.colorMix)
      const color = sample.accent > 0.55 && !override
        ? mixColor(baseColor, preset.palette.accent, sample.accent)
        : baseColor
      const px = offsetX + x * cellWidth + gapX
      const py = offsetY + y * cellHeight + gapY

      if (glow > 0.02 && value > 0.48) {
        ctx.shadowColor = color
        ctx.shadowBlur = Math.min(18, Math.max(cellWidth, cellHeight) * (1 + glow * 4))
      } else {
        ctx.shadowBlur = 0
      }
      ctx.beginPath()
      roundedCellPath(ctx, px, py, pixelWidth, pixelHeight, radius)
      ctx.fillStyle = mixColor(color, preset.palette.highlight, sample.accent * 0.4, alpha)
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
  RGB_CACHE.clear()
}
