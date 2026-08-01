import type { ReactPreset } from '../ReactTypes'
import { clonePixGridLayer } from './PixGridDefaults'
import { compilePixGridGroupMask } from './PixGridGroups'
import type {
  PixGridGroup,
  PixGridLayer,
  PixGridPresetLineage,
  PixGridReactionAssignment,
  PixGridScene,
  PixGridState,
} from './PixGridTypes'

const SOURCE_BACKED_MASKS = new Set<PixGridGroup['mask']['kind']>([
  'layerAlpha',
  'colorRange',
  'luminanceRange',
  'connectedRegion',
  'svgMetadata',
])

interface LegacyLayerAlias {
  canonicalId: string
  ids?: readonly string[]
  names?: readonly string[]
  assetIds?: readonly PixGridLayer['assetId'][]
  preserveName?: boolean
}

const CANONICAL_LAYER_ASSET_UPGRADES: Readonly<Record<string, Readonly<Record<string, readonly PixGridLayer['assetId'][]>>>> = {
  'pix-grid-neon-marquee-cycle': {
    'marquee-structure': ['pix-neon-marquee-structure'],
  },
}

const LEGACY_LAYER_ALIASES: Readonly<Record<string, readonly LegacyLayerAlias[]>> = {
  'pix-grid-geometric-reactor': [
    { canonicalId: 'reactor-checker', ids: ['bass', 'reactor-bass', 'geometric-bass'], names: ['bass', 'bass field', 'reactor bass field'] },
    { canonicalId: 'reactor-tunnel', ids: ['geometric-tunnel', 'tunnel', 'reactor-tunnel-v1'], names: ['geometric tunnel', 'tunnel'], assetIds: ['pix-geometric-tunnel'] },
    { canonicalId: 'reactor-orbits', ids: ['orbiting-dots', 'orbiting-nodes', 'reactor-dots'], names: ['orbiting dots', 'orbiting nodes'], assetIds: ['pix-orbiting-dots'] },
    { canonicalId: 'reactor-rings', ids: ['reactor-rings-v1', 'inner-rings'], names: ['reactor rings', 'inner rings'], assetIds: ['pix-concentric-rings'] },
    { canonicalId: 'reactor-diamond', ids: ['center-geometry', 'reactor-core', 'diamond-core'], names: ['center geometry', 'reactor core', 'diamond core'], assetIds: ['pix-diamond'] },
  ],
  'pix-grid-bass-beacon': [
    { canonicalId: 'bass-word', ids: ['bass', 'bass-text', 'bass-hero'], names: ['bass', 'bass word', 'bass hero'], assetIds: ['pix-bass-word'] },
    { canonicalId: 'bass-rings', ids: ['bass-rings-v1', 'concentric-rings', 'sub-rings'], names: ['concentric rings', 'bass rings', 'sub rings'], assetIds: ['pix-concentric-rings'] },
    { canonicalId: 'bass-outline', ids: ['bass-outline-v1', 'bass-border'], names: ['bass outline', 'typography outline'] },
    { canonicalId: 'bass-sparkles', ids: ['bass-stars', 'star-field'], names: ['star field', 'sparkles'], assetIds: ['pix-multi-star-field'] },
  ],
  'pix-grid-neon-marquee-cycle': [
    {
      canonicalId: 'marquee-structure',
      ids: ['neon-marquee-frame'],
      names: ['Neon Marquee Frame'],
      assetIds: ['pix-neon-marquee-cycle'],
      preserveName: false,
    },
  ],
  'pix-grid-pixel-parade': [
    { canonicalId: 'parade-pal', ids: ['pixel-pal', 'mascot', 'parade-mascot'], names: ['pixel pal', 'mascot', 'hero pixel pal'], assetIds: ['pix-mascot-face'] },
    { canonicalId: 'parade-orbit', ids: ['parade-orbit-v1', 'orbiting-dots'], names: ['orbiting dots', 'parade orbit'], assetIds: ['pix-orbiting-dots'] },
    { canonicalId: 'parade-eq', ids: ['equalizer', 'equalizer-bars', 'parade-equalizer'], names: ['equalizer', 'equalizer bars'], assetIds: ['pix-equalizer-bars'] },
    { canonicalId: 'parade-stars', ids: ['parade-stars-v1', 'star-field'], names: ['star field', 'parade stars'], assetIds: ['pix-multi-star-field'] },
    { canonicalId: 'parade-burst', ids: ['pixel-burst', 'parade-impact'], names: ['pixel burst', 'parade impact'], assetIds: ['pix-pixel-burst'] },
  ],
}

function normalizedLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function canonicalLayersFor(preset: ReactPreset): readonly PixGridLayer[] {
  return preset.pixGridSettings?.layers ?? []
}

function canonicalGroupsFor(preset: ReactPreset): readonly PixGridGroup[] {
  return preset.pixGridSettings?.groups ?? []
}

function aliasForLayer(preset: ReactPreset, layer: PixGridLayer): LegacyLayerAlias | null {
  const aliases = LEGACY_LAYER_ALIASES[preset.id] ?? []
  const canonicalById = new Map(canonicalLayersFor(preset).map(candidate => [candidate.id, candidate]))
  const normalizedId = normalizedLabel(layer.id)
  const normalizedName = normalizedLabel(layer.name)
  for (const alias of aliases) {
    if (alias.ids?.some(id => normalizedLabel(id) === normalizedId)) return alias
    const nameMatches = alias.names?.some(name => normalizedLabel(name) === normalizedName) === true
    const canonicalAssetId = canonicalById.get(alias.canonicalId)?.assetId
    const officialAssetMatches = alias.assetIds?.includes(layer.assetId) === true || canonicalAssetId === layer.assetId
    // Display names alone are not lineage evidence. A name match must also
    // retain the authored asset signature so a user-created "Tunnel" or
    // "BASS" overlay is not silently consumed as an official legacy layer.
    if (nameMatches && officialAssetMatches) return alias
  }
  return null
}

function hasCustomRouteOrGroup(state: PixGridState, preset: ReactPreset): boolean {
  const canonicalGroupIds = new Set(canonicalGroupsFor(preset).map(group => group.id))
  const canonicalAssignmentIds = new Set((preset.pixGridSettings?.audioAssignments ?? []).map(route => route.id))
  return state.groups.some(group => !canonicalGroupIds.has(group.id))
    || state.audioAssignments.some(route => !canonicalAssignmentIds.has(route.id))
}

export interface PixGridPresetLineageDetection {
  lineage: PixGridPresetLineage
  legacyOfficialLayerGraph: boolean
  genuineUserLayers: boolean
  canonicalLayerCount: number
  mappedLegacyLayerCount: number
  customLayerCount: number
}

export function detectPixGridPresetLineage(state: PixGridState, preset: ReactPreset): PixGridPresetLineageDetection {
  const canonicalIds = new Set(canonicalLayersFor(preset).map(layer => layer.id))
  let canonicalLayerCount = 0
  let mappedLegacyLayerCount = 0
  let customLayerCount = 0
  for (const layer of state.layers) {
    if (canonicalIds.has(layer.id)) canonicalLayerCount += 1
    else if (aliasForLayer(preset, layer)) mappedLegacyLayerCount += 1
    else customLayerCount += 1
  }
  const allCanonical = canonicalIds.size > 0 && [...canonicalIds].every(id => state.layers.some(layer => layer.id === id))
  const hasPresetLineage = state.selectedPresetId === preset.id || state.configuration.sourcePresetId === preset.id
  const genuineUserLayers = customLayerCount > 0 || state.layers.some(layer => Boolean(layer.mediaId))
  const legacyOfficialLayerGraph = !allCanonical && mappedLegacyLayerCount > 0
  let lineage: PixGridPresetLineage
  if (allCanonical) lineage = 'current-canonical-built-in'
  else if (!hasPresetLineage || (canonicalLayerCount === 0 && mappedLegacyLayerCount === 0)) lineage = 'fully-custom'
  else if (legacyOfficialLayerGraph && (genuineUserLayers || hasCustomRouteOrGroup(state, preset))) lineage = 'legacy-built-in-custom-overlays'
  else if (legacyOfficialLayerGraph && state.configuration.userCustomized) lineage = 'legacy-built-in-minor-customization'
  else if (legacyOfficialLayerGraph || state.layers.length === 0) lineage = 'untouched-legacy-built-in'
  else lineage = 'fully-custom'
  return { lineage, legacyOfficialLayerGraph, genuineUserLayers, canonicalLayerCount, mappedLegacyLayerCount, customLayerCount }
}

function mergeMappedLayer(canonical: PixGridLayer, legacy: PixGridLayer, preserveName = true): PixGridLayer {
  return {
    ...clonePixGridLayer(canonical),
    name: preserveName ? legacy.name : canonical.name,
    visible: legacy.visible,
    opacity: legacy.opacity,
    position: { ...legacy.position },
    scale: { ...legacy.scale },
    rotation: legacy.rotation,
    flipX: legacy.flipX,
    flipY: legacy.flipY,
    blendMode: legacy.blendMode,
    paletteMap: { ...legacy.paletteMap },
    clipMode: legacy.clipMode,
    maskAssetId: legacy.maskAssetId,
  }
}

export interface PixGridCanonicalLayerMerge {
  layers: PixGridLayer[]
  layerIdMap: ReadonlyMap<string, string>
  canonicalLayersAdded: string[]
  legacyLayersMapped: string[]
  legacyLayersPreservedAsOverlays: string[]
  obsoleteOfficialLayersRemoved: string[]
  safeRecoveryUsed: boolean
}

export function mergePixGridCanonicalLayerGraph(state: PixGridState, preset: ReactPreset): PixGridCanonicalLayerMerge {
  const canonical = canonicalLayersFor(preset)
  const canonicalById = new Map(canonical.map(layer => [layer.id, layer]))
  const mappedByCanonicalId = new Map<string, PixGridLayer>()
  const layerIdMap = new Map<string, string>()
  const overlays: PixGridLayer[] = []
  const legacyLayersMapped: string[] = []
  const obsoleteOfficialLayersRemoved: string[] = []

  for (const layer of state.layers) {
    if (canonicalById.has(layer.id)) {
      if (layer.mediaId) {
        overlays.push({ ...clonePixGridLayer(layer), id: `${layer.id}-user-overlay` })
        layerIdMap.set(layer.id, layer.id)
        continue
      }
      const canonicalLayer = canonicalById.get(layer.id)!
      const authoredAssetUpgrade = CANONICAL_LAYER_ASSET_UPGRADES[preset.id]?.[layer.id]?.includes(layer.assetId) === true
      mappedByCanonicalId.set(layer.id, {
        ...clonePixGridLayer(layer),
        ...(authoredAssetUpgrade ? { assetId: canonicalLayer.assetId } : {}),
      })
      layerIdMap.set(layer.id, layer.id)
      continue
    }
    const alias = layer.mediaId ? null : aliasForLayer(preset, layer)
    if (alias && canonicalById.has(alias.canonicalId) && !mappedByCanonicalId.has(alias.canonicalId)) {
      mappedByCanonicalId.set(alias.canonicalId, mergeMappedLayer(canonicalById.get(alias.canonicalId)!, layer, alias.preserveName !== false))
      layerIdMap.set(layer.id, alias.canonicalId)
      legacyLayersMapped.push(`${layer.id}->${alias.canonicalId}`)
      obsoleteOfficialLayersRemoved.push(layer.id)
      continue
    }
    overlays.push(clonePixGridLayer(layer))
    layerIdMap.set(layer.id, layer.id)
  }

  const canonicalLayersAdded: string[] = []
  const canonicalLayers = canonical.map(layer => {
    const existing = mappedByCanonicalId.get(layer.id)
    if (existing) return existing
    canonicalLayersAdded.push(layer.id)
    return clonePixGridLayer(layer)
  })
  const usedIds = new Set(canonicalLayers.map(layer => layer.id))
  const safeOverlays = overlays.map((layer, index) => {
    if (!usedIds.has(layer.id)) {
      usedIds.add(layer.id)
      return layer
    }
    const base = `${layer.id}-legacy-overlay`
    let id = base
    let suffix = index + 1
    while (usedIds.has(id)) id = `${base}-${suffix++}`
    usedIds.add(id)
    if (layerIdMap.get(layer.id) !== layer.id) layerIdMap.set(layer.id, id)
    return { ...layer, id }
  })
  return {
    layers: [...canonicalLayers, ...safeOverlays],
    layerIdMap,
    canonicalLayersAdded,
    legacyLayersMapped,
    legacyLayersPreservedAsOverlays: safeOverlays.map(layer => layer.id),
    obsoleteOfficialLayersRemoved,
    safeRecoveryUsed: canonical.length > 0 && canonicalLayersAdded.length === canonical.length && state.layers.length > 0,
  }
}

function remapId(id: string, layerIdMap: ReadonlyMap<string, string>): string {
  return layerIdMap.get(id) ?? id
}

function cloneAssignmentWithMappedReferences(assignment: PixGridReactionAssignment, layerIdMap: ReadonlyMap<string, string>): PixGridReactionAssignment {
  const scope = assignment.targetScope ?? 'output'
  const targetId = assignment.targetId && (scope === 'layer' || scope === 'animation')
    ? remapId(assignment.targetId, layerIdMap)
    : assignment.targetId
  return {
    ...assignment,
    targetId,
    clamp: [...assignment.clamp] as [number, number],
    ...(assignment.inputRange ? { inputRange: [...assignment.inputRange] as [number, number] } : {}),
    ...(assignment.outputRange ? { outputRange: [...assignment.outputRange] as [number, number] } : {}),
    ...(assignment.conditions ? {
      conditions: {
        ...assignment.conditions,
        ...(assignment.conditions.activeLayerId ? { activeLayerId: remapId(assignment.conditions.activeLayerId, layerIdMap) } : {}),
      },
    } : {}),
  }
}

export interface PixGridReferenceRepair {
  scenes: PixGridScene[]
  groups: PixGridGroup[]
  audioAssignments: PixGridReactionAssignment[]
  performance: PixGridState['performance']
  selectedSceneId: string | null
  selectedLayerId: string | null
  sceneReferencesRepaired: number
  groupsRepaired: string[]
  assignmentsRepaired: string[]
}

export function repairPixGridLayerReferences(
  state: PixGridState,
  preset: ReactPreset,
  layers: readonly PixGridLayer[],
  layerIdMap: ReadonlyMap<string, string>,
  groups: readonly PixGridGroup[],
  audioAssignments: readonly PixGridReactionAssignment[],
): PixGridReferenceRepair {
  const layerIds = new Set(layers.map(layer => layer.id))
  const canonicalLayerIds = canonicalLayersFor(preset).map(layer => layer.id)
  const canonicalLayerIdSet = new Set(canonicalLayerIds)
  const preservedOverlayIds = layers.filter(layer => !canonicalLayerIdSet.has(layer.id)).map(layer => layer.id)
  const canonicalSceneIds = Object.keys(preset.pixGridSettings?.sceneSettings ?? {})
  const canonicalSceneSet = new Set(canonicalSceneIds)
  let sceneReferencesRepaired = 0
  const scenesById = new Map<string, PixGridScene>()
  for (const scene of state.scenes) {
    const remapped = scene.layerIds.map(id => remapId(id, layerIdMap)).filter(id => layerIds.has(id))
    let repaired = [...new Set(remapped)]
    if (canonicalSceneSet.has(scene.id)) repaired = [...new Set([...canonicalLayerIds, ...repaired, ...preservedOverlayIds])]
    if (repaired.length === 0) repaired = [...canonicalLayerIds]
    if (JSON.stringify(repaired) !== JSON.stringify(scene.layerIds)) sceneReferencesRepaired += 1
    scenesById.set(scene.id, { ...scene, layerIds: repaired, pixelOverrides: [...scene.pixelOverrides] })
  }
  for (const [index, sceneId] of canonicalSceneIds.entries()) {
    if (scenesById.has(sceneId)) continue
    scenesById.set(sceneId, {
      id: sceneId,
      name: (sceneId.split('-').slice(-1)[0] ?? `Scene ${index + 1}`).replace(/^./, (value: string) => value.toUpperCase()),
      layerIds: [...canonicalLayerIds],
      pixelOverrides: [],
    })
  }
  const scenes = [...scenesById.values()]
  const canonicalGroups = new Map(canonicalGroupsFor(preset).map(group => [group.id, group]))
  const groupsRepaired: string[] = []
  const repairedGroups = groups.map(group => {
    const mappedScope = (group.layerScope?.length ? group.layerScope : group.layerId ? [group.layerId] : [])
      .map(id => remapId(id, layerIdMap))
      .filter(id => layerIds.has(id))
    const canonical = canonicalGroups.get(group.id)
    const needsCanonicalScope = canonical && mappedScope.length === 0 && ((canonical.layerScope?.length ?? 0) > 0 || canonical.layerId)
    const scope = needsCanonicalScope
      ? [...(canonical!.layerScope?.length ? canonical!.layerScope! : canonical!.layerId ? [canonical!.layerId] : [])]
      : [...new Set(mappedScope)]
    const mask = needsCanonicalScope ? canonical!.mask : group.mask
    if (needsCanonicalScope || JSON.stringify(scope) !== JSON.stringify(group.layerScope ?? (group.layerId ? [group.layerId] : []))) groupsRepaired.push(group.id)
    return {
      ...group,
      layerId: scope[0] ?? null,
      layerScope: scope.length ? scope : null,
      mask: mask.kind === 'runs' ? { kind: 'runs' as const, runs: [...mask.runs] } : { ...mask },
      cellRuns: mask.kind === 'runs' ? [...mask.runs] : [...group.cellRuns],
      reactions: group.reactions.map(route => cloneAssignmentWithMappedReferences(route, layerIdMap)),
    }
  })
  const assignmentsRepaired: string[] = []
  const repairedAssignments = audioAssignments.map(route => {
    const repaired = cloneAssignmentWithMappedReferences(route, layerIdMap)
    if (repaired.targetId !== route.targetId || repaired.conditions?.activeLayerId !== route.conditions?.activeLayerId) assignmentsRepaired.push(route.id)
    return repaired
  })
  const routeOverrides = Object.fromEntries(Object.entries(state.performance.programOverrides.routes).map(([routeId, override]) => {
    const scope = override.targetScope
    const targetId = override.targetId && (scope === 'layer' || scope === 'animation') ? remapId(override.targetId, layerIdMap) : override.targetId
    return [routeId, { ...override, targetId }]
  }))
  const selectedSceneId = state.selectedSceneId && scenes.some(scene => scene.id === state.selectedSceneId)
    ? state.selectedSceneId
    : preset.pixGridSettings?.selectedSceneId ?? scenes[0]?.id ?? null
  const selectedLayerId = state.editor.selectedLayerId
    ? remapId(state.editor.selectedLayerId, layerIdMap)
    : layers[0]?.id ?? null
  return {
    scenes,
    groups: repairedGroups,
    audioAssignments: repairedAssignments,
    performance: {
      ...state.performance,
      lockedRoutes: [...state.performance.lockedRoutes],
      programOverrides: { routes: routeOverrides, sections: { ...state.performance.programOverrides.sections } },
    },
    selectedSceneId,
    selectedLayerId: selectedLayerId && layerIds.has(selectedLayerId) ? selectedLayerId : layers[0]?.id ?? null,
    sceneReferencesRepaired,
    groupsRepaired: [...new Set(groupsRepaired)].sort(),
    assignmentsRepaired: [...new Set(assignmentsRepaired)].sort(),
  }
}

export type PixGridGroupTargetStatus =
  | 'valid'
  | 'missing-layer'
  | 'empty-mask'
  | 'invisible-content'
  | 'valid-but-currently-hidden'
  | 'disabled-intentionally'

export interface PixGridGroupTargetInspection {
  status: PixGridGroupTargetStatus
  usable: boolean
  compiledCellCount: number
  visibleLayerCount: number
  sourceLayerIds: readonly string[]
}

export function inspectPixGridGroupTarget(state: PixGridState, group: PixGridGroup): PixGridGroupTargetInspection {
  const sourceLayerIds = group.layerScope?.length ? group.layerScope : group.layerId ? [group.layerId] : []
  if (!group.enabled || group.contentVisible === false) return { status: 'disabled-intentionally', usable: false, compiledCellCount: 0, visibleLayerCount: 0, sourceLayerIds }
  const sourceLayers = sourceLayerIds.map(id => state.layers.find(layer => layer.id === id)).filter((layer): layer is PixGridLayer => Boolean(layer))
  if (sourceLayerIds.length > 0 && sourceLayers.length !== sourceLayerIds.length) return { status: 'missing-layer', usable: false, compiledCellCount: 0, visibleLayerCount: 0, sourceLayerIds }
  const visibleLayerCount = sourceLayers.filter(layer => layer.visible && layer.opacity > 0).length
  if (sourceLayers.length > 0 && visibleLayerCount === 0) return { status: 'invisible-content', usable: false, compiledCellCount: 0, visibleLayerCount, sourceLayerIds }
  const activeScene = state.scenes.find(scene => scene.id === state.selectedSceneId) ?? state.scenes[0]
  const activeLayerIds = new Set(activeScene?.layerIds ?? state.layers.map(layer => layer.id))
  const currentlyRenderedLayerCount = sourceLayers.filter(layer => layer.visible && layer.opacity > 0 && activeLayerIds.has(layer.id)).length
  if (group.visible === false || (sourceLayers.length > 0 && currentlyRenderedLayerCount === 0)) {
    return { status: 'valid-but-currently-hidden', usable: true, compiledCellCount: 0, visibleLayerCount, sourceLayerIds }
  }
  if (SOURCE_BACKED_MASKS.has(group.mask.kind)) return { status: 'valid', usable: sourceLayers.length > 0, compiledCellCount: sourceLayers.length > 0 ? 1 : 0, visibleLayerCount, sourceLayerIds }
  const compiledCellCount = compilePixGridGroupMask(group, state.matrixWidth, state.matrixHeight).cellCount
  return { status: compiledCellCount > 0 ? 'valid' : 'empty-mask', usable: compiledCellCount > 0, compiledCellCount, visibleLayerCount, sourceLayerIds }
}
