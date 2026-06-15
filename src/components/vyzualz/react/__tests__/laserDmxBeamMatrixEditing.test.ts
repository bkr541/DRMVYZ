import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mock crypto.randomUUID so tests are deterministic ─────────────────────────
let uuidCounter = 0
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
})

import {
  gridCellToNormalized,
  normalizedToNearestGridCell,
  stageToViewFraction,
  viewFractionToStage,
  isPointInsideOutput,
  outputRectInView,
  viewPxToNormalized,
  viewPxToNearestGridCell,
  viewPxToStageTarget,
  viewPxToGridTarget,
  targetToViewPx,
  originToViewPx,
} from '../laserDmxBeamMatrixCoordinates'
import { LASER_DMX_MATRIX_COLUMNS, LASER_DMX_MATRIX_MAX_BEAMS, DEFAULT_BEAM_MOTION } from '../ReactTypes'
import { useReactStore } from '../../../../stores/reactStore'

const COLS = 15
const ROWS = 10

// ── Grid ↔ Normalized ────────────────────────────────────────────────────────

describe('gridCellToNormalized', () => {
  it('first cell (1,1) maps to (0.5/15, 0.5/10)', () => {
    const { x, y } = gridCellToNormalized(1, 1)
    expect(x).toBeCloseTo(0.5 / COLS)
    expect(y).toBeCloseTo(0.5 / ROWS)
  })

  it('last cell (15,10) maps to (14.5/15, 9.5/10)', () => {
    const { x, y } = gridCellToNormalized(15, 10)
    expect(x).toBeCloseTo(14.5 / COLS)
    expect(y).toBeCloseTo(9.5 / ROWS)
  })

  it('center-ish cell (8,5) maps to approximately (0.5, 0.45)', () => {
    const { x, y } = gridCellToNormalized(8, 5)
    expect(x).toBeCloseTo(7.5 / COLS)
    expect(y).toBeCloseTo(4.5 / ROWS)
  })

  it('x is always in (0,1) for valid columns 1–15', () => {
    for (let col = 1; col <= COLS; col++) {
      const { x } = gridCellToNormalized(col, 1)
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('y is always in (0,1) for valid rows 1–10', () => {
    for (let row = 1; row <= ROWS; row++) {
      const { y } = gridCellToNormalized(1, row)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(1)
    }
  })
})

describe('normalizedToNearestGridCell', () => {
  it('maps cell (1,1) center back to (1,1)', () => {
    const { x, y } = gridCellToNormalized(1, 1)
    const { column, row } = normalizedToNearestGridCell(x, y)
    expect(column).toBe(1)
    expect(row).toBe(1)
  })

  it('maps cell (15,10) center back to (15,10)', () => {
    const { x, y } = gridCellToNormalized(15, 10)
    const { column, row } = normalizedToNearestGridCell(x, y)
    expect(column).toBe(15)
    expect(row).toBe(10)
  })

  it('round-trips every valid grid cell', () => {
    for (let col = 1; col <= COLS; col++) {
      for (let row = 1; row <= ROWS; row++) {
        const { x, y } = gridCellToNormalized(col, row)
        const back = normalizedToNearestGridCell(x, y)
        expect(back.column).toBe(col)
        expect(back.row).toBe(row)
      }
    }
  })

  it('clamps far-left offscreen point to column 1', () => {
    const { column } = normalizedToNearestGridCell(-5, 0.5)
    expect(column).toBe(1)
  })

  it('clamps far-right offscreen point to column 15', () => {
    const { column } = normalizedToNearestGridCell(5, 0.5)
    expect(column).toBe(COLS)
  })

  it('clamps above-top offscreen point to row 1', () => {
    const { row } = normalizedToNearestGridCell(0.5, -5)
    expect(row).toBe(1)
  })

  it('clamps below-bottom offscreen point to row 10', () => {
    const { row } = normalizedToNearestGridCell(0.5, 5)
    expect(row).toBe(ROWS)
  })

  it('boundary between col 1 and col 2 maps to correct side', () => {
    // Cell 1 center = 0.5/15, cell 2 center = 1.5/15, boundary = 1/15
    const boundary = 1 / COLS
    const justLeft  = normalizedToNearestGridCell(boundary - 0.001, 0.5)
    const justRight = normalizedToNearestGridCell(boundary + 0.001, 0.5)
    expect(justLeft.column).toBe(1)
    expect(justRight.column).toBe(2)
  })
})

// ── Stage ↔ View Fraction ─────────────────────────────────────────────────────

describe('stageToViewFraction + viewFractionToStage', () => {
  it('with overscan=0, normalized 0 maps to fraction 0', () => {
    const { fx, fy } = stageToViewFraction(0, 0, 0)
    expect(fx).toBeCloseTo(0)
    expect(fy).toBeCloseTo(0)
  })

  it('with overscan=0, normalized 1 maps to fraction 1', () => {
    const { fx, fy } = stageToViewFraction(1, 1, 0)
    expect(fx).toBeCloseTo(1)
    expect(fy).toBeCloseTo(1)
  })

  it('with overscan=0.1, normalized 0 maps to fraction 0.1/1.2 ≈ 0.0833', () => {
    const { fx } = stageToViewFraction(0, 0, 0.1)
    expect(fx).toBeCloseTo(0.1 / 1.2)
  })

  it('with overscan=0.1, normalized 1 maps to fraction 1.1/1.2 ≈ 0.9167', () => {
    const { fx } = stageToViewFraction(1, 0, 0.1)
    expect(fx).toBeCloseTo(1.1 / 1.2)
  })

  it('round-trips stage coord through viewFraction with overscan=0', () => {
    const { fx, fy } = stageToViewFraction(0.3, 0.7, 0)
    const { stageX, stageY } = viewFractionToStage(fx, fy, 0)
    expect(stageX).toBeCloseTo(0.3)
    expect(stageY).toBeCloseTo(0.7)
  })

  it('round-trips stage coord with overscan=0.15', () => {
    const { fx, fy } = stageToViewFraction(-0.1, 1.1, 0.15)
    const { stageX, stageY } = viewFractionToStage(fx, fy, 0.15)
    expect(stageX).toBeCloseTo(-0.1)
    expect(stageY).toBeCloseTo(1.1)
  })
})

// ── isPointInsideOutput ───────────────────────────────────────────────────────

describe('isPointInsideOutput', () => {
  it('returns true for center (0.5, 0.5)', () => {
    expect(isPointInsideOutput(0.5, 0.5)).toBe(true)
  })

  it('returns true for corners (0,0) and (1,1)', () => {
    expect(isPointInsideOutput(0, 0)).toBe(true)
    expect(isPointInsideOutput(1, 1)).toBe(true)
  })

  it('returns false for negative x', () => {
    expect(isPointInsideOutput(-0.01, 0.5)).toBe(false)
  })

  it('returns false for x > 1', () => {
    expect(isPointInsideOutput(1.01, 0.5)).toBe(false)
  })

  it('returns false for negative y', () => {
    expect(isPointInsideOutput(0.5, -0.01)).toBe(false)
  })

  it('returns false for y > 1', () => {
    expect(isPointInsideOutput(0.5, 1.01)).toBe(false)
  })
})

// ── outputRectInView ──────────────────────────────────────────────────────────

describe('outputRectInView', () => {
  it('with overscan=0, output rect fills entire view [0,1]', () => {
    const r = outputRectInView(0)
    expect(r.left).toBeCloseTo(0)
    expect(r.top).toBeCloseTo(0)
    expect(r.right).toBeCloseTo(1)
    expect(r.bottom).toBeCloseTo(1)
  })

  it('with overscan=0.1, output rect is inset from view edges', () => {
    const r = outputRectInView(0.1)
    // left = (0 - (-0.1)) / 1.2 = 0.1/1.2
    expect(r.left).toBeCloseTo(0.1 / 1.2)
    // right = (1 - (-0.1)) / 1.2 = 1.1/1.2
    expect(r.right).toBeCloseTo(1.1 / 1.2)
  })
})

// ── viewPx ↔ coordinate conversions ──────────────────────────────────────────

describe('viewPxToNormalized and viewPxToNearestGridCell', () => {
  const W = 600, H = 400

  it('with overscan=0, center pixel maps to normalized (0.5, 0.5)', () => {
    const { x, y } = viewPxToNormalized(W / 2, H / 2, W, H, 0)
    expect(x).toBeCloseTo(0.5)
    expect(y).toBeCloseTo(0.5)
  })

  it('with overscan=0, top-left pixel maps to normalized (0, 0)', () => {
    const { x, y } = viewPxToNormalized(0, 0, W, H, 0)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
  })

  it('viewPxToNearestGridCell maps first cell origin to column 1, row 1', () => {
    // Cell (1,1) center in pixels (overscan=0)
    const { x, y } = gridCellToNormalized(1, 1)
    const px = x * W, py = y * H
    const { column, row } = viewPxToNearestGridCell(px, py, W, H, 0)
    expect(column).toBe(1)
    expect(row).toBe(1)
  })
})

describe('viewPxToStageTarget', () => {
  const W = 600, H = 400

  it('produces a stage target with kind=stage', () => {
    const t = viewPxToStageTarget(W / 2, H / 2, W, H, 0)
    expect(t.kind).toBe('stage')
  })

  it('clamps x below -1', () => {
    const t = viewPxToStageTarget(-1000, H / 2, W, H, 0)
    expect(t.x).toBe(-1)
  })

  it('clamps y above 2', () => {
    const t = viewPxToStageTarget(W / 2, 10000, W, H, 0)
    expect(t.y).toBe(2)
  })
})

describe('viewPxToGridTarget', () => {
  const W = 600, H = 400

  it('produces a grid target with kind=grid', () => {
    const t = viewPxToGridTarget(W / 2, H / 2, W, H, 0)
    expect(t.kind).toBe('grid')
  })

  it('column and row are clamped to grid bounds when pointer is outside view', () => {
    const t = viewPxToGridTarget(-500, -500, W, H, 0)
    expect(t.column).toBe(1)
    expect(t.row).toBe(1)
  })
})

describe('targetToViewPx and originToViewPx', () => {
  const W = 600, H = 400

  it('grid target for cell (1,1) maps to expected px', () => {
    const target = { kind: 'grid' as const, column: 1, row: 1, z: 0 }
    const { px, py } = targetToViewPx(target, W, H, 0)
    const { x, y } = gridCellToNormalized(1, 1)
    expect(px).toBeCloseTo(x * W)
    expect(py).toBeCloseTo(y * H)
  })

  it('stage target for (0.5, 0.5) maps to center pixel (overscan=0)', () => {
    const target = { kind: 'stage' as const, x: 0.5, y: 0.5, z: 0 }
    const { px, py } = targetToViewPx(target, W, H, 0)
    expect(px).toBeCloseTo(W / 2)
    expect(py).toBeCloseTo(H / 2)
  })

  it('originToViewPx for cell (1,1) matches gridCellToNormalized (overscan=0)', () => {
    const { px, py } = originToViewPx(1, 1, W, H, 0)
    const { x, y } = gridCellToNormalized(1, 1)
    expect(px).toBeCloseTo(x * W)
    expect(py).toBeCloseTo(y * H)
  })
})

// ── Store: mute / solo ────────────────────────────────────────────────────────

describe('setLaserDmxReactionGroupMuted', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
  })

  it('sets muted on the target group', () => {
    const groupId = useReactStore.getState().laserDmxBeamMatrix.groups[0].id
    useReactStore.getState().setLaserDmxReactionGroupMuted(groupId, true)
    const g = useReactStore.getState().laserDmxBeamMatrix.groups.find(x => x.id === groupId)!
    expect(g.muted).toBe(true)
  })

  it('can un-mute a muted group', () => {
    const groupId = useReactStore.getState().laserDmxBeamMatrix.groups[0].id
    useReactStore.getState().setLaserDmxReactionGroupMuted(groupId, true)
    useReactStore.getState().setLaserDmxReactionGroupMuted(groupId, false)
    const g = useReactStore.getState().laserDmxBeamMatrix.groups.find(x => x.id === groupId)!
    expect(g.muted).toBe(false)
  })

  it('does not affect other groups', () => {
    const groups = useReactStore.getState().laserDmxBeamMatrix.groups
    useReactStore.getState().setLaserDmxReactionGroupMuted(groups[0].id, true)
    const g1 = useReactStore.getState().laserDmxBeamMatrix.groups.find(x => x.id === groups[1].id)!
    expect(g1.muted).toBe(false)
  })
})

describe('setLaserDmxReactionGroupSoloed', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
  })

  it('sets soloed on the target group', () => {
    const groupId = useReactStore.getState().laserDmxBeamMatrix.groups[0].id
    useReactStore.getState().setLaserDmxReactionGroupSoloed(groupId, true)
    const g = useReactStore.getState().laserDmxBeamMatrix.groups.find(x => x.id === groupId)!
    expect(g.soloed).toBe(true)
  })

  it('can un-solo a soloed group', () => {
    const groupId = useReactStore.getState().laserDmxBeamMatrix.groups[0].id
    useReactStore.getState().setLaserDmxReactionGroupSoloed(groupId, true)
    useReactStore.getState().setLaserDmxReactionGroupSoloed(groupId, false)
    const g = useReactStore.getState().laserDmxBeamMatrix.groups.find(x => x.id === groupId)!
    expect(g.soloed).toBe(false)
  })

  it('multiple groups can be soloed simultaneously', () => {
    const groups = useReactStore.getState().laserDmxBeamMatrix.groups
    useReactStore.getState().setLaserDmxReactionGroupSoloed(groups[0].id, true)
    useReactStore.getState().setLaserDmxReactionGroupSoloed(groups[1].id, true)
    const state = useReactStore.getState().laserDmxBeamMatrix.groups
    expect(state.find(g => g.id === groups[0].id)!.soloed).toBe(true)
    expect(state.find(g => g.id === groups[1].id)!.soloed).toBe(true)
  })
})

// ── Store: duplicateLaserDmxMatrixBeamsWithOffset ─────────────────────────────

describe('duplicateLaserDmxMatrixBeamsWithOffset', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
  })

  it('creates a copy of each selected beam with the given column/row offset', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam({ origin: { column: 3, row: 3, z: 0 } })
    const beamId = useReactStore.getState().laserDmxBeamMatrix.beams[0].id
    const count = store.duplicateLaserDmxMatrixBeamsWithOffset([beamId], 2, 1)
    expect(count).toBe(1)
    const beams = useReactStore.getState().laserDmxBeamMatrix.beams
    expect(beams.length).toBe(2)
    expect(beams[1].origin.column).toBe(5)
    expect(beams[1].origin.row).toBe(4)
  })

  it('clamps origin column to grid bounds when offset pushes it out', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam({ origin: { column: 14, row: 5, z: 0 } })
    const beamId = useReactStore.getState().laserDmxBeamMatrix.beams[0].id
    store.duplicateLaserDmxMatrixBeamsWithOffset([beamId], 5, 0)
    const beams = useReactStore.getState().laserDmxBeamMatrix.beams
    expect(beams[1].origin.column).toBe(LASER_DMX_MATRIX_COLUMNS)
  })

  it('duplicates are blocked when at beam limit, returns 0', () => {
    const store = useReactStore.getState()
    const fakeBeams = Array.from({ length: LASER_DMX_MATRIX_MAX_BEAMS }, (_, i) => ({
      id: `beam-limit-${i}`, name: `B${i}`, enabled: true,
      sequenceIndex: i, motion: DEFAULT_BEAM_MOTION,
      origin: { column: 1, row: 1, z: 0 },
      target: { kind: 'grid' as const, column: 1, row: 1, z: 0 },
      groupId: null, useGroupColor: false,
      color: { red: 0, green: 255, blue: 220, white: 0, alpha: 1 },
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' as const },
      modulationRoutes: [],
    }))
    store.setLaserDmxBeamMatrixSettings({ beams: fakeBeams })
    const count = store.duplicateLaserDmxMatrixBeamsWithOffset([fakeBeams[0].id], 1, 0)
    expect(count).toBe(0)
    expect(useReactStore.getState().laserDmxBeamMatrix.beams.length).toBe(LASER_DMX_MATRIX_MAX_BEAMS)
  })

  it('returns count of actually created beams when limit truncates the request', () => {
    const store = useReactStore.getState()
    const slots = 2
    const fakeBeams = Array.from({ length: LASER_DMX_MATRIX_MAX_BEAMS - slots }, (_, i) => ({
      id: `beam-fill-${i}`, name: `B${i}`, enabled: true,
      sequenceIndex: i, motion: DEFAULT_BEAM_MOTION,
      origin: { column: 1, row: 1, z: 0 },
      target: { kind: 'grid' as const, column: 1, row: 1, z: 0 },
      groupId: null, useGroupColor: false,
      color: { red: 0, green: 255, blue: 220, white: 0, alpha: 1 },
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' as const },
      modulationRoutes: [],
    }))
    store.setLaserDmxBeamMatrixSettings({ beams: fakeBeams })
    // Try to duplicate 5 beams, but only 2 slots remain
    const sourceBeams = [fakeBeams[0].id, fakeBeams[1].id, fakeBeams[2].id, fakeBeams[3].id, fakeBeams[4].id]
    const count = store.duplicateLaserDmxMatrixBeamsWithOffset(sourceBeams, 1, 0)
    expect(count).toBe(slots)
    expect(useReactStore.getState().laserDmxBeamMatrix.beams.length).toBe(LASER_DMX_MATRIX_MAX_BEAMS)
  })

  it('duplicated beam gets a new ID (not the original)', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam()
    const beamId = useReactStore.getState().laserDmxBeamMatrix.beams[0].id
    store.duplicateLaserDmxMatrixBeamsWithOffset([beamId], 1, 0)
    const beams = useReactStore.getState().laserDmxBeamMatrix.beams
    expect(beams[1].id).not.toBe(beamId)
  })
})

// ── Store: restoreStarterReactionGroups ───────────────────────────────────────

describe('restoreStarterReactionGroups', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
  })

  it('restores the 4 starter groups if they are all missing', () => {
    // Remove all groups
    const groups = useReactStore.getState().laserDmxBeamMatrix.groups
    groups.forEach(g => useReactStore.getState().removeLaserDmxReactionGroup(g.id))
    expect(useReactStore.getState().laserDmxBeamMatrix.groups.length).toBe(0)
    useReactStore.getState().restoreStarterReactionGroups()
    const starterIds = ['grp-bass', 'grp-snare', 'grp-beat', 'grp-custom']
    const restoredIds = useReactStore.getState().laserDmxBeamMatrix.groups.map(g => g.id)
    starterIds.forEach(id => expect(restoredIds).toContain(id))
  })

  it('does not add duplicate starter groups if they already exist', () => {
    // Default state already has starters
    const before = useReactStore.getState().laserDmxBeamMatrix.groups.length
    useReactStore.getState().restoreStarterReactionGroups()
    const after = useReactStore.getState().laserDmxBeamMatrix.groups.length
    expect(after).toBe(before)
  })

  it('preserves user-created groups when restoring starters', () => {
    useReactStore.getState().addLaserDmxReactionGroup()
    const groups2 = useReactStore.getState().laserDmxBeamMatrix.groups
    const userGroupId = groups2[groups2.length - 1].id
    useReactStore.getState().restoreStarterReactionGroups()
    const ids = useReactStore.getState().laserDmxBeamMatrix.groups.map(g => g.id)
    expect(ids).toContain(userGroupId)
  })

  it('preserves existing beams when restoring starters', () => {
    useReactStore.getState().addLaserDmxMatrixBeam()
    const beamsBefore = useReactStore.getState().laserDmxBeamMatrix.beams.length
    useReactStore.getState().restoreStarterReactionGroups()
    expect(useReactStore.getState().laserDmxBeamMatrix.beams.length).toBe(beamsBefore)
  })

  it('restored groups have muted=false and soloed=false', () => {
    const groups = useReactStore.getState().laserDmxBeamMatrix.groups
    groups.forEach(g => useReactStore.getState().removeLaserDmxReactionGroup(g.id))
    useReactStore.getState().restoreStarterReactionGroups()
    useReactStore.getState().laserDmxBeamMatrix.groups.forEach(g => {
      expect(g.muted).toBe(false)
      expect(g.soloed).toBe(false)
    })
  })
})

// ── Store: setLaserDmxBeamMatrixEditorSettings ────────────────────────────────

describe('setLaserDmxBeamMatrixEditorSettings', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
  })

  it('patches guidesVisible', () => {
    const initial = useReactStore.getState().laserDmxBeamMatrix.editor.guidesVisible
    useReactStore.getState().setLaserDmxBeamMatrixEditorSettings({ guidesVisible: !initial })
    expect(useReactStore.getState().laserDmxBeamMatrix.editor.guidesVisible).toBe(!initial)
  })

  it('patches snapEnabled without touching guidesVisible', () => {
    useReactStore.getState().setLaserDmxBeamMatrixEditorSettings({ guidesVisible: true })
    useReactStore.getState().setLaserDmxBeamMatrixEditorSettings({ snapEnabled: false })
    expect(useReactStore.getState().laserDmxBeamMatrix.editor.guidesVisible).toBe(true)
    expect(useReactStore.getState().laserDmxBeamMatrix.editor.snapEnabled).toBe(false)
  })

  it('patches overscanAmount', () => {
    useReactStore.getState().setLaserDmxBeamMatrixEditorSettings({ overscanAmount: 0.25 })
    expect(useReactStore.getState().laserDmxBeamMatrix.editor.overscanAmount).toBeCloseTo(0.25)
  })

  it('multiple fields can be patched in a single call', () => {
    useReactStore.getState().setLaserDmxBeamMatrixEditorSettings({
      guidesVisible: false,
      snapEnabled: false,
      overscanAmount: 0.1,
    })
    const ed = useReactStore.getState().laserDmxBeamMatrix.editor
    expect(ed.guidesVisible).toBe(false)
    expect(ed.snapEnabled).toBe(false)
    expect(ed.overscanAmount).toBeCloseTo(0.1)
  })
})
