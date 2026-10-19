import { createDeterministicShiftgridPermutation, createShiftgridRuntimeGridState, isValidShiftgridPermutation, type ShiftgridRuntimeGridState } from './ShiftgridGridState'
import { CANVAS_SHIFTGRID_PATTERN_OPTIONS, type CanvasShiftgridPattern, type CanvasShiftgridReconstructionMode, type CanvasShiftgridSettings } from './ShiftgridSettings'
import type { ShiftgridGridGeometry } from './ShiftgridTileGeometry'

export type ShiftgridRouteAxis = 'horizontal' | 'vertical' | 'mixed' | 'radial' | 'resolve'
export interface ShiftgridChoreographyStep {
  id: string
  topology: string
  axis: ShiftgridRouteAxis
  groupIndex: number
  startMs: number
  durationMs: number
  affectedTileIndices: readonly number[]
  fromSlotsByTile: readonly number[]
  toSlotsByTile: readonly number[]
}
export interface ShiftgridChoreographyPlan {
  pattern: CanvasShiftgridPattern
  seed: number
  columns: number
  rows: number
  initialSlotsByTile: readonly number[]
  finalSlotsByTile: readonly number[]
  steps: readonly ShiftgridChoreographyStep[]
  durationMs: number
}

type PlannerSettings = Pick<CanvasShiftgridSettings,
  'choreographyPattern' | 'movementSpeed' | 'movementAmount' | 'stagger' | 'scrambleComplexity' | 'reconstructionMode' | 'reconstructionSpeed' | 'progressiveResolveDurationSec' | 'deterministicSeed'> & {
    /** Runtime-only beat-duration scale; never persisted. */
    durationScale?: number
  }

function seededUnit(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return ((value ^ (value >>> 15)) >>> 0) / 0x100000000
}

function identity(size: number): number[] { return Array.from({ length: size }, (_, index) => index) }
function tileAtSlot(permutation: readonly number[], slot: number): number { return permutation.indexOf(slot) }

function moveSlots(permutation: readonly number[], mapping: ReadonlyMap<number, number>): number[] {
  const next = permutation.map(slot => mapping.get(slot) ?? slot)
  if (!isValidShiftgridPermutation(next, permutation.length)) throw new Error('SHIFTGRID choreography generated an invalid permutation')
  return next
}

function cycleSlots(permutation: readonly number[], slots: readonly number[], distance: number): number[] {
  if (slots.length < 2) return [...permutation]
  const mapping = new Map<number, number>()
  for (let index = 0; index < slots.length; index += 1) {
    const target = ((index + distance) % slots.length + slots.length) % slots.length
    mapping.set(slots[index]!, slots[target]!)
  }
  return moveSlots(permutation, mapping)
}

function swapSlots(permutation: readonly number[], pairs: readonly (readonly [number, number])[]): number[] {
  const mapping = new Map<number, number>()
  for (const [first, second] of pairs) {
    if (first === second || mapping.has(first) || mapping.has(second)) continue
    mapping.set(first, second); mapping.set(second, first)
  }
  return moveSlots(permutation, mapping)
}

function affectedTiles(from: readonly number[], to: readonly number[]): number[] {
  return from.flatMap((slot, tile) => slot === to[tile] ? [] : [tile])
}

function baseDuration(settings: PlannerSettings): number {
  const scale = Number.isFinite(settings.durationScale) ? Math.min(2, Math.max(0.5, settings.durationScale ?? 1)) : 1
  return Math.round((760 - Math.min(2, Math.max(0, settings.movementSpeed)) * 285) * scale)
}

class PlanBuilder {
  private permutation: number[]
  private readonly steps: ShiftgridChoreographyStep[] = []
  private lastEndMs = 0

  constructor(private readonly pattern: CanvasShiftgridPattern, private readonly seed: number, private readonly columns: number, private readonly rows: number, initial: readonly number[]) {
    if (!isValidShiftgridPermutation(initial, columns * rows)) throw new Error('SHIFTGRID plan requires a valid initial permutation')
    this.permutation = [...initial]
  }

  add(target: readonly number[], startMs: number, durationMs: number, topology: string, axis: ShiftgridRouteAxis, groupIndex: number): void {
    if (!isValidShiftgridPermutation(target, this.permutation.length)) throw new Error('SHIFTGRID plan target is not a permutation')
    const affected = affectedTiles(this.permutation, target)
    if (affected.length === 0) return
    const step: ShiftgridChoreographyStep = Object.freeze({ id: `${this.pattern}:${groupIndex}:${this.steps.length}`, topology, axis, groupIndex,
      startMs: Math.max(0, startMs), durationMs: Math.max(60, durationMs), affectedTileIndices: Object.freeze(affected),
      fromSlotsByTile: Object.freeze([...this.permutation]), toSlotsByTile: Object.freeze([...target]) })
    this.steps.push(step); this.permutation = [...target]; this.lastEndMs = Math.max(this.lastEndMs, step.startMs + step.durationMs)
  }

  finish(initial: readonly number[]): ShiftgridChoreographyPlan {
    return Object.freeze({ pattern: this.pattern, seed: this.seed, columns: this.columns, rows: this.rows,
      initialSlotsByTile: Object.freeze([...initial]), finalSlotsByTile: Object.freeze([...this.permutation]),
      steps: Object.freeze(this.steps), durationMs: this.lastEndMs })
  }
}

function movementCount(total: number, settings: PlannerSettings): number {
  return Math.max(1, Math.min(total, Math.round(total * (0.2 + settings.movementAmount * 0.8))))
}

function rowRunner(builder: PlanBuilder, initial: readonly number[], columns: number, rows: number, settings: PlannerSettings): void {
  let current = [...initial]; const duration = baseDuration(settings); const spacing = duration * (0.18 + settings.stagger * 0.82)
  const count = movementCount(rows, settings); const distance = Math.max(1, Math.round(1 + settings.scrambleComplexity * Math.max(1, columns / 3)))
  const offset = Math.floor(seededUnit(settings.deterministicSeed, 1) * rows); const direction = seededUnit(settings.deterministicSeed, 2) < 0.5 ? 1 : -1
  for (let index = 0; index < count; index += 1) {
    const row = (index + offset) % rows; const slots = Array.from({ length: columns }, (_, column) => row * columns + column)
    current = cycleSlots(current, slots, (index % 2 === 0 ? direction : -direction) * distance)
    builder.add(current, index * spacing, duration, 'alternating-whole-row-cycle', 'horizontal', row)
  }
}

function columnCascade(builder: PlanBuilder, initial: readonly number[], columns: number, rows: number, settings: PlannerSettings): void {
  let current = [...initial]; const duration = baseDuration(settings) * 0.92; const spacing = duration * (0.12 + settings.stagger * 0.72)
  const count = movementCount(columns, settings); const distance = Math.max(1, Math.round(1 + settings.scrambleComplexity * Math.max(1, rows / 3)))
  const offset = Math.floor(seededUnit(settings.deterministicSeed, 3) * columns)
  for (let index = 0; index < count; index += 1) {
    const column = (index + offset) % columns; const slots = Array.from({ length: rows }, (_, row) => row * columns + column)
    current = cycleSlots(current, slots, (index % 3 === 2 ? -1 : 1) * distance)
    builder.add(current, index * spacing, duration, 'progressive-column-cascade', 'vertical', column)
  }
}

function checkerShift(builder: PlanBuilder, initial: readonly number[], columns: number, rows: number, settings: PlannerSettings): void {
  let current = [...initial]; const duration = baseDuration(settings) * 0.78; let start = 0
  const phases = Math.max(2, Math.round(2 + settings.scrambleComplexity * 4))
  for (let phase = 0; phase < phases; phase += 1) {
    const pairs: Array<readonly [number, number]> = []; const used = new Set<number>(); const horizontal = phase % 2 === 0
    for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
      if ((row + column) % 2 !== (phase + Math.floor(seededUnit(settings.deterministicSeed, 4) * 2)) % 2) continue
      const first = row * columns + column
      const nextRow = horizontal ? row : row + (row + phase < rows - 1 ? 1 : -1)
      const nextColumn = horizontal ? column + (column + phase < columns - 1 ? 1 : -1) : column
      const second = nextRow * columns + nextColumn
      if (second >= 0 && second < columns * rows && !used.has(first) && !used.has(second)) { pairs.push([first, second]); used.add(first); used.add(second) }
    }
    current = swapSlots(current, pairs); builder.add(current, start, duration, 'checkerboard-parity-exchange', horizontal ? 'horizontal' : 'vertical', phase)
    start += duration * (1 + settings.stagger * 0.18)
  }
}

function dominoChain(builder: PlanBuilder, initial: readonly number[], columns: number, rows: number, settings: PlannerSettings): void {
  let current = [...initial]; const duration = baseDuration(settings) * 0.5
  const path: number[] = []
  for (let row = 0; row < rows; row += 1) {
    const columnsInRow = Array.from({ length: columns }, (_, column) => row * columns + column)
    path.push(...(row % 2 === 0 ? columnsInRow : columnsInRow.reverse()))
  }
  if (seededUnit(settings.deterministicSeed, 5) < 0.5) path.reverse()
  const operations = movementCount(Math.max(1, path.length - 1), settings)
  for (let index = 0; index < operations; index += 1) {
    current = swapSlots(current, [[path[index]!, path[index + 1]!]])
    builder.add(current, index * duration * (1 + settings.stagger * 0.2), duration, 'serpentine-neighbor-chain', 'mixed', index)
  }
}

function radialDistance(slot: number, columns: number, rows: number): number {
  const row = Math.floor(slot / columns); const column = slot % columns
  return Math.abs(column - (columns - 1) / 2) + Math.abs(row - (rows - 1) / 2)
}

function centerCollapse(builder: PlanBuilder, initial: readonly number[], columns: number, rows: number, settings: PlannerSettings): void {
  let current = [...initial]; const duration = baseDuration(settings) * 0.7
  const outside = identity(columns * rows).sort((a, b) => radialDistance(b, columns, rows) - radialDistance(a, columns, rows) || seededUnit(settings.deterministicSeed, a) - seededUnit(settings.deterministicSeed, b))
  const inside = [...outside].reverse(); const used = new Set<number>(); const pairs: Array<readonly [number, number]> = []
  for (let index = 0; index < outside.length && pairs.length < movementCount(Math.floor(outside.length / 2), settings); index += 1) {
    const first = outside[index]!; const second = inside[index]!
    if (first !== second && !used.has(first) && !used.has(second)) { pairs.push([first, second]); used.add(first); used.add(second) }
  }
  for (let index = 0; index < pairs.length; index += 1) {
    current = swapSlots(current, [pairs[index]!]); builder.add(current, index * duration, duration, 'outside-to-center-exchange', 'radial', index)
  }
}

function edgeExpansion(builder: PlanBuilder, initial: readonly number[], columns: number, rows: number, settings: PlannerSettings): void {
  let current = [...initial]; const duration = baseDuration(settings) * 0.72
  const bands = new Map<number, number[]>()
  for (let slot = 0; slot < columns * rows; slot += 1) {
    const band = Math.floor(radialDistance(slot, columns, rows)); const list = bands.get(band) ?? []; list.push(slot); bands.set(band, list)
  }
  const ordered = [...bands.entries()].sort((a, b) => a[0] - b[0]).slice(0, movementCount(bands.size, settings))
  for (let index = 0; index < ordered.length; index += 1) {
    const slots = [...ordered[index]![1]]; const rotate = Math.floor(seededUnit(settings.deterministicSeed, index + 11) * Math.max(1, slots.length)); slots.push(...slots.splice(0, rotate)); const pairs: Array<readonly [number, number]> = []
    for (let pair = 0; pair + 1 < slots.length; pair += 2) pairs.push([slots[pair]!, slots[pair + 1]!])
    current = swapSlots(current, pairs); builder.add(current, index * duration * (0.45 + settings.stagger * 0.55), duration, 'center-outward-band-expansion', 'radial', index)
  }
}

function waveRelay(builder: PlanBuilder, initial: readonly number[], columns: number, rows: number, settings: PlannerSettings): void {
  let current = [...initial]; const duration = baseDuration(settings) * 0.62; const waves = movementCount(columns, settings)
  const offset = Math.floor(seededUnit(settings.deterministicSeed, 7) * columns); const reverse = seededUnit(settings.deterministicSeed, 8) < 0.5
  for (let wave = 0; wave < waves; wave += 1) {
    const column = ((reverse ? columns - 1 - wave : wave) + offset + columns) % columns; const pairs: Array<readonly [number, number]> = []
    const parity = wave % 2
    for (let row = parity; row + 1 < rows; row += 2) pairs.push([row * columns + column, (row + 1) * columns + column])
    current = swapSlots(current, pairs)
    builder.add(current, wave * duration * (0.3 + settings.stagger * 0.7), duration, 'traveling-wavefront-relay', 'vertical', wave)
  }
}

function appendMagneticResolve(builder: PlanBuilder, initial: readonly number[], settings: PlannerSettings, startAt = 0, totalDurationMs?: number): void {
  let current = [...initial]; const size = current.length; const unresolved = () => current.filter((slot, tile) => slot !== tile).length
  const nominal = 260 - settings.reconstructionSpeed * 180
  const groupSize = Math.max(1, Math.round(Math.sqrt(size) * (0.3 + settings.reconstructionSpeed * 0.7)))
  const targets: number[][] = []; let step = 0
  while (unresolved() > 0 && step < size) {
    const usedTiles = new Set<number>(); let exchanges = 0
    for (let tile = 0; tile < size && exchanges < groupSize; tile += 1) {
      if (current[tile] === tile || usedTiles.has(tile)) continue
      const occupant = tileAtSlot(current, tile); if (occupant < 0) throw new Error('SHIFTGRID resolve lost a tile identity')
      if (usedTiles.has(occupant)) continue
      current = swapSlots(current, [[current[tile]!, current[occupant]!]])
      usedTiles.add(tile); usedTiles.add(occupant); exchanges += 1
    }
    if (exchanges === 0) throw new Error('SHIFTGRID magnetic resolve could not advance')
    targets.push(current); step += 1
  }
  const stepDuration = totalDurationMs ? Math.max(60, totalDurationMs / Math.max(1, targets.length)) : nominal
  targets.forEach((target, index) => builder.add(target, startAt + index * stepDuration, stepDuration, 'home-slot-magnetic-exchange', 'resolve', index))
}

function magneticResolve(builder: PlanBuilder, initial: readonly number[], columns: number, rows: number, settings: PlannerSettings): void {
  let current = [...initial]; const size = columns * rows; let start = 0
  if (current.every((slot, tile) => slot === tile)) {
    current = createDeterministicShiftgridPermutation(size, settings.deterministicSeed ^ 0x51f15e)
    const duration = baseDuration(settings); builder.add(current, 0, duration, 'deterministic-scatter', 'mixed', 0); start = duration
  }
  appendMagneticResolve(builder, current, settings, start)
}

export function createShiftgridChoreographyPlan({ columns, rows, settings, initialSlotsByTile, seed = settings.deterministicSeed }: {
  columns: number; rows: number; settings: PlannerSettings; initialSlotsByTile?: readonly number[]; seed?: number
}): ShiftgridChoreographyPlan {
  const initial = initialSlotsByTile ? [...initialSlotsByTile] : identity(columns * rows)
  const builder = new PlanBuilder(settings.choreographyPattern, seed, columns, rows, initial)
  const seededSettings = { ...settings, deterministicSeed: seed }
  if (settings.choreographyPattern === 'rowRunner') rowRunner(builder, initial, columns, rows, seededSettings)
  else if (settings.choreographyPattern === 'columnCascade') columnCascade(builder, initial, columns, rows, seededSettings)
  else if (settings.choreographyPattern === 'checkerShift') checkerShift(builder, initial, columns, rows, seededSettings)
  else if (settings.choreographyPattern === 'dominoChain') dominoChain(builder, initial, columns, rows, seededSettings)
  else if (settings.choreographyPattern === 'centerCollapse') centerCollapse(builder, initial, columns, rows, seededSettings)
  else if (settings.choreographyPattern === 'edgeExpansion') edgeExpansion(builder, initial, columns, rows, seededSettings)
  else if (settings.choreographyPattern === 'waveRelay') waveRelay(builder, initial, columns, rows, seededSettings)
  else magneticResolve(builder, initial, columns, rows, seededSettings)
  return builder.finish(initial)
}

export function createShiftgridReconstructionPlan({ columns, rows, settings, initialSlotsByTile }: {
  columns: number; rows: number; settings: PlannerSettings; initialSlotsByTile: readonly number[]
}): ShiftgridChoreographyPlan {
  const pattern: CanvasShiftgridPattern = 'magneticResolve'; const builder = new PlanBuilder(pattern, settings.deterministicSeed, columns, rows, initialSlotsByTile)
  const total = settings.reconstructionMode === 'progressiveResolve' ? settings.progressiveResolveDurationSec * 1000 : undefined
  appendMagneticResolve(builder, initialSlotsByTile, settings, 0, total)
  return builder.finish(initialSlotsByTile)
}

export function createShiftgridScramblePlan({ columns, rows, settings, initialSlotsByTile, seed = settings.deterministicSeed }: {
  columns: number; rows: number; settings: PlannerSettings; initialSlotsByTile: readonly number[]; seed?: number
}): ShiftgridChoreographyPlan {
  const builder = new PlanBuilder(settings.choreographyPattern, seed, columns, rows, initialSlotsByTile)
  builder.add(createDeterministicShiftgridPermutation(columns * rows, seed), 0, baseDuration(settings), 'deterministic-full-scramble', 'mixed', 0)
  return builder.finish(initialSlotsByTile)
}

/** Audio accents preserve the active pattern identity while adding one valid row/column exchange. */
export function createShiftgridDirectionalImpulsePlan({ columns, rows, settings, initialSlotsByTile, axis, seed = settings.deterministicSeed }: {
  columns: number; rows: number; settings: PlannerSettings; initialSlotsByTile: readonly number[]
  axis: 'horizontal' | 'vertical'; seed?: number
}): ShiftgridChoreographyPlan {
  const builder = new PlanBuilder(settings.choreographyPattern, seed, columns, rows, initialSlotsByTile)
  const unitCount = axis === 'horizontal' ? rows : columns
  const unit = Math.min(unitCount - 1, Math.floor(seededUnit(seed, 41) * unitCount))
  const slots = axis === 'horizontal'
    ? Array.from({ length: columns }, (_, column) => unit * columns + column)
    : Array.from({ length: rows }, (_, row) => row * columns + unit)
  const direction = seededUnit(seed, 42) < 0.5 ? -1 : 1
  const target = cycleSlots(initialSlotsByTile, slots, direction)
  builder.add(target, 0, baseDuration(settings) * 0.55, `audio-${axis}-impulse`, axis, unit)
  return builder.finish(initialSlotsByTile)
}

export function createShiftgridStaticPlan(columns: number, rows: number, slotsByTile: readonly number[], seed = 0): ShiftgridChoreographyPlan {
  if (!isValidShiftgridPermutation(slotsByTile, columns * rows)) throw new Error('SHIFTGRID static plan requires a valid permutation')
  return Object.freeze({ pattern: 'magneticResolve', seed, columns, rows, initialSlotsByTile: Object.freeze([...slotsByTile]),
    finalSlotsByTile: Object.freeze([...slotsByTile]), steps: Object.freeze([]), durationMs: 0 })
}

function progressAt(step: ShiftgridChoreographyStep, timeMs: number): number {
  return Math.min(1, Math.max(0, (timeMs - step.startMs) / step.durationMs))
}

export class ShiftgridChoreographyPlayback {
  readonly state: ShiftgridRuntimeGridState
  private plan: ShiftgridChoreographyPlan
  private timeMs = 0
  private paused = false

  constructor(geometry: ShiftgridGridGeometry, plan: ShiftgridChoreographyPlan, identityKey: string) {
    this.state = createShiftgridRuntimeGridState(geometry, [], identityKey); this.plan = plan; this.seek(0)
  }

  get moving(): boolean { return this.plan.steps.some(step => this.timeMs >= step.startMs && this.timeMs < step.startMs + step.durationMs) }
  get complete(): boolean { return this.timeMs >= this.plan.durationMs }
  get timelineMs(): number { return this.timeMs }
  get activePlan(): ShiftgridChoreographyPlan { return this.plan }
  setPaused(paused: boolean): void { this.paused = paused }
  advance(deltaMs: number): void { if (!this.paused) this.seek(this.timeMs + Math.max(0, deltaMs)) }
  reset(): void { this.seek(0) }

  seek(timeMs: number): void {
    this.timeMs = Math.min(this.plan.durationMs, Math.max(0, timeMs))
    const settled = [...this.plan.initialSlotsByTile]
    for (const step of this.plan.steps) {
      if (this.timeMs < step.startMs + step.durationMs) continue
      for (const tile of step.affectedTileIndices) settled[tile] = step.toSlotsByTile[tile]!
    }
    if (!isValidShiftgridPermutation(settled, this.state.tiles.length)) throw new Error('SHIFTGRID settled timeline state is invalid')
    this.state.currentSlotsByTile = settled; this.state.pendingMovement = this.moving ? {
      kind: this.plan.pattern === 'magneticResolve' ? 'reconstruct' : 'coordinated',
      fromSlotsByTile: settled, toSlotsByTile: settled, progress: 0, durationMs: 1,
    } : null
  }

  replacePlan(plan: ShiftgridChoreographyPlan): void {
    if (!isValidShiftgridPermutation(plan.initialSlotsByTile, this.state.tiles.length)) throw new Error('SHIFTGRID replacement plan size mismatch')
    this.plan = plan; this.state.patternRevision += 1; this.seek(0)
  }

  getTileSlot(tileIndex: number): { from: number; to: number; progress: number } {
    let settled = this.plan.initialSlotsByTile[tileIndex]!
    let active: ShiftgridChoreographyStep | null = null
    for (const step of this.plan.steps) {
      if (!step.affectedTileIndices.includes(tileIndex)) continue
      if (this.timeMs >= step.startMs + step.durationMs) settled = step.toSlotsByTile[tileIndex]!
      else if (this.timeMs >= step.startMs && (!active || step.startMs >= active.startMs)) active = step
    }
    return active
      ? { from: active.fromSlotsByTile[tileIndex]!, to: active.toSlotsByTile[tileIndex]!, progress: progressAt(active, this.timeMs) }
      : { from: settled, to: settled, progress: 1 }
  }
}

export function shouldShiftgridResolve(mode: CanvasShiftgridReconstructionMode, boundary: 'phrase' | 'drop' | 'continuous' | 'manual'): boolean {
  if (boundary === 'manual') return true
  if (mode === 'continuousPuzzle') return boundary === 'continuous'
  if (mode === 'phraseResolve') return boundary === 'phrase'
  if (mode === 'dropResolve') return boundary === 'drop'
  if (mode === 'progressiveResolve') return boundary === 'continuous'
  return false
}

export function createShiftgridPatternCycle(seed: number): readonly CanvasShiftgridPattern[] {
  const cycle = CANVAS_SHIFTGRID_PATTERN_OPTIONS.map(option => option.value)
  for (let index = cycle.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(seededUnit(seed, index) * (index + 1)); [cycle[index], cycle[swap]] = [cycle[swap]!, cycle[index]!]
  }
  return Object.freeze(cycle)
}
