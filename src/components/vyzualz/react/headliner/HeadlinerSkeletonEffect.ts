// Spark Skeleton (priority 16 of the POV document): finds the body points with the shared pose tracker
// (HeadlinerPoseTracking.ts) and turns the performer into a living electronic skeleton or constellation: glowing bones
// with electric jitter, pulsing joint nodes and sparks that fly off fast-moving hands. With nobody found it shows the
// plain camera, and Master Intensity 0 is always the clean camera.

import { getHeadlinerNumber, getHeadlinerString } from './HeadlinerEffectCatalog'
import {
  WorkSurface,
  clamp01,
  compositeLayer,
  drawLive,
  effectStrength,
  lerp,
  resolveHeadlinerWorkSize,
  rgba,
  type HeadlinerEffectProcessor,
  type HeadlinerEffectRenderArgs,
} from './HeadlinerEffectKit'
import {
  HEADLINER_POSE_BONES,
  HeadlinerPoseFilter,
  getHeadlinerPoseTracker,
  mapHeadlinerPoseToCanvas,
  type HeadlinerPoseSource,
} from './HeadlinerPoseTracking'
import { glowNoise } from './HeadlinerSilhouetteEffects'
import { glowPulse, readGlowPalette, resolveGlowColor } from './HeadlinerSilhouetteShapes'

export const HEADLINER_SPARK_MAX = 400
/** Joints that shed sparks when they move fast: the wrists, then the head and elbows. */
const SPARK_JOINTS = [15, 16, 0, 13, 14] as const

export interface HeadlinerSkeletonDeps {
  tracker?: () => HeadlinerPoseSource
}

/** Follow-smoothing time constant for the 0..1 Follow Smoothing setting. */
export function resolvePoseFollowSmoothing(setting: number): number {
  return lerp(0.02, 0.25, clamp01(setting))
}

/** Points along a bone with sideways noise, ends pinned. `jitter` is the sideways reach in px; `seed` and `tick` vary it per bone and per moment. */
export function jaggedBonePoints(ax: number, ay: number, bx: number, by: number, jitter: number, seed: number, tick: number): [number, number][] {
  const length = Math.hypot(bx - ax, by - ay)
  const segments = Math.max(1, Math.min(14, Math.round(length / 26)))
  const points: [number, number][] = [[ax, ay]]
  if (length < 0.5 || jitter <= 0.05) {
    points.push([bx, by])
    return points
  }
  const nx = -(by - ay) / length
  const ny = (bx - ax) / length
  for (let step = 1; step < segments; step += 1) {
    const t = step / segments
    const offset = (glowNoise(seed * 17.3 + step * 3.7 + tick * 11.1) - 0.5) * 2 * jitter
    points.push([lerp(ax, bx, t) + nx * offset, lerp(ay, by, t) + ny * offset])
  }
  points.push([bx, by])
  return points
}

class SparkSkeletonProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'spark-skeleton' as const
  private readonly filter = new HeadlinerPoseFilter()
  private readonly layer = new WorkSurface()
  private tracker: HeadlinerPoseSource | null = null
  private readonly x = new Float32Array(HEADLINER_SPARK_MAX)
  private readonly y = new Float32Array(HEADLINER_SPARK_MAX)
  private readonly vx = new Float32Array(HEADLINER_SPARK_MAX)
  private readonly vy = new Float32Array(HEADLINER_SPARK_MAX)
  private readonly life = new Float32Array(HEADLINER_SPARK_MAX)
  private nextSpark = 0
  private previous = new Map<number, { x: number; y: number }>()

  constructor(private readonly deps: HeadlinerSkeletonDeps = {}) {}

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.layer.context) {
      this.releaseTracker()
      return
    }
    const tracker = this.acquireTracker()
    const sample = tracker.sample(video, timing.timeSec)
    const follow = this.filter.update(sample, timing.timeSec, resolvePoseFollowSmoothing(getHeadlinerNumber(parameters, 'followSmoothing', 0.3)))
    if (!follow.points || follow.presence < 0.01) return

    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    this.layer.resize(work.width, work.height)
    const layer = this.layer.context
    if (!layer) return
    const scale = work.width / 720
    const minVisibility = getHeadlinerNumber(parameters, 'minVisibility', 0.5)
    const mapped = follow.points.map(point => {
      const position = mapHeadlinerPoseToCanvas(point, video.videoWidth, video.videoHeight, sourceRect, work.width, work.height)
      return { ...position, shown: point.visibility >= minVisibility }
    })

    const pulse = glowPulse(parameters, timing.beat, timing.kick)
    const palette = readGlowPalette(parameters)
    const style = getHeadlinerString(parameters, 'style', 'skeleton')
    const width = lerp(1, 7, getHeadlinerNumber(parameters, 'lineWidth', 0.3)) * scale * (1 + pulse * 0.8)
    const jitter = getHeadlinerNumber(parameters, 'jitter', 0.35) * 9 * scale * (1 + pulse)
    const tick = Math.floor(timing.timeSec * 18)
    const nodeSize = lerp(2, 12, getHeadlinerNumber(parameters, 'nodeSize', 0.4)) * scale * (1 + pulse * 0.7)

    this.layer.clear()
    layer.save()
    layer.lineCap = 'round'
    layer.lineJoin = 'round'
    if (style === 'skeleton' || style === 'both') {
      layer.lineWidth = width
      HEADLINER_POSE_BONES.forEach(([from, to], index) => {
        const a = mapped[from]
        const b = mapped[to]
        if (!a.shown || !b.shown) return
        layer.strokeStyle = rgba(resolveGlowColor(palette, index / HEADLINER_POSE_BONES.length, timing.timeSec), 1)
        layer.beginPath()
        jaggedBonePoints(a.x, a.y, b.x, b.y, jitter, index, tick).forEach(([px, py], step) => (step === 0 ? layer.moveTo(px, py) : layer.lineTo(px, py)))
        layer.stroke()
      })
    }
    if (style === 'constellation' || style === 'both') this.drawConstellation(layer, mapped, palette, timing.timeSec, width * 0.45, scale)
    for (let index = 0; index < mapped.length; index += 1) {
      const point = mapped[index]
      if (!point.shown) continue
      layer.fillStyle = rgba(resolveGlowColor(palette, index / mapped.length, timing.timeSec), 1)
      layer.beginPath()
      layer.arc(point.x, point.y, nodeSize * (index === 0 ? 1.6 : index === 15 || index === 16 ? 1.3 : 1), 0, Math.PI * 2)
      layer.fill()
    }
    layer.restore()

    this.updateSparks(layer, mapped, args, palette, scale)

    // Dim the picture so the skeleton reads, then add it with a soft bloom under a crisp copy.
    const dim = getHeadlinerNumber(parameters, 'cameraDim', 0.5) * Math.min(1, strength) * follow.presence
    if (dim > 0.01) {
      args.context.save()
      args.context.fillStyle = `rgba(0, 0, 0, ${clamp01(dim)})`
      args.context.fillRect(0, 0, canvas.width, canvas.height)
      args.context.restore()
    }
    const level = Math.min(1, strength) * follow.presence
    const glow = getHeadlinerNumber(parameters, 'glow', 0.6)
    const blend = getHeadlinerString(parameters, 'blendMode', 'add')
    if (glow > 0.01) compositeLayer(args, this.layer, level * glow, blend, glow * 12 * scale * (canvas.width / work.width))
    compositeLayer(args, this.layer, level, blend)
  }

  /** Thin links between nearby visible points (and always head-to-hands), so the body reads as a web of lights. */
  private drawConstellation(
    layer: CanvasRenderingContext2D,
    mapped: { x: number; y: number; shown: boolean }[],
    palette: ReturnType<typeof readGlowPalette>,
    timeSec: number,
    width: number,
    scale: number,
  ): void {
    layer.lineWidth = Math.max(1, width)
    const reach = 190 * scale
    for (let a = 0; a < mapped.length; a += 1) {
      if (!mapped[a].shown) continue
      for (let b = a + 1; b < mapped.length; b += 1) {
        if (!mapped[b].shown) continue
        const distance = Math.hypot(mapped[a].x - mapped[b].x, mapped[a].y - mapped[b].y)
        const linked = distance < reach || ((a === 0 || a === 15 || a === 16) && (b === 15 || b === 16))
        if (!linked) continue
        layer.strokeStyle = rgba(resolveGlowColor(palette, (a + b) / (2 * mapped.length), timeSec), clamp01(1 - distance / (reach * 2.2)) * 0.8)
        layer.beginPath()
        layer.moveTo(mapped[a].x, mapped[a].y)
        layer.lineTo(mapped[b].x, mapped[b].y)
        layer.stroke()
      }
    }
  }

  /** Sparks fly off joints that are moving fast, and every joint bursts on a kick. */
  private updateSparks(
    layer: CanvasRenderingContext2D,
    mapped: { x: number; y: number; shown: boolean }[],
    args: HeadlinerEffectRenderArgs,
    palette: ReturnType<typeof readGlowPalette>,
    scale: number,
  ): void {
    const { parameters, timing } = args
    const amount = getHeadlinerNumber(parameters, 'sparks', 0.5)
    const dt60 = Math.min(3, timing.dtSec * 60)
    if (amount > 0.01) {
      for (const joint of SPARK_JOINTS) {
        const point = mapped[joint]
        const last = this.previous.get(joint)
        this.previous.set(joint, { x: point.x, y: point.y })
        if (!point.shown || !last) continue
        const speed = Math.hypot(point.x - last.x, point.y - last.y) / scale
        const count = Math.floor(clamp01(speed / 28) * amount * 4 * dt60 + Math.random())
        for (let n = 0; n < count; n += 1) this.emit(point.x, point.y, (point.x - last.x) * 0.35, (point.y - last.y) * 0.35, scale)
      }
      if (timing.kickHit) {
        for (let joint = 0; joint < mapped.length; joint += 3) {
          if (mapped[joint].shown) for (let n = 0; n < Math.ceil(amount * 3); n += 1) this.emit(mapped[joint].x, mapped[joint].y, 0, 0, scale)
        }
      }
    }
    const drag = Math.pow(0.93, dt60)
    for (let index = 0; index < HEADLINER_SPARK_MAX; index += 1) {
      if (this.life[index] <= 0) continue
      this.life[index] -= timing.dtSec / 0.7
      this.vx[index] *= drag
      this.vy[index] = this.vy[index] * drag + 0.15 * scale * dt60
      this.x[index] += this.vx[index] * dt60
      this.y[index] += this.vy[index] * dt60
      if (this.life[index] <= 0) continue
      const tail = 0.9
      layer.strokeStyle = rgba(resolveGlowColor(palette, glowNoise(index * 1.7), timing.timeSec), clamp01(this.life[index]))
      layer.lineWidth = Math.max(1, 2.2 * scale * this.life[index])
      layer.beginPath()
      layer.moveTo(this.x[index], this.y[index])
      layer.lineTo(this.x[index] - this.vx[index] * tail, this.y[index] - this.vy[index] * tail)
      layer.stroke()
    }
  }

  private emit(x: number, y: number, vx: number, vy: number, scale: number): void {
    const index = this.nextSpark
    this.nextSpark = (this.nextSpark + 1) % HEADLINER_SPARK_MAX
    const angle = Math.random() * Math.PI * 2
    const speed = (1 + Math.random() * 5) * scale
    this.x[index] = x
    this.y[index] = y
    this.vx[index] = vx + Math.cos(angle) * speed
    this.vy[index] = vy + Math.sin(angle) * speed
    this.life[index] = 0.6 + Math.random() * 0.4
  }

  private acquireTracker(): HeadlinerPoseSource {
    if (!this.tracker) {
      this.tracker = (this.deps.tracker ?? getHeadlinerPoseTracker)()
      this.tracker.acquire()
    }
    return this.tracker
  }

  private releaseTracker(): void {
    this.tracker?.release()
    this.tracker = null
    this.filter.reset()
    this.life.fill(0)
    this.previous.clear()
  }

  dispose(): void {
    this.releaseTracker()
    this.layer.dispose()
  }
}

export function createSparkSkeletonProcessor(deps?: HeadlinerSkeletonDeps): HeadlinerEffectProcessor {
  return new SparkSkeletonProcessor(deps)
}
