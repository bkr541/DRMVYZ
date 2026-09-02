import {
  CANVAS_LAYER_EFFECT_IDS,
  type CanvasLayerEffectId,
} from './CanvasPerformanceTypes'

export interface CanvasLayerEffectFrameContext {
  bass: number
  high: number
  beat: number
  transient: number
  bpm: number
  absoluteBeat: number
  audioTimeSec: number
  isPlaying: boolean
  isPaused: boolean
}

export interface CanvasLayerEffectRenderStep {
  id: CanvasLayerEffectId
  amount: number
  variation: number
  stutterBucket: number | null
}

export interface CanvasLayerEffectRuntimeDescriptor {
  id: string
  sourceIdentity: string
  effects: readonly CanvasLayerEffectId[]
}

type RuntimeCanvas = HTMLCanvasElement

/**
 * Bounded multi-tap delay line for Add Effects -> Echo. Slots are captured at
 * a decimated rate (not every frame) so a handful of reused canvases can span
 * a useful temporal window instead of storing an unbounded frame list.
 */
type EchoRingState = {
  slots: (RuntimeCanvas | null)[]
  filled: number
  writeIndex: number
  frameCounter: number
}

type RuntimeEntry = {
  sourceIdentity: string
  effectSignature: string
  width: number
  height: number
  echoHistory: EchoRingState | null
  stutterFrame: RuntimeCanvas | null
  meltSample: RuntimeCanvas | null
  stutterBucket: number | null
  stutterInitialized: boolean
}

const EFFECT_ID_SET = new Set<string>(CANVAS_LAYER_EFFECT_IDS)
const TEMPORAL_EFFECTS = new Set<CanvasLayerEffectId>(['echo', 'stutter'])
const MELT_SAMPLE_COLUMNS = 16
const MELT_SAMPLE_ROWS = 6
const ECHO_RING_SIZE = 4
const ECHO_CAPTURE_STRIDE = 4

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function normalizedEffects(effects: readonly CanvasLayerEffectId[] | undefined): CanvasLayerEffectId[] {
  if (!effects?.length) return []
  const seen = new Set<CanvasLayerEffectId>()
  const result: CanvasLayerEffectId[] = []
  for (const effect of effects) {
    if (!EFFECT_ID_SET.has(effect) || seen.has(effect)) continue
    seen.add(effect)
    result.push(effect)
    if (result.length >= CANVAS_LAYER_EFFECT_IDS.length) break
  }
  return result
}

function resolveBeatPosition(context: CanvasLayerEffectFrameContext): number {
  if (Number.isFinite(context.absoluteBeat) && context.absoluteBeat >= 0) return context.absoluteBeat
  const bpm = Math.max(1, Number.isFinite(context.bpm) ? context.bpm : 120)
  return Math.max(0, context.audioTimeSec) * bpm / 60
}

/**
 * Resolves the Stage 3 ordered user-effect vocabulary into deterministic frame
 * steps. This intentionally stays separate from CanvasEffectNode[] because Echo
 * and Stutter own temporal buffers that primitive stateless nodes cannot model.
 */
export function resolveCanvasLayerEffectRenderPlan(
  layerId: string,
  effects: readonly CanvasLayerEffectId[] | undefined,
  context: CanvasLayerEffectFrameContext,
): readonly CanvasLayerEffectRenderStep[] {
  const ordered = normalizedEffects(effects)
  const bass = clamp01(context.bass)
  const high = clamp01(context.high)
  const beat = context.isPlaying && !context.isPaused ? clamp01(context.beat) : 0
  const transient = context.isPlaying && !context.isPaused ? clamp01(context.transient) : 0
  const beatPosition = resolveBeatPosition(context)
  const phaseBucket = Math.max(0, Math.floor(beatPosition * 8))

  return ordered.map((id, index) => {
    const variation = (stableHash(`${layerId}:${id}:${phaseBucket}:${index}`) % 10_000) / 10_000
    switch (id) {
      case 'bloom':
        return { id, amount: clamp01(0.55 + bass * 0.35 + beat * 0.1), variation, stutterBucket: null }
      case 'echo':
        // Quiet at rest so a static layer is not permanently smeared; bass
        // and beat drive it up to a strong expansion.
        return { id, amount: clamp01(0.14 + bass * 0.5 + beat * 0.22), variation, stutterBucket: null }
      case 'glitch':
        return { id, amount: clamp01(0.34 + beat * 0.38 + transient * 0.2 + high * 0.08), variation, stutterBucket: null }
      case 'melt':
        return { id, amount: clamp01(0.46 + bass * 0.12 + high * 0.16), variation, stutterBucket: null }
      case 'stutter': {
        const amount = clamp01(beat * 0.72 + transient * 0.18 + bass * 0.1)
        const stutterBucket = context.isPlaying && !context.isPaused
          ? resolveStutterBucket(beatPosition, amount)
          : null
        return { id, amount, variation, stutterBucket }
      }
    }
  })
}

function resolveStutterBucket(beatPosition: number, amount: number): number | null {
  if (amount <= 0.04) return null
  const subdivisions = 2 + Math.round(amount * 4)
  const position = beatPosition * subdivisions
  const bucket = Math.max(0, Math.floor(position))
  const phase = position - bucket
  const liveFraction = Math.max(0.14, 0.96 - amount * 0.82)
  return phase >= liveFraction ? bucket : null
}

function effectSignature(effects: readonly CanvasLayerEffectId[]): string {
  return effects.join('>')
}

function resizeRuntimeCanvas(canvas: RuntimeCanvas, width: number, height: number): void {
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
}

function releaseRuntimeCanvas(canvas: RuntimeCanvas | null): void {
  if (!canvas) return
  canvas.width = 0
  canvas.height = 0
}

function releaseEchoRing(ring: EchoRingState | null): void {
  if (!ring) return
  for (const slot of ring.slots) releaseRuntimeCanvas(slot)
}

/**
 * Bounded runtime ownership for authored layer effects. At most one entry is
 * retained per stable layer ID; Echo/Stutter own full-size temporal canvases.
 */
export class CanvasLayerEffectRuntime {
  private readonly entries = new Map<string, RuntimeEntry>()

  constructor(private readonly createCanvas: () => RuntimeCanvas | null) {}

  get size(): number {
    return this.entries.size
  }

  has(layerId: string): boolean {
    return this.entries.has(layerId)
  }

  getTemporalAllocationCount(layerId: string): number {
    const entry = this.entries.get(layerId)
    if (!entry) return 0
    return Number(Boolean(entry.echoHistory)) + Number(Boolean(entry.stutterFrame))
  }

  reconcile(activeLayers: readonly CanvasLayerEffectRuntimeDescriptor[]): void {
    const activeById = new Map(activeLayers.map(layer => [layer.id, layer]))
    for (const [layerId, entry] of this.entries) {
      const active = activeById.get(layerId)
      if (
        !active
        || entry.sourceIdentity !== active.sourceIdentity
        || entry.effectSignature !== effectSignature(normalizedEffects(active.effects))
      ) this.releaseEntry(layerId)
    }
  }

  dispose(): void {
    for (const layerId of this.entries.keys()) this.releaseEntry(layerId)
  }

  private releaseEntry(layerId: string): void {
    const entry = this.entries.get(layerId)
    if (!entry) return
    releaseEchoRing(entry.echoHistory)
    releaseRuntimeCanvas(entry.stutterFrame)
    releaseRuntimeCanvas(entry.meltSample)
    this.entries.delete(layerId)
  }

  private entryFor(
    layerId: string,
    sourceIdentity: string,
    effects: readonly CanvasLayerEffectId[],
    width: number,
    height: number,
  ): RuntimeEntry {
    const signature = effectSignature(effects)
    const existing = this.entries.get(layerId)
    if (
      existing
      && existing.sourceIdentity === sourceIdentity
      && existing.effectSignature === signature
      && existing.width === width
      && existing.height === height
    ) return existing
    if (existing) this.releaseEntry(layerId)

    const next: RuntimeEntry = {
      sourceIdentity,
      effectSignature: signature,
      width,
      height,
      echoHistory: null,
      stutterFrame: null,
      meltSample: null,
      stutterBucket: null,
      stutterInitialized: false,
    }
    this.entries.set(layerId, next)
    return next
  }

  private temporalCanvas(entry: RuntimeEntry): RuntimeCanvas | null {
    const existing = entry.stutterFrame
    if (existing) {
      resizeRuntimeCanvas(existing, entry.width, entry.height)
      return existing
    }
    const canvas = this.createCanvas()
    if (!canvas) return null
    resizeRuntimeCanvas(canvas, entry.width, entry.height)
    entry.stutterFrame = canvas
    return canvas
  }

  private echoRingFor(entry: RuntimeEntry): EchoRingState {
    if (!entry.echoHistory) {
      entry.echoHistory = {
        slots: new Array<RuntimeCanvas | null>(ECHO_RING_SIZE).fill(null),
        filled: 0,
        writeIndex: 0,
        frameCounter: 0,
      }
    }
    return entry.echoHistory
  }

  private allocateEchoSlot(ring: EchoRingState, index: number, width: number, height: number): RuntimeCanvas | null {
    const existing = ring.slots[index]
    if (existing) {
      resizeRuntimeCanvas(existing, width, height)
      return existing
    }
    const canvas = this.createCanvas()
    if (!canvas) return null
    resizeRuntimeCanvas(canvas, width, height)
    ring.slots[index] = canvas
    return canvas
  }

  private meltSampleCanvas(entry: RuntimeEntry): RuntimeCanvas | null {
    if (entry.meltSample) {
      resizeRuntimeCanvas(entry.meltSample, MELT_SAMPLE_COLUMNS, MELT_SAMPLE_ROWS)
      return entry.meltSample
    }
    const canvas = this.createCanvas()
    if (!canvas) return null
    resizeRuntimeCanvas(canvas, MELT_SAMPLE_COLUMNS, MELT_SAMPLE_ROWS)
    entry.meltSample = canvas
    return canvas
  }

  render({
    layerId,
    sourceIdentity,
    mediaType,
    effects,
    source,
    scratchA,
    scratchB,
    width,
    height,
    context,
  }: {
    layerId: string
    sourceIdentity: string
    mediaType: 'image' | 'video' | 'svg'
    effects: readonly CanvasLayerEffectId[] | undefined
    source: RuntimeCanvas
    scratchA: RuntimeCanvas
    scratchB: RuntimeCanvas
    width: number
    height: number
    context: CanvasLayerEffectFrameContext
  }): RuntimeCanvas {
    const plan = resolveCanvasLayerEffectRenderPlan(layerId, effects, context)
    if (plan.length === 0) {
      this.releaseEntry(layerId)
      return source
    }

    const orderedEffects = plan.map(step => step.id)
    const entry = this.entryFor(layerId, sourceIdentity, orderedEffects, width, height)
    resizeRuntimeCanvas(scratchA, width, height)
    resizeRuntimeCanvas(scratchB, width, height)

    let input = source
    let output = scratchA
    for (const step of plan) {
      const outputContext = output.getContext('2d', { alpha: true })
      if (!outputContext) return input
      outputContext.setTransform(1, 0, 0, 1, 0, 0)
      outputContext.clearRect(0, 0, width, height)

      switch (step.id) {
        case 'bloom':
          renderBloom(outputContext, input, width, height, step.amount)
          break
        case 'echo': {
          const ring = this.echoRingFor(entry)
          renderEcho(
            outputContext,
            input,
            width,
            height,
            step.amount,
            ring,
            layerId,
            index => this.allocateEchoSlot(ring, index, width, height),
          )
          break
        }
        case 'glitch':
          renderGlitch(outputContext, input, width, height, step.amount, step.variation, context)
          break
        case 'melt':
          renderMelt(
            outputContext,
            input,
            width,
            height,
            step.amount,
            step.variation,
            context,
            this.meltSampleCanvas(entry),
          )
          break
        case 'stutter':
          renderStutter(
            outputContext,
            input,
            width,
            height,
            mediaType,
            step.amount,
            step.stutterBucket,
            entry,
            step.amount > 0.04 ? this.temporalCanvas(entry) : null,
          )
          break
      }

      input = output
      output = output === scratchA ? scratchB : scratchA
    }

    return input
  }
}

function drawFull(context: CanvasRenderingContext2D, source: RuntimeCanvas, width: number, height: number): void {
  context.drawImage(source, 0, 0, width, height)
}

function renderBloom(
  context: CanvasRenderingContext2D,
  source: RuntimeCanvas,
  width: number,
  height: number,
  amount: number,
): void {
  drawFull(context, source, width, height)
  context.save()
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = 0.2 + amount * 0.26
  context.filter = `blur(${(3 + amount * 8).toFixed(2)}px) brightness(${(1.05 + amount * 0.26).toFixed(3)}) saturate(${(1.02 + amount * 0.16).toFixed(3)})`
  context.translate(width / 2, height / 2)
  const scale = 1 + amount * 0.022
  context.scale(scale, scale)
  context.drawImage(source, -width / 2, -height / 2, width, height)
  context.restore()
}

/**
 * Add Effects -> Echo: a multi-tap temporal ghost. Unlike the preset-native
 * trail/feedback systems, this owns a small non-recursive delay line per
 * layer: a handful of historical copies of this layer's own pre-Echo source
 * are captured at a decimated rate and redrawn with progressively stronger
 * scale/offset/opacity so the separation reads clearly even on static media,
 * where adjacent source frames are identical.
 */
function renderEcho(
  context: CanvasRenderingContext2D,
  source: RuntimeCanvas,
  width: number,
  height: number,
  amount: number,
  ring: EchoRingState,
  layerId: string,
  allocateSlot: (index: number) => RuntimeCanvas | null,
): void {
  drawFull(context, source, width, height)

  if (ring.frameCounter % ECHO_CAPTURE_STRIDE === 0) {
    const slot = allocateSlot(ring.writeIndex)
    if (slot) {
      const slotContext = slot.getContext('2d', { alpha: true })
      if (slotContext) {
        slotContext.setTransform(1, 0, 0, 1, 0, 0)
        slotContext.clearRect(0, 0, width, height)
        slotContext.globalCompositeOperation = 'source-over'
        slotContext.globalAlpha = 1
        slotContext.filter = 'none'
        slotContext.drawImage(source, 0, 0, width, height)
      }
      ring.writeIndex = (ring.writeIndex + 1) % ECHO_RING_SIZE
      ring.filled = Math.min(ECHO_RING_SIZE, ring.filled + 1)
    }
  }
  ring.frameCounter += 1

  // A fourth ghost only unlocks on stronger audio energy so the resting
  // state stays tasteful while bass pulses read as a clear expansion.
  const maxTaps = amount > 0.72 ? ECHO_RING_SIZE : ECHO_RING_SIZE - 1
  const tapCount = Math.min(maxTaps, ring.filled)
  if (tapCount <= 0) return

  const minSpan = Math.min(width, height)
  // One stable per-layer rotation; taps are then fanned evenly around the
  // full circle so the echo expands in all directions from the media rather
  // than piling up toward one corner. Audio only modulates travel distance.
  const baseAngle = (stableHash(`${layerId}:echo`) / 4294967295) * Math.PI * 2
  for (let tap = 0; tap < tapCount; tap += 1) {
    const slotIndex = (ring.writeIndex - 1 - tap + ECHO_RING_SIZE * 4) % ECHO_RING_SIZE
    const slot = ring.slots[slotIndex]
    if (!slot) continue

    const t = tap / (ECHO_RING_SIZE - 1)
    const angle = baseAngle + tap * ((Math.PI * 2) / ECHO_RING_SIZE)
    const scale = 1.018 + t * 0.085 + amount * 0.05 * (tap + 1)
    // Opacity tracks the audio-driven amount instead of sitting on a high
    // floor, so the resting echo is a faint ghost, not a full-strength one.
    const opacity = clamp01((0.44 - t * 0.34) * (0.22 + amount))
    const offsetMag = (0.007 + t * 0.026) * (1 + amount * 0.9) * minSpan

    context.save()
    context.globalCompositeOperation = 'source-over'
    context.globalAlpha = opacity
    context.filter = `blur(${(0.5 + t * 1.6).toFixed(2)}px)`
    context.translate(width / 2 + Math.cos(angle) * offsetMag, height / 2 + Math.sin(angle) * offsetMag)
    context.scale(scale, scale)
    context.drawImage(slot, -width / 2, -height / 2, width, height)
    context.restore()
  }
}

function renderGlitch(
  context: CanvasRenderingContext2D,
  source: RuntimeCanvas,
  width: number,
  height: number,
  amount: number,
  variation: number,
  frame: CanvasLayerEffectFrameContext,
): void {
  drawFull(context, source, width, height)
  const activePulse = clamp01(Math.max(frame.beat, frame.transient))
  const split = Math.max(1, Math.round((2 + amount * 12) * (0.55 + activePulse * 0.8)))

  context.save()
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = 0.08 + amount * 0.15
  context.drawImage(source, split, 0, width, height)
  context.drawImage(source, -split, 0, width, height)
  context.restore()

  const sliceCount = 3 + Math.round(amount * 5)
  for (let index = 0; index < sliceCount; index += 1) {
    const local = (variation + index * 0.173 + frame.absoluteBeat * 0.071) % 1
    const sliceHeight = Math.max(2, Math.round(height * (0.012 + ((local * 1.7) % 1) * 0.055)))
    const y = Math.round(((local * 3.13) % 1) * Math.max(0, height - sliceHeight))
    const direction = index % 2 === 0 ? 1 : -1
    const offset = direction * Math.round((3 + amount * 24) * (0.45 + local))
    context.save()
    context.beginPath()
    context.rect(0, y, width, sliceHeight)
    context.clip()
    context.globalCompositeOperation = index % 3 === 0 ? 'screen' : 'source-over'
    context.globalAlpha = Math.min(0.9, 0.42 + amount * 0.42)
    context.drawImage(source, offset, 0, width, height)
    context.restore()
  }
}

function renderMelt(
  context: CanvasRenderingContext2D,
  source: RuntimeCanvas,
  width: number,
  height: number,
  amount: number,
  variation: number,
  frame: CanvasLayerEffectFrameContext,
  sampleCanvas: RuntimeCanvas | null,
): void {
  drawFull(context, source, width, height)
  if (!sampleCanvas) return

  const sampleContext = sampleCanvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!sampleContext) return
  sampleContext.setTransform(1, 0, 0, 1, 0, 0)
  sampleContext.clearRect(0, 0, MELT_SAMPLE_COLUMNS, MELT_SAMPLE_ROWS)
  sampleContext.globalCompositeOperation = 'source-over'
  sampleContext.globalAlpha = 1
  sampleContext.filter = 'none'
  sampleContext.drawImage(source, 0, 0, MELT_SAMPLE_COLUMNS, MELT_SAMPLE_ROWS)

  let pixels: Uint8ClampedArray
  try {
    pixels = sampleContext.getImageData(0, 0, MELT_SAMPLE_COLUMNS, MELT_SAMPLE_ROWS).data
  } catch {
    return
  }

  const phase = frame.audioTimeSec * (0.45 + amount * 0.35) + variation * Math.PI * 2
  for (let row = 0; row < MELT_SAMPLE_ROWS; row += 1) {
    const sourceY = Math.floor(row * height / MELT_SAMPLE_ROWS)
    const nextY = Math.floor((row + 1) * height / MELT_SAMPLE_ROWS)
    const sourceHeight = Math.max(1, nextY - sourceY)
    for (let column = 0; column < MELT_SAMPLE_COLUMNS; column += 1) {
      const pixelIndex = (row * MELT_SAMPLE_COLUMNS + column) * 4
      const alpha = pixels[pixelIndex + 3] / 255
      if (alpha <= 0.01) continue
      const luminance = (
        pixels[pixelIndex] * 0.2126
        + pixels[pixelIndex + 1] * 0.7152
        + pixels[pixelIndex + 2] * 0.0722
      ) / 255 * alpha
      const luminanceWeight = clamp01((luminance - 0.1) / 0.9)
      if (luminanceWeight <= 0.025) continue

      const sourceX = Math.floor(column * width / MELT_SAMPLE_COLUMNS)
      const nextX = Math.floor((column + 1) * width / MELT_SAMPLE_COLUMNS)
      const sourceWidth = Math.max(1, nextX - sourceX)
      const wave = (Math.sin(phase + column * 0.83 + row * 0.47) + 1) * 0.5
      const maxDrop = Math.max(2, height * (0.018 + amount * 0.09))
      const drop = Math.max(1, Math.round(maxDrop * luminanceWeight * (0.7 + wave * 0.55)))
      const destinationY = Math.min(height - 1, sourceY + Math.round(drop * 0.16))
      const destinationHeight = Math.min(height - destinationY, sourceHeight + drop)
      if (destinationHeight <= 0) continue

      context.save()
      context.beginPath()
      context.rect(sourceX, sourceY, sourceWidth + 1, Math.min(height - sourceY, sourceHeight + drop))
      context.clip()
      context.globalCompositeOperation = 'source-over'
      context.globalAlpha = Math.min(0.9, 0.16 + amount * luminanceWeight * 0.68)
      context.filter = `blur(${(0.35 + amount * luminanceWeight * 2.4).toFixed(2)}px)`
      context.drawImage(
        source,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        sourceX,
        destinationY,
        sourceWidth,
        destinationHeight,
      )
      context.restore()
    }
  }
}

function renderStutter(
  context: CanvasRenderingContext2D,
  source: RuntimeCanvas,
  width: number,
  height: number,
  mediaType: 'image' | 'video' | 'svg',
  amount: number,
  bucket: number | null,
  entry: RuntimeEntry,
  held: RuntimeCanvas | null,
): void {
  if (!held || amount <= 0.04) {
    drawFull(context, source, width, height)
    return
  }
  const heldContext = held.getContext('2d', { alpha: true })
  if (!heldContext) {
    drawFull(context, source, width, height)
    return
  }

  const shouldRefresh = mediaType !== 'video'
    || !entry.stutterInitialized
    || bucket === null
    || entry.stutterBucket !== bucket

  if (shouldRefresh) {
    heldContext.setTransform(1, 0, 0, 1, 0, 0)
    heldContext.clearRect(0, 0, width, height)
    heldContext.globalCompositeOperation = 'source-over'
    heldContext.globalAlpha = 1
    heldContext.filter = 'none'
    heldContext.drawImage(source, 0, 0, width, height)
    entry.stutterInitialized = true
    entry.stutterBucket = bucket
  }

  if (bucket === null || mediaType !== 'video') {
    drawFull(context, source, width, height)
    return
  }

  drawFull(context, source, width, height)
  context.save()
  context.globalCompositeOperation = 'source-over'
  context.globalAlpha = clamp01(0.12 + amount * 0.88)
  context.drawImage(held, 0, 0, width, height)
  context.restore()
}

export function canvasLayerHasTemporalEffects(effects: readonly CanvasLayerEffectId[] | undefined): boolean {
  return Boolean(effects?.some(effect => TEMPORAL_EFFECTS.has(effect)))
}
