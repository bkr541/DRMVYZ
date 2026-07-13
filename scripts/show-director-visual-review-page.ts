import { LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS } from '../src/components/vyzualz/react/LaserDmxShowDirectorPerformanceShowcasePresets'
import {
  SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES,
  SHOW_DIRECTOR_VISUAL_VALIDATION_SEED,
  SHOW_DIRECTOR_VISUAL_VALIDATION_SIZE,
  resolveShowDirectorVisualValidationFrame,
  type ShowDirectorVisualValidationResolution,
} from '../src/components/vyzualz/react/LaserDmxShowDirectorVisualValidation'
import { renderLaserDmxBeamMatrix } from '../src/components/vyzualz/react/renderers/LaserDmxBeamMatrixRenderer'
import { renderFog } from '../src/components/vyzualz/react/renderers/LaserDmxFogRenderer'

interface PixelMetrics {
  meanLuminance: number
  visibleLuminance: number
  meanSaturation: number
  blackFrameRatio: number
  litPixelRatio: number
  sourceBloomPeakRatio: number
}

interface ReviewFrameSummary {
  key: string
  canvasId: string
  presetId: string
  presetName: string
  frameId: string
  timeSec: number
  seed: number
  section: string
  bar: number
  fixtureCount: number
  activeFixtureCount: number
  compiledBeamCount: number
  activeMotif: string | null
  recruitmentStage: number
  geometryMetrics: ShowDirectorVisualValidationResolution['metrics']
  pixelMetrics: PixelMetrics
}

declare global {
  interface Window {
    __SHOW_DIRECTOR_VISUAL_REVIEW__?: {
      ready: boolean
      width: number
      height: number
      frames: ReviewFrameSummary[]
    }
  }
}

function measurePixels(ctx: CanvasRenderingContext2D, width: number, height: number): PixelMetrics {
  const data = ctx.getImageData(0, 0, width, height).data
  let luminance = 0
  let visibleLuminance = 0
  let saturation = 0
  let visible = 0
  let black = 0
  let peak = 0
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const value = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    luminance += value
    if (value < 0.012) black += 1
    if (value >= 0.02) {
      visible += 1
      visibleLuminance += value
      saturation += max > 0 ? (max - min) / max : 0
    }
    if (value > 0.82) peak += 1
  }
  const pixels = width * height
  return {
    meanLuminance: luminance / pixels,
    visibleLuminance: visible ? visibleLuminance / visible : 0,
    meanSaturation: visible ? saturation / visible : 0,
    blackFrameRatio: black / pixels,
    litPixelRatio: visible / pixels,
    sourceBloomPeakRatio: peak / pixels,
  }
}

function makeCard(resolution: ShowDirectorVisualValidationResolution): { canvas: HTMLCanvasElement; canvasId: string } {
  const grid = document.getElementById('review-grid')
  if (!grid) throw new Error('Missing review grid')
  const canvasId = `frame-${resolution.presetId}-${resolution.frame.id}`
  const card = document.createElement('article')
  const header = document.createElement('header')
  const title = document.createElement('h2')
  title.textContent = `${resolution.presetName} · ${resolution.frame.id}`
  const meta = document.createElement('code')
  meta.textContent = `${resolution.compiledBeamCount} beams · ${resolution.activeFixtureCount} sources · bar ${resolution.bar}`
  header.append(title, meta)
  const canvas = document.createElement('canvas')
  canvas.id = canvasId
  canvas.dataset.presetId = resolution.presetId
  canvas.dataset.frameId = resolution.frame.id
  canvas.width = SHOW_DIRECTOR_VISUAL_VALIDATION_SIZE.width
  canvas.height = SHOW_DIRECTOR_VISUAL_VALIDATION_SIZE.height
  card.append(header, canvas)
  grid.append(card)
  return { canvas, canvasId }
}

function renderFrame(resolution: ShowDirectorVisualValidationResolution): ReviewFrameSummary {
  const { canvas, canvasId } = makeCard(resolution)
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!ctx) throw new Error('Canvas2D unavailable')
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  renderFog(ctx, canvas.width, canvas.height, resolution.fog, resolution.beams, 0)
  renderLaserDmxBeamMatrix(
    ctx,
    canvas.width,
    canvas.height,
    resolution.output,
    resolution.beams,
    1,
    1,
    false,
  )
  return {
    key: `${resolution.presetId}/${resolution.frame.id}`,
    canvasId,
    presetId: resolution.presetId,
    presetName: resolution.presetName,
    frameId: resolution.frame.id,
    timeSec: resolution.frame.timeSec,
    seed: SHOW_DIRECTOR_VISUAL_VALIDATION_SEED,
    section: resolution.section,
    bar: resolution.bar,
    fixtureCount: resolution.fixtureCount,
    activeFixtureCount: resolution.activeFixtureCount,
    compiledBeamCount: resolution.compiledBeamCount,
    activeMotif: resolution.activeMotif,
    recruitmentStage: resolution.recruitmentStage,
    geometryMetrics: resolution.metrics,
    pixelMetrics: measurePixels(ctx, canvas.width, canvas.height),
  }
}

const summaries: ReviewFrameSummary[] = []
for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
  for (const frame of SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES) {
    summaries.push(renderFrame(resolveShowDirectorVisualValidationFrame(preset, frame)))
  }
}
window.__SHOW_DIRECTOR_VISUAL_REVIEW__ = {
  ready: true,
  width: SHOW_DIRECTOR_VISUAL_VALIDATION_SIZE.width,
  height: SHOW_DIRECTOR_VISUAL_VALIDATION_SIZE.height,
  frames: summaries,
}
document.documentElement.dataset.visualReviewReady = 'true'
