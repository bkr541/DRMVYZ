import { describe, expect, it } from 'vitest'
import { CINEMA2_HYPNOTIZE_STATIC_COUNTS } from '../modules/hypnotize/Cinema2HypnotizeGeometry'
import {
  CINEMA2_HYPNOTIZE_ALTERNATING_LED_PATTERNS,
  CINEMA2_HYPNOTIZE_MAJOR_IMPACT_THRESHOLD,
  CINEMA2_HYPNOTIZE_PATTERN_PROFILES,
  Cinema2HypnotizePatternEngine,
  resolveCinema2HypnotizeLedDrive,
  resolveCinema2HypnotizeLedPowerGatingEnabled,
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
  CINEMA2_HYPNOTIZE_IMPACT_ONLY_LED_GATING_ID,
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
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'

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
    expect(byId(CINEMA2_HYPNOTIZE_IMPACT_ONLY_LED_GATING_ID)).toMatchObject({
      type: 'boolean',
      defaultValue: false,
      designParentGroup: 'effects',
      label: 'Drop / Impact LED Gating',
    })
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
    const signatures = CINEMA2_HYPNOTIZE_PATTERNS.map(pattern => [5.35, 5.6, 5.85].flatMap(beats => addresses.map(address => Number(resolveCinema2HypnotizeLedDrive({
      pattern,
      previousPattern: pattern,
      transition: 1,
      beats,
      profile: CINEMA2_HYPNOTIZE_PATTERN_PROFILES[pattern],
    }, address, signals).toFixed(4)))).join(','))
    expect(new Set(signatures).size).toBe(6)
  })

  it('uses sporadic, non-paired ON/OFF choreography across collar and exterior LEDs in three patterns', () => {
    const signals = {
      overallEnergy: 0.64,
      bassPressure: 0.71,
      highsAmount: 0.48,
      fluxAmount: 0.36,
      kickAccent: 0.22,
      snareAccent: 0.16,
      downbeatAccent: 0.1,
      phraseAccent: 0.08,
      dropAccent: 0.05,
    }
    const addresses = [
      ...Array.from({ length: 8 }, (_, layer) => Array.from({ length: 12 }, (_, sector) => {
        const segmentCount = layer % 2 === 0 || layer === 1 || layer === 3 ? 3 : layer === 5 ? 2 : 4
        return Array.from({ length: segmentCount }, (_, segment) => ({ family: 'collar' as const, layer, sector, segment }))
      }).flat()).flat(),
      ...Array.from({ length: 16 }, (_, sector) => Array.from({ length: 12 }, (_, segment) => ({ family: 'exterior' as const, layer: 8, sector, segment }))).flat(),
    ]
    expect(addresses).toHaveLength(CINEMA2_HYPNOTIZE_STATIC_COUNTS.addressableLedSegments)

    for (const pattern of CINEMA2_HYPNOTIZE_ALTERNATING_LED_PATTERNS) {
      const profile = CINEMA2_HYPNOTIZE_PATTERN_PROFILES[pattern]
      const signatures: string[] = []
      const activeCounts: number[] = []
      for (let step = 0; step < 8; step += 1) {
        const drives = addresses.map(address => resolveCinema2HypnotizeLedDrive({
          pattern,
          previousPattern: pattern,
          transition: 1,
          beats: 4 + step * 0.25,
          profile,
        }, address, signals))
        expect(drives.some(value => value === 0)).toBe(true)
        expect(drives.some(value => value >= 0.72)).toBe(true)
        signatures.push(drives.map(value => value === 0 ? '0' : '1').join(''))
        activeCounts.push(drives.filter(value => value > 0).length)
      }
      expect(new Set(signatures).size).toBe(8)
      expect(new Set(activeCounts).size).toBeGreaterThanOrEqual(5)

      const exterior = signatures[0]!.slice(-192)
      expect(exterior).toMatch(/010|101/)
      expect(exterior).not.toMatch(/^(00|11)+$/)
    }
  })

  it('restricts LED power masks to DROP sections and Major Impacts when the toggle is enabled', () => {
    expect(resolveCinema2HypnotizeLedPowerGatingEnabled(false, 'verse', 0)).toBe(true)
    expect(resolveCinema2HypnotizeLedPowerGatingEnabled(true, 'verse', CINEMA2_HYPNOTIZE_MAJOR_IMPACT_THRESHOLD - 0.01)).toBe(false)
    expect(resolveCinema2HypnotizeLedPowerGatingEnabled(true, 'DROP', 0)).toBe(true)
    expect(resolveCinema2HypnotizeLedPowerGatingEnabled(true, 'verse', CINEMA2_HYPNOTIZE_MAJOR_IMPACT_THRESHOLD)).toBe(true)

    const pattern = 'blackIris' as const
    const profile = CINEMA2_HYPNOTIZE_PATTERN_PROFILES[pattern]
    const signals = {
      overallEnergy: 0.62,
      bassPressure: 0.7,
      highsAmount: 0.5,
      fluxAmount: 0.35,
      kickAccent: 0.2,
      snareAccent: 0.15,
      downbeatAccent: 0.1,
      phraseAccent: 0.08,
      dropAccent: 0,
    }
    const frame = { pattern, previousPattern: pattern, transition: 1, beats: 4, profile }
    const addresses = Array.from({ length: 12 }, (_, segment) => ({ family: 'exterior' as const, layer: 8, sector: 3, segment }))
    const activeMask = addresses.map(address => resolveCinema2HypnotizeLedDrive(frame, address, signals, true))
    const restingMask = addresses.map(address => resolveCinema2HypnotizeLedDrive(frame, address, signals, false))
    expect(activeMask.some(value => value === 0)).toBe(true)
    expect(restingMask.every(value => value >= 0.72)).toBe(true)
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

  it('uses the shared BPM clock, freezes while paused, and resets deterministically after a seek', () => {
    const input = {
      authoredPattern: 'mesmericOrbit' as const,
      patternChange: false,
      autoPerformance: false,
      trigger: 'beat',
      triggerEventId: null,
      triggerPulse: 0,
      deltaTimeSec: 0.25,
      animationActive: true,
      bpmSync: true,
      bpm: 90,
      discontinuityGeneration: 0,
      overallEnergy: 0.5,
      vocalPresence: 0,
      directorIntensity: 0.5,
      directorMomentum: 0.5,
      buildAmount: 0,
      dropAccent: 0,
    }
    const synced = new Cinema2HypnotizePatternEngine()
    const free = new Cinema2HypnotizePatternEngine()
    synced.update(input)
    free.update({ ...input, bpmSync: false })
    let syncedFrame = synced.update(input)
    let freeFrame = free.update({ ...input, bpmSync: false })
    for (let index = 0; index < 3; index += 1) {
      syncedFrame = synced.update(input)
      freeFrame = free.update({ ...input, bpmSync: false })
    }
    expect(syncedFrame.beats).toBeCloseTo(1.5)
    expect(freeFrame.beats).toBeCloseTo(2)

    const paused = synced.update({ ...input, deltaTimeSec: 1, animationActive: false })
    expect(paused.beats).toBe(syncedFrame.beats)
    expect(synced.update({ ...input, discontinuityGeneration: 1 }).beats).toBe(0)
  })

  it('round-trips saved controls and gives manual Pattern edits authority over Auto Performance', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_HYPNOTIZE_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
    const current = new Cinema2ParameterState(compiled.plan.parameters)
    expect(current.setPersistentValue(CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID, true)).toMatchObject({ ok: true })
    expect(current.setPersistentValue(CINEMA2_HYPNOTIZE_PATTERN_ID, 'blackIris')).toMatchObject({ ok: true })
    expect(current.getValue(CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID)).toBe(false)
    expect(current.setPersistentValue(CINEMA2_HYPNOTIZE_IMPACT_ONLY_LED_GATING_ID, true)).toMatchObject({ ok: true })

    const restored = new Cinema2ParameterState(compiled.plan.parameters)
    expect(restored.restore(current.serialize())).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_HYPNOTIZE_PATTERN_ID)).toBe('blackIris')
    expect(restored.getValue(CINEMA2_HYPNOTIZE_IMPACT_ONLY_LED_GATING_ID)).toBe(true)
    expect(restored.getValue(CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID)).toBe(false)
  })
})
