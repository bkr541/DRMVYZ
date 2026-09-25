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
import { cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetManifest'
import { Cinema2ThreeAssetCache, Cinema2ThreeAssetError, type Cinema2ThreeLoadedAsset } from './three/Cinema2ThreeAssetCache'
import type { Cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetRegistry'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import {
  CINEMA2_THREE_DEFAULT_OVERRIDES,
  Cinema2ThreeSceneBridge,
  type Cinema2ThreeMaterialOverrides,
  type Cinema2ThreePanelSpec,
  type Cinema2ThreeSceneInstance,
} from './three/Cinema2ThreeSceneBridge'
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

  return Object.freeze({
    typeId: CINEMA2_THREE_SCENE_MODULE_TYPE_ID,
    version: CINEMA2_THREE_SCENE_MODULE_VERSION,
    validate(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] {
      return Object.freeze(validateConfig(module, registry, environments))
    },
    create(context: Cinema2ModuleCreateContext) {
      const requested = parseInstances(context.module)
      const panels = parsePanels(context.module)
      const environmentId = typeof context.module.config?.environment === 'string' ? context.module.config.environment : null
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
          loaded = ok.map(entry => ({ asset: entry.asset, node: entry.instance.node }))
          state = loaded.length > 0 ? 'building' : 'failed'
        })()
      }

      const buildBridge = () => {
        try {
          bridge = context.resources.acquire(
            'three-scene:bridge',
            'ThreeSceneBridge',
            gl => new Cinema2ThreeSceneBridge(gl, library!, loaded, { panels: areaLightTables ? panels : [], areaLightTables, environmentUrl: environmentId ? quality => environments.resolveUrl(environmentId, quality) : null }),
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
          bridge.draw(execution, overrides)
          if (bridge.ready && state !== 'ready') state = 'ready'
          const bytes = bridge.estimateGpuBytes()
          if (bytes !== reportedBytes) { reportedBytes = bytes; context.resources.reportGpuBytes(bytes) }
        },
      })

      return {
        lifecycle: {
          update: ({ parameters }: Cinema2ModuleUpdateContext) => { overrides = readOverrides(parameters, overrides) },
          dispose: () => {
            disposed = true
            // With a bridge, its resource disposer releases the assets after its own materials; otherwise release here.
            if (!bridge) releaseHeld()
          },
        },
        render: { providers: Object.freeze([provider]) },
        getDiagnostics: () => (bridge ? [...diagnostics, ...bridge.getDiagnostics().map(entry => ({ ...entry, path: `module.${context.module.id}` }))] : diagnostics),
        inspect: (): Cinema2ThreeSceneModuleInspection => ({ state, loadedAssetCount: loaded.length, skippedInstanceCount: requested.length - loaded.length }),
      }
    },
  })
}

export const cinema2ThreeSceneModuleDefinition = createCinema2ThreeSceneModuleDefinition()

interface RequestedInstance {
  asset: string
  node: string | null
}

function parseInstances(module: Readonly<Cinema2ModuleManifest>): RequestedInstance[] {
  const raw = module.config?.instances
  if (!Array.isArray(raw)) return []
  const result: RequestedInstance[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const record = entry as Record<string, unknown>
    if (typeof record.asset !== 'string') continue
    result.push({ asset: record.asset, node: typeof record.node === 'string' && record.node ? record.node : null })
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
    if (record.node !== undefined && (typeof record.node !== 'string' || !record.node.trim())) {
      diagnostics.push({ code: 'CINEMA2_THREE_SCENE_INSTANCE_INVALID', path: `${path}.node`, message: 'Instance "node" must be a Scene Graph node id string when present.' })
    }
  })
  const environment = module.config?.environment
  if (environment !== undefined && (typeof environment !== 'string' || !environments.has(environment))) {
    diagnostics.push({ code: 'CINEMA2_THREE_SCENE_ENVIRONMENT_UNKNOWN', path: '$.config.environment', message: `No shipped environment "${String(environment)}" is registered.` })
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

function readOverrides(parameters: Cinema2ModuleParameterReadFacet, previous: Readonly<Cinema2ThreeMaterialOverrides>): Readonly<Cinema2ThreeMaterialOverrides> {
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
  const same = (x: readonly number[] | null, y: readonly number[] | null) => x === y || (x != null && y != null && x.every((value, index) => value === y[index]))
  if (same(color, previous.color) && same(emissive, previous.emissive) && emissiveIntensity === previous.emissiveIntensity
    && roughness === previous.roughness && metalness === previous.metalness && environmentIntensity === previous.environmentIntensity
    && clearcoat === previous.clearcoat && clearcoatRoughness === previous.clearcoatRoughness
    && environmentRotation === previous.environmentRotation && panelIntensity === previous.panelIntensity) return previous
  return Object.freeze({ color, emissive, emissiveIntensity, roughness, metalness, environmentIntensity, clearcoat, clearcoatRoughness, environmentRotation, panelIntensity })
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
