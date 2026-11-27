import { describe, expect, it } from 'vitest'
import { CINEMA2_CORRIDOR_MODULE_TYPE_ID, CINEMA2_GOONZ_CORRIDOR_MODULE_TYPE_ID } from '../modules/Cinema2CorridorNativeModule'
import { buildCorridorGeometry, CORRIDOR_BANK_SPAN, CORRIDOR_BAY_LENGTH, CORRIDOR_MAX_INSET, CORRIDOR_VERTEX_FLOATS, GOONZ_MIN_SIDE, GOONZ_MAX_PAIR_SIDE, GOONZ_MAX_AXIAL_SIDE } from '../modules/corridor/Cinema2CorridorRenderer'
import { CINEMA2_CORRIDOR_PRESET_ID, CINEMA2_CORRIDOR_PRESET_MANIFEST } from '../presets/Cinema2CorridorPreset'
import { CINEMA2_GOONZ_CORRIDOR_PRESET_ID, CINEMA2_GOONZ_CORRIDOR_PRESET_MANIFEST } from '../presets/Cinema2GoonzCorridorPreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

describe('GOONZ CORRIDOR', () => {
  it('compiles separately and inherits all authored controls, media, camera and musical rules', () => {
    const original = CINEMA2_CORRIDOR_PRESET_MANIFEST
    const variant = CINEMA2_GOONZ_CORRIDOR_PRESET_MANIFEST
    expect(variant.id).not.toBe(original.id)
    expect(variant.metadata.name).toBe('GOONZ CORRIDOR')
    expect(variant.modules?.[0]?.typeId).toBe(CINEMA2_GOONZ_CORRIDOR_MODULE_TYPE_ID)
    expect(original.modules?.[0]?.typeId).toBe(CINEMA2_CORRIDOR_MODULE_TYPE_ID)
    for (const key of ['parameters', 'mediaSlots', 'choreography', 'cameras', 'effects', 'render'] as const) expect(variant[key]).toEqual(original[key])
    for (const id of [CINEMA2_CORRIDOR_PRESET_ID, CINEMA2_GOONZ_CORRIDOR_PRESET_ID]) {
      const result = cinema2NativePresetRegistry.compile(id)
      expect(result.diagnostics).toEqual([])
      expect(result.ok).toBe(true)
    }
  })

  it('guarantees double the minimum original casing, face and illuminated aperture at every width', () => {
    for (const width of [1.8, 2.35, 3.3]) {
      const originalUnit = Math.min(width * CORRIDOR_BANK_SPAN * 2 / 4 * .72, CORRIDOR_BAY_LENGTH * .66)
      const minimum = Math.min(width * GOONZ_MIN_SIDE, GOONZ_MAX_AXIAL_SIDE)
      expect(minimum).toBeGreaterThanOrEqual(2 * .95 * originalUnit)
      expect(minimum * .70 / .95).toBeGreaterThanOrEqual(2 * .804 * originalUnit)
      expect(minimum * .64 / .95).toBeGreaterThanOrEqual(2 * .73 * originalUnit)
      // Adjacent pairs, single panels, axial staggering and full piston extension
      // must fit without touching any neighboring bank or depth bay.
      expect(CORRIDOR_BANK_SPAN / 2 + GOONZ_MAX_PAIR_SIDE / 2 + CORRIDOR_MAX_INSET).toBeLessThan(1)
      expect(1.24 / 2 + CORRIDOR_MAX_INSET).toBeLessThan(1)
      expect(GOONZ_MAX_AXIAL_SIDE + .11).toBeLessThan(CORRIDOR_BAY_LENGTH)
    }
  })

  it('preserves the original mesh and uses at most two individually cased squares per bank and bay', () => {
    const original = buildCorridorGeometry()
    const variant = buildCorridorGeometry(true)
    expect(original.byteLength).toBe(1382400)
    expect(variant.byteLength).toBe(original.byteLength / 2)
    const cells = new Map<string, Set<number>>()
    for (let i = 0; i < variant.length; i += CORRIDOR_VERTEX_FLOATS) {
      const key = `${variant[i+5]}:${variant[i+6]}:${variant[i+7]}`
      const parts = cells.get(key) ?? new Set<number>()
      parts.add(variant[i+8]!)
      cells.set(key, parts)
    }
    expect(cells.size).toBe(96)
    for (const parts of cells.values()) expect([...parts].sort()).toEqual([0,1,2,3,4,5])
  })
})
