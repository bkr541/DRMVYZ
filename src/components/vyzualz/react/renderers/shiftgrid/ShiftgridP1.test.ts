import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import type { CanvasMediaItem } from '../../ReactTypes'
import { ShiftgridGridRuntime, createDeterministicShiftgridPermutation, isValidShiftgridPermutation } from './ShiftgridGridState'
import { buildShiftgridVertexBatch, createShiftgridRenderPlan } from './ShiftgridRenderPlan'
import { createShiftgridRenderer } from './ShiftgridRenderer'
import { isShiftgridP1ImageSource } from './ShiftgridSourceMedia'
import { DEFAULT_CANVAS_SHIFTGRID_SETTINGS } from './ShiftgridSettings'
import { SHIFTGRID_REQUESTED_GRID_DIMENSIONS, createShiftgridTileGeometry, resolveShiftgridGridDimensions } from './ShiftgridTileGeometry'

function geometry(columns: number, rows: number, width = 960, height = 540) {
  return createShiftgridTileGeometry({ ...DEFAULT_CANVAS_SHIFTGRID_SETTINGS, gridColumns: columns, gridRows: rows, tileShape: 'rectangular' }, width, height)
}

describe('SHIFTGRID P1 tile system', () => {
  it.each(SHIFTGRID_REQUESTED_GRID_DIMENSIONS)('builds a fully occupied $columns × $rows grid', ({ columns, rows }) => {
    const result = geometry(columns, rows)
    expect(result.tiles).toHaveLength(columns * rows)
    expect(new Set(result.tiles.map(tile => tile.id)).size).toBe(columns * rows)
    expect(result.tiles.map(tile => tile.index)).toEqual(Array.from({ length: columns * rows }, (_, index) => index))
  })

  it('selects automatic grids using aspect, viewport, quality, and budget', () => {
    const wide = resolveShiftgridGridDimensions({ settings: { ...DEFAULT_CANVAS_SHIFTGRID_SETTINGS, gridPreset: 'auto', quality: 'high' }, sourceWidth: 1920, sourceHeight: 1080, viewportWidth: 1920, viewportHeight: 1080 })
    const square = resolveShiftgridGridDimensions({ settings: { ...DEFAULT_CANVAS_SHIFTGRID_SETTINGS, gridPreset: 'auto', quality: 'low' }, sourceWidth: 1000, sourceHeight: 1000, viewportWidth: 800, viewportHeight: 800 })
    expect(wide.columns / wide.rows).toBeGreaterThan(1.5)
    expect(square.columns).toBe(square.rows)
    expect(wide.columns * wide.rows).toBeLessThanOrEqual(DEFAULT_CANVAS_SHIFTGRID_SETTINGS.tileBudget)
  })

  it('preserves every identity through deterministic movement and exact reconstruction', () => {
    const grid = geometry(6, 6); const first = new ShiftgridGridRuntime(grid, 'one'); const second = new ShiftgridGridRuntime(grid, 'two')
    first.scramble(42, 400); second.scramble(42, 400)
    expect(first.state.pendingMovement?.toSlotsByTile).toEqual(second.state.pendingMovement?.toSlotsByTile)
    first.advance(400)
    expect(isValidShiftgridPermutation(first.state.currentSlotsByTile)).toBe(true)
    expect(new Set(first.state.currentSlotsByTile).size).toBe(36)
    first.swap(7, 200); first.advance(200); first.cycleRow(2, 1, 200); first.advance(200)
    first.cycleColumn(3, -1, 200); first.advance(200); first.coordinated(9, 200); first.advance(200)
    expect(isValidShiftgridPermutation(first.state.currentSlotsByTile)).toBe(true)
    first.reconstruct(500); first.advance(250)
    expect(first.state.pendingMovement?.progress).toBe(0.5)
    first.advance(250)
    expect(first.state.currentSlotsByTile).toEqual(first.state.reconstructionTarget)
  })

  it('generates valid repeatable permutations without arbitrary coordinates', () => {
    expect(createDeterministicShiftgridPermutation(80, 73421)).toEqual(createDeterministicShiftgridPermutation(80, 73421))
    expect(isValidShiftgridPermutation(createDeterministicShiftgridPermutation(80, 73421), 80)).toBe(true)
  })

  it('keeps normalized source coordinates and animation progress correct across resize', () => {
    const initial = geometry(4, 4, 800, 600); const runtime = new ShiftgridGridRuntime(initial, 'resize')
    runtime.swap(11, 1000); runtime.advance(500)
    const resized = geometry(4, 4, 1600, 900)
    const plan = createShiftgridRenderPlan({ geometry: resized, runtime, width: 1600, height: 900, sourceWidth: 1200, sourceHeight: 400, fitMode: 'contain', easing: 'linear' })
    expect(plan.tiles).toHaveLength(16)
    expect(runtime.state.pendingMovement?.progress).toBe(0.5)
    expect(plan.tiles.every(tile => Number.isFinite(tile.destination.x) && Number.isFinite(tile.source.x))).toBe(true)
  })

  it.each([[1600, 400], [400, 1600], [900, 900]])('preserves a %d × %d source aspect in contain and cover plans', (sourceWidth, sourceHeight) => {
    const grid = createShiftgridTileGeometry({ ...DEFAULT_CANVAS_SHIFTGRID_SETTINGS, gridColumns: 5, gridRows: 5, tileShape: 'square' }, 1280, 720)
    expect(grid.tiles.every(tile => tile.width === tile.height)).toBe(true)
    const runtime = new ShiftgridGridRuntime(grid, 'aspect')
    const contain = createShiftgridRenderPlan({ geometry: grid, runtime, width: 1280, height: 720, sourceWidth, sourceHeight, fitMode: 'contain', easing: 'linear' })
    const cover = createShiftgridRenderPlan({ geometry: grid, runtime, width: 1280, height: 720, sourceWidth, sourceHeight, fitMode: 'cover', easing: 'linear' })
    const containMinU = Math.min(...contain.tiles.map(tile => tile.source.x)); const containMaxU = Math.max(...contain.tiles.map(tile => tile.source.x + tile.source.width))
    const containMinV = Math.min(...contain.tiles.map(tile => tile.source.y)); const containMaxV = Math.max(...contain.tiles.map(tile => tile.source.y + tile.source.height))
    expect(containMinU).toBeLessThanOrEqual(0); expect(containMaxU).toBeGreaterThanOrEqual(1)
    expect(containMinV).toBeLessThanOrEqual(0); expect(containMaxV).toBeGreaterThanOrEqual(1)
    expect(cover.tiles.every(tile => Number.isFinite(tile.source.width) && tile.source.width > 0)).toBe(true)
  })

  it('emits one batched vertex buffer and pixel-perfect assembled identity including alpha', () => {
    const grid = geometry(3, 3, 6, 6); const runtime = new ShiftgridGridRuntime(grid, 'pixels')
    const plan = createShiftgridRenderPlan({ geometry: grid, runtime, width: 6, height: 6, sourceWidth: 6, sourceHeight: 6, fitMode: 'cover', easing: 'linear' })
    expect(buildShiftgridVertexBatch(plan)).toHaveLength(9 * 6 * 15)
    const source = new Uint8Array(6 * 6 * 4)
    for (let index = 0; index < 36; index += 1) { source[index * 4] = index; source[index * 4 + 1] = 255 - index; source[index * 4 + 2] = index % 3; source[index * 4 + 3] = index % 5 === 0 ? 0 : 255 }
    const restored = new Uint8Array(source.length)
    for (const tile of plan.tiles) for (let y = tile.destination.y; y < tile.destination.y + tile.destination.height; y += 1) for (let x = tile.destination.x; x < tile.destination.x + tile.destination.width; x += 1) {
      const u = tile.source.x + ((x - tile.destination.x) / tile.destination.width) * tile.source.width
      const v = tile.source.y + ((y - tile.destination.y) / tile.destination.height) * tile.source.height
      const sourceIndex = (Math.floor(v * 6) * 6 + Math.floor(u * 6)) * 4; const destinationIndex = (y * 6 + x) * 4
      restored.set(source.subarray(sourceIndex, sourceIndex + 4), destinationIndex)
    }
    expect(restored).toEqual(source)
  })

  it.each([
    ['image/png', 'asset.png'], ['image/jpeg', 'asset.jpg'], ['image/webp', 'asset.webp'], ['image/svg+xml', 'asset.svg'],
  ])('accepts P1 image format %s', (mimeType, filename) => {
    const item: CanvasMediaItem = { id: filename, name: filename, type: mimeType === 'image/svg+xml' ? 'svg' : 'image', objectUrl: `blob:${filename}`, mimeType, createdAt: new Date(0).toISOString() }
    expect(isShiftgridP1ImageSource(item)).toBe(true)
  })

  it('decodes real PNG, JPEG, WebP, and SVG fixtures, including transparent pixels', async () => {
    const rgba = Buffer.from([255, 0, 0, 0, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 128])
    const make = () => sharp(rgba, { raw: { width: 2, height: 2, channels: 4 } })
    const fixtures = [
      await make().png().toBuffer(),
      await make().jpeg().toBuffer(),
      await make().webp().toBuffer(),
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="1" height="2" fill="red"/></svg>'),
    ]
    for (const fixture of fixtures) {
      const decoded = await sharp(fixture).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      expect(decoded.info).toMatchObject({ width: 2, height: 2, channels: 4 })
    }
    const transparentPng = await sharp(fixtures[0]).ensureAlpha().raw().toBuffer()
    expect(transparentPng[3]).toBe(0)
  })

  it('falls back to Canvas2D when WebGL2 is unavailable', () => {
    const context = { imageSmoothingEnabled: false, imageSmoothingQuality: 'low', setTransform: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn() }
    const canvas = { width: 0, height: 0, getContext: vi.fn((kind: string) => kind === '2d' ? context : null) } as unknown as HTMLCanvasElement
    const renderer = createShiftgridRenderer(canvas)
    expect(renderer.backend).toBe('canvas2d')
    renderer.resize(320, 180, 2); renderer.dispose()
    expect(canvas.width).toBe(640); expect(context.clearRect).toHaveBeenCalled()
  })
})
