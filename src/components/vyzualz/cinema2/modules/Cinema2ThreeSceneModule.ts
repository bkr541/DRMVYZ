import {
  cinema2StableId,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
  type Cinema2RenderQualityLevel,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleParameterReadFacet,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
  Cinema2ModuleUpdateContext,
} from './Cinema2ModuleContracts'
import type { Cinema2DispatchedTargetAction } from '../parameters/Cinema2TargetRuntime'
import { cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetManifest'
import { Cinema2ThreeAssetCache, Cinema2ThreeAssetError, type Cinema2ThreeLoadedAsset } from './three/Cinema2ThreeAssetCache'
import type { Cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetRegistry'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import {
  CINEMA2_THREE_DEFAULT_OVERRIDES,
  Cinema2ThreeSceneBridge,
  samePartOverrides,
  type Cinema2ThreeGlowDraw,
  type Cinema2ThreeMaterialOverrides,
  type Cinema2ThreePartOverrides,
  type Cinema2ThreePanelSpec,
  type Cinema2ThreeSceneInstance,
  type Cinema2ThreeSegmentDraw,
} from './three/Cinema2ThreeSceneBridge'
import {
  CINEMA2_THREE_SEGMENT_ROLES,
  Cinema2ThreeSegmentLighting,
  readCinema2ThreeSegmentPattern,
  type Cinema2ConduitCueKind,
  type Cinema2ConduitTriggerId,
  type Cinema2ThreeSegmentRole,
} from './three/Cinema2ThreeSegmentLighting'
import { parseCinema2ThreeParticleSpec, type Cinema2ThreeParticleSpec } from './three/Cinema2ThreeParticles'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { Cinema2ThreeAudioGlow, readCinema2ThreeGlowMode } from './three/Cinema2ThreeAudioGlow'
import { cinema2ThreeEnvironmentRegistry, type Cinema2ThreeEnvironmentRegistry } from './three/Cinema2ThreeEnvironmentRegistry'

export const CINEMA2_THREE_SCENE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('three-scene')
export const CINEMA2_THREE_SCENE_MODULE_VERSION = 1 as const

export type Cinema2ThreeSceneModuleState = 'idle' | 'loading' | 'building' | 'ready' | 'failed'

/**
 * `three-scene`: draws shipped glTF models with Three.js. Cinema 2.0 keeps the camera, lights, audio intelligence and
 * choreography; this module only turns asset ids into pixels. Three itself is loaded lazily (first render of a preset that
 * includes the module) and the module renders nothing until its assets are decoded and warmed up.
 *
 * `config.instances`: `[{ asset: "<shipped asset id>", node?: "<Scene Graph node id>" }]`. A node places the instance (choreography can
 * move it); without one the instance sits at the world origin.
 *
 * Module parameters (bindable to Design controls, all optional): `color` (multiplies the base color), `emissive` and
 * `emissiveIntensity`, `roughness`, `metalness`, `environmentIntensity`, and the PBR set: `clearcoat` / `clearcoatRoughness` (a glossy
 * lacquer layer; using `clearcoat` upgrades the materials to physical ones), `environmentRotation` (degrees) and `panelIntensity`
 * (multiplies the configured panel lights). Missing parameters leave the asset's own values.
 *
 * Per-part looks: `config.parts` lists the model's part (mesh) names, and each part then reads its own `<part>.color`, `<part>.emissive`,
 * `<part>.emissiveIntensity`, `<part>.roughness`, `<part>.metalness`, `<part>.clearcoat` and `<part>.clearcoatRoughness` parameters. For that part they
 * replace the global value of the same property, so one model can be a gold rim around a crystal body. Parts also read a thin-film set with no
 * global counterpart: `<part>.iridescence` (0-1; upgrades the materials to physical ones), `<part>.iridescenceIOR` and
 * `<part>.iridescenceThicknessMin` / `<part>.iridescenceThicknessMax` (nanometres), for a pearly, pastel-shifting finish; and a glass set:
 * `<part>.transmission` (0-1, see-through; upgrades to physical materials; off on the low tier), `<part>.ior`, `<part>.thickness` and
 * `<part>.dispersion` (rainbow splitting), for clear cut crystal. `<part>.environmentIntensity` scales that part's share of the environment
 * reflections (1 = the module's level), so dark bark and polished crystal can sit in one scene.
 *
 * Turntable spin: an instance with `spin: true` turns about its own vertical axis. The module parameter `spinTurnSeconds` is the time one full turn
 * takes at the 120 BPM reference (0 or missing = no spin) and `spinSync` (default true) locks it to the track's beat grid, so the turn follows the
 * detected tempo (a faster track turns faster; the spin stands still while playback is paused). Off, it turns at the reference rate whatever the tempo.
 *
 * Audio glow: `config.glow` maps part names to their share of the glow (`{ "veins": 1, "roots": 0.2 }`); those parts emit light that follows the
 * music (see Cinema2ThreeAudioGlow). Parameters: `glowMode` (`energy` | `breathing` | `both`), `glowSync` (default true: timing locked to the
 * beat grid; off: a steady 120 BPM), `glowReactivity` (0-1, how strongly it reacts), `glowStrength` (overall brightness) and `glowColor`. A
 * part with a `_GLOW_PHASE` vertex attribute (0 at the root tips, 1 at the top) carries climbing pulses; without it, it only breathes.
 *
 * Segment lighting: `config.segments` maps part names to a role - `feed` (energy runs along it into the logo), `core` (flares when energy
 * arrives) or `field` (the lit wall) - and those parts are lit LED segment by LED segment from their `_SEGMENT` and `_GLOW_PHASE` vertex
 * attributes (see Cinema2ThreeSegmentLighting), replacing their own emissive. Parameters: `segmentPattern` (`energyFlow` | `ringChase` |
 * `split` | `pulse` | `coreDischarge` | `routeRelay`), `segmentAuto` (true: the music picks the pattern), `segmentPatternChange`,
 * `segmentTrigger`, `segmentRouteDensity`, `segmentPulseWidth`, `segmentDropIntensity`, `segmentFlicker` (0-1), `segmentReactivity` (0-1),
 * `segmentStrength` (overall brightness), `segmentCore` (0-1, how much each segment's light gathers into a hot centre where it faces the camera),
 * `segmentColor` (the energy color) and `segmentSync` (default true: locked to the beat grid; off: a steady 120 BPM).
 *
 * `config.particles`: `[{ count, center, size, pointSize, color, brightness, drift?, twinkle?, reactivity?, tint? }]` fields of glowing points
 * drifting through a box - embers, dust in a light shaft (see Cinema2ThreeParticles). `tint: 'glow'` takes the glow color; `reactivity` lets
 * the audio glow brighten the field. High quality draws `count`, medium half, low none.
 *
 * `config.hdr: true` declares that the preset renders this module into float (`rgba16f`) targets and tone-maps later: the segments'
 * and the audio glow's light is then emitted at full strength, many times brighter than white, for bloom and the finish's tone curve to
 * shape. On a GPU that cannot render to float textures (the targets fall back to 8-bit) both roll off softly toward white, so amber does
 * not clip to yellow. Without it the segments roll off and the glow is emitted as is.
 *
 * Shadows: `config.shadows` = `{ cast: [parts], receive: [parts] }` names which parts cast and receive shadows from spot lights authored
 * with `config.threeShadow` (up to two, medium and high only; see CINEMA2_THREE_SHADOW_BUDGET). Keep casters to the models inside those lights'
 * cones: every caster is drawn again into each shadow map.
 *
 * `config.environment`: id of a shipped equirectangular environment used for image-based lighting (default: the built-in studio room;
 * a shipped one that fails to load falls back to it with a diagnostic). Its intensity follows the Cinema 2.0 environment exposure.
 * `config.panels`: `[{ position, target, size: [width, height], color, intensity }]` rectangular LED-panel lights (Three `RectAreaLight`) that
 * light the models: 0 on low, 2 on medium, 4 on high.
 */
export interface Cinema2ThreeSceneModuleOptions {
  environments?: Cinema2ThreeEnvironmentRegistry
  registry?: Cinema2ThreeAssetRegistry
  assets?: Cinema2ThreeAssetCache
  loadLibrary?: () => Promise<Cinema2ThreeLibrary>
  typeId?: Cinema2ModuleTypeId
  version?: number
  resourceKey?: string
  acceptSegmentCues?: boolean
}

export interface Cinema2ThreeSceneModuleInspection {
  state: Cinema2ThreeSceneModuleState
  loadedAssetCount: number
  skippedInstanceCount: number
}

const defaultAssetCache = new Cinema2ThreeAssetCache(cinema2ThreeAssetRegistry)

export function createCinema2ThreeSceneModuleDefinition(options: Cinema2ThreeSceneModuleOptions = {}): Readonly<Cinema2ModuleTypeDefinition> {
  const registry = options.registry ?? cinema2ThreeAssetRegistry
  const assets = options.assets ?? (registry === cinema2ThreeAssetRegistry ? defaultAssetCache : new Cinema2ThreeAssetCache(registry))
  const loadLibrary = options.loadLibrary ?? loadCinema2ThreeLibrary
  const environments = options.environments ?? cinema2ThreeEnvironmentRegistry
  const typeId = options.typeId ?? CINEMA2_THREE_SCENE_MODULE_TYPE_ID
  const version = options.version ?? CINEMA2_THREE_SCENE_MODULE_VERSION

  return Object.freeze({
    typeId,
    version,
    validate(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] {
      return Object.freeze(validateConfig(module, registry, environments))
    },
    create(context: Cinema2ModuleCreateContext) {
      const requested = parseInstances(context.module)
      const panels = parsePanels(context.module)
      const environmentId = typeof context.module.config?.environment === 'string' ? context.module.config.environment : null
      const partNames = parsePartNames(context.module)
      let state: Cinema2ThreeSceneModuleState = 'idle'
      let disposed = false
      let bridge: Cinema2ThreeSceneBridge | null = null
      let bridgeCreateFailed = false
      let held: Cinema2ThreeLoadedAsset[] = []
      let loaded: Cinema2ThreeSceneInstance[] = []
      let library: Cinema2ThreeLibrary | null = null
      let areaLightTables: { init(): void } | null = null
      let overrides: Readonly<Cinema2ThreeMaterialOverrides> = CINEMA2_THREE_DEFAULT_OVERRIDES
      let reportedBytes = -1
      const beatClock = new Cinema2BeatClock()
      let spinRadians = 0
      const glowShares = parseGlow(context.module)
      const shadowParts = parseShadows(context.module)
      const particles = parseParticles(context.module)
      const audioGlow = glowShares ? new Cinema2ThreeAudioGlow() : null
      let glowDraw: Cinema2ThreeGlowDraw | null = null
      const segmentRoles = parseSegments(context.module)
      const segmentLighting = segmentRoles ? new Cinema2ThreeSegmentLighting() : null
      let segmentDraw: Cinema2ThreeSegmentDraw | null = null
      const diagnostics: Cinema2ModuleDiagnostic[] = []

      const report = (code: string, message: string, path: string) => {
        if (!diagnostics.some(existing => existing.code === code && existing.message === message)) diagnostics.push({ code, message, path })
      }

      const releaseHeld = () => {
        const releasing = held
        held = []
        for (const asset of releasing) assets.release(asset)
      }

      const startLoading = (quality: Cinema2RenderQualityLevel) => {
        state = 'loading'
        void (async () => {
          try {
            library = await loadLibrary()
          } catch (error) {
            if (!disposed) { state = 'failed'; report('CINEMA2_THREE_LIBRARY_LOAD_FAILED', `Cinema 2.0 could not load the 3D library: ${message(error)}`, `module.${context.module.id}`) }
            return
          }
          if (panels.length > 0) {
            try {
              areaLightTables = await library.loadAreaLightTables()
            } catch (error) {
              // Without the tables the panels cannot light anything, but the models still draw.
              report('CINEMA2_THREE_AREA_LIGHTS_UNAVAILABLE', `Cinema 2.0 could not load the panel-light tables; panel lights are off: ${message(error)}`, `module.${context.module.id}.config.panels`)
            }
          }
          const results = await Promise.all(requested.map(async instance => {
            try {
              return { instance, asset: await assets.acquire(library!, instance.asset, quality) }
            } catch (error) {
              report(error instanceof Cinema2ThreeAssetError ? error.code : 'CINEMA2_THREE_ASSET_LOAD_FAILED', message(error), `module.${context.module.id}.config.instances`)
              return null
            }
          }))
          const ok = results.filter((entry): entry is { instance: typeof requested[number]; asset: Cinema2ThreeLoadedAsset } => entry !== null)
          if (disposed) {
            for (const entry of ok) assets.release(entry.asset)
            return
          }
          held = ok.map(entry => entry.asset)
          loaded = ok.map(entry => ({ asset: entry.asset, node: entry.instance.node, spin: entry.instance.spin }))
          state = loaded.length > 0 ? 'building' : 'failed'
        })()
      }

      const buildBridge = () => {
        try {
          bridge = context.resources.acquire(
            options.resourceKey ?? 'three-scene:bridge',
            'ThreeSceneBridge',
            gl => new Cinema2ThreeSceneBridge(gl, library!, loaded, { panels: areaLightTables ? panels : [], areaLightTables, environmentUrl: environmentId ? quality => environments.resolveUrl(environmentId, quality) : null, ...(glowShares ? { glow: glowShares } : {}), ...(segmentRoles ? { segments: segmentRoles } : {}), conduitSemantics: context.module.config?.conduitSemantics === true, hdr: context.module.config?.hdr === true, ...(particles.length > 0 ? { particles } : {}), ...(shadowParts ? { shadows: shadowParts } : {}) }),
            value => { value.dispose(); releaseHeld() },
          )
          state = 'building'
        } catch (error) {
          bridgeCreateFailed = true
          state = 'failed'
          report('CINEMA2_THREE_SCENE_BUILD_FAILED', `Cinema 2.0 could not build the 3D scene: ${message(error)}`, `module.${context.module.id}`)
          releaseHeld()
        }
      }

      const provider = Object.freeze({
        id: `${context.module.id}:three-scene`,
        moduleId: context.module.id,
        intent: 'world' as const,
        execute(execution: Cinema2ModuleRenderExecutionContext) {
          const quality = execution.lightingEnvironment?.quality ?? 'high'
          if (state === 'idle') startLoading(quality)
          if (state === 'building' && !bridge && !bridgeCreateFailed && library) buildBridge()
          if (!bridge || state === 'failed' || state === 'loading') return
          bridge.draw(execution, overrides, spinRadians, glowDraw, segmentDraw)
          if (bridge.ready && state !== 'ready') state = 'ready'
          const bytes = bridge.estimateGpuBytes()
          if (bytes !== reportedBytes) { reportedBytes = bytes; context.resources.reportGpuBytes(bytes) }
        },
      })

      return {
        lifecycle: {
          update: ({ frame, parameters }: Cinema2ModuleUpdateContext) => {
            overrides = readOverrides(parameters, overrides, partNames)
            const turnSeconds = readNumber(parameters.get('spinTurnSeconds'), 0, 3600) ?? 0
            const sync = parameters.get('spinSync') !== false
            const beats = beatClock.update(frame, sync).beats
            spinRadians = cinema2ThreeSpinRadians(beats, turnSeconds)
            if (audioGlow) {
              const glowFrame = audioGlow.update(frame, {
                mode: readCinema2ThreeGlowMode(parameters.get('glowMode')),
                sync: parameters.get('glowSync') !== false,
                reactivity: readNumber(parameters.get('glowReactivity'), 0, 1) ?? 1,
              })
              glowDraw = { color: readColor(parameters.get('glowColor')) ?? [1, 0.62, 0.2], strength: readNumber(parameters.get('glowStrength'), 0, 40) ?? 1, frame: glowFrame }
            }
            if (segmentLighting) {
              const segmentFrame = segmentLighting.update(frame, {
                pattern: readCinema2ThreeSegmentPattern(parameters.get('segmentPattern')),
                sync: parameters.get('segmentSync') !== false,
                flicker: readNumber(parameters.get('segmentFlicker'), 0, 1) ?? 0,
                reactivity: readNumber(parameters.get('segmentReactivity'), 0, 1) ?? 1,
                auto: parameters.get('segmentAuto') === true,
                patternChange: parameters.get('segmentPatternChange') === true,
                trigger: parameters.get('segmentTrigger') as Cinema2ConduitTriggerId,
                routeDensity: readNumber(parameters.get('segmentRouteDensity'), 0, 1) ?? 0.55,
                pulseWidth: readNumber(parameters.get('segmentPulseWidth'), 0, 1) ?? 0.45,
                dropIntensity: readNumber(parameters.get('segmentDropIntensity'), 0, 1) ?? 1,
              })
              segmentDraw = { color: readColor(parameters.get('segmentColor')) ?? [1, 0.62, 0.2], strength: readNumber(parameters.get('segmentStrength'), 0, 40) ?? 1, core: readNumber(parameters.get('segmentCore'), 0, 1) ?? 0, frame: segmentFrame }
            }
          },
          dispose: () => {
            disposed = true
            beatClock.reset()
            audioGlow?.reset()
            segmentLighting?.reset()
            // With a bridge, its resource disposer releases the assets after its own materials; otherwise release here.
            if (!bridge) releaseHeld()
          },
        },
        render: { providers: Object.freeze([provider]) },
        handleAction: options.acceptSegmentCues ? (action: string, event: Readonly<Cinema2DispatchedTargetAction>) => {
          if (action !== 'musicalCue' || disposed || !segmentLighting || !event.eventId || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return
          const kind = (event.payload as { kind?: unknown }).kind
          if (typeof kind === 'string' && ['kick', 'snare', 'transient', 'beat', 'downbeat', 'bar', 'phrase', 'section', 'drop'].includes(kind)) {
            segmentLighting.enqueueCue(kind as Cinema2ConduitCueKind, event.eventId)
          }
        } : undefined,
        getDiagnostics: () => (bridge ? [...diagnostics, ...bridge.getDiagnostics().map(entry => ({ ...entry, path: `module.${context.module.id}` }))] : diagnostics),
        inspect: (): Cinema2ThreeSceneModuleInspection => ({ state, loadedAssetCount: loaded.length, skippedInstanceCount: requested.length - loaded.length }),
      }
    },
  })
}

export const cinema2ThreeSceneModuleDefinition = createCinema2ThreeSceneModuleDefinition()

/**
 * The turntable angle for a beat position: one full turn takes `turnSeconds` at the 120 BPM reference (2 beats a second), so a track at 240 BPM
 * turns twice as fast when locked. 0 (or under half a second) means no spin. The result is always in [0, 2π).
 */
export function cinema2ThreeSpinRadians(beats: number, turnSeconds: number): number {
  if (!Number.isFinite(beats) || !Number.isFinite(turnSeconds) || turnSeconds <= 0.5) return 0
  const turns = beats / (2 * turnSeconds)
  return (turns - Math.floor(turns)) * Math.PI * 2
}

interface RequestedInstance {
  asset: string
  node: string | null
  spin: boolean
}

function parseInstances(module: Readonly<Cinema2ModuleManifest>): RequestedInstance[] {
  const raw = module.config?.instances
  if (!Array.isArray(raw)) return []
  const result: RequestedInstance[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const record = entry as Record<string, unknown>
    if (typeof record.asset !== 'string') continue
    result.push({ asset: record.asset, node: typeof record.node === 'string' && record.node ? record.node : null, spin: record.spin === true })
  }
  return result
}

function validateConfig(module: Readonly<Cinema2ModuleManifest>, registry: Cinema2ThreeAssetRegistry, environments: Cinema2ThreeEnvironmentRegistry): Cinema2ModuleDiagnostic[] {
  const diagnostics: Cinema2ModuleDiagnostic[] = []
  const raw = module.config?.instances
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ code: 'CINEMA2_THREE_SCENE_INSTANCES_REQUIRED', path: '$.config.instances', message: 'A three-scene module needs a non-empty config.instances list of { asset, node? }.' }]
  }
  raw.forEach((entry, index) => {
    const path = `$.config.instances[${index}]`
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      diagnostics.push({ code: 'CINEMA2_THREE_SCENE_INSTANCE_INVALID', path, message: 'Each instance must be an object with an "asset" id.' })
      return
    }
    const record = entry as Record<string, unknown>
    if (typeof record.asset !== 'string' || !record.asset.trim()) {
      diagnostics.push({ code: 'CINEMA2_THREE_SCENE_INSTANCE_INVALID', path: `${path}.asset`, message: 'Instance "asset" must be a shipped asset id string.' })
    } else if (!registry.has(record.asset)) {
      diagnostics.push({ code: 'CINEMA2_THREE_SCENE_ASSET_UNKNOWN', path: `${path}.asset`, message: `No shipped 3D asset "${record.asset}" is registered.` })
    }
    if (record.spin !== undefined && typeof record.spin !== 'boolean') {
      diagnostics.push({ code: 'CINEMA2_THREE_SCENE_INSTANCE_INVALID', path: `${path}.spin`, message: 'Instance "spin" must be true or false when present.' })
    }
    if (record.node !== undefined && (typeof record.node !== 'string' || !record.node.trim())) {
      diagnostics.push({ code: 'CINEMA2_THREE_SCENE_INSTANCE_INVALID', path: `${path}.node`, message: 'Instance "node" must be a Scene Graph node id string when present.' })
    }
  })
  const environment = module.config?.environment
  if (environment !== undefined && (typeof environment !== 'string' || !environments.has(environment))) {
    diagnostics.push({ code: 'CINEMA2_THREE_SCENE_ENVIRONMENT_UNKNOWN', path: '$.config.environment', message: `No shipped environment "${String(environment)}" is registered.` })
  }
  const rawParts = module.config?.parts
  if (rawParts !== undefined && (!Array.isArray(rawParts) || rawParts.some(name => typeof name !== 'string' || !name.trim()))) {
    diagnostics.push({ code: 'CINEMA2_THREE_SCENE_PARTS_INVALID', path: '$.config.parts', message: 'config.parts must be a list of part (mesh) name strings.' })
  }
  const rawShadows = module.config?.shadows
  if (rawShadows !== undefined) {
    const record = rawShadows && typeof rawShadows === 'object' && !Array.isArray(rawShadows) ? rawShadows as Record<string, unknown> : null
    const isNameList = (value: unknown) => value === undefined || (Array.isArray(value) && value.every(name => typeof name === 'string' && name.trim() !== ''))
    if (!record || !isNameList(record.cast) || !isNameList(record.receive)) {
      diagnostics.push({ code: 'CINEMA2_THREE_SCENE_SHADOWS_INVALID', path: '$.config.shadows', message: 'config.shadows must be { cast?: [part names], receive?: [part names] }.' })
    }
  }
  const rawGlow = module.config?.glow
  if (rawGlow !== undefined && (!rawGlow || typeof rawGlow !== 'object' || Array.isArray(rawGlow)
    || Object.values(rawGlow).some(share => typeof share !== 'number' || !Number.isFinite(share) || share < 0))) {
    diagnostics.push({ code: 'CINEMA2_THREE_SCENE_GLOW_INVALID', path: '$.config.glow', message: 'config.glow must map part names to non-negative numbers (each part\'s share of the glow).' })
  }
  const rawSegments = module.config?.segments
  if (rawSegments !== undefined && (!rawSegments || typeof rawSegments !== 'object' || Array.isArray(rawSegments)
    || Object.values(rawSegments).some(role => !CINEMA2_THREE_SEGMENT_ROLES.includes(role as Cinema2ThreeSegmentRole)))) {
    diagnostics.push({ code: 'CINEMA2_THREE_SCENE_SEGMENTS_INVALID', path: '$.config.segments', message: `config.segments must map part names to a role: ${CINEMA2_THREE_SEGMENT_ROLES.join(', ')}.` })
  }
  const rawParticles = module.config?.particles
  if (rawParticles !== undefined) {
    if (!Array.isArray(rawParticles)) {
      diagnostics.push({ code: 'CINEMA2_THREE_SCENE_PARTICLES_INVALID', path: '$.config.particles', message: 'config.particles must be a list of particle fields.' })
    } else {
      rawParticles.forEach((entry, index) => {
        if (!parseCinema2ThreeParticleSpec(entry)) diagnostics.push({ code: 'CINEMA2_THREE_SCENE_PARTICLES_INVALID', path: `$.config.particles[${index}]`, message: 'A particle field needs count (0-4000), center [x, y, z], size [x, y, z] above 0, pointSize (0-2), color [r, g, b] in 0..1 and brightness (0-100); drift [x, y, z], twinkle (0-1), reactivity (0-1) and tint (color | glow) are optional.' })
      })
    }
  }
  if (module.config?.hdr !== undefined && typeof module.config.hdr !== 'boolean') {
    diagnostics.push({ code: 'CINEMA2_THREE_SCENE_HDR_INVALID', path: '$.config.hdr', message: 'config.hdr must be true or false.' })
  }
  if (module.config?.conduitSemantics !== undefined && typeof module.config.conduitSemantics !== 'boolean') {
    diagnostics.push({ code: 'CINEMA2_THREE_SCENE_CONDUIT_SEMANTICS_INVALID', path: '$.config.conduitSemantics', message: 'config.conduitSemantics must be true or false.' })
  }
  const rawPanels = module.config?.panels
  if (rawPanels !== undefined) {
    if (!Array.isArray(rawPanels)) {
      diagnostics.push({ code: 'CINEMA2_THREE_SCENE_PANELS_INVALID', path: '$.config.panels', message: 'config.panels must be a list of { position, target, size, color, intensity }.' })
    } else {
      rawPanels.forEach((entry, index) => {
        if (!parsePanel(entry)) diagnostics.push({ code: 'CINEMA2_THREE_SCENE_PANELS_INVALID', path: `$.config.panels[${index}]`, message: 'A panel needs finite position [x, y, z] and target [x, y, z], size [width, height] above 0, a color [r, g, b] in 0..1 and a non-negative intensity.' })
      })
    }
  }
  return diagnostics
}

function parseParticles(module: Readonly<Cinema2ModuleManifest>): readonly Readonly<Cinema2ThreeParticleSpec>[] {
  const raw = module.config?.particles
  if (!Array.isArray(raw)) return []
  return raw.map(entry => parseCinema2ThreeParticleSpec(entry)).filter((spec): spec is Readonly<Cinema2ThreeParticleSpec> => spec !== null)
}

function parseShadows(module: Readonly<Cinema2ModuleManifest>): Readonly<{ cast: readonly string[]; receive: readonly string[] }> | null {
  const raw = module.config?.shadows
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const names = (value: unknown) => (Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string' && name.trim() !== '') : [])
  return Object.freeze({ cast: Object.freeze(names(record.cast)), receive: Object.freeze(names(record.receive)) })
}

function parseGlow(module: Readonly<Cinema2ModuleManifest>): Readonly<Record<string, number>> | null {
  const raw = module.config?.glow
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const shares: Record<string, number> = {}
  for (const [name, share] of Object.entries(raw)) if (typeof share === 'number' && Number.isFinite(share) && share > 0) shares[name] = share
  return Object.keys(shares).length > 0 ? Object.freeze(shares) : null
}

function parseSegments(module: Readonly<Cinema2ModuleManifest>): Readonly<Record<string, Cinema2ThreeSegmentRole>> | null {
  const raw = module.config?.segments
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const roles: Record<string, Cinema2ThreeSegmentRole> = {}
  for (const [name, role] of Object.entries(raw)) if (CINEMA2_THREE_SEGMENT_ROLES.includes(role as Cinema2ThreeSegmentRole)) roles[name] = role as Cinema2ThreeSegmentRole
  return Object.keys(roles).length > 0 ? Object.freeze(roles) : null
}

function parsePartNames(module: Readonly<Cinema2ModuleManifest>): string[] {
  const raw = module.config?.parts
  return Array.isArray(raw) ? raw.filter((name): name is string => typeof name === 'string' && name.trim() !== '') : []
}

function readPartOverrides(parameters: Cinema2ModuleParameterReadFacet, names: readonly string[]): Readonly<Cinema2ThreeMaterialOverrides['parts']> {
  if (names.length === 0) return CINEMA2_THREE_DEFAULT_OVERRIDES.parts
  const parts: Record<string, Readonly<Cinema2ThreePartOverrides>> = {}
  for (const name of names) {
    parts[name] = Object.freeze({
      color: readColor(parameters.get(`${name}.color`)),
      emissive: readColor(parameters.get(`${name}.emissive`)),
      emissiveIntensity: readNumber(parameters.get(`${name}.emissiveIntensity`), 0, 20),
      roughness: readNumber(parameters.get(`${name}.roughness`), 0, 1),
      metalness: readNumber(parameters.get(`${name}.metalness`), 0, 1),
      clearcoat: readNumber(parameters.get(`${name}.clearcoat`), 0, 1),
      clearcoatRoughness: readNumber(parameters.get(`${name}.clearcoatRoughness`), 0, 1),
      iridescence: readNumber(parameters.get(`${name}.iridescence`), 0, 1),
      iridescenceIOR: readNumber(parameters.get(`${name}.iridescenceIOR`), 1, 2.333),
      iridescenceThicknessMin: readNumber(parameters.get(`${name}.iridescenceThicknessMin`), 0, 2000),
      iridescenceThicknessMax: readNumber(parameters.get(`${name}.iridescenceThicknessMax`), 0, 2000),
      transmission: readNumber(parameters.get(`${name}.transmission`), 0, 1),
      ior: readNumber(parameters.get(`${name}.ior`), 1, 2.333),
      thickness: readNumber(parameters.get(`${name}.thickness`), 0, 10),
      dispersion: readNumber(parameters.get(`${name}.dispersion`), 0, 20),
      environmentIntensity: readNumber(parameters.get(`${name}.environmentIntensity`), 0, 8),
    })
  }
  return Object.freeze(parts)
}

function parsePanels(module: Readonly<Cinema2ModuleManifest>): Cinema2ThreePanelSpec[] {
  const raw = module.config?.panels
  return Array.isArray(raw) ? raw.map(parsePanel).filter((panel): panel is Cinema2ThreePanelSpec => panel !== null) : []
}

function parsePanel(entry: unknown): Cinema2ThreePanelSpec | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  const record = entry as Record<string, unknown>
  const vector = (value: unknown, length: number): number[] | null =>
    Array.isArray(value) && value.length === length && value.every(component => typeof component === 'number' && Number.isFinite(component)) ? value as number[] : null
  const position = vector(record.position, 3)
  const target = vector(record.target, 3)
  const size = vector(record.size, 2)
  const color = vector(record.color, 3)
  const intensity = record.intensity
  if (!position || !target || !size || !color || typeof intensity !== 'number' || !Number.isFinite(intensity) || intensity < 0) return null
  if (size[0]! <= 0 || size[1]! <= 0 || color.some(component => component < 0 || component > 1)) return null
  return { position: position as [number, number, number], target: target as [number, number, number], width: size[0]!, height: size[1]!, color: color as [number, number, number], intensity }
}

function readOverrides(parameters: Cinema2ModuleParameterReadFacet, previous: Readonly<Cinema2ThreeMaterialOverrides>, partNames: readonly string[]): Readonly<Cinema2ThreeMaterialOverrides> {
  const color = readColor(parameters.get('color'))
  const emissive = readColor(parameters.get('emissive'))
  const emissiveIntensity = readNumber(parameters.get('emissiveIntensity'), 0, 20)
  const roughness = readNumber(parameters.get('roughness'), 0, 1)
  const metalness = readNumber(parameters.get('metalness'), 0, 1)
  const environmentIntensity = readNumber(parameters.get('environmentIntensity'), 0, 4) ?? CINEMA2_THREE_DEFAULT_OVERRIDES.environmentIntensity
  const clearcoat = readNumber(parameters.get('clearcoat'), 0, 1)
  const clearcoatRoughness = readNumber(parameters.get('clearcoatRoughness'), 0, 1)
  const environmentRotation = readNumber(parameters.get('environmentRotation'), -720, 720) ?? CINEMA2_THREE_DEFAULT_OVERRIDES.environmentRotation
  const panelIntensity = readNumber(parameters.get('panelIntensity'), 0, 40) ?? CINEMA2_THREE_DEFAULT_OVERRIDES.panelIntensity
  const parts = readPartOverrides(parameters, partNames)
  const same = (x: readonly number[] | null, y: readonly number[] | null) => x === y || (x != null && y != null && x.every((value, index) => value === y[index]))
  if (samePartOverrides(parts, previous.parts) && same(color, previous.color) && same(emissive, previous.emissive) && emissiveIntensity === previous.emissiveIntensity
    && roughness === previous.roughness && metalness === previous.metalness && environmentIntensity === previous.environmentIntensity
    && clearcoat === previous.clearcoat && clearcoatRoughness === previous.clearcoatRoughness
    && environmentRotation === previous.environmentRotation && panelIntensity === previous.panelIntensity) return previous
  return Object.freeze({ color, emissive, emissiveIntensity, roughness, metalness, environmentIntensity, clearcoat, clearcoatRoughness, environmentRotation, panelIntensity, parts })
}

function readNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null
}

function readColor(value: unknown): readonly [number, number, number] | null {
  return Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(component => typeof component === 'number' && Number.isFinite(component))
    ? [value[0] as number, value[1] as number, value[2] as number]
    : null
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
