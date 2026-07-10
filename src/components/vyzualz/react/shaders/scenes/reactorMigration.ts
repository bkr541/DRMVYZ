import type { ShaderModulationRoute } from '../modulation/shaderModulationTypes'
import type { ShaderParamValue, ShaderParamValues } from '../registry/shaderRegistryTypes'
import type { ShaderTexSourceSelection } from '../textures/shaderTextureInputTypes'
import {
  LEGACY_REACTOR_SCENE_IDS,
  REACTOR_SCENE_ID,
  applyReactorRecipe,
  normalizeReactorParamValues,
  type ReactorRecipe,
} from './reactor'

export type LegacyReactorRecipe = Exclude<ReactorRecipe, 'hybrid' | 'custom'>

const LEGACY_RECIPE_BY_SCENE_ID: Readonly<Record<string, LegacyReactorRecipe>> = {
  [LEGACY_REACTOR_SCENE_IDS.semantic]: 'semantic',
  [LEGACY_REACTOR_SCENE_IDS.shrapnel]: 'shrapnel',
  [LEGACY_REACTOR_SCENE_IDS.singularity]: 'singularity',
}

const LEGACY_PARAM_ID_MAP: Readonly<Record<LegacyReactorRecipe, Readonly<Record<string, string>>>> = {
  semantic: {
    cellCount: 'semanticCellCount',
    coreSize: 'coreSize',
    spin: 'angularMovement',
    shockwave: 'shockwaveIntensity',
    primaryColor: 'primaryColor',
    secondaryColor: 'secondaryColor',
    accentColor: 'accentColor',
    backgroundColor: 'backgroundColor',
  },
  shrapnel: {
    shardCount: 'shardCount',
    shardScale: 'spread',
    explosion: 'dropForce',
    angularVelocity: 'rotationSpeed',
    trailAmount: 'trailPersistence',
    shardColor: 'primaryColor',
    coreColor: 'secondaryColor',
    impactColor: 'accentColor',
    backgroundColor: 'backgroundColor',
  },
  singularity: {
    coreScale: 'logoScale',
    fragmentCount: 'shardCount',
    refraction: 'refractionAmount',
    orbitSpeed: 'rotationSpeed',
    echoAmount: 'trailPersistence',
    coreColor: 'primaryColor',
    orbitColor: 'secondaryColor',
    burstColor: 'accentColor',
    backgroundColor: 'backgroundColor',
  },
}

export function getLegacyReactorRecipe(sceneId: string | null | undefined): LegacyReactorRecipe | null {
  if (!sceneId) return null
  return LEGACY_RECIPE_BY_SCENE_ID[sceneId] ?? null
}

export function getLegacyReactorSceneIdForRecipe(
  recipe: ReactorRecipe | null | undefined,
): string | null {
  if (!recipe || recipe === 'hybrid' || recipe === 'custom') return null
  return LEGACY_REACTOR_SCENE_IDS[recipe]
}

export function isLegacyReactorSceneId(sceneId: string | null | undefined): boolean {
  return getLegacyReactorRecipe(sceneId) !== null
}

export function migrateLegacyReactorSceneId(sceneId: string | null): string | null {
  return sceneId && isLegacyReactorSceneId(sceneId) ? REACTOR_SCENE_ID : sceneId
}

function migrateLegacyValueAliases(
  recipe: LegacyReactorRecipe,
  values: ShaderParamValues | undefined,
): ShaderParamValues {
  const migrated = applyReactorRecipe(recipe)
  if (!values) return migrated

  const aliases = LEGACY_PARAM_ID_MAP[recipe]
  for (const [legacyParamId, value] of Object.entries(values)) {
    const targetParamId = aliases[legacyParamId]
    if (targetParamId) migrated[targetParamId] = value
  }

  if (recipe === 'singularity' && typeof values.coreScale === 'number') {
    migrated.coreSize = Math.max(0.1, Math.min(1.1, values.coreScale * 0.48))
    const orbitSpeed = typeof values.orbitSpeed === 'number' ? values.orbitSpeed : 0.18
    migrated.orbitAmount = Math.max(0, Math.min(2, Math.abs(orbitSpeed) * 3.2))
  }

  return migrated
}

export function migrateLegacyReactorParamValues(
  sceneId: string,
  values: ShaderParamValues | undefined,
): ShaderParamValues {
  const recipe = getLegacyReactorRecipe(sceneId)
  if (sceneId === REACTOR_SCENE_ID) return normalizeReactorParamValues(values)
  if (!recipe) return { ...(values ?? {}) }
  return migrateLegacyValueAliases(recipe, values)
}

export function migrateLegacyReactorParamValueMap(
  source: Record<string, ShaderParamValues> | undefined,
): Record<string, ShaderParamValues> {
  const input = source ?? {}
  const output: Record<string, ShaderParamValues> = {}

  for (const [sceneId, values] of Object.entries(input)) {
    if (!isLegacyReactorSceneId(sceneId)) output[sceneId] = { ...values }
  }

  const reactorValues = input[REACTOR_SCENE_ID]
  if (reactorValues) output[REACTOR_SCENE_ID] = normalizeReactorParamValues(reactorValues)

  for (const legacyId of Object.values(LEGACY_REACTOR_SCENE_IDS)) {
    if (!input[legacyId]) continue
    const migrated = migrateLegacyReactorParamValues(legacyId, input[legacyId])
    output[REACTOR_SCENE_ID] = output[REACTOR_SCENE_ID]
      ? { ...migrated, ...output[REACTOR_SCENE_ID] }
      : migrated
  }

  return output
}

export function migrateLegacyReactorRoutes(
  source: Record<string, ShaderModulationRoute[]> | undefined,
): Record<string, ShaderModulationRoute[]> {
  const input = source ?? {}
  const output: Record<string, ShaderModulationRoute[]> = {}

  for (const [sceneId, routes] of Object.entries(input)) {
    if (!isLegacyReactorSceneId(sceneId)) output[sceneId] = routes.map(route => ({ ...route }))
  }

  const merged = [...(output[REACTOR_SCENE_ID] ?? [])]
  const usedIds = new Set(merged.map(route => route.id))

  for (const legacyId of Object.values(LEGACY_REACTOR_SCENE_IDS)) {
    const recipe = getLegacyReactorRecipe(legacyId)
    if (!recipe) continue
    const aliases = LEGACY_PARAM_ID_MAP[recipe]
    for (const route of input[legacyId] ?? []) {
      const targetParamId = aliases[route.targetParamId]
      if (!targetParamId) continue
      let id = route.id
      if (usedIds.has(id)) id = `${id}-${recipe}`
      usedIds.add(id)
      merged.push({ ...route, id, targetParamId })
    }
  }

  if (merged.length > 0) output[REACTOR_SCENE_ID] = merged
  return output
}

export function migrateLegacyReactorTextureSelections(
  source: Record<string, Record<string, ShaderTexSourceSelection>> | undefined,
): Record<string, Record<string, ShaderTexSourceSelection>> {
  const input = source ?? {}
  const output: Record<string, Record<string, ShaderTexSourceSelection>> = {}

  for (const [sceneId, selections] of Object.entries(input)) {
    if (!isLegacyReactorSceneId(sceneId)) output[sceneId] = { ...selections }
  }

  for (const legacyId of Object.values(LEGACY_REACTOR_SCENE_IDS)) {
    if (!input[legacyId]) continue
    output[REACTOR_SCENE_ID] = {
      ...input[legacyId],
      ...(output[REACTOR_SCENE_ID] ?? {}),
    }
  }

  return output
}

export function migrateLegacyReactorIdList(ids: readonly string[] | undefined): string[] {
  const result: string[] = []
  for (const id of ids ?? []) {
    const migrated = migrateLegacyReactorSceneId(id) ?? id
    if (!result.includes(migrated)) result.push(migrated)
  }
  return result
}

export function migrateLegacyReactorCollections(
  collections: Record<string, string[]> | undefined,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(collections ?? {}).map(([name, ids]) => [name, migrateLegacyReactorIdList(ids)]),
  )
}

export interface ReactorMigratablePreset {
  id: string
  name: string
  sceneId: string
  values: ShaderParamValues
  createdAt: string
}

export function migrateLegacyReactorPresets<T extends ReactorMigratablePreset>(
  presets: Record<string, T> | undefined,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(presets ?? {}).map(([id, preset]) => {
      if (preset.sceneId === REACTOR_SCENE_ID) {
        return [id, { ...preset, values: normalizeReactorParamValues(preset.values) }]
      }
      if (!isLegacyReactorSceneId(preset.sceneId)) return [id, preset]
      return [id, {
        ...preset,
        sceneId: REACTOR_SCENE_ID,
        values: migrateLegacyReactorParamValues(preset.sceneId, preset.values),
      }]
    }),
  )
}

export function migrateLegacyReactorParamId(
  sceneId: string,
  paramId: string,
): string | null {
  const recipe = getLegacyReactorRecipe(sceneId)
  return recipe ? (LEGACY_PARAM_ID_MAP[recipe][paramId] ?? null) : paramId
}

export function cloneShaderParamValue(value: ShaderParamValue): ShaderParamValue {
  if (Array.isArray(value)) return value.map(item => (
    typeof item === 'object' && item !== null ? { ...item } : item
  )) as ShaderParamValue
  return value
}
