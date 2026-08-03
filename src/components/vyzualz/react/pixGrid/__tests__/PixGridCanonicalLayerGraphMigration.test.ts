import { describe, expect, it } from 'vitest'
import type { ReactPreset } from '../../ReactTypes'
import { createSilentPixGridAudioFrame, PixGridReactionRuntime } from '../PixGridAudioRouting'
import { inspectPixGridGroupTarget } from '../PixGridCanonicalGraph'
import { updatePixGridLayer } from '../PixGridAuthoring'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createEmptyPixGridCanonicalSignatures } from '../PixGridConfiguration'
import { clonePixGridLayer, createDefaultPixGridState } from '../PixGridDefaults'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import {
  ensurePixGridCanonicalPresetIntegrity,
  ensurePixGridRuntimeAudioRoutes,
  isPixGridAudioAssignmentEffective,
  migratePixGridState,
} from '../PixGridStateMigration'
import {
  PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION,
  PIX_GRID_BUILT_IN_LAYER_GRAPH_VERSION,
  PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION,
  PIX_GRID_SMART_GROUP_CONFIGURATION_VERSION,
  PIX_GRID_STATE_VERSION,
  type PixGridAudioFrame,
  type PixGridGroup,
  type PixGridLayer,
  type PixGridReactionSource,
  type PixGridState,
} from '../PixGridTypes'
import { normalizePixGridState } from '../PixGridValidation'
import { validatePixGridState } from '../PixGridValidationAudit'

const GEOMETRIC = PIX_GRID_PRESET_BY_ID.get('pix-grid-geometric-reactor')!
const BASS_BEACON = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!
const PIXEL_PARADE = PIX_GRID_PRESET_BY_ID.get('pix-grid-pixel-parade')!

function stateForPreset(preset: ReactPreset): PixGridState {
  return applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
}

function layerWithIdentity(layer: PixGridLayer, id: string, name: string, patch: Partial<PixGridLayer> = {}): PixGridLayer {
  return {
    ...clonePixGridLayer(layer),
    id,
    name,
    ...patch,
    position: { ...(patch.position ?? layer.position) },
    scale: { ...(patch.scale ?? layer.scale) },
    paletteMap: { ...(patch.paletteMap ?? layer.paletteMap) },
    animations: patch.animations?.map(animation => ({ ...animation })) ?? layer.animations.map(animation => ({ ...animation })),
  }
}

function legacyBuiltInState(
  preset: ReactPreset,
  layers: PixGridLayer[],
  options: {
    userCustomized?: boolean
    customGroups?: PixGridGroup[]
    sceneLayerIds?: string[]
  } = {},
) {
  const current = stateForPreset(preset)
  const sceneLayerIds = options.sceneLayerIds ?? layers.map(layer => layer.id)
  return {
    ...current,
    version: PIX_GRID_STATE_VERSION - 4,
    configuration: {
      ...current.configuration,
      metadataVersion: 1,
      presetConfigurationVersion: 1,
      layerGraphVersion: 0,
      smartGroupConfigurationVersion: 0,
      audioRouteConfigurationVersion: 0,
      performanceProgramConfigurationVersion: 0,
      musicReactiveConfigurationVersion: 0,
      userCustomized: options.userCustomized === true,
      legacyOfficialLayerGraph: true,
      genuineUserLayers: layers.some(layer => Boolean(layer.mediaId)),
      canonicalMigrationCompleted: false,
      canonicalSignatures: createEmptyPixGridCanonicalSignatures(),
      lastMigration: null,
    },
    layers,
    scenes: current.scenes.map(scene => ({ ...scene, layerIds: [...sceneLayerIds], pixelOverrides: [...scene.pixelOverrides] })),
    groups: [
      ...current.groups.map((group, index) => ({
        ...group,
        layerId: index === 0 ? 'missing-canonical-layer' : group.layerId,
        layerScope: index === 0 ? ['missing-canonical-layer'] : group.layerScope ? [...group.layerScope] : null,
        cellRuns: [...group.cellRuns],
        reactions: group.reactions.map(route => ({ ...route, clamp: [...route.clamp] as [number, number] })),
        mask: group.mask.kind === 'runs' ? { kind: 'runs' as const, runs: [...group.mask.runs] } : { ...group.mask },
      })),
      ...(options.customGroups ?? []),
    ],
    audioAssignments: current.audioAssignments.map(route => ({ ...route, clamp: [...route.clamp] as [number, number] })),
  }
}

function expectCanonicalGraph(state: PixGridState, preset: ReactPreset): void {
  const expected = preset.pixGridSettings?.layers?.map(layer => layer.id) ?? []
  const actual = state.layers.map(layer => layer.id)
  expect(expected.every(id => actual.includes(id))).toBe(true)
  expect(new Set(actual).size).toBe(actual.length)
  expect(state.configuration.layerGraphVersion).toBe(PIX_GRID_BUILT_IN_LAYER_GRAPH_VERSION)
  expect(state.configuration.smartGroupConfigurationVersion).toBe(PIX_GRID_SMART_GROUP_CONFIGURATION_VERSION)
  expect(state.configuration.audioRouteConfigurationVersion).toBe(PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION)
  expect(state.configuration.performanceProgramConfigurationVersion).toBe(PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION)
  expect(state.configuration.canonicalMigrationCompleted).toBe(true)
}

function expectCanonicalTargetsUsable(state: PixGridState, preset: ReactPreset): void {
  const canonicalGroupIds = new Set(preset.pixGridSettings?.groups?.map(group => group.id) ?? [])
  for (const group of state.groups.filter(group => canonicalGroupIds.has(group.id))) {
    const inspection = inspectPixGridGroupTarget(state, group)
    expect(inspection.status, group.id).not.toBe('missing-layer')
    expect(inspection.status, group.id).not.toBe('empty-mask')
    expect(inspection.status, group.id).not.toBe('invisible-content')
    expect(inspection.usable, group.id).toBe(true)
    for (const route of group.reactions) expect(isPixGridAudioAssignmentEffective(state, route, group.id), route.id).toBe(true)
  }
  for (const route of state.audioAssignments.filter(route => preset.pixGridSettings?.audioAssignments?.some(authored => authored.id === route.id))) {
    expect(isPixGridAudioAssignmentEffective(state, route), route.id).toBe(true)
  }
}

function pixelHash(pixels: Uint8Array): number {
  let hash = 2_166_136_261
  for (const value of pixels) {
    hash ^= value
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

function sourceFrame(source: 'quiet' | 'kick' | 'snare' | 'bass', index: number): PixGridAudioFrame {
  const active = source !== 'quiet'
  const sourceValues: Partial<Record<PixGridReactionSource, number>> = {
    energy: active ? 0.7 : 0,
    trackRelativeEnergy: active ? 0.7 : 0,
    bass: source === 'bass' ? 1 : 0,
    sub: source === 'bass' ? 1 : 0,
    kick: source === 'kick' && index === 0 ? 1 : 0,
    snare: source === 'snare' && index === 0 ? 1 : 0,
    transient: (source === 'kick' || source === 'snare') && index === 0 ? 1 : 0,
  }
  return createSilentPixGridAudioFrame({
    audioTime: 12 + index / 60,
    deltaTimeSec: 1 / 60,
    isPlaying: true,
    autoPerformanceEnabled: true,
    sectionType: 'drop',
    sectionPhase: 'body',
    bass: source === 'bass' ? 1 : 0,
    sub: source === 'bass' ? 1 : 0,
    energy: active ? 0.7 : 0,
    trackRelativeEnergy: active ? 0.7 : 0,
    kickHit: source === 'kick' && index === 0,
    snareHit: source === 'snare' && index === 0,
    transientHit: (source === 'kick' || source === 'snare') && index === 0,
    sourceValues,
    eventIdentities: index === 0 && source !== 'quiet' ? { [source]: `${source}-migration-regression` } : {},
    bassReactivityGain: 1,
    motionMultiplier: 0,
  })
}

function renderedHash(preset: ReactPreset, state: PixGridState, source: 'quiet' | 'kick' | 'snare' | 'bass'): number {
  const runtime = new PixGridReactionRuntime()
  let result = composePixGridLogicalFrame(preset, state, sourceFrame(source, 0), undefined, undefined, runtime)
  for (let index = 1; index < 3; index += 1) {
    result = composePixGridLogicalFrame(preset, state, sourceFrame(source, index), undefined, undefined, runtime)
  }
  return pixelHash(result.pixels)
}

function expectSceneReferencesValid(state: PixGridState): void {
  const layerIds = new Set(state.layers.map(layer => layer.id))
  for (const scene of state.scenes) {
    expect(scene.layerIds.length, scene.id).toBeGreaterThan(0)
    expect(scene.layerIds.every(id => layerIds.has(id)), scene.id).toBe(true)
  }
}

describe('PixGrid canonical layer-graph migration', () => {
  it('repairs the persisted legacy Geometric Reactor graph and restores rendered kick, snare, and bass reactions', () => {
    const current = stateForPreset(GEOMETRIC)
    const checker = current.layers.find(layer => layer.id === 'reactor-checker')!
    const tunnel = current.layers.find(layer => layer.id === 'reactor-tunnel')!
    const orbits = current.layers.find(layer => layer.id === 'reactor-orbits')!
    const overlaySource = current.layers.find(layer => layer.id === 'reactor-cross')!
    const legacyBass = layerWithIdentity(checker, 'BASS', 'BASS', { opacity: 0.37, position: { x: 0.48, y: 0.53 } })
    const legacyTunnel = layerWithIdentity(tunnel, 'geometric-tunnel', 'Geometric Tunnel')
    const legacyDots = layerWithIdentity(orbits, 'orbiting-dots', 'Orbiting Dots')
    const customOverlay = layerWithIdentity(overlaySource, 'user-logo-overlay', 'My Imported Logo', {
      mediaId: 'user-imported-logo',
      opacity: 0.73,
      position: { x: 0.61, y: 0.42 },
    })
    const customNameCollision = layerWithIdentity(overlaySource, 'user-tunnel-art', 'Tunnel', { opacity: 0.52 })
    const replacedCanonicalMedia = layerWithIdentity(overlaySource, 'reactor-cross', 'My Replaced Cross', {
      mediaId: 'user-cross-media',
      opacity: 0.66,
    })
    const customGroup: PixGridGroup = {
      ...current.groups[0]!,
      id: 'user-logo-group',
      name: 'User Logo Group',
      layerId: customOverlay.id,
      layerScope: [customOverlay.id],
      reactions: [],
    }
    const legacy = legacyBuiltInState(GEOMETRIC, [legacyBass, legacyTunnel, legacyDots, customOverlay, customNameCollision, replacedCanonicalMedia], {
      userCustomized: true,
      customGroups: [customGroup],
      sceneLayerIds: [legacyBass.id, legacyTunnel.id, legacyDots.id, customOverlay.id, customNameCollision.id, replacedCanonicalMedia.id],
    })

    const migrated = migratePixGridState(legacy, GEOMETRIC)

    expectCanonicalGraph(migrated, GEOMETRIC)
    expectCanonicalTargetsUsable(migrated, GEOMETRIC)
    expectSceneReferencesValid(migrated)
    expect(migrated.layers.find(layer => layer.id === 'reactor-checker')).toMatchObject({ opacity: 0.37, position: { x: 0.48, y: 0.53 } })
    expect(migrated.layers.find(layer => layer.id === customOverlay.id)).toMatchObject({ mediaId: 'user-imported-logo', opacity: 0.73 })
    expect(migrated.layers.find(layer => layer.id === customNameCollision.id)).toMatchObject({ name: 'Tunnel', opacity: 0.52 })
    expect(migrated.layers.find(layer => layer.id === 'reactor-cross')).toMatchObject({ mediaId: null })
    expect(migrated.layers.find(layer => layer.id === 'reactor-cross-user-overlay')).toMatchObject({ mediaId: 'user-cross-media', opacity: 0.66 })
    expect(migrated.groups.some(group => group.id === customGroup.id && group.layerScope?.includes(customOverlay.id))).toBe(true)
    expect(migrated.configuration.lastMigration).toMatchObject({
      detectedPresetLineage: 'legacy-built-in-custom-overlays',
      migrationCompleted: true,
      safeRecoveryUsed: false,
      effectiveLiveRouteCount: expect.any(Number),
    })
    expect(migrated.configuration.lastMigration?.legacyLayersMapped).toEqual(expect.arrayContaining([
      'BASS->reactor-checker',
      'geometric-tunnel->reactor-tunnel',
      'orbiting-dots->reactor-orbits',
    ]))
    expect(migrated.configuration.lastMigration?.legacyLayersPreservedAsOverlays).toContain(customOverlay.id)
    expect(migrated.configuration.lastMigration?.effectiveLiveRouteCount ?? 0).toBeGreaterThan(0)

    const quiet = renderedHash(GEOMETRIC, migrated, 'quiet')
    expect(renderedHash(GEOMETRIC, migrated, 'kick')).not.toBe(quiet)
    expect(renderedHash(GEOMETRIC, migrated, 'snare')).not.toBe(quiet)
    expect(renderedHash(GEOMETRIC, migrated, 'bass')).not.toBe(quiet)
    expect(migratePixGridState(migrated, GEOMETRIC)).toEqual(migrated)
  })

  it('restores a legacy Bass Beacon graph while preserving minor typography adjustments', () => {
    const current = stateForPreset(BASS_BEACON)
    const legacyWord = layerWithIdentity(current.layers.find(layer => layer.id === 'bass-word')!, 'bass', 'BASS', { opacity: 0.61 })
    const legacyRings = layerWithIdentity(current.layers.find(layer => layer.id === 'bass-rings')!, 'concentric-rings', 'Concentric Rings')
    const legacyOutline = layerWithIdentity(current.layers.find(layer => layer.id === 'bass-outline')!, 'bass-border', 'Bass Outline')
    const migrated = migratePixGridState(legacyBuiltInState(BASS_BEACON, [legacyWord, legacyRings, legacyOutline], {
      userCustomized: true,
      sceneLayerIds: [legacyWord.id, legacyRings.id, legacyOutline.id],
    }), BASS_BEACON)

    expectCanonicalGraph(migrated, BASS_BEACON)
    expectCanonicalTargetsUsable(migrated, BASS_BEACON)
    expect(migrated.layers.find(layer => layer.id === 'bass-word')?.opacity).toBe(0.61)
    expectSceneReferencesValid(migrated)
  })

  it('restores legacy Pixel Parade frame and chase content with working canonical routes', () => {
    const current = stateForPreset(PIXEL_PARADE)
    const legacyPal = layerWithIdentity(current.layers.find(layer => layer.id === 'parade-pal')!, 'pixel-pal', 'Pixel Pal')
    const legacyEq = layerWithIdentity(current.layers.find(layer => layer.id === 'parade-eq')!, 'equalizer-bars', 'Equalizer Bars')
    const legacyOrbit = layerWithIdentity(current.layers.find(layer => layer.id === 'parade-orbit')!, 'orbiting-dots', 'Orbiting Dots')
    const migrated = migratePixGridState(legacyBuiltInState(PIXEL_PARADE, [legacyPal, legacyEq, legacyOrbit], {
      sceneLayerIds: [legacyPal.id, legacyEq.id, legacyOrbit.id],
    }), PIXEL_PARADE)

    expectCanonicalGraph(migrated, PIXEL_PARADE)
    expectCanonicalTargetsUsable(migrated, PIXEL_PARADE)
    expectSceneReferencesValid(migrated)
    expect(renderedHash(PIXEL_PARADE, migrated, 'kick')).not.toBe(renderedHash(PIXEL_PARADE, migrated, 'quiet'))
  })

  it('does not replace a genuine fully custom graph with a built-in preset', () => {
    const source = stateForPreset(BASS_BEACON)
    const customLayer = layerWithIdentity(source.layers[0]!, 'custom-only-layer', 'Custom Only Layer', {
      mediaId: 'custom-media',
      opacity: 0.44,
    })
    const raw = {
      ...source,
      version: PIX_GRID_STATE_VERSION - 2,
      selectedPresetId: null,
      selectedSceneId: 'custom-scene',
      layers: [customLayer],
      scenes: [{ id: 'custom-scene', name: 'Custom Scene', layerIds: [customLayer.id], pixelOverrides: [] }],
      groups: [],
      audioAssignments: [],
      performance: { ...source.performance, enabled: false, sharedPerformanceProgramId: null },
      configuration: {
        ...source.configuration,
        origin: 'custom',
        sourcePresetId: null,
        userCustomized: true,
        canonicalMigrationCompleted: false,
        canonicalSignatures: createEmptyPixGridCanonicalSignatures(),
      },
    }

    const migrated = migratePixGridState(raw, null)
    expect(migrated.configuration.origin).toBe('custom')
    expect(migrated.selectedPresetId).toBeNull()
    expect(migrated.layers).toHaveLength(1)
    expect(migrated.layers[0]).toMatchObject({ id: customLayer.id, mediaId: 'custom-media', opacity: 0.44 })
    expect(migrated.layers.some(layer => layer.id.startsWith('bass-'))).toBe(false)
  })

  it('repairs broken canonical group references and rejects invisible enabled routes as usable', () => {
    const current = stateForPreset(GEOMETRIC)
    const broken = normalizePixGridState({
      ...current,
      configuration: { ...current.configuration, layerGraphVersion: 0, canonicalMigrationCompleted: false },
      groups: current.groups.map((group, index) => index === 0
        ? { ...group, layerId: 'missing-layer', layerScope: ['missing-layer'] }
        : group),
    })
    const repaired = migratePixGridState(broken, GEOMETRIC)
    expect(inspectPixGridGroupTarget(repaired, repaired.groups[0]!).usable).toBe(true)
    expect(repaired.configuration.lastMigration?.groupsRepaired).toContain(repaired.groups[0]!.id)

    const invisible = normalizePixGridState({
      ...current,
      layers: current.layers.map(layer => ({ ...layer, visible: false })),
    })
    const group = invisible.groups.find(candidate => candidate.reactions.length > 0)!
    const route = group.reactions[0]!
    expect(inspectPixGridGroupTarget(invisible, group).status).toBe('invisible-content')
    expect(isPixGridAudioAssignmentEffective(invisible, route, group.id)).toBe(false)
    expect(ensurePixGridRuntimeAudioRoutes({ ...invisible, audioAssignments: [] }).fallbackActive).toBe(true)
    expect(validatePixGridState(invisible, { builtInPresetId: GEOMETRIC.id }).issues.some(issue => issue.code === 'ineffective-assignment-target')).toBe(true)
  })


})
