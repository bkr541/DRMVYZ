import { describe, expect, it } from 'vitest'
import { buildCinema2InertiaGeometry, INERTIA_PROOF_POSES } from '../modules/inertia/Cinema2InertiaGeometry'
import { CINEMA2_INERTIA_PRESET_MANIFEST, CINEMA2_INERTIA_PRESET_ID } from '../presets/Cinema2InertiaPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'

describe('Inertia static visual core', () => {
  it('keeps a unique, centered sphere and eight anchors inside safe bounds at every proof pose and quality', () => {
    for (const pose of INERTIA_PROOF_POSES) for (const quality of ['low', 'medium', 'high'] as const) {
      const geometry = buildCinema2InertiaGeometry(pose, quality)
      expect(geometry.counts.anchors).toBe(8)
      expect(geometry.counts.core).toBeGreaterThan(1000)
      expect(geometry.maxRadius).toBeLessThan(0.9) // reserve sprite footprint before the 0.92 bound
      const unique = new Set<string>()
      let previousZ = -Infinity
      for (let i = 0; i < geometry.points.length; i += 4) {
        const [x, y, z, role] = geometry.points.slice(i, i + 4)
        expect([x, y, z].every(Number.isFinite)).toBe(true)
        expect(z).toBeGreaterThanOrEqual(previousZ)
        previousZ = z
        const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)},${role}`
        expect(unique.has(key), key).toBe(false); unique.add(key)
        if (role === 1) expect(Math.hypot(x, y, z)).toBeCloseTo(0.26, 6)
      }
      expect(geometry.ribs.every(Number.isFinite)).toBe(true)
      for (let i = 0; i < geometry.ribs.length; i += 3) {
        expect(Math.hypot(...geometry.ribs.slice(i, i + 3))).toBeLessThan(0.9)
      }
    }
  })

  it('retains the structured balanced topology and does not degenerate in its folded proof pose', () => {
    const baseline = buildCinema2InertiaGeometry()
    const folded = buildCinema2InertiaGeometry('folded')
    expect(baseline.counts).toEqual({ lattice: 6138, core: 2114, anchors: 8, ribs: 384 })
    expect(folded.counts).toEqual(baseline.counts)
    expect(folded.points).not.toEqual(baseline.points)
    expect(buildCinema2InertiaGeometry('coherent', 'low').counts.lattice).toBeLessThan(baseline.counts.lattice)
    expect(buildCinema2InertiaGeometry('coherent', 'high').counts.lattice).toBeGreaterThan(baseline.counts.lattice)
  })

  it('registers the user-approved keeper with restrained default finishing', () => {
    const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(value => value.manifest.id === CINEMA2_INERTIA_PRESET_ID)!
    expect(declaration.role).toBe('keeper')
    expect(validateCinema2PresetAuthoringConventions(declaration).diagnostics).toEqual([])
    const compiled = compileCinema2NativePreset(CINEMA2_INERTIA_PRESET_MANIFEST)
    expect(compiled.ok, JSON.stringify(compiled.diagnostics)).toBe(true)
    const module = CINEMA2_INERTIA_PRESET_MANIFEST.modules![0]
    expect(cinema2NativeModuleRegistry.get(module.typeId, module.version)).not.toBeNull()
    expect(CINEMA2_INERTIA_PRESET_MANIFEST.effects ?? []).toHaveLength(2)
    expect(CINEMA2_INERTIA_PRESET_MANIFEST.effects!.every(effect => effect.enabled === false)).toBe(true)
    expect(CINEMA2_INERTIA_PRESET_MANIFEST.choreography?.rules ?? []).toHaveLength(13)
    expect(CINEMA2_INERTIA_PRESET_MANIFEST.parameters!.filter(p => p.id.includes('proof-')).every(p => p.exposure === 'hidden')).toBe(true)
  })
})
