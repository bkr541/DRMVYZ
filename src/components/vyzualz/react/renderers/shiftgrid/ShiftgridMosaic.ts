import type { CanvasShiftgridMosaicType, CanvasShiftgridSettings, CanvasShiftgridWaveRoute } from './ShiftgridSettings'

export type ShiftgridImplementedMosaicType = Exclude<CanvasShiftgridMosaicType, 'singleImage' | 'autoMosaic'>

export interface ShiftgridMosaicStep {
  id: string
  topology: string
  startMs: number
  durationMs: number
  affectedTileIndices: readonly number[]
  fromSourceIndicesByTile: readonly number[]
  toSourceIndicesByTile: readonly number[]
}

export interface ShiftgridMosaicPlan {
  requestedType: CanvasShiftgridMosaicType
  resolvedType: Exclude<CanvasShiftgridMosaicType, 'autoMosaic'>
  seed: number
  sourceCount: number
  targetSourceIndex: number
  initialSourceIndicesByTile: readonly number[]
  finalSourceIndicesByTile: readonly number[]
  steps: readonly ShiftgridMosaicStep[]
  durationMs: number
}

type MosaicSettings = Pick<CanvasShiftgridSettings,
  'mosaicType' | 'movementSpeed' | 'movementAmount' | 'stagger' | 'scrambleComplexity' | 'deterministicSeed' | 'avoidImmediateRepeat' | 'primaryTargetMediaId' | 'waveRoute'>

const AUTO_TYPES: readonly ShiftgridImplementedMosaicType[] = [
  'imageTakeover', 'hybridMosaic', 'travelingImageWave', 'callAndResponse', 'progressiveIdentityReveal',
]

function unit(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return ((value ^ (value >>> 15)) >>> 0) / 0x100000000
}

function assertAssignments(assignments: readonly number[], tileCount: number, sourceCount: number): void {
  if (assignments.length !== tileCount || assignments.some(source => !Number.isInteger(source) || source < 0 || source >= sourceCount)) {
    throw new Error('SHIFTGRID mosaic generated an invalid source assignment')
  }
}

function transitionDuration(settings: MosaicSettings): number {
  return Math.round(680 - Math.min(2, Math.max(0, settings.movementSpeed)) * 240)
}

class MosaicBuilder {
  private current: number[]
  private readonly steps: ShiftgridMosaicStep[] = []
  private durationMs = 0

  constructor(
    private readonly requestedType: CanvasShiftgridMosaicType,
    private readonly resolvedType: Exclude<CanvasShiftgridMosaicType, 'autoMosaic'>,
    private readonly seed: number,
    private readonly sourceCount: number,
    private readonly targetSourceIndex: number,
    initial: readonly number[],
  ) { this.current = [...initial] }

  add(target: readonly number[], startMs: number, durationMs: number, topology: string): void {
    assertAssignments(target, this.current.length, this.sourceCount)
    const affected = target.flatMap((source, tile) => source === this.current[tile] ? [] : [tile])
    if (affected.length === 0) return
    const step: ShiftgridMosaicStep = Object.freeze({
      id: `${this.resolvedType}:${this.steps.length}`,
      topology,
      startMs: Math.max(0, startMs),
      durationMs: Math.max(60, durationMs),
      affectedTileIndices: Object.freeze(affected),
      fromSourceIndicesByTile: Object.freeze([...this.current]),
      toSourceIndicesByTile: Object.freeze([...target]),
    })
    this.steps.push(step)
    this.current = [...target]
    this.durationMs = Math.max(this.durationMs, step.startMs + step.durationMs)
  }

  finish(initial: readonly number[]): ShiftgridMosaicPlan {
    return Object.freeze({
      requestedType: this.requestedType,
      resolvedType: this.resolvedType,
      seed: this.seed,
      sourceCount: this.sourceCount,
      targetSourceIndex: this.targetSourceIndex,
      initialSourceIndicesByTile: Object.freeze([...initial]),
      finalSourceIndicesByTile: Object.freeze([...this.current]),
      steps: Object.freeze(this.steps),
      durationMs: this.durationMs,
    })
  }
}

export function resolveShiftgridAutoMosaicType(seed: number, sequenceIndex: number, previous?: ShiftgridImplementedMosaicType | null): ShiftgridImplementedMosaicType {
  let index = Math.floor(unit(seed, sequenceIndex + 41) * AUTO_TYPES.length)
  if (previous && AUTO_TYPES[index] === previous) index = (index + 1) % AUTO_TYPES.length
  return AUTO_TYPES[index]!
}

export function selectShiftgridTargetSource({ sourceIds, settings, sequenceIndex, previousTargetIndex = -1 }: {
  sourceIds: readonly string[]
  settings: Pick<MosaicSettings, 'primaryTargetMediaId' | 'avoidImmediateRepeat' | 'deterministicSeed'>
  sequenceIndex: number
  previousTargetIndex?: number
}): number {
  if (sourceIds.length === 0) return -1
  const manual = settings.primaryTargetMediaId ? sourceIds.indexOf(settings.primaryTargetMediaId) : -1
  if (manual >= 0) return manual
  let next = sequenceIndex % sourceIds.length
  if (settings.avoidImmediateRepeat && sourceIds.length > 1 && next === previousTargetIndex) next = (next + 1) % sourceIds.length
  return next
}

function groupReplace(builder: MosaicBuilder, initial: readonly number[], order: readonly number[], targetSource: number, settings: MosaicSettings, topology: string, startOffsetMs = 0): void {
  let current = [...initial]
  const duration = transitionDuration(settings)
  const groupSize = Math.max(1, Math.round(order.length / (3 + settings.scrambleComplexity * 7)))
  const spacing = duration * (0.3 + settings.stagger * 0.7)
  for (let start = 0, group = 0; start < order.length; start += groupSize, group += 1) {
    for (const tile of order.slice(start, start + groupSize)) current[tile] = targetSource
    builder.add(current, startOffsetMs + group * spacing, duration, topology)
  }
}

function rowMajor(tileCount: number): number[] { return Array.from({ length: tileCount }, (_, index) => index) }

function waveOrder(columns: number, rows: number, route: CanvasShiftgridWaveRoute, seed: number): number[] {
  const resolved = route === 'auto' ? (['horizontal', 'vertical', 'serpentine'] as const)[Math.floor(unit(seed, 71) * 3)]! : route
  if (resolved === 'vertical') {
    return Array.from({ length: columns * rows }, (_, index) => {
      const column = Math.floor(index / rows); const row = index % rows
      return row * columns + column
    })
  }
  if (resolved === 'serpentine') {
    const result: number[] = []
    for (let row = 0; row < rows; row += 1) {
      const line = Array.from({ length: columns }, (_, column) => row * columns + column)
      result.push(...(row % 2 === 0 ? line : line.reverse()))
    }
    return result
  }
  return rowMajor(columns * rows)
}

export function createShiftgridMosaicPlan({ columns, rows, sourceIds, settings, initialSourceIndicesByTile, sequenceIndex = 0, previousTargetIndex = -1, previousAutoType = null }: {
  columns: number
  rows: number
  sourceIds: readonly string[]
  settings: MosaicSettings
  initialSourceIndicesByTile?: readonly number[]
  sequenceIndex?: number
  previousTargetIndex?: number
  previousAutoType?: ShiftgridImplementedMosaicType | null
}): ShiftgridMosaicPlan {
  const tileCount = columns * rows
  const sourceCount = Math.max(1, sourceIds.length)
  const target = Math.max(0, selectShiftgridTargetSource({ sourceIds: sourceIds.length ? sourceIds : ['source'], settings, sequenceIndex, previousTargetIndex }))
  const initialSource = previousTargetIndex >= 0 && previousTargetIndex < sourceCount ? previousTargetIndex : 0
  const initial = initialSourceIndicesByTile ? [...initialSourceIndicesByTile] : Array(tileCount).fill(initialSource)
  assertAssignments(initial, tileCount, sourceCount)
  const requested = sourceCount < 2 ? 'singleImage' : settings.mosaicType
  const resolved = requested === 'autoMosaic'
    ? resolveShiftgridAutoMosaicType(settings.deterministicSeed, sequenceIndex, previousAutoType)
    : requested
  const builder = new MosaicBuilder(requested, resolved, settings.deterministicSeed + sequenceIndex, sourceCount, target, initial)
  if (resolved === 'singleImage') {
    if (initial.some(source => source !== target)) groupReplace(builder, initial, rowMajor(tileCount), target, settings, 'single-image-resolve')
    return builder.finish(initial)
  }

  if (resolved === 'imageTakeover') {
    const order = rowMajor(tileCount).sort((a, b) => Math.floor(a / columns) - Math.floor(b / columns) || unit(settings.deterministicSeed, a) - unit(settings.deterministicSeed, b))
    groupReplace(builder, initial, order, target, settings, 'corresponding-region-takeover')
  } else if (resolved === 'hybridMosaic') {
    const targetAssignments = initial.map((_, tile) => (tile + Math.floor(unit(settings.deterministicSeed + sequenceIndex, tile) * sourceCount)) % sourceCount)
    const duration = transitionDuration(settings)
    let current = [...initial]
    for (let parity = 0; parity < 2; parity += 1) {
      for (let tile = 0; tile < tileCount; tile += 1) if ((Math.floor(tile / columns) + tile % columns) % 2 === parity) current[tile] = targetAssignments[tile]!
      builder.add(current, parity * duration * (0.65 + settings.stagger * 0.35), duration, 'multi-source-checker-distribution')
    }
  } else if (resolved === 'travelingImageWave') {
    groupReplace(builder, initial, waveOrder(columns, rows, settings.waveRoute, settings.deterministicSeed + sequenceIndex), target, settings, `traveling-${settings.waveRoute}-wave`)
  } else if (resolved === 'callAndResponse') {
    const response = target
    const call = sourceCount > 1 ? (target + sourceCount - 1) % sourceCount : target
    const duration = transitionDuration(settings); let current = [...initial]
    for (let phase = 0; phase < 4; phase += 1) {
      const responding = phase % 2; const source = phase < 2 ? response : call
      for (let tile = 0; tile < tileCount; tile += 1) if ((Math.floor(tile / columns) + tile % columns) % 2 === responding) current[tile] = source
      builder.add(current, phase * duration * (0.7 + settings.stagger * 0.3), duration, 'alternating-call-response-groups')
    }
    groupReplace(builder, current, rowMajor(tileCount), response, settings, 'response-dominance-resolve', 4 * duration)
  } else {
    let current = initial.map((_, tile) => (tile + Math.floor(unit(settings.deterministicSeed + 97, tile) * sourceCount)) % sourceCount)
    builder.add(current, 0, transitionDuration(settings), 'many-identity-scatter')
    const contributors = Array.from({ length: sourceCount }, (_, index) => index).filter(index => index !== target)
    const duration = transitionDuration(settings)
    contributors.forEach((source, index) => {
      current = current.map(value => value === source ? target : value)
      builder.add(current, (index + 1) * duration * (1 + settings.stagger * 0.2), duration, 'progressive-contributor-elimination')
    })
  }
  return builder.finish(initial)
}

export function createShiftgridMosaicResolvePlan({ columns, rows, sourceCount, targetSourceIndex, initialSourceIndicesByTile, settings }: {
  columns: number
  rows: number
  sourceCount: number
  targetSourceIndex: number
  initialSourceIndicesByTile: readonly number[]
  settings: MosaicSettings
}): ShiftgridMosaicPlan {
  const sourceIds = Array.from({ length: sourceCount }, (_, index) => `source-${index}`)
  const resolveSettings = { ...settings, mosaicType: 'imageTakeover' as const, primaryTargetMediaId: sourceIds[targetSourceIndex] ?? sourceIds[0]! }
  return createShiftgridMosaicPlan({ columns, rows, sourceIds, settings: resolveSettings, initialSourceIndicesByTile })
}

export class ShiftgridMosaicPlayback {
  private plan: ShiftgridMosaicPlan
  private timeMs = 0
  private paused = false
  currentSourceIndicesByTile: number[]

  constructor(plan: ShiftgridMosaicPlan) {
    this.plan = plan
    this.currentSourceIndicesByTile = [...plan.initialSourceIndicesByTile]
    this.seek(0)
  }

  get complete(): boolean { return this.timeMs >= this.plan.durationMs }
  get moving(): boolean { return this.plan.steps.some(step => this.timeMs >= step.startMs && this.timeMs < step.startMs + step.durationMs) }
  get timelineMs(): number { return this.timeMs }
  get activePlan(): ShiftgridMosaicPlan { return this.plan }
  setPaused(paused: boolean): void { this.paused = paused }
  advance(deltaMs: number): void { if (!this.paused) this.seek(this.timeMs + Math.max(0, deltaMs)) }
  reset(): void { this.seek(0) }

  seek(timeMs: number): void {
    this.timeMs = Math.min(this.plan.durationMs, Math.max(0, timeMs))
    const settled = [...this.plan.initialSourceIndicesByTile]
    for (const step of this.plan.steps) {
      if (this.timeMs < step.startMs + step.durationMs) continue
      for (const tile of step.affectedTileIndices) settled[tile] = step.toSourceIndicesByTile[tile]!
    }
    assertAssignments(settled, settled.length, this.plan.sourceCount)
    this.currentSourceIndicesByTile = settled
  }

  replacePlan(plan: ShiftgridMosaicPlan): void {
    assertAssignments(plan.initialSourceIndicesByTile, this.currentSourceIndicesByTile.length, plan.sourceCount)
    this.plan = plan
    this.seek(0)
  }

  getTileSource(tileIndex: number): { current: number; pending: number; progress: number } {
    let settled = this.plan.initialSourceIndicesByTile[tileIndex]!
    let active: ShiftgridMosaicStep | null = null
    for (const step of this.plan.steps) {
      if (!step.affectedTileIndices.includes(tileIndex)) continue
      if (this.timeMs >= step.startMs + step.durationMs) settled = step.toSourceIndicesByTile[tileIndex]!
      else if (this.timeMs >= step.startMs && (!active || step.startMs >= active.startMs)) active = step
    }
    return active
      ? { current: active.fromSourceIndicesByTile[tileIndex]!, pending: active.toSourceIndicesByTile[tileIndex]!, progress: Math.min(1, Math.max(0, (this.timeMs - active.startMs) / active.durationMs)) }
      : { current: settled, pending: settled, progress: 1 }
  }
}
