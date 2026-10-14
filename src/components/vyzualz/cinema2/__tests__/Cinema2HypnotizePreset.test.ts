import { describe, expect, it } from 'vitest'
import { CINEMA2_HYPNOTIZE_STATIC_COUNTS } from '../modules/hypnotize/Cinema2HypnotizeGeometry'
import {
  CINEMA2_HYPNOTIZE_PATTERN_PROFILES,
  Cinema2HypnotizePatternEngine,
  resolveCinema2HypnotizeLedDrive,
} from '../modules/hypnotize/Cinema2HypnotizePatternEngine'
import { CINEMA2_HYPNOTIZE_NATIVE_MODULE_TYPE_ID, CINEMA2_HYPNOTIZE_PATTERNS } from '../modules/Cinema2HypnotizeNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import {
  CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID,
  CINEMA2_HYPNOTIZE_BPM_SYNC_ID,
  CINEMA2_HYPNOTIZE_COUNTER_ROTATION_ID,
  CINEMA2_HYPNOTIZE_FLASH_ACCENTS_ID,
  CINEMA2_HYPNOTIZE_INTENSITY_ID,
  CINEMA2_HYPNOTIZE_PATTERN_CHANGE_ID,
  CINEMA2_HYPNOTIZE_PATTERN_ID,
  CINEMA2_HYPNOTIZE_PRESET_ID,
  CINEMA2_HYPNOTIZE_PRESET_MANIFEST,
  CINEMA2_HYPNOTIZE_TRIGGER_ID,
  CINEMA2_HYPNOTIZE_TRAVEL_ID,
} from '../presets/Cinema2HypnotizePreset'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const CAPABILITIES = Object.freeze(['render.webgl2', 'render.depth', 'render.history', 'scene.3d', 'camera.world'] as const)

describe('Cinema 2.0 Hypnotize Phase D preset', () => {
  it('ships through the production registry as a native first-party keeper', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_HYPNOTIZE_PRESET_ID)).toMatchObject({ role: 'keeper' })
    expect(cinema2NativePresetRegistry.get(CINEMA2_HYPNOTIZE_PRESET_ID)).not.toBeNull()
    expect(cinema2NativeModuleRegistry.get(CINEMA2_HYPNOTIZE_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_HYPNOTIZE_PRESET_MANIFEST })).toEqual({ ok: true, diagnostics: [] })
    const compiled = compileCinema2NativePreset(CINEMA2_HYPNOTIZE_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
    expect(compiled.ok, compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
  })

  it('declares the approved controls and six independent palette roles', () => {
    const parameters = CINEMA2_HYPNOTIZE_PRESET_MANIFEST.parameters ?? []
    const byId = (id: string) => parameters.find(parameter => parameter.id === id)
    expect(byId(CINEMA2_HYPNOTIZE_INTENSITY_ID)).toMatchObject({ type: 'float', designParentGroup: 'master-controls' })
    expect(byId(CINEMA2_HYPNOTIZE_BPM_SYNC_ID)).toMatchObject({ type: 'boolean', designParentGroup: 'master-controls' })
    expect(byId(CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID)).toMatchObject({ type: 'boolean', designParentGroup: 'master-controls' })
    expect(byId(CINEMA2_HYPNOTIZE_PATTERN_ID)?.options?.map(option => option.value)).toEqual(CINEMA2_HYPNOTIZE_PATTERNS)
    expect(byId(CINEMA2_HYPNOTIZE_PATTERN_CHANGE_ID)).toMatchObject({ type: 'boolean', designParentGroup: 'design' })
    expect(byId(CINEMA2_HYPNOTIZE_TRIGGER_ID)).toMatchObject({ type: 'enum', designParentGroup: 'design' })
    expect(byId(CINEMA2_HYPNOTIZE_COUNTER_ROTATION_ID)).toMatchObject({ type: 'float', designParentGroup: 'design' })
    expect(byId(CINEMA2_HYPNOTIZE_TRAVEL_ID)).toMatchObject({ type: 'float', designParentGroup: 'design' })
    expect(byId(CINEMA2_HYPNOTIZE_FLASH_ACCENTS_ID)).toMatchObject({ type: 'enum', designParentGroup: 'master-controls' })
    expect(parameters.find(parameter => parameter.label === 'LED Intensity')).toMatchObject({ defaultValue: 2.1 })
    expect(parameters.find(parameter => parameter.label === 'LED Bloom')).toMatchObject({ defaultValue: 1.45 })
    expect(parameters.filter(parameter => parameter.designParentGroup === 'palette' && parameter.type === 'color').map(parameter => parameter.label)).toEqual([
      'Background', 'Structure', 'Cool Energy', 'Warm Energy', 'Core', 'Spectrum Edge',
    ])
  })

  it('contains the complete optical-engine architecture and shared Phase C choreography', () => {
    expect(CINEMA2_HYPNOTIZE_STATIC_COUNTS).toEqual({
      sectors: 12,
      pairedSectorAssemblies: 6,
      depthCollars: 8,
      turbineVanes: 18,
      conductorStrands: 2,
      membraneFilaments: 24,
      spectralGlints: 54,
      exteriorResonators: 16,
      addressableLedSegments: 480,
    })
    expect(CINEMA2_HYPNOTIZE_PRESET_MANIFEST.choreography?.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: expect.objectContaining({ path: 'audio.features.overallEnergy' }), actions: [expect.objectContaining({ target: expect.objectContaining({ property: 'overallEnergy' }) })] }),
      expect.objectContaining({ source: expect.objectContaining({ path: 'audio.bands.bass' }), actions: [expect.objectContaining({ target: expect.objectContaining({ property: 'bassPressure' }) })] }),
      expect.objectContaining({ source: expect.objectContaining({ signal: 'kick' }), actions: [expect.objectContaining({ target: expect.objectContaining({ property: 'kickAccent' }) })] }),
      expect.objectContaining({ source: expect.objectContaining({ path: 'director.build' }), actions: [expect.objectContaining({ target: expect.objectContaining({ property: 'buildAmount' }) })] }),
    ]))
    expect(CINEMA2_HYPNOTIZE_PRESET_MANIFEST.cameras?.[0]).toMatchObject({ rig: { kind: 'static' }, fovDegrees: 50 })
    expect(CINEMA2_HYPNOTIZE_PRESET_MANIFEST.lighting?.lights).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'spot', config: expect.objectContaining({ threeShadow: true }) }),
      expect.objectContaining({ type: 'point' }),
    ]))
    expect(CINEMA2_HYPNOTIZE_PRESET_MANIFEST.modules?.[0]).toMatchObject({
      typeId: CINEMA2_HYPNOTIZE_NATIVE_MODULE_TYPE_ID,
      parameters: expect.objectContaining({
        look: 'mesmericOrbit',
        nodeDensity: 1,
        depthSpread: 1.45,
        spectrumColor: expect.any(Array),
      }),
    })
  })

  it('defines six materially distinct authored motion profiles', () => {
    expect(Object.keys(CINEMA2_HYPNOTIZE_PATTERN_PROFILES)).toEqual(CINEMA2_HYPNOTIZE_PATTERNS)
    expect(new Set(Object.values(CINEMA2_HYPNOTIZE_PATTERN_PROFILES).map(profile => JSON.stringify(profile))).size).toBe(6)
  })

  it('gives every pattern a distinct addressable LED choreography signature', () => {
    const addresses = [
      { family: 'collar' as const, layer: 0, sector: 0, segment: 0 },
      { family: 'collar' as const, layer: 3, sector: 5, segment: 1 },
      { family: 'collar' as const, layer: 7, sector: 9, segment: 2 },
      { family: 'exterior' as const, layer: 8, sector: 13, segment: 7 },
    ]
    const signals = {
      overallEnergy: 0.58,
      bassPressure: 0.66,
      highsAmount: 0.47,
      fluxAmount: 0.31,
      kickAccent: 0.2,
      snareAccent: 0.14,
      downbeatAccent: 0.08,
      phraseAccent: 0.12,
      dropAccent: 0.05,
    }
    const signatures = CINEMA2_HYPNOTIZE_PATTERNS.map(pattern => addresses.map(address => Number(resolveCinema2HypnotizeLedDrive({
      pattern,
      previousPattern: pattern,
      transition: 1,
      beats: 5.35,
      profile: CINEMA2_HYPNOTIZE_PATTERN_PROFILES[pattern],
    }, address, signals).toFixed(4))).join(','))
    expect(new Set(signatures).size).toBe(6)
  })

  it('crossfades manual changes and advances deterministic Pattern Change events', () => {
    const engine = new Cinema2HypnotizePatternEngine()
    const base = {
      authoredPattern: 'mesmericOrbit' as const,
      patternChange: false,
      autoPerformance: false,
      trigger: 'beat',
      triggerEventId: null,
      triggerPulse: 0,
      deltaTimeSec: 0.1,
      animationActive: true,
      bpmSync: true,
      bpm: 120,
      discontinuityGeneration: 0,
      overallEnergy: 0.4,
      vocalPresence: 0,
      directorIntensity: 0.4,
      directorMomentum: 0.4,
      buildAmount: 0,
      dropAccent: 0,
    }
    expect(engine.update(base).pattern).toBe('mesmericOrbit')
    expect(engine.update({ ...base, authoredPattern: 'turbineBloom' }).pattern).toBe('turbineBloom')
    expect(engine.update({ ...base, authoredPattern: 'turbineBloom', patternChange: true, triggerEventId: 'beat-8' }).pattern).toBe('chromaticRelay')
  })
})
