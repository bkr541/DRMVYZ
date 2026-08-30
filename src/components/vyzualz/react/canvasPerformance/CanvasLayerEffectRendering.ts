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

type RuntimeEntry = {
  sourceIdentity: string
  effectSignature: string
  width: number
  height: number
  echoHistory: RuntimeCanvas | null
  stutterFrame: RuntimeCanvas | null
  stutterBucket: number | null
  stutterInitialized: boolean
}

const EFFECT_ID_SET = new Set<string>(CANVAS_LAYER_EFFECT_IDS)
const TEMPORAL_EFFECTS = new Set<CanvasLayerEffectId>(['echo', 'stutter'])

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
        return { id, amount: clamp01(0.48 + bass * 0.16), variation, stutterBucket: null }
      case 'glitch':
        return { id, amount: clamp01(0.34 + beat * 0.38 + transient * 0.2 + high * 0.08), variation, stutterBucket: null }
      case 'melt':
        return { id, amount: clamp01(0.46 + bass * 0.12 + high * 0.16), variation, stutterBucket: null }
      case 'stutter': {
        const stutterBucket = context.isPlaying && !context.isPaused
          ? Math.max(0, Math.floor(beatPosition * 6))
          : null
        return { id, amount: clamp01(0.62 + beat * 0.24), variation, stutterBucket }
      }
    }
  })
}

function effectSignature(effects: readonly CanvasLayerEffectId[]): string {
  return effects.join('>')
}

function resizeRuntimeCanvas(canvas: RuntimeCanvas, width: number, height: number): void {
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
}

/**
 * Bounded temporal ownership for authored layer effects. At most one entry is
 * retained per stable layer ID; only Echo/Stutter allocate persistent canvases.
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
      ) this.entries.delete(layerId)
    }
  }

  dispose(): void {
    this.entries.clear()
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

    const next: RuntimeEntry = {
      sourceIdentity,
      effectSignature: signature,
      width,
      height,
      echoHistory: null,
      stutterFrame: null,
      stutterBucket: null,
      stutterInitialized: false,
    }
    this.entries.set(layerId, next)
    return next
  }

  private temporalCanvas(entry: RuntimeEntry, kind: 'echo' | 'stutter'): RuntimeCanvas | null {
    const existing = kind === 'echo' ? entry.echoHistory : entry.stutterFrame
    if (existing) {
      resizeRuntimeCanvas(existing, entry.width, entry.height)
      return existing
    }
    const canvas = this.createCanvas()
    if (!canvas) return null
    resizeRuntimeCanvas(canvas, entry.width, entry.height)
    if (kind === 'echo') entry.echoHistory = canvas
    else entry.stutterFrame = canvas
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
    if (plan.length === 0) return source

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
        case 'echo':
          renderEcho(outputContext, input, width, height, step.amount, this.temporalCanvas(entry, 'echo'))
          break
        case 'glitch':
          renderGlitch(outputContext, input, width, height, step.amount, step.variation, context)
          break
        case 'melt':
          renderMelt(outputContext, input, width, height, step.amount, step.variation, context)
          break
        case 'stutter':
          renderStutter(
            outputContext,
            input,
            width,
            height,
            mediaType,
            step.stutterBucket,
            entry,
            this.temporalCanvas(entry, 'stutter'),
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

function renderEcho(
  context: CanvasRenderingContext2D,
  source: RuntimeCanvas,
  width: number,
  height: number,
  amount: number,
  history: RuntimeCanvas | null,
): void {
  drawFull(context, source, width, height)
  if (!history) return

  const historyContext = history.getContext('2d', { alpha: true })
  if (!historyContext) return
  context.save()
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = 0.18 + amount * 0.34
  context.filter = `blur(${(0.8 + amount * 2.4).toFixed(2)}px)`
  context.translate(width / 2, height / 2)
  const echoScale = 1 + amount * 0.012
  context.scale(echoScale, echoScale)
  context.drawImage(history, -width / 2, -height / 2, width, height)
  context.restore()

  historyContext.setTransform(1, 0, 0, 1, 0, 0)
  historyContext.clearRect(0, 0, width, height)
  historyContext.globalCompositeOperation = 'source-over'
  historyContext.globalAlpha = 0.82
  historyContext.filter = 'none'
  historyContext.drawImage(context.canvas, 0, 0, width, height)
  historyContext.globalAlpha = 1
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
): void {
  drawFull(context, source, width, height)
  const columns = 12
  const columnWidth = width / columns
  const phase = frame.audioTimeSec * (0.45 + amount * 0.35) + variation * Math.PI * 2

  for (let index = 0; index < columns; index += 1) {
    const wave = (Math.sin(phase + index * 0.91) + 1) * 0.5
    const drop = Math.round((4 + wave * 28) * amount)
    context.save()
    context.beginPath()
    context.rect(index * columnWidth, 0, Math.ceil(columnWidth + 1), height)
    context.clip()
    context.globalCompositeOperation = 'screen'
    context.globalAlpha = 0.08 + amount * 0.2
    context.filter = `blur(${(1.2 + amount * 4.2).toFixed(2)}px) brightness(${(1.12 + amount * 0.42).toFixed(3)}) contrast(${(1.02 + amount * 0.18).toFixed(3)})`
    context.drawImage(source, 0, drop, width, height)
    context.restore()
  }
}

function renderStutter(
  context: CanvasRenderingContext2D,
  source: RuntimeCanvas,
  width: number,
  height: number,
  mediaType: 'image' | 'video' | 'svg',
  bucket: number | null,
  entry: RuntimeEntry,
  held: RuntimeCanvas | null,
): void {
  if (!held) {
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

  drawFull(context, held, width, height)
}

export function canvasLayerHasTemporalEffects(effects: readonly CanvasLayerEffectId[] | undefined): boolean {
  return Boolean(effects?.some(effect => TEMPORAL_EFFECTS.has(effect)))
}
