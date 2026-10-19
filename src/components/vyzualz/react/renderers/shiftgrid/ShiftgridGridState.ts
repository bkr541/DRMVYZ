import type { ShiftgridGridGeometry } from './ShiftgridTileGeometry'

export type ShiftgridMovementKind = 'scramble' | 'swap' | 'rowCycle' | 'columnCycle' | 'coordinated' | 'reconstruct'
export interface ShiftgridTileIdentity {
  id: string; originalSlot: number; originalRow: number; originalColumn: number
  sourceU: number; sourceV: number; sourceWidth: number; sourceHeight: number
}
export interface ShiftgridPendingMovement {
  kind: ShiftgridMovementKind; fromSlotsByTile: readonly number[]; toSlotsByTile: readonly number[]
  progress: number; durationMs: number
}
export interface ShiftgridRuntimeGridState {
  identity: string; columns: number; rows: number; patternRevision: number
  tiles: readonly ShiftgridTileIdentity[]; currentSlotsByTile: readonly number[]
  reconstructionTarget: readonly number[]; pendingMovement: ShiftgridPendingMovement | null
}

const identityPermutation = (length: number) => Array.from({ length }, (_, index) => index)
export function isValidShiftgridPermutation(value: readonly number[], size = value.length): boolean {
  return value.length === size && value.every(slot => Number.isInteger(slot) && slot >= 0 && slot < size) && new Set(value).size === size
}
function seededUnit(seed: number, step: number): number {
  let value = (seed ^ Math.imul(step + 1, 0x9e3779b1)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad); value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return ((value ^ (value >>> 15)) >>> 0) / 0x100000000
}
export function createDeterministicShiftgridPermutation(size: number, seed: number): number[] {
  const result = identityPermutation(size)
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(seededUnit(seed, index) * (index + 1)); [result[index], result[swap]] = [result[swap]!, result[index]!]
  }
  if (size > 1 && result.every((slot, index) => slot === index)) [result[0], result[1]] = [result[1]!, result[0]!]
  return result
}
function withSlotsMoved(current: readonly number[], mapping: ReadonlyMap<number, number>): number[] {
  const next = current.map(slot => mapping.get(slot) ?? slot)
  if (!isValidShiftgridPermutation(next, current.length)) throw new Error('SHIFTGRID movement must preserve a complete permutation')
  return next
}
export function createShiftgridSwapTarget(current: readonly number[], firstSlot: number, secondSlot: number): number[] {
  return firstSlot === secondSlot ? [...current] : withSlotsMoved(current, new Map([[firstSlot, secondSlot], [secondSlot, firstSlot]]))
}
export function createShiftgridRowCycleTarget(current: readonly number[], columns: number, rows: number, row: number, direction = 1): number[] {
  const safeRow = ((row % rows) + rows) % rows; const map = new Map<number, number>()
  for (let column = 0; column < columns; column += 1) map.set(safeRow * columns + column, safeRow * columns + ((column + direction) % columns + columns) % columns)
  return withSlotsMoved(current, map)
}
export function createShiftgridColumnCycleTarget(current: readonly number[], columns: number, rows: number, column: number, direction = 1): number[] {
  const safeColumn = ((column % columns) + columns) % columns; const map = new Map<number, number>()
  for (let row = 0; row < rows; row += 1) map.set(row * columns + safeColumn, (((row + direction) % rows + rows) % rows) * columns + safeColumn)
  return withSlotsMoved(current, map)
}
export function createShiftgridRuntimeGridState(geometry: ShiftgridGridGeometry, _sourceMediaIds: readonly string[], identity: string): ShiftgridRuntimeGridState {
  const reconstructionTarget = Object.freeze(identityPermutation(geometry.tiles.length))
  return { identity, columns: geometry.columns, rows: geometry.rows, patternRevision: 0,
    tiles: Object.freeze(geometry.tiles.map(tile => Object.freeze({ id: tile.id, originalSlot: tile.index,
      originalRow: tile.row, originalColumn: tile.column, sourceU: tile.sourceU, sourceV: tile.sourceV,
      sourceWidth: tile.sourceWidth, sourceHeight: tile.sourceHeight }))),
    currentSlotsByTile: [...reconstructionTarget], reconstructionTarget, pendingMovement: null }
}

export class ShiftgridGridRuntime {
  readonly state: ShiftgridRuntimeGridState
  private commandRevision = 0
  constructor(geometry: ShiftgridGridGeometry, identity: string) { this.state = createShiftgridRuntimeGridState(geometry, [], identity) }
  get moving(): boolean { return this.state.pendingMovement !== null }
  showOriginal(): void { this.state.currentSlotsByTile = [...this.state.reconstructionTarget]; this.state.pendingMovement = null; this.state.patternRevision += 1 }
  scramble(seed: number, durationMs: number): void { this.start('scramble', createDeterministicShiftgridPermutation(this.state.tiles.length, seed), durationMs) }
  swap(seed: number, durationMs: number): void {
    const count = this.state.tiles.length; if (count < 2) return
    const first = Math.floor(seededUnit(seed, this.commandRevision++) * count); const row = Math.floor(first / this.state.columns); const column = first % this.state.columns
    const candidates = [column > 0 ? first - 1 : -1, column + 1 < this.state.columns ? first + 1 : -1,
      row > 0 ? first - this.state.columns : -1, row + 1 < this.state.rows ? first + this.state.columns : -1].filter(value => value >= 0)
    const second = candidates[Math.floor(seededUnit(seed ^ 0x6d2b79f5, this.commandRevision) * candidates.length)]!
    this.start('swap', createShiftgridSwapTarget(this.state.currentSlotsByTile, first, second), durationMs)
  }
  cycleRow(row: number, direction: number, durationMs: number): void { this.start('rowCycle', createShiftgridRowCycleTarget(this.state.currentSlotsByTile, this.state.columns, this.state.rows, row, direction), durationMs) }
  cycleColumn(column: number, direction: number, durationMs: number): void { this.start('columnCycle', createShiftgridColumnCycleTarget(this.state.currentSlotsByTile, this.state.columns, this.state.rows, column, direction), durationMs) }
  coordinated(seed: number, durationMs: number): void {
    const row = Math.floor(seededUnit(seed, this.commandRevision++) * this.state.rows)
    let target = createShiftgridRowCycleTarget(this.state.currentSlotsByTile, this.state.columns, this.state.rows, row, 1)
    if (this.state.columns > 1 && this.state.rows > 1) target = createShiftgridColumnCycleTarget(target, this.state.columns, this.state.rows, Math.floor(seededUnit(seed ^ 0x85ebca6b, this.commandRevision) * this.state.columns), -1)
    this.start('coordinated', target, durationMs)
  }
  reconstruct(durationMs: number): void { this.start('reconstruct', this.state.reconstructionTarget, durationMs) }
  advance(deltaMs: number): boolean {
    const movement = this.state.pendingMovement; if (!movement) return false
    movement.progress = Math.min(1, movement.progress + Math.max(0, deltaMs) / movement.durationMs)
    if (movement.progress >= 1) { this.state.currentSlotsByTile = [...movement.toSlotsByTile]; this.state.pendingMovement = null }
    return true
  }
  getTileSlot(tileIndex: number): { from: number; to: number; progress: number } {
    const movement = this.state.pendingMovement; if (!movement) { const slot = this.state.currentSlotsByTile[tileIndex]!; return { from: slot, to: slot, progress: 1 } }
    return { from: movement.fromSlotsByTile[tileIndex]!, to: movement.toSlotsByTile[tileIndex]!, progress: movement.progress }
  }
  private start(kind: ShiftgridMovementKind, target: readonly number[], durationMs: number): void {
    if (!isValidShiftgridPermutation(target, this.state.tiles.length)) throw new Error('Invalid SHIFTGRID target permutation')
    if (this.state.pendingMovement) { this.state.currentSlotsByTile = [...this.state.pendingMovement.toSlotsByTile]; this.state.pendingMovement = null }
    this.state.pendingMovement = { kind, fromSlotsByTile: [...this.state.currentSlotsByTile], toSlotsByTile: [...target], progress: 0, durationMs: Math.max(80, durationMs) }
    this.state.patternRevision += 1
  }
}
