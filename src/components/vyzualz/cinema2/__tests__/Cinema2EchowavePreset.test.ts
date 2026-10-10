import { describe, expect, it } from 'vitest'
import cloudLogoSvg from '../../../../assets/dvydrm_cloud_logo_clean_master.svg?raw'
import wordmarkSvg from '../../../../assets/dvydrm_wordmark_clean_master.svg?raw'
import { buildCinema2EchoformGeometry, ECHOFORM_KIND, ECHOFORM_VERTEX_FLOATS } from '../modules/echoform/Cinema2EchoformGeometry'
import { CINEMA2_ECHOWAVE_CLOUD_LOGO_GEOMETRY, CINEMA2_ECHOWAVE_GEOMETRY, CINEMA2_ECHOWAVE_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2EchowaveNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_ECHOFORM_PRESET_MANIFEST } from '../presets/Cinema2EchoformPreset'
import { CINEMA2_ECHOWAVE_PRESET_ID, CINEMA2_ECHOWAVE_PRESET_MANIFEST } from '../presets/Cinema2EchowavePreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const REQUIRED_CAPABILITIES = ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world'] as const

describe('Echowave preset', () => {
  it('ships as a visible first-party keeper and passes the native authoring and compiler gates', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_ECHOWAVE_PRESET_ID)).toMatchObject({ role: 'keeper' })
    expect(CINEMA2_ECHOWAVE_PRESET_MANIFEST.metadata).toMatchObject({ name: 'Echowave' })
    expect(CINEMA2_ECHOWAVE_PRESET_MANIFEST.metadata.tags).not.toContain('internal')
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_ECHOWAVE_PRESET_MANIFEST })).toEqual({ ok: true, diagnostics: [] })
    const compiled = compileCinema2NativePreset(CINEMA2_ECHOWAVE_PRESET_MANIFEST, { availableCapabilities: REQUIRED_CAPABILITIES })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n'))
    expect(cinema2NativePresetRegistry.get(CINEMA2_ECHOWAVE_PRESET_ID)).not.toBeNull()
    expect(cinema2NativeModuleRegistry.get(CINEMA2_ECHOWAVE_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
  })

  it('is Echoform in every control, default and rule, on its own module, ids and wording', () => {
    const labels = (manifest: typeof CINEMA2_ECHOFORM_PRESET_MANIFEST) => (manifest.parameters ?? []).map(parameter => [parameter.label, 'defaultValue' in parameter ? parameter.defaultValue : null])
    expect(labels(CINEMA2_ECHOWAVE_PRESET_MANIFEST)).toEqual(labels(CINEMA2_ECHOFORM_PRESET_MANIFEST))
    expect(CINEMA2_ECHOWAVE_PRESET_MANIFEST.choreography?.rules).toHaveLength(CINEMA2_ECHOFORM_PRESET_MANIFEST.choreography?.rules.length ?? -1)
    expect(CINEMA2_ECHOWAVE_PRESET_MANIFEST.modules?.[0]).toMatchObject({ typeId: CINEMA2_ECHOWAVE_NATIVE_MODULE_TYPE_ID })
    const text = JSON.stringify(CINEMA2_ECHOWAVE_PRESET_MANIFEST)
    expect(text).not.toMatch(/echoform|Echoform|bulldog|GOONZ/)
    const ids = new Set((CINEMA2_ECHOFORM_PRESET_MANIFEST.parameters ?? []).map(parameter => parameter.id))
    // Only the shared Quality control keeps a shared id; everything Echowave owns has its own.
    const owned = (CINEMA2_ECHOWAVE_PRESET_MANIFEST.parameters ?? []).filter(parameter => String(parameter.id).startsWith('echowave-'))
    expect(owned.length).toBeGreaterThan(20)
    for (const parameter of owned) expect(ids.has(parameter.id)).toBe(false)
  })

  it('builds the cloud from the wordmark: ring, bodies, sweeps and a focal symbol, all with orchestration attributes', () => {
    expect(wordmarkSvg).toContain('four-point-symbol')
    const geometry = buildCinema2EchoformGeometry(wordmarkSvg, CINEMA2_ECHOWAVE_GEOMETRY)
    expect(geometry.pointCount).toBeGreaterThan(5_000)
    expect(geometry.lineVertexCount).toBeGreaterThan(2_000)
    const kinds = new Set<number>()
    const regions = new Set<number>()
    let minX = Infinity
    let maxX = -Infinity
    for (let index = 0; index < geometry.pointCount; index += 1) {
      const base = index * ECHOFORM_VERTEX_FLOATS
      minX = Math.min(minX, geometry.points[base]!)
      maxX = Math.max(maxX, geometry.points[base]!)
      kinds.add(geometry.points[base + 6]!)
      regions.add(geometry.points[base + 9]!)
    }
    expect(kinds.has(ECHOFORM_KIND.eye)).toBe(true)
    expect(kinds.has(ECHOFORM_KIND.contour)).toBe(true)
    expect(regions.size).toBe(8)
    expect(maxX - minX).toBeGreaterThan(3)
  })

  it('also builds the DVYDRM cloud logo the particles merge into, with its own focal star', () => {
    expect(cloudLogoSvg).toContain('lower-star')
    const logo = buildCinema2EchoformGeometry(cloudLogoSvg, CINEMA2_ECHOWAVE_CLOUD_LOGO_GEOMETRY)
    expect(logo.pointCount).toBeGreaterThan(5_000)
    let focal = 0
    let minX = Infinity
    let maxX = -Infinity
    for (let index = 0; index < logo.pointCount; index += 1) {
      const base = index * ECHOFORM_VERTEX_FLOATS
      if (logo.points[base + 6] === ECHOFORM_KIND.eye) focal += 1
      minX = Math.min(minX, logo.points[base]!)
      maxX = Math.max(maxX, logo.points[base]!)
    }
    expect(focal).toBeGreaterThan(50)
    expect(maxX - minX).toBeGreaterThan(2)
  })
})
