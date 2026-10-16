import { describe, expect, it, vi } from 'vitest'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { CINEMA2_STARTERS_PARAMETER_IDS, CINEMA2_STARTERS_PRESET_ID, CINEMA2_STARTERS_PRESET_MANIFEST } from '../presets/Cinema2StartersPreset'
import { CINEMA2_STARTERS_NATIVE_MODULE_TYPE_ID, createCinema2StartersNativeModuleDefinition } from '../modules/Cinema2StartersNativeModule'
import type { Cinema2ModuleCreateContext } from '../modules/Cinema2ModuleContracts'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'

const CAPABILITIES = new Set(['render.webgl2', 'audio.features', 'audio.bands', 'music.rhythm-events', 'music.drop', 'visual-director.significance'] as const)

describe('Cinema 2.0 Starters preset', () => {
  it('registers as a compilable first-party keeper with the required inspector contract', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_STARTERS_PRESET_ID)).toMatchObject({ role: 'keeper' })
    expect(cinema2NativeModuleRegistry.get(CINEMA2_STARTERS_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_STARTERS_PRESET_MANIFEST })).toEqual({ ok: true, diagnostics: [] })
    const compiled = compileCinema2NativePreset(CINEMA2_STARTERS_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
    expect(compiled.ok, compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)

    const parameters = CINEMA2_STARTERS_PRESET_MANIFEST.parameters ?? []
    expect(parameters.find(parameter => parameter.id === CINEMA2_STARTERS_PARAMETER_IDS.bpmSync)).toMatchObject({ label: 'BPM Sync', designParentGroup: 'master-controls' })
    expect(parameters.filter(parameter => parameter.type === 'color' && parameter.designParentGroup === 'palette')).toHaveLength(6)
    expect(new Set(parameters.map(parameter => parameter.designParentGroup))).toEqual(new Set(['master-controls', 'design', 'effects', 'palette']))
  })

  it('passes authored extremes and shared choreography values to the procedural renderer', () => {
    const moduleManifest = CINEMA2_STARTERS_PRESET_MANIFEST.modules![0]!
    const values = new Map<string, Cinema2JsonValue>(Object.entries(moduleManifest.parameters ?? {}))
    values.set('caseOpen', 0)
    values.set('ballSpread', 1.6)
    values.set('ballScale', 0.6)
    values.set('ambientMotion', 0)
    values.set('overallEnergy', 0.8)
    values.set('kickAccent', 1)
    values.set('dropAccent', 0.75)
    const parameters = { get: (name: string) => values.get(name), getAuthored: (name: string) => values.get(name), resolve: () => null }
    const draw = vi.fn()
    const renderer = { draw, dispose: vi.fn(), estimateGpuBytes: () => 65536 }
    const definition = createCinema2StartersNativeModuleDefinition({ createRenderer: () => renderer })
    const resources = {
      acquire: (_key: string, _kind: string, create: (gl: WebGL2RenderingContext) => typeof renderer) => create({} as WebGL2RenderingContext),
      reportGpuBytes: vi.fn(),
      getSnapshot: () => ({ activeLeaseCount: 1, disposedLeaseCount: 0, estimatedGpuBytes: 65536 }),
    }
    const instance = definition.create({ module: moduleManifest, parameters, targets: {}, media: {}, resources, randomness: {} } as unknown as Cinema2ModuleCreateContext)
    instance.lifecycle.update({ parameters, frame: { elapsedTimeSec: 2, deltaTimeSec: 1 / 60, contextGeneration: 1, transport: { sourcePresent: true, animationActive: true, paused: false, timeSec: 2, bpm: 120, trackId: 'track' } } } as never)
    instance.render!.providers[0]!.execute({ target: null, width: 1280, height: 720, frame: { elapsedTimeSec: 2 } } as never)

    expect(draw).toHaveBeenCalledOnce()
    expect(draw.mock.calls[0]![0]).toMatchObject({ width: 1280, height: 720, caseOpen: 0, ballSpread: 1.6, ballScale: 0.6, ambientMotion: 0, energy: 0.8, kick: 1, drop: 0.75 })
    expect(resources.reportGpuBytes).toHaveBeenCalledWith(65536)
  })
})
