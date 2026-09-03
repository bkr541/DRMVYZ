import { describe, expect, it } from 'vitest'
import {
  CINEMA_CINEMATIC_PRESET_CATALOG_EXCLUSIONS,
  CINEMA_LEGACY_PRESET_CATALOG,
  compileCinemaCompositionGraph,
  createCinemaCameraParameterSchemaMap,
  createCinemaDefinitionRegistryFromPersisted,
  createCinemaFoundationPersistedState,
  validateCinemaCompositionGraph,
  validateCinemaParameterSchemas,
} from '..'
import {
  CINEMATIC_AUDIO_EVENT_SOURCES,
  CINEMATIC_AUDIO_SOURCES,
  createDefaultCinematicAudioRoutes,
  type CinematicAudioRoute,
  type CinematicAudioSource,
  type CinematicAudioTarget,
} from '../../react/CinematicWorldConfig'
import { DEFAULT_REACT_PRESETS } from '../../react/ReactTypes'
import { shaderRegistry } from '../../react/shaders/registry'
import { PRODUCTION_SCENES } from '../../react/shaders/scenes'
import { cinematicWorldDefinitions } from '../../react/renderers/cinematic/worlds'
import {
  CinematicModulationEngine,
  canonicalCinematicAudioTarget,
  validateCinematicMappings,
  type CinematicNormalizedAudioFrame,
} from '../../react/renderers/cinematic/CinematicAudioModulation'

type ReactivityClass = 'transient' | 'groove' | 'section' | 'minimal'

interface PresetAuditSpec {
  class: ReactivityClass
  requiredSources: readonly CinematicAudioSource[]
  minimumRouteAmount?: number
  strategy?: 'preset-authored' | 'world-default'
}

const CINEMATIC_AUDIT: Readonly<Record<string, PresetAuditSpec>> = {
  'preset-singularity-crown': { class: 'transient', requiredSources: ['kick', 'dropEntry'] },
  'preset-neon-transit': { class: 'transient', requiredSources: ['kick', 'snare'] },
  'preset-glass-wound': { class: 'transient', requiredSources: ['transientIntensity', 'dropEntry'] },
  'preset-sixfold-chamber': { class: 'transient', requiredSources: ['beat', 'high'] },
  'preset-oracle-lock': { class: 'groove', requiredSources: ['barStart', 'high'] },
  'preset-tempest-eye': { class: 'transient', requiredSources: ['snare', 'bass'] },
  'preset-minimal-skeleton': { class: 'minimal', requiredSources: ['beat', 'barStart', 'dropEntry'] },
}

const SHADER_AUDIT: Readonly<Record<string, ReactivityClass>> = {
  'shader-neon-tunnel': 'transient',
  'shader-liquid-metaballs': 'transient',
  'shader-brand-echo-signal': 'transient',
  'shader-reactor': 'transient',
  'shader-bass-cathedral': 'transient',
  'shader-laser-lattice-overdrive': 'transient',
  'shader-wobble-glyph-forge': 'transient',
  'shader-melodic-rift-bloom': 'transient',
}

const SALIENT_TARGETS = new Set<CinematicAudioTarget>([
  'portalAperture', 'cameraPunch', 'distortion', 'bloom', 'environmentBrightness', 'impact', 'lightning',
  'networkSpread', 'nodeScale', 'edgeBrightness', 'topologyMorph', 'collapseForce',
  'burstImpulse', 'facetOpacity', 'portalPulse', 'glow',
])

const FULL_CAPABILITIES: CinematicNormalizedAudioFrame['capabilities'] = {
  musicIntelligence: true,
  broadBands: true,
  detailedBands: true,
  transientEvents: true,
  kickEvents: true,
  snareEvents: true,
  beatTiming: true,
  downbeatTiming: true,
  barTiming: true,
  phraseTiming: true,
  sectionTiming: true,
  buildProgress: true,
  dropState: true,
  trackEnergyCurve: true,
  vocalEnergy: true,
}

const cinematicPresets = DEFAULT_REACT_PRESETS.filter(preset => (
  preset.engine === 'cinematicPortal'
  && !(preset.id in CINEMA_CINEMATIC_PRESET_CATALOG_EXCLUSIONS)
))
const worldTargets = new Map(cinematicWorldDefinitions.map(definition => [definition.id, definition.capabilities.modulationTargets]))

describe('Cinema Stage 4 built-in schema and reactivity audit', () => {
  it('validates every built-in definition, composition, master, node, effect, and camera schema with zero errors', () => {
    const state = createCinemaFoundationPersistedState()
    const registryResult = createCinemaDefinitionRegistryFromPersisted(state.definitions)
    const errors: string[] = registryResult.diagnostics
      .filter(diagnostic => diagnostic.severity === 'error' || diagnostic.severity === 'fatal')
      .map(diagnostic => `${diagnostic.code}:${diagnostic.message}`)

    for (const entry of registryResult.registry.list()) {
      errors.push(...validateCinemaParameterSchemas(entry.definition.parameters, { owner: 'node' })
        .filter(diagnostic => diagnostic.severity === 'error' || diagnostic.severity === 'fatal')
        .map(diagnostic => `${entry.definition.typeId}:${diagnostic.message}`))
    }

    for (const composition of state.compositions) {
      errors.push(...validateCinemaParameterSchemas(composition.masterParameters, { owner: 'master' })
        .filter(diagnostic => diagnostic.severity === 'error' || diagnostic.severity === 'fatal')
        .map(diagnostic => `${composition.id}:master:${diagnostic.message}`))
      const cameraSchemas = createCinemaCameraParameterSchemaMap(composition)
      for (const camera of composition.cameras) {
        errors.push(...validateCinemaParameterSchemas(cameraSchemas[camera.id] ?? [], { owner: 'camera' })
          .filter(diagnostic => diagnostic.severity === 'error' || diagnostic.severity === 'fatal')
          .map(diagnostic => `${composition.id}:${camera.id}:${diagnostic.message}`))
      }
      const validation = validateCinemaCompositionGraph(composition, registryResult.registry)
      const compilation = compileCinemaCompositionGraph(composition, registryResult.registry)
      if (!validation.valid) errors.push(...validation.diagnostics.diagnostics.map(diagnostic => `${composition.id}:graph:${diagnostic.message}`))
      if (!compilation.ok) errors.push(...compilation.diagnostics.diagnostics.map(diagnostic => `${composition.id}:compile:${diagnostic.message}`))
    }

    expect(errors, errors.join('\n')).toEqual([])
  })

  it('classifies the complete immutable Cinema legacy catalog without changing stable source identities', () => {
    const cinematicIds = cinematicPresets.map(preset => preset.id).sort()
    const shaderIds = PRODUCTION_SCENES.map(scene => scene.id).sort()
    expect(Object.keys(CINEMATIC_AUDIT).sort()).toEqual(cinematicIds)
    expect(Object.keys(SHADER_AUDIT).sort()).toEqual(shaderIds)
    expect(CINEMA_LEGACY_PRESET_CATALOG.manifest.map(entry => entry.legacySourceId).sort())
      .toEqual([...cinematicIds, ...shaderIds].sort())
  })

  it('keeps every Cinematic preset route production-reachable and aligned with its authored response class', () => {
    const issues: string[] = []
    for (const preset of cinematicPresets) {
      const config = preset.cinematicConfig
      const audit = CINEMATIC_AUDIT[preset.id]
      if (!config || !audit) {
        issues.push(`${preset.id}:missing-config-or-audit`)
        continue
      }
      const targets = worldTargets.get(config.worldMode)
      if (!targets) {
        issues.push(`${preset.id}:missing-world-targets`)
        continue
      }
      issues.push(...validateCinematicMappings(config.audioMapping.routes, targets)
        .map(issue => `${preset.id}:${issue.routeId}:${issue.code}`))

      for (const source of audit.requiredSources) {
        const route = config.audioMapping.routes.find(candidate => candidate.enabled && candidate.source === source)
        if (!route) {
          issues.push(`${preset.id}:missing-source:${source}`)
          continue
        }
        if (Math.abs(route.amount) < (audit.minimumRouteAmount ?? 0.15)) {
          issues.push(`${preset.id}:weak-source:${source}:${route.amount}`)
        }
      }

      if (audit.class === 'transient') {
        const immediateSalientRoute = config.audioMapping.routes.find(route => (
          route.enabled
          && (CINEMATIC_AUDIO_EVENT_SOURCES as readonly string[]).includes(route.source)
          && route.attackMs === 0
          && SALIENT_TARGETS.has(route.target)
        ))
        if (!immediateSalientRoute) issues.push(`${preset.id}:missing-immediate-salient-route`)
      }
    }
    expect(issues, issues.join('\n')).toEqual([])
  })

  it('keeps Shader canonical programs reachable, differentiated, and materially authored', () => {
    const validation = shaderRegistry.validateAll()
    const fingerprints = new Set<string>()
    for (const scene of PRODUCTION_SCENES) {
      const program = scene.performanceProgram
      expect(SHADER_AUDIT[scene.id]).toBe('transient')
      expect(validation[scene.id].valid, scene.id).toBe(true)
      expect(program?.authoredRoutes.length, scene.id).toBeGreaterThanOrEqual(6)
      expect(program?.authoredRoutes.some(route => route.source === 'kick' && Math.abs(route.amount) >= 0.05), scene.id).toBe(true)
      expect(program?.authoredRoutes.some(route => route.source === 'snare' && Math.abs(route.amount) >= 0.05), scene.id).toBe(true)
      expect(program?.authoredRoutes.some(route => route.source === 'dropImpact' && Math.abs(route.amount) >= 0.1), scene.id).toBe(true)
      fingerprints.add(program!.authoredRoutes.map(route => `${route.source}:${route.targetParamId}`).join('|'))
    }
    expect(fingerprints.size).toBe(PRODUCTION_SCENES.length)
  })

  it('produces same-frame distinct kick/snare gestures and a stronger drop hierarchy for aggressive presets', () => {
    for (const presetId of ['preset-monolith-breaker', 'preset-trapwire']) {
      const preset = cinematicPreset(presetId)
      const kick = response(preset.cinematicConfig!.audioMapping.routes, supportedTargets(preset), ['kick'])
      const snare = response(preset.cinematicConfig!.audioMapping.routes, supportedTargets(preset), ['snare'])
      const drop = response(preset.cinematicConfig!.audioMapping.routes, supportedTargets(preset), ['kick', 'dropEntry'])
      const kickTargets = activeTargets(kick)
      const snareTargets = activeTargets(snare)
      expect(kickTargets.length, `${presetId}:kick`).toBeGreaterThan(0)
      expect(snareTargets.length, `${presetId}:snare`).toBeGreaterThan(0)
      expect(kickTargets, `${presetId}:distinct`).not.toEqual(snareTargets)
      expect(magnitude(drop), `${presetId}:drop`).toBeGreaterThan(magnitude(kick))
    }

    const gearSun = cinematicPreset('preset-gear-sun')
    const gearKick = response(gearSun.cinematicConfig!.audioMapping.routes, supportedTargets(gearSun), ['kick', 'beat'])
    const gearDrop = response(gearSun.cinematicConfig!.audioMapping.routes, supportedTargets(gearSun), ['kick', 'beat', 'dropEntry'])
    expect(gearKick.impact).toBeGreaterThanOrEqual(0.95)
    expect(gearKick.environmentBrightness).toBeGreaterThanOrEqual(0.7)
    expect(gearDrop.cameraPunch).toBeGreaterThanOrEqual(0.95)
    expect(magnitude(gearDrop)).toBeGreaterThan(magnitude(gearKick))
  })

  it('separates repeated aggressive gestures at 120, 140, 150, and 174 BPM', () => {
    const cases = [
      { presetId: 'preset-gear-sun', source: 'kick' as const },
      { presetId: 'preset-monolith-breaker', source: 'kick' as const },
      { presetId: 'preset-trapwire', source: 'snare' as const },
    ]
    for (const { presetId, source } of cases) {
      const preset = cinematicPreset(presetId)
      const routes = preset.cinematicConfig!.audioMapping.routes
      const targets = supportedTargets(preset)
      const route = routes.find(candidate => candidate.source === source)!
      for (const bpm of [120, 140, 150, 174]) {
        const engine = new CinematicModulationEngine()
        engine.update(audioFrame(), routes, targets, 1 / 60, preset.cinematicConfig!.audioMapping.smoothingMs, 7)
        const peak = Math.abs(engine.update(audioFrame([source]), routes, targets, 1 / 60, preset.cinematicConfig!.audioMapping.smoothingMs, 7).values[canonicalCinematicAudioTarget(route.target)])
        const intervalSec = 60 / bpm
        const recovered = Math.abs(engine.update(audioFrame(), routes, targets, intervalSec, preset.cinematicConfig!.audioMapping.smoothingMs, 7).values[canonicalCinematicAudioTarget(route.target)])
        const retriggered = Math.abs(engine.update(audioFrame([source]), routes, targets, 1 / 60, preset.cinematicConfig!.audioMapping.smoothingMs, 7).values[canonicalCinematicAudioTarget(route.target)])
        expect(peak, `${presetId}:${bpm}:peak`).toBeGreaterThan(0.4)
        expect(recovered, `${presetId}:${bpm}:recovery`).toBeLessThan(peak * 0.75)
        expect(retriggered, `${presetId}:${bpm}:retrigger`).toBeGreaterThan(peak * 0.9)
      }
    }
  })

  it('preserves restrained pacing, low-load quality, and an explicit Crystal Synapse default strategy', () => {
    const oracle = cinematicPreset('preset-oracle-lock').cinematicConfig!
    expect(oracle.audioMapping.routes.find(route => route.id === 'ol-beat-rings')).toMatchObject({ source: 'barStart', target: 'portalPulse' })
    expect(oracle.audioMapping.routes.some(route => route.source === 'beat')).toBe(false)

    const epoch = cinematicPreset('preset-epoch-engine').cinematicConfig!
    const ashen = cinematicPreset('preset-ashen-cyclone').cinematicConfig!
    expect(epoch.audioMapping.routes.some(route => (CINEMATIC_AUDIO_EVENT_SOURCES as readonly string[]).includes(route.source))).toBe(false)
    expect(ashen.audioMapping.routes.every(route => route.releaseMs >= 420)).toBe(true)

    const minimal = cinematicPreset('preset-minimal-skeleton').cinematicConfig!
    expect(minimal.qualityTier).toBe('low')
    expect(Math.max(...minimal.audioMapping.routes.map(route => Math.abs(route.amount)))).toBeLessThanOrEqual(0.38)

    const crystal = cinematicPreset('preset-crystal-synapse').cinematicConfig!
    expect(crystal.audioMapping.routes.map(route => route.id))
      .toEqual(createDefaultCinematicAudioRoutes('reactiveConstellation').map(route => route.id))
  })

  it('falls back from missing transient analysis to the beat grid and from a missing grid to continuous audio', () => {
    const gear = cinematicPreset('preset-gear-sun').cinematicConfig!
    const noTransients = audioFrame(['beat'], { transientEvents: false, kickEvents: false, snareEvents: false })
    const beatFallback = new CinematicModulationEngine().update(
      noTransients,
      gear.audioMapping.routes,
      supportedTargets(cinematicPreset('preset-gear-sun')),
      1 / 60,
      gear.audioMapping.smoothingMs,
      gear.seed,
    )
    expect(beatFallback.values.environmentBrightness).toBeGreaterThan(0.6)
    expect(beatFallback.values.impact).toBe(0)

    const ashen = cinematicPreset('preset-ashen-cyclone').cinematicConfig!
    const continuousOnly = audioFrame(['bass', 'volume'], {
      beatTiming: false,
      downbeatTiming: false,
      barTiming: false,
      phraseTiming: false,
      transientEvents: false,
      kickEvents: false,
      snareEvents: false,
    })
    const continuous = new CinematicModulationEngine().update(
      continuousOnly,
      ashen.audioMapping.routes,
      supportedTargets(cinematicPreset('preset-ashen-cyclone')),
      1 / 60,
      ashen.audioMapping.smoothingMs,
      ashen.seed,
    )
    expect(continuous.values.fogDensity).toBeGreaterThan(0)
    expect(continuous.values.particleEmission).toBeGreaterThan(0)
  })
})

function cinematicPreset(id: string) {
  // Resolve from the full preset library, not the catalog-filtered list: these
  // targeted audits check preset definitions that survive catalog exclusion for
  // restore/import compatibility.
  const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === id && candidate.engine === 'cinematicPortal')
  expect(preset, id).toBeDefined()
  return preset!
}

function supportedTargets(preset: ReturnType<typeof cinematicPreset>): readonly CinematicAudioTarget[] {
  const targets = worldTargets.get(preset.cinematicConfig!.worldMode)
  expect(targets, preset.id).toBeDefined()
  return targets!
}

function audioFrame(
  activeSources: readonly CinematicAudioSource[] = [],
  capabilityOverrides: Partial<CinematicNormalizedAudioFrame['capabilities']> = {},
): CinematicNormalizedAudioFrame {
  const active = new Set(activeSources)
  const values = Object.fromEntries(CINEMATIC_AUDIO_SOURCES.map(source => [source, active.has(source) ? 1 : 0])) as Record<CinematicAudioSource, number>
  const events = Object.fromEntries(CINEMATIC_AUDIO_EVENT_SOURCES.map(source => [source, active.has(source)])) as CinematicNormalizedAudioFrame['events']
  return {
    frameId: 1,
    sourceId: 'stage-4-audit',
    trackId: 'stage-4-audit-track',
    transportTimeSec: 1,
    isPlaying: true,
    values,
    events,
    timing: { bpm: 150, beatPhase: 0, beatIndex: 8, beatInBar: 0, barIndex: 2, barPosition: 0, phraseProgress: 0.5 },
    section: { type: 'drop', label: 'Drop', startSec: 0, endSec: 16, progress: 0.25, intensity: 1, confidence: 1 },
    capabilities: { ...FULL_CAPABILITIES, ...capabilityOverrides },
    resetReasons: [],
  }
}

function response(
  routes: readonly CinematicAudioRoute[],
  targets: readonly CinematicAudioTarget[],
  sources: readonly CinematicAudioSource[],
): Readonly<Record<CinematicAudioTarget, number>> {
  const engine = new CinematicModulationEngine()
  engine.update(audioFrame(), routes, targets, 1 / 60, 0, 11)
  return { ...engine.update(audioFrame(sources), routes, targets, 1 / 60, 0, 11).values }
}

function activeTargets(values: Readonly<Record<CinematicAudioTarget, number>>): string[] {
  return Object.entries(values).filter(([, value]) => Math.abs(value) > 0.001).map(([target]) => target).sort()
}

function magnitude(values: Readonly<Record<CinematicAudioTarget, number>>): number {
  return Object.values(values).reduce((sum, value) => sum + Math.abs(value), 0)
}
