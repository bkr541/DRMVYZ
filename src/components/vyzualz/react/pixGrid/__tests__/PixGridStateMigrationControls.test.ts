import { describe, expect, it } from 'vitest'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { createSilentPixGridAudioFrame, PixGridReactionRuntime } from '../PixGridAudioRouting'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createPixGridCanonicalSignatures } from '../PixGridConfiguration'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { applyPixGridRuntimeControls } from '../PixGridRuntimeControls'
import { PIX_GRID_AUTHORED_PRESET_CONFIGURATION_VERSION, PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import {
  ensurePixGridRuntimeAudioRoutes,
  migratePixGridState,
} from '../PixGridStateMigration'
import {
  PIX_GRID_CONFIGURATION_METADATA_VERSION,
  PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
  PIX_GRID_STATE_VERSION,
  type PixGridLayer,
  type PixGridReactionAssignment,
  type PixGridState,
} from '../PixGridTypes'
import { normalizePixGridReactionAssignment, normalizePixGridState } from '../PixGridValidation'

const PRESET_ID = 'pix-grid-bass-beacon'
const PRESET = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!

function stateForPreset(): PixGridState {
  return applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, PRESET.pixGridSettings)
}

function pixelEnergy(pixels: Uint8Array): number {
  let total = 0
  for (let offset = 0; offset < pixels.length; offset += 4) {
    total += pixels[offset] + pixels[offset + 1] + pixels[offset + 2]
  }
  return total
}

function assignmentKeys(state: PixGridState): string[] {
  return [
    ...state.audioAssignments.map(route => `audio:${route.id}`),
    ...state.groups.flatMap(group => group.reactions.map(route => `group:${group.id}:${route.id}`)),
  ]
}

function controlledBassFrame(gain: number) {
  return applyPixGridRuntimeControls(createSilentPixGridAudioFrame({
    audioTime: 12,
    isPlaying: true,
    deltaTimeSec: 1,
    bass: 1,
    sub: 1,
    lowMid: 1,
    bassStemActivity: 1,
    sourceValues: { bass: 1, sub: 1, lowMid: 1, bassStemActivity: 1, kick: 0, energy: 0 },
  }), { bassReactivity: gain, motion: 1 })
}

describe('PixGrid state migration', () => {
  it('restores current built-in music routing even when legacy artwork is nonempty and remains idempotent', () => {
    const authored = stateForPreset()
    const legacy = {
      ...authored,
      version: PIX_GRID_STATE_VERSION - 1,
      configuration: undefined,
      layers: authored.layers.map(layer => ({ ...layer, position: { ...layer.position }, scale: { ...layer.scale } })),
      groups: [],
      audioAssignments: [],
      performance: {
        ...authored.performance,
        sharedPerformanceProgramId: null,
      },
    }

    const migrated = migratePixGridState(legacy, PRESET)
    expect(migrated.layers).toEqual(normalizePixGridState(legacy).layers)
    expect(migrated.groups.map(group => group.id)).toEqual(PRESET.pixGridSettings!.groups!.map(group => group.id))
    expect(migrated.audioAssignments.map(route => route.id)).toEqual(PRESET.pixGridSettings!.audioAssignments!.map(route => route.id))
    expect(migrated.performance.sharedPerformanceProgramId).toBe(PRESET.pixGridSettings!.performanceProgramId)
    expect(migrated.configuration).toMatchObject({
      origin: 'builtInPreset',
      sourcePresetId: PRESET_ID,
      presetConfigurationVersion: PIX_GRID_AUTHORED_PRESET_CONFIGURATION_VERSION,
      musicReactiveConfigurationVersion: PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
    })
    expect(migrated.configuration.lastMigration).toMatchObject({
      applied: true,
      originalBuiltInPresetId: PRESET_ID,
      programsUpgraded: 1,
      customizationsPreserved: false,
      fallbackRoutingInstalled: false,
    })

    const repeated = migratePixGridState(migrated, PRESET)
    expect(repeated).toEqual(migrated)
    expect(new Set(repeated.groups.map(group => group.id)).size).toBe(repeated.groups.length)
    expect(new Set(assignmentKeys(repeated)).size).toBe(assignmentKeys(repeated).length)
  })

  it('preserves customized artwork, custom groups, and edited routes while adding missing canonical infrastructure', () => {
    const authored = stateForPreset()
    const canonicalRoutes = authored.audioAssignments
    expect(canonicalRoutes.length).toBeGreaterThan(1)
    const editedRoute = { ...canonicalRoutes[0]!, amount: canonicalRoutes[0]!.amount * 0.37, name: 'My edited route' }
    const missingRoute = canonicalRoutes[1]!
    const customGroup = {
      ...authored.groups[0]!,
      id: 'user-custom-group',
      name: 'User Custom Group',
      reactions: [],
    }
    const customized: PixGridState = normalizePixGridState({
      ...authored,
      configuration: {
        ...authored.configuration,
        presetConfigurationVersion: PIX_GRID_AUTHORED_PRESET_CONFIGURATION_VERSION - 1,
        musicReactiveConfigurationVersion: 0,
        userCustomized: true,
      },
      layers: authored.layers.map((layer, index) => index === 0
        ? {
            ...layer,
            name: 'My Hero Artwork',
            opacity: 0.43,
            position: { x: 0.27, y: 0.64 },
            animations: layer.animations.map(animation => ({ ...animation, speed: animation.speed * 0.41 })),
          }
        : layer),
      scenes: authored.scenes.map((scene, index) => index === 0
        ? { ...scene, pixelOverrides: [[2, 3, 1, '#abcdef', 0.8]] }
        : scene),
      groups: [...authored.groups, customGroup],
      audioAssignments: [editedRoute, ...canonicalRoutes.slice(2)],
    })

    const migrated = migratePixGridState(customized, PRESET)
    expect(migrated.layers[0]).toMatchObject({ name: 'My Hero Artwork', opacity: 0.43, position: { x: 0.27, y: 0.64 } })
    expect(migrated.layers[0]!.animations).toEqual(customized.layers[0]!.animations)
    expect(migrated.scenes[0]!.pixelOverrides).toEqual([[2, 3, 1, '#abcdef', 0.8]])
    expect(migrated.groups.some(group => group.id === customGroup.id)).toBe(true)
    expect(migrated.audioAssignments.find(route => route.id === editedRoute.id)).toMatchObject({ amount: editedRoute.amount, name: editedRoute.name })
    expect(migrated.audioAssignments.some(route => route.id === missingRoute.id)).toBe(true)
    expect(migrated.configuration.userCustomized).toBe(true)
    expect(migrated.configuration.lastMigration).toMatchObject({
      applied: true,
      originalBuiltInPresetId: PRESET_ID,
      customizationsPreserved: true,
      fallbackRoutingInstalled: false,
    })
    expect(new Set(migrated.groups.map(group => group.id)).size).toBe(migrated.groups.length)
    expect(new Set(assignmentKeys(migrated)).size).toBe(assignmentKeys(migrated).length)
  })

  it('upgrades canonical animation metadata for an untouched older built-in configuration without replacing visual edits', () => {
    const authored = stateForPreset()
    const firstLayer = authored.layers[0]!
    const olderLayers = authored.layers.map((layer, index) => index === 0
      ? {
          ...layer,
          name: 'Preserved Layer Name',
          opacity: 0.31,
          position: { x: 0.19, y: 0.71 },
          animations: [{ ...layer.animations[0]!, speed: 0.01, amount: 0.001 }],
          densityRank: 0.99,
          seed: 9999,
        }
      : layer)
    const olderUntouched = normalizePixGridState({
      ...authored,
      configuration: {
        ...authored.configuration,
        presetConfigurationVersion: PIX_GRID_AUTHORED_PRESET_CONFIGURATION_VERSION - 1,
        musicReactiveConfigurationVersion: 0,
        userCustomized: false,
        canonicalSignatures: createPixGridCanonicalSignatures({
          ...PRESET.pixGridSettings!,
          layers: olderLayers,
        }),
      },
      layers: olderLayers,
    })

    const migrated = migratePixGridState(olderUntouched, PRESET)
    expect(migrated.layers[0]).toMatchObject({
      name: 'Preserved Layer Name',
      opacity: 0.31,
      position: { x: 0.19, y: 0.71 },
      densityRank: firstLayer.densityRank,
      seed: firstLayer.seed,
    })
    expect(migrated.layers[0]!.animations).toEqual(firstLayer.animations)
  })
})

describe('PixGrid live global controls', () => {
  it('scales bass-driven route input materially and monotonically without changing non-bass sources', () => {
    const assignment = normalizePixGridReactionAssignment({
      id: 'bass-gain-test',
      name: 'Bass gain test',
      source: 'bass',
      target: 'brightness',
      targetScope: 'output',
      amount: 1,
      threshold: 0,
      attack: 0,
      release: 0,
      smoothing: 0,
      inputRange: [0, 1],
      outputRange: [0, 1],
      clamp: [0, 1],
    }, 0, 'output') as PixGridReactionAssignment

    const values = [0, 0.5, 1].map(gain => new PixGridReactionRuntime().resolve(assignment, controlledBassFrame(gain)).value)
    expect(values[0]).toBeCloseTo(0, 5)
    expect(values[1]).toBeGreaterThan(values[0]!)
    expect(values[2]).toBeGreaterThan(values[1]!)
    expect(values[1]).toBeCloseTo(0.5, 2)
    expect(values[2]).toBeCloseTo(1, 2)

    const snareFrame = applyPixGridRuntimeControls(createSilentPixGridAudioFrame({
      kickHit: true,
      snareHit: true,
      sourceValues: { kick: 1, snare: 1 },
    }), { bassReactivity: 0, motion: 1 })
    expect(snareFrame.sourceValues?.kick).toBe(0)
    expect(snareFrame.kickHit).toBe(false)
    expect(snareFrame.sourceValues?.snare).toBe(1)
    expect(snareFrame.snareHit).toBe(true)
  })

  it('scales autonomous animation speed while keeping audio one-shots functional and seek output deterministic', () => {
    const base = stateForPreset().layers[0]!
    const asset = PIX_GRID_BUILT_IN_ASSET_BY_ID.get(base.assetId)!
    const movingLayer: PixGridLayer = {
      ...base,
      position: { x: 0.2, y: 0.5 },
      animations: [{ mode: 'horizontalScroll', clock: 'time', speed: 1, amount: 0.4, phase: 0, boundary: 'wrap' }],
    }
    const frame = createSilentPixGridAudioFrame({ audioTime: 0.25, isPlaying: true })
    const stopped = resolvePixGridLayerAnimation(movingLayer, asset, applyPixGridRuntimeControls(frame, { bassReactivity: 1, motion: 0 }))
    const half = resolvePixGridLayerAnimation(movingLayer, asset, applyPixGridRuntimeControls(frame, { bassReactivity: 1, motion: 0.5 }))
    const full = resolvePixGridLayerAnimation(movingLayer, asset, applyPixGridRuntimeControls(frame, { bassReactivity: 1, motion: 1 }))
    expect(stopped.positionX).toBeCloseTo(movingLayer.position.x, 6)
    expect(half.positionX).toBeGreaterThan(stopped.positionX)
    expect(full.positionX).toBeGreaterThan(half.positionX)

    const oneShotLayer: PixGridLayer = {
      ...movingLayer,
      animations: [{ mode: 'audioAmplitudeScale', speed: 1, amount: 0.5, phase: 0, boundary: 'clamp', audioSource: 'bass' }],
    }
    const oneShot = resolvePixGridLayerAnimation(
      oneShotLayer,
      asset,
      applyPixGridRuntimeControls(createSilentPixGridAudioFrame({ bass: 1 }), { bassReactivity: 1, motion: 0 }),
    )
    expect(oneShot.scaleX).toBeGreaterThan(oneShotLayer.scale.x)

    const seekFrame = applyPixGridRuntimeControls(createSilentPixGridAudioFrame({ audioTime: 42.25, timingDiscontinuity: true, isPlaying: true }), { bassReactivity: 1, motion: 0.5 })
    expect(resolvePixGridLayerAnimation(movingLayer, asset, seekFrame)).toEqual(resolvePixGridLayerAnimation(movingLayer, asset, seekFrame))
    const earlierFrame = applyPixGridRuntimeControls(createSilentPixGridAudioFrame({ audioTime: 12.25, timingDiscontinuity: true, isPlaying: true }), { bassReactivity: 1, motion: 0.5 })
    const earlierA = resolvePixGridLayerAnimation(movingLayer, asset, earlierFrame)
    resolvePixGridLayerAnimation(movingLayer, asset, seekFrame)
    expect(resolvePixGridLayerAnimation(movingLayer, asset, earlierFrame)).toEqual(earlierA)
  })
})

describe('PixGrid empty custom routing fallback', () => {
  it('changes rendered pixels without replacing user visuals or persisting duplicate fallback routes', () => {
    const builtIn = stateForPreset()
    const custom = normalizePixGridState({
      ...builtIn,
      selectedPresetId: null,
      configuration: {
        metadataVersion: PIX_GRID_CONFIGURATION_METADATA_VERSION,
        origin: 'custom',
        sourcePresetId: null,
        presetConfigurationVersion: 0,
        musicReactiveConfigurationVersion: PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
        userCustomized: true,
        lastMigration: null,
      },
      layers: [{ ...builtIn.layers[0]!, name: 'User Artwork', animations: [] }],
      scenes: [{ id: 'custom-scene', name: 'Custom Scene', layerIds: [builtIn.layers[0]!.id], pixelOverrides: [] }],
      selectedSceneId: 'custom-scene',
      groups: [],
      audioAssignments: [],
      performance: { ...builtIn.performance, enabled: false, sharedPerformanceProgramId: null },
    })
    const fallback = ensurePixGridRuntimeAudioRoutes(custom)
    expect(fallback.fallbackActive).toBe(true)
    expect(fallback.state.layers).toEqual(custom.layers)
    expect(fallback.state.audioAssignments.length).toBeGreaterThan(0)

    const quiet = composePixGridLogicalFrame(
      PRESET,
      fallback.state,
      controlledBassFrame(0),
      undefined,
      undefined,
      new PixGridReactionRuntime(),
    )
    const active = composePixGridLogicalFrame(
      PRESET,
      fallback.state,
      controlledBassFrame(1),
      undefined,
      undefined,
      new PixGridReactionRuntime(),
    )
    expect(pixelEnergy(active.pixels)).not.toBe(pixelEnergy(quiet.pixels))

    const repeated = ensurePixGridRuntimeAudioRoutes(fallback.state)
    expect(repeated.state.audioAssignments.map(route => route.id)).toEqual(fallback.state.audioAssignments.map(route => route.id))
    expect(new Set(repeated.state.audioAssignments.map(route => route.id)).size).toBe(repeated.state.audioAssignments.length)
  })
})
