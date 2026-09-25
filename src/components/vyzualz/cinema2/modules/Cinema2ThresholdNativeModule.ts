import {
  cinema2StableId,
  type Cinema2Color,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleShadowCasterContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
  Cinema2ModuleUpdateContext,
} from './Cinema2ModuleContracts'
import type { Cinema2TextureHandle } from '../assets/Cinema2AssetTextureService'
import { CINEMA2_SMOKE_SPRITES_TEXTURE_ASSET_ID } from '../assets/Cinema2TextureAssetManifest'
import {
  THRESHOLD_INSTANCE_BUDGETS,
  THRESHOLD_PERIOD,
  THRESHOLD_TIER_BY_QUALITY,
  buildThresholdChunks,
  buildThresholdLayout,
  buildThresholdSmoke,
  countThresholdInstances,
  packThresholdInstances,
  packThresholdPuffs,
  thresholdPeriodIndices,
  type ThresholdTier,
} from './threshold/Cinema2ThresholdLayout'
import { multiplyMatrices, translationMatrix } from '../spatial/Cinema2LightMatrices'
import { ThresholdReactiveState } from './threshold/Cinema2ThresholdReactiveState'
import { ThresholdRenderer } from './threshold/Cinema2ThresholdRenderer'

export const CINEMA2_THRESHOLD_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('threshold-native-render')
export const CINEMA2_THRESHOLD_NATIVE_MODULE_VERSION = 1 as const

const DEFAULT_PRIMARY: Cinema2Color = Object.freeze([0.97, 0.985, 1, 1]) as Cinema2Color
const DEFAULT_ACCENT: Cinema2Color = Object.freeze([0.42, 0.68, 1, 1]) as Cinema2Color
const DEFAULT_ATMOSPHERE: Cinema2Color = Object.freeze([0.44, 0.5, 0.6, 1]) as Cinema2Color
const DEFAULT_VOID: Cinema2Color = Object.freeze([0.014, 0.016, 0.02, 1]) as Cinema2Color

/**
 * Threshold: giant LED monoliths in fog. Draws the repeating three-scene layout (corridor, hanging field, ring)
 * as instanced boxes with music-reactive LED faces. Fog, haze, floor reflections, bloom and finishing are the
 * shared Cinema 2.0 effects the preset chains after this module, and the camera flight is the shared camera rig.
 */
export const cinema2ThresholdNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_THRESHOLD_NATIVE_MODULE_TYPE_ID,
  version: CINEMA2_THRESHOLD_NATIVE_MODULE_VERSION,
  validate(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] {
    const seed = module.config?.seed
    if (seed !== undefined && (typeof seed !== 'number' || !Number.isFinite(seed))) {
      return Object.freeze([{ code: 'CINEMA2_THRESHOLD_SEED_INVALID', path: '$.config.seed', message: 'Threshold layout seed must be a finite number.' }])
    }
    const extras = module.config?.extras
    if (extras !== undefined && typeof extras !== 'boolean') {
      return Object.freeze([{ code: 'CINEMA2_THRESHOLD_EXTRAS_INVALID', path: '$.config.extras', message: 'Threshold "extras" (outer towers, overhead structure and ground smoke) must be a boolean.' }])
    }
    return Object.freeze([])
  },
  create(context: Cinema2ModuleCreateContext) {
    const seed = typeof context.module.config?.seed === 'number' ? context.module.config.seed : 1337
    const extras = context.module.config?.extras !== false
    const reactive = new ThresholdReactiveState()
    // Detail (outer towers, overhead structure, ground smoke) is generated deterministically from the seed, gated per quality tier, and must fit
    // each tier's instance budget: adding detail that would blow a budget fails module creation instead of a frame.
    const layout = buildThresholdLayout(seed, { extras })
    const puffs = extras ? buildThresholdSmoke(seed) : []
    for (const quality of ['low', 'medium', 'high'] as const) {
      const tier = THRESHOLD_TIER_BY_QUALITY[quality]
      const budget = THRESHOLD_INSTANCE_BUDGETS[quality]
      const boxes = countThresholdInstances(layout, tier)
      const smoke = countThresholdInstances(puffs, tier)
      if (boxes > budget.boxes || smoke > budget.puffs) {
        throw new Error(`Cinema 2.0 Threshold module "${context.module.id}" needs ${boxes} boxes and ${smoke} smoke puffs on ${quality}, above the ${budget.boxes} / ${budget.puffs} instance budget for that tier.`)
      }
    }
    const renderer = context.resources.acquire(
      `threshold:monoliths:${seed}:${extras ? 'extras' : 'base'}`,
      'ThresholdRenderer',
      gl => new ThresholdRenderer(gl, packThresholdInstances(layout), { chunks: buildThresholdChunks(layout), puffs: packThresholdPuffs(puffs) }),
      value => value.dispose(),
    )
    // The ground-smoke sprite sheet comes from the shared texture service; smoke draws only once it has loaded (and fades in), the rest of the
    // scene never waits for it.
    const spriteAssetId = extras && context.textures ? CINEMA2_SMOKE_SPRITES_TEXTURE_ASSET_ID : null
    let spriteHandle: Cinema2TextureHandle | null = null
    let spriteQuality: string | null = null
    let spriteReadySinceSec: number | null = null
    const smokeState = (execution: Cinema2ModuleRenderExecutionContext, quality: 'low' | 'medium' | 'high') => {
      if (!spriteAssetId || !context.textures) return { texture: null, amount: 0 }
      if (spriteQuality !== quality) {
        spriteHandle?.release()
        spriteHandle = context.textures.acquire(spriteAssetId, quality)
        spriteQuality = quality
        spriteReadySinceSec = null
      }
      if (!spriteHandle || spriteHandle.status !== 'ready' || !spriteHandle.texture) return { texture: null, amount: 0 }
      spriteReadySinceSec ??= execution.frame.elapsedTimeSec
      return { texture: spriteHandle.texture, amount: clamp((execution.frame.elapsedTimeSec - spriteReadySinceSec) / 0.8, 0, 1) }
    }

    const provider = Object.freeze({
      id: `${context.module.id}:threshold`,
      moduleId: context.module.id,
      intent: 'world' as const,
      execute(execution: Cinema2ModuleRenderExecutionContext) {
        if (!execution.depthAvailable) throw new Error(`Cinema 2.0 Threshold module "${context.module.id}" requires a render target with a depth attachment.`)
        const camera = execution.camera
        if (!camera) throw new Error(`Cinema 2.0 Threshold module "${context.module.id}" requires final Camera Runtime state.`)

        // Rotation-only view: monolith positions are made camera-relative in JS, so the shader never sees large world coordinates.
        const viewRotation = new Float32Array(camera.viewMatrix)
        viewRotation[12] = 0
        viewRotation[13] = 0
        viewRotation[14] = 0
        const atmosphere = color(context, 'atmosphereColor', DEFAULT_ATMOSPHERE)
        const laps = thresholdPeriodIndices(camera.position[2])
        const state = reactive.getFrame()
        const quality = execution.lightingEnvironment?.quality ?? 'high'
        const widthScale = clamp(number(context, 'corridorWidth', 1), 0.5, 1.8)
        const smoke = smokeState(execution, quality)
        renderer.draw({
          tier: THRESHOLD_TIER_BY_QUALITY[quality] as ThresholdTier,
          viewFar: camera.far,
          cullMargin: 8,
          smoke: { ...smoke, wallX: 24 + 26 * (widthScale - 1) },
          viewRotation,
          projection: new Float32Array(camera.projectionMatrix),
          cameraPosition: camera.position,
          laps,
          period: THRESHOLD_PERIOD,
          widthScale,
          intensity: clamp(number(context, 'intensity', 1), 0, 1.5),
          baseLevel: 1.1 + 0.15 * clamp(number(context, 'panelBrightness', 0.7), 0, 1),
          accentBase: 0.32 + 0.4 * clamp(number(context, 'panelBrightness', 0.7), 0, 1),
          fogDensity: clamp(number(context, 'fogDensity', 0.02), 0, 0.2),
          primaryColor: rgb(color(context, 'primaryColor', DEFAULT_PRIMARY)),
          accentColor: rgb(color(context, 'accentColor', DEFAULT_ACCENT)),
          bodyColor: rgb(color(context, 'voidColor', DEFAULT_VOID)),
          fogColor: [atmosphere[0] * 0.16, atmosphere[1] * 0.16, atmosphere[2] * 0.16],
          time: state.timeSec,
          fieldVisibility: laps.map(lap => smoothstep(35, 60, -camera.position[2] - lap * THRESHOLD_PERIOD)),
          vanishing: vanishingGlow(camera.position[2], laps, viewRotation, camera.projectionMatrix, clamp(number(context, 'intensity', 1), 0, 1.5), execution),
          reactive: state,
        })
      },
      // Threshold's towers cast into the engine shadow map. The field and ring fade with the camera, so the map is refreshed every frame.
      dynamicShadowCaster: true,
      renderShadow(shadow: Cinema2ModuleShadowCasterContext) {
        const camera = shadow.camera
        const laps = thresholdPeriodIndices(camera.position[2])
        // The renderer places towers camera-relative in JS doubles; fold the camera translation into the light matrix the same way.
        const relative = multiplyMatrices(shadow.lightViewProjection, translationMatrix(camera.position[0], camera.position[1], camera.position[2]))
        renderer.drawShadow({
          lightViewProjection: new Float32Array(relative),
          laps,
          period: THRESHOLD_PERIOD,
          cameraPosition: camera.position,
          widthScale: clamp(number(context, 'corridorWidth', 1), 0.5, 1.8),
          fieldVisibility: laps.map(lap => smoothstep(35, 60, -camera.position[2] - lap * THRESHOLD_PERIOD)),
          tier: THRESHOLD_TIER_BY_QUALITY[shadow.lightingEnvironment.quality],
          viewFar: camera.far,
          // The light's frustum reaches well behind the camera (the map is centred ahead of it), so chunks behind stay in the map.
          cullMargin: 110,
        })
      },
    })

    return {
      lifecycle: {
        update: ({ frame, parameters }: Cinema2ModuleUpdateContext) => {
          const reactivity = typeof parameters.get('reactivity') === 'number' ? parameters.get('reactivity') as number : 0.75
          reactive.update(frame, reactivity, parameters.get('bpmSync') !== false)
        },
        dispose: () => {
          reactive.reset()
          spriteHandle?.release()
          spriteHandle = null
          spriteQuality = null
        },
      },
      render: { providers: Object.freeze([provider]) },
    }
  },
})

/**
 * Where the corridor's far end appears on screen and how strongly it glows. The glow belongs to a corridor, so it is strong while a
 * lap's corridor is ahead (or the camera is inside it), fades out as the flight passes its last pair (into the hanging field and the
 * ring), and fades back in as the next lap's corridor comes into view.
 */
function vanishingGlow(
  cameraZ: number,
  laps: readonly number[],
  viewRotation: Float32Array,
  projection: ArrayLike<number>,
  intensity: number,
  execution: Cinema2ModuleRenderExecutionContext,
): { x: number; y: number; strength: number; aspect: number } {
  let corridor = 0
  for (const lap of laps) {
    const phase = -cameraZ - lap * THRESHOLD_PERIOD
    corridor = Math.max(corridor, smoothstep(-200, -150, phase) * (1 - smoothstep(70, 110, phase)))
  }
  // A point far down the corridor axis, through the camera's rotation and projection.
  const v = [0, 0.04, -1]
  const r = viewRotation
  const view = [r[0]! * v[0]! + r[4]! * v[1]! + r[8]! * v[2]!, r[1]! * v[0]! + r[5]! * v[1]! + r[9]! * v[2]!, r[2]! * v[0]! + r[6]! * v[1]! + r[10]! * v[2]!]
  const p = projection
  const clipX = p[0]! * view[0]! + p[4]! * view[1]! + p[8]! * view[2]!
  const clipY = p[1]! * view[0]! + p[5]! * view[1]! + p[9]! * view[2]!
  const clipW = -view[2]!
  const behind = clipW <= 0.0001
  const x = behind ? 0.5 : (clipX / clipW) * 0.5 + 0.5
  const y = behind ? 0.5 : (clipY / clipW) * 0.5 + 0.5
  return { x, y, strength: behind ? 0 : corridor * intensity * 3.6, aspect: execution.width / Math.max(execution.height, 1) }
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function number(context: Cinema2ModuleCreateContext, name: string, fallback: number): number {
  const value = context.parameters.get(name)
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function color(context: Cinema2ModuleCreateContext, name: string, fallback: Cinema2Color): Cinema2Color {
  const value = context.parameters.get(name)
  return Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component))
    ? value as unknown as Cinema2Color
    : fallback
}

function rgb(value: Cinema2Color): readonly [number, number, number] {
  return [value[0], value[1], value[2]]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
