// RGB Ghost (priority 8 of the POV document): the red, green and blue channels of the camera picture are
// each taken from a different moment, so the colour separation happens across time rather than as a fixed
// chromatic offset. It keeps a short rolling history of the picture and rebuilds the frame channel by channel.

import { getHeadlinerBoolean, getHeadlinerNumber, getHeadlinerString } from './HeadlinerEffectCatalog'
import {
  WorkSurface,
  clamp01,
  compositeLayer,
  drawLive,
  drawVideoInto,
  effectStrength,
  hexToRgb,
  resolveHeadlinerWorkSize,
  type HeadlinerEffectProcessor,
  type HeadlinerEffectRenderArgs,
} from './HeadlinerEffectKit'
import { HeadlinerMotionAnalyzer } from './HeadlinerMotion'

/** The history is stored at this rate, however fast the camera delivers frames. */
export const HEADLINER_RGB_GHOST_CAPTURE_HZ = 30
/** The oldest channel never lags more than this, which bounds how many pictures are kept. */
export const HEADLINER_RGB_GHOST_MAX_LAG_SEC = 1
export const HEADLINER_RGB_GHOST_MAX_FRAMES = Math.ceil(HEADLINER_RGB_GHOST_MAX_LAG_SEC * HEADLINER_RGB_GHOST_CAPTURE_HZ) + 2

export type HeadlinerRgbChannel = 'r' | 'g' | 'b'

/** The channels from live to oldest; anything that is not a permutation of r, g, b falls back to r, g, b. */
export function resolveRgbGhostOrder(order: string): HeadlinerRgbChannel[] {
  const letters = order.split('')
  const valid = letters.length === 3 && new Set(letters).size === 3 && letters.every(letter => 'rgb'.includes(letter))
  return (valid ? letters : ['r', 'g', 'b']) as HeadlinerRgbChannel[]
}

/** How long each channel lags the live picture: the first of the order is live, then one step, then two. */
export function resolveRgbGhostDelays(order: string, stepSec: number): Record<HeadlinerRgbChannel, number> {
  const channels = resolveRgbGhostOrder(order)
  const step = Math.max(0, Math.min(stepSec, HEADLINER_RGB_GHOST_MAX_LAG_SEC / 2))
  const delays = { r: 0, g: 0, b: 0 }
  channels.forEach((channel, index) => {
    delays[channel] = index * step
  })
  return delays
}

/** Index of the stored picture whose age is closest to `delaySec`. Ages are in seconds, newest first. */
export function pickRgbGhostFrame(ages: readonly number[], delaySec: number): number {
  let best = -1
  let bestError = Number.POSITIVE_INFINITY
  for (let index = 0; index < ages.length; index += 1) {
    const error = Math.abs(ages[index] - delaySec)
    if (error < bestError) {
      best = index
      bestError = error
    }
  }
  return best
}

const PURE_CHANNEL_COLORS: Readonly<Record<HeadlinerRgbChannel, readonly [number, number, number]>> = {
  r: [255, 0, 0],
  g: [0, 255, 0],
  b: [0, 0, 255],
}

interface StoredFrame {
  surface: WorkSurface
  timeSec: number
}

class RgbGhostProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'rgb-ghost' as const
  /** Newest first. */
  private history: StoredFrame[] = []
  private spare: WorkSurface[] = []
  private readonly live = new WorkSurface()
  private readonly channel = new WorkSurface()
  private readonly layer = new WorkSurface()
  private readonly analyzer = new HeadlinerMotionAnalyzer()
  private lastCaptureSec = Number.NEGATIVE_INFINITY

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.layer.context || !this.channel.context) {
      this.clearHistory()
      return
    }

    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    if (this.live.resize(work.width, work.height)) this.clearHistory()
    this.channel.resize(work.width, work.height)
    this.layer.resize(work.width, work.height)
    if (!drawVideoInto(this.live, args)) return
    this.capture(timing.timeSec, work.width, work.height)

    const speedBoost = getHeadlinerNumber(parameters, 'speedBoost', 0.3)
    const speed = speedBoost > 0 ? this.analyzer.update(video, sourceRect, false)?.speed ?? 0 : 0
    const synced = getHeadlinerBoolean(parameters, 'bpmSync', true)
    const baseStepSec = synced
      ? (Number(getHeadlinerString(parameters, 'delaySpacingBeats', '0.125')) || 0.125) * timing.secondsPerBeat
      : getHeadlinerNumber(parameters, 'delayMs', 90) / 1000
    const stepSec = baseStepSec * Math.min(1.5, strength) * (1 + speedBoost * speed * 3)
    const orderValue = getHeadlinerString(parameters, 'channelOrder', 'rgb')
    const delays = resolveRgbGhostDelays(orderValue, stepSec)
    const channels = resolveRgbGhostOrder(orderValue)

    const custom = getHeadlinerString(parameters, 'colorMode', 'original') === 'custom'
    const customColors = [
      hexToRgb(getHeadlinerString(parameters, 'primaryColor', '#ff2a2a')),
      hexToRgb(getHeadlinerString(parameters, 'secondaryColor', '#2aff5a')),
      hexToRgb(getHeadlinerString(parameters, 'tertiaryColor', '#2a6bff')),
    ]
    const drift = getHeadlinerNumber(parameters, 'channelDrift', 0) * 0.045 * work.width
    const angle = (getHeadlinerNumber(parameters, 'driftAngle', 0) * Math.PI) / 180

    const layer = this.layer.context
    if (!layer) return
    this.layer.clear()
    const ages = this.history.map(frame => timing.timeSec - frame.timeSec)
    channels.forEach((channel, lag) => {
      const delay = delays[channel]
      const stored = delay <= 0.001 ? -1 : pickRgbGhostFrame(ages, delay)
      const source = stored >= 0 ? this.history[stored]?.surface.canvas : this.live.canvas
      if (!source) return
      const color = custom ? customColors[lag] : PURE_CHANNEL_COLORS[channel]
      this.drawChannel(source, color, Math.cos(angle) * drift * lag, Math.sin(angle) * drift * lag, work.width, work.height)
      layer.save()
      layer.globalAlpha = 1
      layer.globalCompositeOperation = 'lighter'
      layer.drawImage(this.channel.canvas as HTMLCanvasElement, 0, 0)
      layer.restore()
    })

    compositeLayer(args, this.layer, clamp01(getHeadlinerNumber(parameters, 'ghostAmount', 1)), getHeadlinerString(parameters, 'blendMode', 'normal'))
  }

  /** Filters one picture down to a single colour: black behind it so any uncovered edge adds nothing. */
  private drawChannel(source: HTMLCanvasElement, color: readonly number[], offsetX: number, offsetY: number, width: number, height: number): void {
    const target = this.channel.context
    if (!target) return
    target.save()
    target.globalAlpha = 1
    target.globalCompositeOperation = 'source-over'
    target.fillStyle = '#000'
    target.fillRect(0, 0, width, height)
    target.drawImage(source, offsetX, offsetY)
    target.globalCompositeOperation = 'multiply'
    target.fillStyle = `rgb(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])})`
    target.fillRect(0, 0, width, height)
    target.restore()
  }

  private capture(timeSec: number, width: number, height: number): void {
    if (this.history.length > 0 && timeSec - this.lastCaptureSec < 1 / HEADLINER_RGB_GHOST_CAPTURE_HZ) return
    this.lastCaptureSec = timeSec
    const surface = this.spare.pop() ?? new WorkSurface()
    surface.resize(width, height)
    const target = surface.context
    if (!target || !this.live.canvas) {
      this.spare.push(surface)
      return
    }
    target.globalAlpha = 1
    target.globalCompositeOperation = 'source-over'
    target.drawImage(this.live.canvas, 0, 0)
    this.history.unshift({ surface, timeSec })
    while (this.history.length > HEADLINER_RGB_GHOST_MAX_FRAMES) {
      const old = this.history.pop()
      if (old) this.spare.push(old.surface)
    }
  }

  private clearHistory(): void {
    for (const frame of this.history) this.spare.push(frame.surface)
    this.history = []
    this.lastCaptureSec = Number.NEGATIVE_INFINITY
    this.analyzer.reset()
  }

  dispose(): void {
    for (const surface of [...this.history.map(frame => frame.surface), ...this.spare, this.live, this.channel, this.layer]) surface.dispose()
    this.history = []
    this.spare = []
    this.analyzer.dispose()
  }
}

export function createRgbGhostProcessor(): HeadlinerEffectProcessor {
  return new RgbGhostProcessor()
}
