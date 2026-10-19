import { describe, expect, it } from 'vitest'
import {
  createShiftgridChoreographyPlan,
  createShiftgridReconstructionPlan,
  ShiftgridChoreographyPlayback,
  shouldShiftgridResolve,
} from './ShiftgridChoreography'
import { isValidShiftgridPermutation } from './ShiftgridGridState'
import { CANVAS_SHIFTGRID_PATTERN_OPTIONS, DEFAULT_CANVAS_SHIFTGRID_SETTINGS, type CanvasShiftgridPattern, type CanvasShiftgridSettings } from './ShiftgridSettings'
import { createShiftgridTileGeometry } from './ShiftgridTileGeometry'

const PATTERNS = CANVAS_SHIFTGRID_PATTERN_OPTIONS.map(option => option.value)

function settings(pattern: CanvasShiftgridPattern, patch: Partial<CanvasShiftgridSettings> = {}): CanvasShiftgridSettings {
  return { ...DEFAULT_CANVAS_SHIFTGRID_SETTINGS, choreographyPattern: pattern, autoPerformance: false, ...patch }
}

function geometry(columns: number, rows: number) {
  return createShiftgridTileGeometry({ gridColumns: columns, gridRows: rows, tileShape: 'rectangular' }, columns * 100, rows * 100)
}

function validatePlan(plan: ReturnType<typeof createShiftgridChoreographyPlan>) {
  const size = plan.columns * plan.rows
  expect(isValidShiftgridPermutation(plan.initialSlotsByTile, size)).toBe(true)
  expect(isValidShiftgridPermutation(plan.finalSlotsByTile, size)).toBe(true)
  expect(plan.steps.length).toBeGreaterThan(0)
  for (const step of plan.steps) {
    expect(isValidShiftgridPermutation(step.fromSlotsByTile, size)).toBe(true)
    expect(isValidShiftgridPermutation(step.toSlotsByTile, size)).toBe(true)
    expect(step.affectedTileIndices.length).toBeGreaterThan(0)
    expect(new Set(step.affectedTileIndices).size).toBe(step.affectedTileIndices.length)
    expect(step.startMs).toBeGreaterThanOrEqual(0)
    expect(step.durationMs).toBeGreaterThan(0)
  }
}

describe('SHIFTGRID P2 choreography planner', () => {
  it.each(PATTERNS)('%s produces valid settled permutations', pattern => {
    const plan = createShiftgridChoreographyPlan({ columns: 10, rows: 6, settings: settings(pattern) })
    validatePlan(plan)
    const playback = new ShiftgridChoreographyPlayback(geometry(10, 6), plan, pattern)
    for (const step of plan.steps) {
      playback.seek(step.startMs + step.durationMs)
      expect(isValidShiftgridPermutation(playback.state.currentSlotsByTile, 60)).toBe(true)
    }
  })

  it('the eight patterns have distinct movement topology and target sequences', () => {
    const signatures = PATTERNS.map(pattern => {
      const plan = createShiftgridChoreographyPlan({ columns: 8, rows: 8, settings: settings(pattern) })
      return JSON.stringify(plan.steps.map(step => ({ axis: step.axis, affected: step.affectedTileIndices, target: step.toSlotsByTile })))
    })
    expect(new Set(signatures).size).toBe(8)
  })

  it('overlaps only coordinated disjoint groups in staggered row motion', () => {
    const plan = createShiftgridChoreographyPlan({ columns: 10, rows: 6, settings: settings('rowRunner', { movementAmount: 1, stagger: 0 }) })
    const first = plan.steps[0]!; const second = plan.steps[1]!
    expect(second.startMs).toBeLessThan(first.startMs + first.durationMs)
    expect(second.affectedTileIndices.some(tile => first.affectedTileIndices.includes(tile))).toBe(false)
    const playback = new ShiftgridChoreographyPlayback(geometry(10, 6), plan, 'overlap')
    playback.seek(second.startMs + 1)
    expect(isValidShiftgridPermutation(playback.state.currentSlotsByTile, 60)).toBe(true)
  })

  it.each(PATTERNS)('%s reconstructs every tile exactly', pattern => {
    const source = createShiftgridChoreographyPlan({ columns: 10, rows: 6, settings: settings(pattern) })
    const reconstruction = createShiftgridReconstructionPlan({ columns: 10, rows: 6, settings: settings(pattern), initialSlotsByTile: source.finalSlotsByTile })
    const playback = new ShiftgridChoreographyPlayback(geometry(10, 6), reconstruction, `resolve:${pattern}`)
    playback.seek(reconstruction.durationMs)
    expect(playback.state.currentSlotsByTile).toEqual(Array.from({ length: 60 }, (_, index) => index))
  })

  it('is repeatable for the same seed and changes deterministically with another seed', () => {
    const one = createShiftgridChoreographyPlan({ columns: 10, rows: 6, settings: settings('rowRunner', { deterministicSeed: 91 }) })
    const two = createShiftgridChoreographyPlan({ columns: 10, rows: 6, settings: settings('rowRunner', { deterministicSeed: 91 }) })
    const three = createShiftgridChoreographyPlan({ columns: 10, rows: 6, settings: settings('rowRunner', { deterministicSeed: 92 }) })
    expect(two).toEqual(one)
    expect(three.steps.map(step => step.toSlotsByTile)).not.toEqual(one.steps.map(step => step.toSlotsByTile))
  })

  it('survives rapid pattern switching and active-movement interruption', () => {
    const grid = geometry(10, 6)
    let plan = createShiftgridChoreographyPlan({ columns: 10, rows: 6, settings: settings(PATTERNS[0]!) })
    const playback = new ShiftgridChoreographyPlayback(grid, plan, 'switch')
    for (let index = 1; index < PATTERNS.length; index += 1) {
      playback.seek(Math.min(plan.durationMs, 75 + index * 31))
      expect(isValidShiftgridPermutation(playback.state.currentSlotsByTile, 60)).toBe(true)
      plan = createShiftgridChoreographyPlan({ columns: 10, rows: 6, settings: settings(PATTERNS[index]!), initialSlotsByTile: playback.state.currentSlotsByTile, seed: 100 + index })
      playback.replacePlan(plan)
      expect(playback.timelineMs).toBe(0)
      expect(isValidShiftgridPermutation(playback.state.currentSlotsByTile, 60)).toBe(true)
    }
  })

  it('pause, resume, seek, and reset are deterministic and frame-rate independent', () => {
    const plan = createShiftgridChoreographyPlan({ columns: 4, rows: 4, settings: settings('dominoChain') })
    const stepped = new ShiftgridChoreographyPlayback(geometry(4, 4), plan, 'stepped')
    const sought = new ShiftgridChoreographyPlayback(geometry(4, 4), plan, 'sought')
    stepped.advance(125); stepped.advance(75); stepped.advance(300)
    sought.seek(500)
    expect(stepped.state.currentSlotsByTile).toEqual(sought.state.currentSlotsByTile)
    expect(Array.from({ length: 16 }, (_, tile) => stepped.getTileSlot(tile))).toEqual(Array.from({ length: 16 }, (_, tile) => sought.getTileSlot(tile)))
    stepped.setPaused(true); stepped.advance(500); expect(stepped.timelineMs).toBe(500)
    stepped.setPaused(false); stepped.advance(100); expect(stepped.timelineMs).toBe(600)
    stepped.reset(); expect(stepped.timelineMs).toBe(0)
    expect(stepped.state.currentSlotsByTile).toEqual(plan.initialSlotsByTile)
  })

  it.each([[4, 4], [10, 6], [16, 9]])('handles high-density choreography at %d × %d', (columns, rows) => {
    for (const pattern of PATTERNS) {
      const plan = createShiftgridChoreographyPlan({ columns, rows, settings: settings(pattern, { movementAmount: 1, scrambleComplexity: 1 }) })
      validatePlan(plan)
      expect(plan.finalSlotsByTile).toHaveLength(columns * rows)
    }
  })

  it('motion controls materially change density and timing', () => {
    const low = createShiftgridChoreographyPlan({ columns: 16, rows: 9, settings: settings('rowRunner', { movementAmount: 0.1, movementSpeed: 0.1, stagger: 0.1, scrambleComplexity: 0.1 }) })
    const high = createShiftgridChoreographyPlan({ columns: 16, rows: 9, settings: settings('rowRunner', { movementAmount: 1, movementSpeed: 2, stagger: 1, scrambleComplexity: 1 }) })
    const lowStagger = createShiftgridChoreographyPlan({ columns: 16, rows: 9, settings: settings('rowRunner', { movementSpeed: 1, stagger: 0 }) })
    const highStagger = createShiftgridChoreographyPlan({ columns: 16, rows: 9, settings: settings('rowRunner', { movementSpeed: 1, stagger: 1 }) })
    expect(high.steps.length).toBeGreaterThan(low.steps.length)
    expect(high.steps[0]!.durationMs).toBeLessThan(low.steps[0]!.durationMs)
    expect(highStagger.steps[1]!.startMs - highStagger.steps[0]!.startMs).toBeGreaterThan(lowStagger.steps[1]!.startMs - lowStagger.steps[0]!.startMs)
    expect(high.finalSlotsByTile).not.toEqual(low.finalSlotsByTile)
  })

  it('Magnetic Resolve monotonically increases correct tile placement', () => {
    const plan = createShiftgridChoreographyPlan({ columns: 10, rows: 6, settings: settings('magneticResolve') })
    let previousCorrect = 0
    for (const step of plan.steps.slice(1)) {
      const correct = step.toSlotsByTile.filter((slot, tile) => slot === tile).length
      expect(correct).toBeGreaterThan(previousCorrect)
      previousCorrect = correct
    }
    expect(plan.finalSlotsByTile.every((slot, tile) => slot === tile)).toBe(true)
  })

  it('applies reconstruction speed and exact progressive duration', () => {
    const scrambled = createShiftgridChoreographyPlan({ columns: 10, rows: 6, settings: settings('rowRunner') }).finalSlotsByTile
    const slow = createShiftgridReconstructionPlan({ columns: 10, rows: 6, settings: settings('rowRunner', { reconstructionMode: 'manualResolve', reconstructionSpeed: 0 }), initialSlotsByTile: scrambled })
    const fast = createShiftgridReconstructionPlan({ columns: 10, rows: 6, settings: settings('rowRunner', { reconstructionMode: 'manualResolve', reconstructionSpeed: 1 }), initialSlotsByTile: scrambled })
    const progressive = createShiftgridReconstructionPlan({ columns: 10, rows: 6, settings: settings('rowRunner', { reconstructionMode: 'progressiveResolve', progressiveResolveDurationSec: 12 }), initialSlotsByTile: scrambled })
    expect(fast.durationMs).toBeLessThan(slow.durationMs)
    expect(progressive.durationMs).toBeCloseTo(12_000, 5)
  })

  it('gates reconstruction strategies independently of Audio Intelligence', () => {
    expect(shouldShiftgridResolve('continuousPuzzle', 'continuous')).toBe(true)
    expect(shouldShiftgridResolve('phraseResolve', 'phrase')).toBe(true)
    expect(shouldShiftgridResolve('phraseResolve', 'drop')).toBe(false)
    expect(shouldShiftgridResolve('dropResolve', 'drop')).toBe(true)
    expect(shouldShiftgridResolve('progressiveResolve', 'continuous')).toBe(true)
    expect(shouldShiftgridResolve('manualResolve', 'continuous')).toBe(false)
    expect(shouldShiftgridResolve('manualResolve', 'manual')).toBe(true)
  })
})
