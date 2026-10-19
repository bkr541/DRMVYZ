import { describe, expect, it } from 'vitest'
import { createShiftgridChoreographyPlan, createShiftgridReconstructionPlan, ShiftgridChoreographyPlayback } from './ShiftgridChoreography'
import { isValidShiftgridPermutation } from './ShiftgridGridState'
import { createShiftgridMosaicPlan, createShiftgridMosaicResolvePlan, ShiftgridMosaicPlayback } from './ShiftgridMosaic'
import { buildShiftgridVertexBatch, createShiftgridRenderPlan } from './ShiftgridRenderPlan'
import {
  CANVAS_SHIFTGRID_MULTI_MOSAIC_TYPE_OPTIONS,
  CANVAS_SHIFTGRID_PATTERN_OPTIONS,
  DEFAULT_CANVAS_SHIFTGRID_SETTINGS,
  type CanvasShiftgridMosaicType,
  type CanvasShiftgridPattern,
} from './ShiftgridSettings'
import { createShiftgridTileGeometry } from './ShiftgridTileGeometry'
import { resolveShiftgridAtlasLayout } from './ShiftgridTextureAtlas'

const settings = (pattern: CanvasShiftgridPattern, columns: number, rows: number) => ({
  ...DEFAULT_CANVAS_SHIFTGRID_SETTINGS,
  choreographyPattern: pattern,
  gridMode: 'fixed' as const,
  gridColumns: columns,
  gridRows: rows,
  gridPreset: 'custom' as const,
  tileShape: 'rectangular' as const,
  movementAmount: 1,
  scrambleComplexity: 0.8,
  deterministicSeed: 9042026,
})

describe('SHIFTGRID P7 production invariants', () => {
  it.each([[4, 4], [10, 6], [16, 9]])('keeps all eight patterns occupied, deterministic, pausable, seekable, and reconstructable at %d×%d', (columns, rows) => {
    const signatures = new Set<string>()
    for (const { value: pattern } of CANVAS_SHIFTGRID_PATTERN_OPTIONS) {
      const config = settings(pattern, columns, rows)
      const first = createShiftgridChoreographyPlan({ columns, rows, settings: config })
      const second = createShiftgridChoreographyPlan({ columns, rows, settings: config })
      expect(first).toEqual(second)
      expect(isValidShiftgridPermutation(first.finalSlotsByTile, columns * rows)).toBe(true)
      expect(first.steps.every(step => isValidShiftgridPermutation(step.toSlotsByTile, columns * rows))).toBe(true)
      signatures.add(first.steps.map(step => `${step.topology}:${step.axis}:${step.affectedTileIndices.length}`).join('|'))

      const geometry = createShiftgridTileGeometry({ gridColumns: columns, gridRows: rows, tileShape: 'rectangular' }, 1600, 900)
      const playback = new ShiftgridChoreographyPlayback(geometry, first, `${pattern}:${columns}x${rows}`)
      playback.seek(first.durationMs * 0.47)
      const paused = [...playback.state.currentSlotsByTile]
      playback.setPaused(true); playback.advance(30_000)
      expect(playback.state.currentSlotsByTile).toEqual(paused)
      playback.setPaused(false); playback.seek(first.durationMs); playback.seek(first.durationMs * 0.2); playback.seek(first.durationMs)
      expect(playback.state.currentSlotsByTile).toEqual(first.finalSlotsByTile)

      const reconstruction = createShiftgridReconstructionPlan({ columns, rows, settings: config, initialSlotsByTile: first.finalSlotsByTile })
      playback.replacePlan(reconstruction); playback.seek(reconstruction.durationMs)
      expect(playback.state.currentSlotsByTile).toEqual(Array.from({ length: columns * rows }, (_, index) => index))
    }
    expect(signatures.size).toBe(8)
  })

  it('survives long synthetic playback with rapid deterministic pattern changes at multiple frame rates', () => {
    const columns = 10; const rows = 6
    for (const fps of [24, 60, 144]) {
      const geometry = createShiftgridTileGeometry({ gridColumns: columns, gridRows: rows, tileShape: 'rectangular' }, 1920, 1080)
      let slots = Array.from({ length: columns * rows }, (_, index) => index)
      for (let cycle = 0; cycle < 96; cycle += 1) {
        const pattern = CANVAS_SHIFTGRID_PATTERN_OPTIONS[cycle % 8]!.value
        const config = { ...settings(pattern, columns, rows), deterministicSeed: 9042026 + cycle }
        const plan = createShiftgridChoreographyPlan({ columns, rows, settings: config, initialSlotsByTile: slots })
        const playback = new ShiftgridChoreographyPlayback(geometry, plan, `${fps}:${cycle}`)
        const frameMs = 1000 / fps
        while (!playback.complete) playback.advance(frameMs)
        expect(isValidShiftgridPermutation(playback.state.currentSlotsByTile, slots.length)).toBe(true)
        slots = [...playback.state.currentSlotsByTile]
      }
    }
  })

  it.each([2, 6, 10])('runs all six multi-image modes and resolves every tile to one coherent target with %d sources', sourceCount => {
    const columns = 10; const rows = 6; const sourceIds = Array.from({ length: sourceCount }, (_, index) => `source-${index}`)
    for (const { value } of CANVAS_SHIFTGRID_MULTI_MOSAIC_TYPE_OPTIONS) {
      const mosaicType = value as CanvasShiftgridMosaicType
      const config = { ...settings('waveRelay', columns, rows), mosaicType, primaryTargetMediaId: sourceIds[sourceCount - 1]! }
      const plan = createShiftgridMosaicPlan({ columns, rows, sourceIds, settings: config, sequenceIndex: 3 })
      const playback = new ShiftgridMosaicPlayback(plan)
      playback.seek(plan.durationMs * 0.51)
      expect(playback.currentSourceIndicesByTile).toHaveLength(columns * rows)
      expect(playback.currentSourceIndicesByTile.every(source => source >= 0 && source < sourceCount)).toBe(true)
      const resolve = createShiftgridMosaicResolvePlan({ columns, rows, sourceCount, targetSourceIndex: sourceCount - 1,
        initialSourceIndicesByTile: playback.currentSourceIndicesByTile, settings: config })
      playback.replacePlan(resolve); playback.seek(resolve.durationMs)
      expect(new Set(playback.currentSourceIndicesByTile)).toEqual(new Set([sourceCount - 1]))
    }
  })

  it('preserves exact synthetic pixels in a clean assembled grid and emits no gaps or duplicate identities', () => {
    const width = 160; const height = 90; const columns = 16; const rows = 9
    const geometry = createShiftgridTileGeometry({ gridColumns: columns, gridRows: rows, tileShape: 'rectangular' }, width, height)
    const config = settings('rowRunner', columns, rows)
    const staticPlan = createShiftgridChoreographyPlan({ columns, rows, settings: { ...config, movementAmount: 0 } })
    const runtime = new ShiftgridChoreographyPlayback(geometry, staticPlan, 'pixel-fixture')
    runtime.seek(0)
    const plan = createShiftgridRenderPlan({ geometry, runtime, width, height, sourceWidth: width, sourceHeight: height, fitMode: 'cover', easing: 'linear' })
    const coverage = new Uint8Array(width * height)
    for (const tile of plan.tiles) {
      expect(tile.opacity).toBe(1)
      for (let y = tile.destination.y; y < tile.destination.y + tile.destination.height; y += 1) {
        for (let x = tile.destination.x; x < tile.destination.x + tile.destination.width; x += 1) coverage[y * width + x] += 1
      }
    }
    expect(coverage.every(value => value === 1)).toBe(true)
    expect(new Set(plan.tiles.map(tile => tile.tileId)).size).toBe(columns * rows)
    expect(plan.cleanEffects).toBe(true)
  })

  it('keeps representative planning and batching costs bounded without reducing puzzle layout', () => {
    const scenarios = [[4, 4], [10, 6], [16, 9]] as const
    for (const [columns, rows] of scenarios) {
      const geometry = createShiftgridTileGeometry({ gridColumns: columns, gridRows: rows, tileShape: 'rectangular' }, 1920, 1080)
      const config = settings('checkerShift', columns, rows)
      const started = performance.now()
      for (let iteration = 0; iteration < 40; iteration += 1) {
        const choreography = createShiftgridChoreographyPlan({ columns, rows, settings: { ...config, deterministicSeed: config.deterministicSeed + iteration } })
        const runtime = new ShiftgridChoreographyPlayback(geometry, choreography, `profile:${iteration}`)
        runtime.seek(choreography.durationMs * 0.5)
        const plan = createShiftgridRenderPlan({ geometry, runtime, width: 1920, height: 1080, sourceWidth: 1920, sourceHeight: 1080, fitMode: 'cover', easing: 'easeOut' })
        const renderedQuads = columns * rows + plan.trails.length + (plan.backdrop ? 1 : 0)
        expect(buildShiftgridVertexBatch(plan).length).toBe(renderedQuads * 6 * 15)
      }
      expect((performance.now() - started) / 40).toBeLessThan(25)
    }
    expect(resolveShiftgridAtlasLayout(1, 512, 8192).estimatedBytes).toBe(1_048_576)
    expect(resolveShiftgridAtlasLayout(6, 512, 8192).estimatedBytes).toBe(6_291_456)
    expect(resolveShiftgridAtlasLayout(10, 512, 8192).estimatedBytes).toBe(12_582_912)
    expect(resolveShiftgridAtlasLayout(10, 768, 8192).estimatedBytes).toBe(28_311_552)
  })
})
