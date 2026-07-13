import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS } from '../src/components/vyzualz/react/LaserDmxShowDirectorPerformancePresets'
import {
  SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES,
  SHOW_DIRECTOR_VISUAL_VALIDATION_SEED,
  SHOW_DIRECTOR_VISUAL_VALIDATION_SIZE,
  SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK,
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
  washedBrightPixelRatio: number
  centerLitPixelRatio: number
}

interface ReviewFrameSummary {
  key: string
  canvasId: string
  presetId: string
  presetName: string
  sourceRigLayoutId: string | null
  performanceProgramId: string
  frameId: string
  timeSec: number
  renderSettleMs: number
  seed: number
  trackAssumptions: typeof SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK
  section: string
  beat: number
  bar: number
  absoluteBar: number
  fourBarIndex: number
  eightBarIndex: number
  sixteenBarIndex: number
  dropOccurrence: number
  fixtureCount: number
  activeFixtureCount: number
  authoredBeamCount: number
  compiledBeamCount: number
  visibleBeamCount: number
  activeMotif: string | null
  recruitmentStage: number
  staticSourceRigImmutable: boolean
  geometryMetrics: ShowDirectorVisualValidationResolution['metrics']
  effectMetrics: ShowDirectorVisualValidationResolution['effects']
  pixelMetrics: PixelMetrics
  screenshotPath: string
  stateReportPath: string
}

declare global {
  interface Window {
    __SHOW_DIRECTOR_VISUAL_REVIEW__?: {
      ready: boolean
      width: number
      height: number
      expectedFrameCount: number
      trackAssumptions: typeof SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK
      frames: ReviewFrameSummary[]
    }
  }
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function measurePixels(ctx: CanvasRenderingContext2D, width: number, height: number): PixelMetrics {
  const data = ctx.getImageData(0, 0, width, height).data
  let luminance = 0
  let visibleLuminance = 0
  let saturation = 0
  let visible = 0
  let black = 0
  let peak = 0
  let washedBright = 0
  let centerLit = 0
  let centerPixels = 0
  for (let index = 0; index < data.length; index += 4) {
    const pixel = index / 4
    const x = pixel % width
    const y = Math.floor(pixel / width)
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const value = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    const pixelSaturation = max > 0 ? (max - min) / max : 0
    luminance += value
    if (value < 0.012) black += 1
    if (value >= 0.02) {
      visible += 1
      visibleLuminance += value
      saturation += pixelSaturation
    }
    if (value > 0.82) peak += 1
    if (value > 0.35 && pixelSaturation < 0.12) washedBright += 1
    if (x >= width * 0.4 && x <= width * 0.6 && y >= height * 0.18 && y <= height * 0.88) {
      centerPixels += 1
      if (value >= 0.02) centerLit += 1
    }
  }
  const pixels = width * height
  return {
    meanLuminance: rounded(luminance / pixels),
    visibleLuminance: rounded(visible ? visibleLuminance / visible : 0),
    meanSaturation: rounded(visible ? saturation / visible : 0),
    blackFrameRatio: rounded(black / pixels),
    litPixelRatio: rounded(visible / pixels),
    sourceBloomPeakRatio: rounded(peak / pixels),
    washedBrightPixelRatio: rounded(washedBright / pixels),
    centerLitPixelRatio: rounded(centerPixels ? centerLit / centerPixels : 0),
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
  meta.textContent = `${resolution.visibleBeamCount}/${resolution.compiledBeamCount} visible/compiled · ${resolution.activeFixtureCount} fixtures · bar ${resolution.absoluteBar}`
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
  const screenshotPath = `${resolution.presetId}/${resolution.frame.id}.png`
  const stateReportPath = `${resolution.presetId}/${resolution.frame.id}.json`
  return {
    key: `${resolution.presetId}/${resolution.frame.id}`,
    canvasId,
    presetId: resolution.presetId,
    presetName: resolution.presetName,
    sourceRigLayoutId: resolution.sourceRigLayoutId,
    performanceProgramId: resolution.performanceProgramId,
    frameId: resolution.frame.id,
    timeSec: resolution.frame.timeSec,
    renderSettleMs: resolution.renderSettleMs,
    seed: SHOW_DIRECTOR_VISUAL_VALIDATION_SEED,
    trackAssumptions: resolution.trackAssumptions,
    section: resolution.section,
    beat: resolution.beat,
    bar: resolution.bar,
    absoluteBar: resolution.absoluteBar,
    fourBarIndex: resolution.fourBarIndex,
    eightBarIndex: resolution.eightBarIndex,
    sixteenBarIndex: resolution.sixteenBarIndex,
    dropOccurrence: resolution.dropOccurrence,
    fixtureCount: resolution.fixtureCount,
    activeFixtureCount: resolution.activeFixtureCount,
    authoredBeamCount: resolution.authoredBeamCount,
    compiledBeamCount: resolution.compiledBeamCount,
    visibleBeamCount: resolution.visibleBeamCount,
    activeMotif: resolution.activeMotif,
    recruitmentStage: resolution.recruitmentStage,
    staticSourceRigImmutable: resolution.staticSourceRigImmutable,
    geometryMetrics: resolution.metrics,
    effectMetrics: resolution.effects,
    pixelMetrics: measurePixels(ctx, canvas.width, canvas.height),
    screenshotPath,
    stateReportPath,
  }
}

const summaries: ReviewFrameSummary[] = []
for (const preset of LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS) {
  for (const frame of SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES) {
    summaries.push(renderFrame(resolveShowDirectorVisualValidationFrame(preset, frame)))
  }
}
window.__SHOW_DIRECTOR_VISUAL_REVIEW__ = {
  ready: true,
  width: SHOW_DIRECTOR_VISUAL_VALIDATION_SIZE.width,
  height: SHOW_DIRECTOR_VISUAL_VALIDATION_SIZE.height,
  expectedFrameCount: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.length * SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES.length,
  trackAssumptions: SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK,
  frames: summaries,
}
document.documentElement.dataset.visualReviewReady = 'true'
