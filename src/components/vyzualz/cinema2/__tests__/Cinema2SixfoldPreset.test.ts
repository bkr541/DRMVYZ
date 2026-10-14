import { describe, expect, it } from 'vitest'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import {
  CINEMA2_SIXFOLD_AUTO_PERFORMANCE_ID,
  CINEMA2_SIXFOLD_BPM_SYNC_ID,
  CINEMA2_SIXFOLD_MASTER_INTENSITY_ID,
  CINEMA2_SIXFOLD_PATTERN_CHANGE_ID,
  CINEMA2_SIXFOLD_PATTERN_ID,
  CINEMA2_SIXFOLD_PRESET_ID,
  CINEMA2_SIXFOLD_PRESET_MANIFEST,
  CINEMA2_SIXFOLD_TRIGGER_ID,
} from '../presets/Cinema2SixfoldPreset'
import {
  CINEMA2_SIXFOLD_NATIVE_MODULE_TYPE_ID,
  CINEMA2_SIXFOLD_PATTERNS,
  Cinema2SixfoldPatternController,
  resolveCinema2SixfoldComponentResponses,
} from '../modules/Cinema2SixfoldNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import type { Cinema2ModuleCreateContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2SixfoldChoreography } from '../modules/sixfold/Cinema2SixfoldChoreography'

const CAPABILITIES = Object.freeze(['render.webgl2', 'render.depth', 'render.history', 'scene.3d', 'camera.world'] as const)

describe('Cinema 2.0 Sixfold preset', () => {
  it('ships as a native first-party keeper and compiles through the production registry', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_SIXFOLD_PRESET_ID)).toMatchObject({ role: 'keeper' })
    expect(cinema2NativePresetRegistry.get(CINEMA2_SIXFOLD_PRESET_ID)).not.toBeNull()
    expect(cinema2NativeModuleRegistry.get(CINEMA2_SIXFOLD_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_SIXFOLD_PRESET_MANIFEST })).toEqual({ ok: true, diagnostics: [] })
    const compiled = compileCinema2NativePreset(CINEMA2_SIXFOLD_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
    expect(compiled.ok, compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
  })

  it('provides the requested master, design, effects and palette surfaces', () => {
    const parameters = CINEMA2_SIXFOLD_PRESET_MANIFEST.parameters ?? []
    const byId = (id: string) => parameters.find(parameter => parameter.id === id)
    expect(byId(CINEMA2_SIXFOLD_MASTER_INTENSITY_ID)).toMatchObject({ type: 'float', designParentGroup: 'master-controls' })
    expect(byId(CINEMA2_SIXFOLD_BPM_SYNC_ID)).toMatchObject({ type: 'boolean', designParentGroup: 'master-controls' })
    expect(byId(CINEMA2_SIXFOLD_AUTO_PERFORMANCE_ID)).toMatchObject({ type: 'boolean', designParentGroup: 'master-controls' })
    expect(parameters.filter(parameter => parameter.designParentGroup === 'design' && parameter.type === 'float').length).toBeGreaterThanOrEqual(2)
    expect(parameters.filter(parameter => parameter.designParentGroup === 'palette' && parameter.type === 'color')).toHaveLength(5)
    expect(byId(CINEMA2_SIXFOLD_PATTERN_ID)?.options?.map(option => option.value)).toEqual(CINEMA2_SIXFOLD_PATTERNS)
    expect(byId(CINEMA2_SIXFOLD_PATTERN_ID)?.options?.map(option => option.label)).toEqual([
      'Phase Cascade', 'Harmonic Expansion', 'Recursive Descent', 'Mirror Fold', 'Singularity', 'Lockstep',
    ])
    expect(byId(CINEMA2_SIXFOLD_PATTERN_ID)?.metadata).toMatchObject({
      userEditSetParameters: { [CINEMA2_SIXFOLD_AUTO_PERFORMANCE_ID]: false },
    })
    expect(byId(CINEMA2_SIXFOLD_PATTERN_CHANGE_ID)).toMatchObject({ type: 'boolean', defaultValue: false })
    expect(byId(CINEMA2_SIXFOLD_TRIGGER_ID)).toMatchObject({ type: 'enum', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ parameterId: CINEMA2_SIXFOLD_PATTERN_CHANGE_ID, value: true }] })
    expect(CINEMA2_SIXFOLD_PRESET_MANIFEST.choreography?.rules.every(rule => rule.enabledParameter == null)).toBe(true)
  })

  it('routes different musical intelligence into six independent component lanes', () => {
    const values = new Map<string, unknown>([
      ['overallEnergy', 0.35], ['bassPressure', 0.8], ['kickAccent', 1], ['snareAccent', 0.55],
      ['highsAmount', 0.2], ['downbeatAccent', 0.1], ['phraseAccent', 0.72], ['buildAmount', 0.4], ['dropAccent', 0],
    ])
    const parameters = { get: (name: string) => values.get(name) } as Cinema2ModuleCreateContext['parameters']
    const lanes = resolveCinema2SixfoldComponentResponses(parameters)
    expect(lanes).toHaveLength(6)
    expect(new Set(lanes.map(value => value.toFixed(3))).size).toBeGreaterThanOrEqual(5)
    expect(lanes[0]).toBeGreaterThan(lanes[3])
    expect(lanes[2]).toBeGreaterThan(lanes[1])
    expect(lanes[4]).toBeGreaterThan(lanes[5])
  })

  it('assigns kick, snare, phrase, mids, highs and downbeats to different semantic systems', () => {
    const responses = (values: Record<string, number>) => resolveCinema2SixfoldComponentResponses({
      get: (name: string) => values[name] ?? 0,
    } as Cinema2ModuleCreateContext['parameters'])
    expect(responses({ kickAccent: 1 }).indexOf(Math.max(...responses({ kickAccent: 1 })))).toBe(0)
    expect(responses({ snareAccent: 1 }).indexOf(Math.max(...responses({ snareAccent: 1 })))).toBe(1)
    expect(responses({ phraseAccent: 1 }).indexOf(Math.max(...responses({ phraseAccent: 1 })))).toBe(2)
    expect(responses({ midAmount: 1 }).indexOf(Math.max(...responses({ midAmount: 1 })))).toBe(3)
    expect(responses({ highsAmount: 1 }).indexOf(Math.max(...responses({ highsAmount: 1 })))).toBe(4)
    expect(responses({ downbeatAccent: 1 }).indexOf(Math.max(...responses({ downbeatAccent: 1 })))).toBe(5)
  })

  it('resolves six visibly distinct deterministic system programs with vocal restraint', () => {
    const choreography = new Cinema2SixfoldChoreography()
    const responses = [0.8, 0.72, 0.64, 0.56, 0.76, 0.68] as const
    const signatures = Array.from({ length: 6 }, (_, pattern) => {
      const pose = choreography.resolve({ pattern, phaseBeats: 3.37, responses, build: 0.7, drop: 0.45, vocalPresence: 0 })
      expect(pose.ledLight).toHaveLength(18)
      return [pose.irisBladeOffset, pose.outerMechanismRotation, pose.illumination, ...pose.facetFold, ...pose.frameDepth, ...pose.ledLight, ...pose.lockFold]
        .map(value => value.toFixed(4)).join('|')
    })
    expect(new Set(signatures)).toHaveLength(6)

    const open = choreography.resolve({ pattern: 0, phaseBeats: 3.37, responses, build: 0, drop: 0, vocalPresence: 0 })
    const openTravel = Math.abs(open.facetFold[0]!) + Math.abs(open.lockFold[0]!)
    const restrained = choreography.resolve({ pattern: 0, phaseBeats: 3.37, responses, build: 0, drop: 0, vocalPresence: 1 })
    const restrainedTravel = Math.abs(restrained.facetFold[0]!) + Math.abs(restrained.lockFold[0]!)
    expect(restrainedTravel).toBeLessThan(openTravel)
  })

  it('advances the six-program cycle once per unique selected trigger', () => {
    const controller = new Cinema2SixfoldPatternController(CINEMA2_SIXFOLD_PATTERNS)
    const base = { authored: 'facetRelay' as const, enabled: true, trigger: 'bar4' as const, reset: false }
    expect(controller.update({ ...base, eventId: 'bar:1' })).toBe('facetRelay')
    expect(controller.update({ ...base, eventId: 'bar:2' })).toBe('hexBloom')
    expect(controller.update({ ...base, eventId: 'bar:2' })).toBe('hexBloom')
    expect(controller.update({ ...base, eventId: 'bar:3' })).toBe('spiralDescent')
  })

  it('retains camera motion, depth, history and the full shared musical cue vocabulary', () => {
    expect(CINEMA2_SIXFOLD_PRESET_MANIFEST.cameras?.[0]).toMatchObject({ rig: { kind: 'static' }, fovDegrees: 43, motion: { tempo: expect.any(Object), drift: expect.any(Object) } })
    expect(CINEMA2_SIXFOLD_PRESET_MANIFEST.lighting?.lights).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'spot', config: expect.objectContaining({ threeShadow: true }) }),
    ]))
    expect(CINEMA2_SIXFOLD_PRESET_MANIFEST.choreography?.rules.some(rule => rule.source.path === 'audio.bands.mid')).toBe(true)
    expect(CINEMA2_SIXFOLD_PRESET_MANIFEST.choreography?.rules.some(rule => rule.source.path === 'audio.features.vocalPresence')).toBe(true)
    const capabilities = new Set(CINEMA2_SIXFOLD_PRESET_MANIFEST.capabilities?.map(capability => capability.id))
    for (const capability of ['audio.features', 'music.beat', 'music.rhythm-events', 'music.downbeat', 'music.bar', 'music.phrase', 'music.drop', 'visual-director.significance']) expect(capabilities.has(capability as never)).toBe(true)
    expect(CINEMA2_SIXFOLD_PRESET_MANIFEST.render?.targets?.some(target => target.descriptor.depthFormat === 'depth24')).toBe(true)
    expect(CINEMA2_SIXFOLD_PRESET_MANIFEST.capabilities?.some(capability => capability.id === 'render.history')).toBe(true)
    expect(CINEMA2_SIXFOLD_PRESET_MANIFEST.modules?.[0]).toMatchObject({ typeId: CINEMA2_SIXFOLD_NATIVE_MODULE_TYPE_ID })
  })
})
