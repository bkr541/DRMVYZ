import { describe, expect, it } from 'vitest'
import { CINEMA2_ECHOFORM_PATTERN_CHANGE_ID, CINEMA2_ECHOFORM_PATTERN_ID, CINEMA2_ECHOFORM_TRIGGER_ID, CINEMA2_ECHOFORM_IDLE_GLOW_ID } from '../presets/Cinema2EchoformPreset'
import { buildCinema2EchoformGeometry, ECHOFORM_KIND, ECHOFORM_VERTEX_FLOATS } from '../modules/echoform/Cinema2EchoformGeometry'
import goonzMasterSvg from '../../../../assets/goonz_true_vector_master.svg?raw'
import { CINEMA2_ECHOFORM_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2EchoformNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import {
  CINEMA2_ECHOFORM_BPM_SYNC_ID,
  CINEMA2_ECHOFORM_PRESET_ID,
  CINEMA2_ECHOFORM_PRESET_MANIFEST,
} from '../presets/Cinema2EchoformPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const REQUIRED_CAPABILITIES = ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world'] as const

describe('Echoform preset', () => {
  it('ships as a visible first-party keeper and passes the native authoring/compiler gates', () => {
    const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_ECHOFORM_PRESET_ID)
    expect(declaration).toMatchObject({ role: 'keeper' })
    expect(CINEMA2_ECHOFORM_PRESET_MANIFEST.metadata).toMatchObject({ name: 'Echoform' })
    expect(CINEMA2_ECHOFORM_PRESET_MANIFEST.metadata.tags).not.toContain('internal')
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_ECHOFORM_PRESET_MANIFEST })).toEqual({ ok: true, diagnostics: [] })

    const compiled = compileCinema2NativePreset(CINEMA2_ECHOFORM_PRESET_MANIFEST, { availableCapabilities: REQUIRED_CAPABILITIES })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n'))

    expect(compiled.plan.render.passes.map(pass => pass.kind)).toEqual(['scene', 'fullscreen', 'fullscreen'])
    expect(cinema2NativePresetRegistry.get(CINEMA2_ECHOFORM_PRESET_ID)).not.toBeNull()
    expect(cinema2NativeModuleRegistry.get(CINEMA2_ECHOFORM_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
  })

  it('keeps the supplied SVG as a flat layered source with its original palette and identity', () => {
    expect(goonzMasterSvg).toContain('viewBox="0 0 800 800"')
    expect(goonzMasterSvg).toContain('GOONZ bulldog wearing headphones')
    expect(goonzMasterSvg).toContain('id="blue-iris"')
    expect(goonzMasterSvg).toContain('#05e1ef')

    const module = CINEMA2_ECHOFORM_PRESET_MANIFEST.modules?.[0]
    expect(module).toMatchObject({ typeId: CINEMA2_ECHOFORM_NATIVE_MODULE_TYPE_ID, version: 1 })
    expect(CINEMA2_ECHOFORM_PRESET_MANIFEST.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'scene.3d', requirement: 'required' }),
      expect.objectContaining({ id: 'render.depth', requirement: 'required' }),
    ]))
    expect(CINEMA2_ECHOFORM_PRESET_MANIFEST.metadata.description).toContain('layered figure')
    expect(CINEMA2_ECHOFORM_PRESET_MANIFEST.metadata.description).toContain('wire mesh')
  })

  it('exposes BPM sync plus a six-color original-palette surface and music-aware formation controls', () => {
    const parameters = CINEMA2_ECHOFORM_PRESET_MANIFEST.parameters ?? []
    expect(parameters.find(parameter => parameter.id === CINEMA2_ECHOFORM_BPM_SYNC_ID)).toMatchObject({
      label: 'BPM Sync',
      type: 'boolean',
      defaultValue: true,
      designParentGroup: 'master-controls',
    })
    expect(parameters.filter(parameter => parameter.type === 'color').map(parameter => parameter.label)).toEqual([
      'Background',
      'Shadow',
      'Metal',
      'Highlight',
      'Eye Cyan',
      'Topology Accent',
    ])
    expect(CINEMA2_ECHOFORM_PRESET_MANIFEST.choreography?.rules.map(rule => rule.source.signal)).toEqual(expect.arrayContaining([
      'continuous',
      'beat',
      'downbeat',
      'kick',
      'phrase',
      'section-change',
    ]))
  })

  it('builds the point and wire cloud from the SVG outlines with the eyes and a depth spread', () => {
    const geometry = buildCinema2EchoformGeometry(goonzMasterSvg)
    expect(geometry.pointCount).toBeGreaterThan(10_000)
    expect(geometry.lineVertexCount).toBeGreaterThan(10_000)
    expect(geometry.lineVertexCount % 2).toBe(0)
    expect(geometry.points.length).toBe(geometry.pointCount * ECHOFORM_VERTEX_FLOATS)
    const kinds = new Set<number>()
    let minZ = Infinity
    let maxZ = -Infinity
    let minX = Infinity
    let maxX = -Infinity
    for (let index = 0; index < geometry.pointCount; index += 1) {
      const base = index * ECHOFORM_VERTEX_FLOATS
      minX = Math.min(minX, geometry.points[base]!)
      maxX = Math.max(maxX, geometry.points[base]!)
      minZ = Math.min(minZ, geometry.points[base + 2]!)
      maxZ = Math.max(maxZ, geometry.points[base + 2]!)
      kinds.add(geometry.points[base + 6]!)
    }
    for (const kind of [ECHOFORM_KIND.contour, ECHOFORM_KIND.fill, ECHOFORM_KIND.eye, ECHOFORM_KIND.halo]) expect(kinds.has(kind)).toBe(true)
    expect(maxZ - minZ).toBeGreaterThan(0.3)
    expect(maxX - minX).toBeGreaterThan(1.4)
    // Deterministic: the same SVG always yields the same cloud.
    expect(buildCinema2EchoformGeometry(goonzMasterSvg).points.slice(0, 70)).toEqual(geometry.points.slice(0, 70))
  })

  it('carries Mainframe\u2019s orchestration surface: the six programs, Pattern Change with its Trigger, Idle Glow and the nine musical cues', () => {
    const parameters = CINEMA2_ECHOFORM_PRESET_MANIFEST.parameters ?? []
    expect(parameters.find(parameter => parameter.id === CINEMA2_ECHOFORM_PATTERN_ID)).toMatchObject({ type: 'enum', defaultValue: 'outward-bus', designParentGroup: 'effects' })
    expect(parameters.find(parameter => parameter.id === CINEMA2_ECHOFORM_PATTERN_CHANGE_ID)).toMatchObject({ type: 'boolean', defaultValue: false })
    expect(parameters.find(parameter => parameter.id === CINEMA2_ECHOFORM_TRIGGER_ID)).toMatchObject({
      defaultValue: 'bar4',
      visibleWhen: [{ kind: 'parameter-equals', parameterId: CINEMA2_ECHOFORM_PATTERN_CHANGE_ID, value: true }],
    })
    expect(parameters.find(parameter => parameter.id === CINEMA2_ECHOFORM_IDLE_GLOW_ID)).toMatchObject({ type: 'float', defaultValue: 0.45 })
    const cueRules = (CINEMA2_ECHOFORM_PRESET_MANIFEST.choreography?.rules ?? [])
      .filter(rule => rule.actions.length === 1 && rule.actions[0]!.id.endsWith('-cue'))
    expect(cueRules.map(rule => (rule.actions[0]!.value as { kind: string }).kind)).toEqual([
      'kick', 'snare', 'transient', 'beat', 'downbeat', 'fourBeat', 'phrase', 'section', 'drop',
    ])
  })

  it('gives every vertex Mainframe\u2019s route, bank, region, system and phase attributes', () => {
    const geometry = buildCinema2EchoformGeometry(goonzMasterSvg)
    const banks = new Set<number>()
    const regions = new Set<number>()
    const systems = new Set<number>()
    let phaseMin = Infinity
    let phaseMax = -Infinity
    for (let index = 0; index < geometry.pointCount; index += 1) {
      const base = index * ECHOFORM_VERTEX_FLOATS
      banks.add(geometry.points[base + 8]!)
      regions.add(geometry.points[base + 9]!)
      systems.add(geometry.points[base + 10]!)
      phaseMin = Math.min(phaseMin, geometry.points[base + 11]!)
      phaseMax = Math.max(phaseMax, geometry.points[base + 11]!)
    }
    expect([...banks].sort()).toEqual([0, 1, 2, 3])
    expect([...regions].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(systems.size).toBeGreaterThanOrEqual(4)
    expect(phaseMin).toBeGreaterThanOrEqual(0)
    expect(phaseMax).toBeLessThanOrEqual(1)
    expect(phaseMax - phaseMin).toBeGreaterThan(0.6)
  })
})
