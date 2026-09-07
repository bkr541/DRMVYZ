import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  AFTERHOURS_DEFAULT_ACCENT,
  AFTERHOURS_DEFAULT_PRIMARY,
  type AfterhoursColorInput,
  parseAfterhoursHexColor,
  resolveAfterhoursPalette,
} from './AfterhoursColor'

const MANUAL: AfterhoursColorInput = { colorMode: 'manual', primaryColor: '#74f5ff', accentColor: '#ffffff' }
const AUTO_SOURCE = { primary: '#ff3366', accent: '#33ddff', secondary: '#8844ff' }

const finite = (c: { r: number; g: number; b: number }) =>
  [c.r, c.g, c.b].every(v => Number.isFinite(v) && v >= 0 && v <= 1)

describe('Afterhours Stage 3 — colour parsing', () => {
  it('parses #rrggbb, #rgb, and bare hex; falls back on malformed input', () => {
    expect(parseAfterhoursHexColor('#ff8000', AFTERHOURS_DEFAULT_PRIMARY)).toEqual({ r: 1, g: 128 / 255, b: 0 })
    expect(parseAfterhoursHexColor('0f0', AFTERHOURS_DEFAULT_PRIMARY)).toEqual({ r: 0, g: 1, b: 0 })
    expect(parseAfterhoursHexColor('not-a-color', AFTERHOURS_DEFAULT_ACCENT)).toBe(AFTERHOURS_DEFAULT_ACCENT)
    expect(parseAfterhoursHexColor('', AFTERHOURS_DEFAULT_PRIMARY)).toBe(AFTERHOURS_DEFAULT_PRIMARY)
  })
})

describe('Afterhours Stage 3 — Manual colour mode', () => {
  it('renders the persisted Primary and Accent hues', () => {
    const palette = resolveAfterhoursPalette(MANUAL, null)
    expect(palette.primary).toEqual({ r: 116 / 255, g: 245 / 255, b: 1 })
    expect(palette.accent).toEqual({ r: 1, g: 1, b: 1 })
  })

  it('ignores any auto palette source while in Manual mode', () => {
    expect(resolveAfterhoursPalette(MANUAL, AUTO_SOURCE)).toEqual(resolveAfterhoursPalette(MANUAL, null))
  })

  it('falls back independently per channel on malformed manual colours', () => {
    const palette = resolveAfterhoursPalette({ colorMode: 'manual', primaryColor: '#123456', accentColor: 'oops' }, null)
    expect(palette.primary).toEqual({ r: 0x12 / 255, g: 0x34 / 255, b: 0x56 / 255 })
    expect(palette.accent).toEqual(AFTERHOURS_DEFAULT_ACCENT)
  })

  it('stays finite for black-on-black and identical primary/accent inputs', () => {
    const black = resolveAfterhoursPalette({ colorMode: 'manual', primaryColor: '#000000', accentColor: '#000000' }, null)
    expect(finite(black.primary) && finite(black.accent)).toBe(true)
  })
})

describe('Afterhours Stage 3 — Auto colour mode', () => {
  it('derives the active pair from the stable palette source, not the persisted fields', () => {
    const input: AfterhoursColorInput = { colorMode: 'auto', primaryColor: '#74f5ff', accentColor: '#ffffff' }
    const palette = resolveAfterhoursPalette(input, AUTO_SOURCE)
    expect(palette.primary).toEqual(parseAfterhoursHexColor('#ff3366', AFTERHOURS_DEFAULT_PRIMARY))
    // Distinct enough hues -> accent is taken straight from the source.
    expect(palette.primary).not.toEqual(palette.accent)
  })

  it('is deterministic — the same source always yields the same palette', () => {
    const input: AfterhoursColorInput = { colorMode: 'auto', primaryColor: '#000', accentColor: '#000' }
    expect(resolveAfterhoursPalette(input, AUTO_SOURCE)).toEqual(resolveAfterhoursPalette(input, AUTO_SOURCE))
  })

  it('falls back to Afterhours defaults when no usable palette source exists', () => {
    const input: AfterhoursColorInput = { colorMode: 'auto', primaryColor: '#zzz', accentColor: 'nope' }
    const palette = resolveAfterhoursPalette(input, null)
    expect(palette.primary).toEqual(AFTERHOURS_DEFAULT_PRIMARY)
    expect(palette.accent).toEqual(AFTERHOURS_DEFAULT_ACCENT)
  })

  it('keeps Accent perceptually distinct when the auto source is effectively monochrome', () => {
    const mono = { primary: '#2050ff', accent: '#2454ff' }
    const palette = resolveAfterhoursPalette({ colorMode: 'auto', primaryColor: '#fff', accentColor: '#fff' }, mono)
    expect(finite(palette.primary) && finite(palette.accent)).toBe(true)
    const delta = Math.abs(palette.primary.r - palette.accent.r)
      + Math.abs(palette.primary.g - palette.accent.g)
      + Math.abs(palette.primary.b - palette.accent.b)
    expect(delta).toBeGreaterThan(0.15)
  })
})

describe('Afterhours Stage 3 — Manual <-> Auto <-> Manual', () => {
  it('never mutates the input and restores identical manual colours after an Auto excursion', () => {
    const input: AfterhoursColorInput = { colorMode: 'manual', primaryColor: '#abcdef', accentColor: '#fedcba' }
    const before = resolveAfterhoursPalette(input, null)
    resolveAfterhoursPalette({ ...input, colorMode: 'auto' }, AUTO_SOURCE)
    const after = resolveAfterhoursPalette(input, null)
    expect(after).toEqual(before)
    expect(input).toEqual({ colorMode: 'manual', primaryColor: '#abcdef', accentColor: '#fedcba' })
  })
})

describe('Afterhours Stage 3 — no LaserDMX runtime coupling', () => {
  it('the Afterhours world/shader/colour modules never reference LaserDMX', () => {
    for (const name of [
      'AfterhoursColor.ts', 'AfterhoursShader.ts', 'AfterhoursWorld.ts', 'AfterhoursBeamGeometry.ts',
      'AfterhoursTriggerController.ts', 'AfterhoursPatternDirector.ts',
    ]) {
      const source = readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8')
      expect(/laser[-_ ]?dmx/i.test(source)).toBe(false)
    }
  })
})
