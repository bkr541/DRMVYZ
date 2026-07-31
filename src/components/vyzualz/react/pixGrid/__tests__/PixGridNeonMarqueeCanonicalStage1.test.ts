import { describe, expect, it } from 'vitest'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID, samplePixGridBuiltInAsset } from '../PixGridArtwork'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import {
  getPixGridNeonMarqueeFrames,
  PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT,
  PIX_GRID_NEON_MARQUEE_FRAME_ORDER,
  PIX_GRID_NEON_MARQUEE_FRAME_WIDTH,
} from '../PixGridNeonMarqueeFrames'
import {
  PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS,
  PIX_GRID_NEON_MARQUEE_COMPONENT_IDS,
  pixGridNeonMarqueeComponentContainsCell,
  samplePixGridNeonMarqueeComponent,
  type PixGridNeonMarqueeComponentId,
} from '../PixGridNeonMarqueeMasks'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import {
  PIX_GRID_FOLLOW_TRACK_SCENE_VALUE,
  applyPixGridSelectedScenePreviewFrame,
  resolvePixGridPreviewState,
  selectPixGridEditingTarget,
  selectPixGridPreviewScene,
} from '../PixGridScenePreview'
import { applyPixGridPresetSettings } from '../PixGridState'
import { migratePixGridState } from '../PixGridStateMigration'
import type { PixGridAudioFrame, PixGridLayer, PixGridState } from '../PixGridTypes'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const PRESET = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
const SETTINGS = PRESET.pixGridSettings!

const REQUIRED_LAYER_IDS = [
  'marquee-structure',
  'marquee-bulbs-a',
  'marquee-bulbs-b',
  'marquee-bulbs-c',
  'marquee-bulbs-d',
  'marquee-letter-lights-a',
  'marquee-letter-lights-b',
  'marquee-letter-lights-c',
  'marquee-equalizer-lights',
  'marquee-trim-lights',
  'marquee-focal-lights',
  'marquee-sparkle-lights',
] as const

const REQUIRED_GROUP_IDS = [
  'marquee-structure-group',
  'marquee-perimeter-group',
  'marquee-bulb-a-group',
  'marquee-bulb-b-group',
  'marquee-bulb-c-group',
  'marquee-bulb-d-group',
  'marquee-letter-group',
  'marquee-letter-travel-group',
  'marquee-equalizer-group',
  'marquee-trim-group',
  'marquee-focal-group',
  'marquee-sparkle-group',
  'marquee-transition-group',
  'marquee-impact-group',
] as const

const COMPONENT_ASSET_IDS: Readonly<Record<PixGridNeonMarqueeComponentId, PixGridLayer['assetId']>> = {
  structure: 'pix-neon-marquee-structure',
  'bulbs-a': 'pix-neon-marquee-bulbs-a',
  'bulbs-b': 'pix-neon-marquee-bulbs-b',
  'bulbs-c': 'pix-neon-marquee-bulbs-c',
  'bulbs-d': 'pix-neon-marquee-bulbs-d',
  'letter-a': 'pix-neon-marquee-letter-lights-a',
  'letter-b': 'pix-neon-marquee-letter-lights-b',
  'letter-c': 'pix-neon-marquee-letter-lights-c',
  equalizer: 'pix-neon-marquee-equalizer-lights',
  trim: 'pix-neon-marquee-trim-lights',
  focal: 'pix-neon-marquee-focal-lights',
  sparkle: 'pix-neon-marquee-sparkle-lights',
}

function currentState(): PixGridState {
  return applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, SETTINGS)
}


function visibleLayerIdsFor(sceneId: string): string[] {
  const scene = SETTINGS.sceneSettings![sceneId]
  const hidden = new Set(scene.hiddenLayerIds ?? [])
  return SETTINGS.layers!
    .filter(layer => layer.visible && layer.densityRank <= scene.density && !hidden.has(layer.id))
    .map(layer => layer.id)
}

function previewFrame(overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  return {
    audioTime: 12,
    bass: 0,
    mid: 0,
    high: 0,
    volume: 0,
    beatHit: false,
    beatPhase: 0.5,
    isPlaying: true,
    beatIndex: 10,
    barIndex: 2,
    motionClockBar: 2.625,
    sectionType: 'verse',
    sectionProgress: 0.8,
    ...overrides,
  }
}

function legacyMarqueeState(): PixGridState {
  const state = currentState()
  const structure = state.layers.find(layer => layer.id === 'marquee-structure')!
  const oldOfficial: PixGridLayer = {
    ...structure,
    id: 'neon-marquee-frame',
    name: 'Neon Marquee Frame',
    assetId: 'pix-neon-marquee-cycle',
    animations: structure.animations.map(animation => ({ ...animation })),
  }
  const customOverlay: PixGridLayer = {
    ...structure,
    id: 'user-star-overlay',
    name: 'User Star Overlay',
    assetId: 'pix-five-point-star',
    mediaId: 'media-user-star',
    position: { x: 0.2, y: 0.25 },
    scale: { x: 0.15, y: 0.2 },
    zIndex: 30,
    seed: 9876,
    animations: [],
  }
  return {
    ...state,
    version: state.version,
    qualityMode: 'fixed',
    backgroundMode: 'custom',
    backgroundColor: '#010203',
    backgroundBrightness: 0.42,
    cellGap: 0.23,
    glowAmount: 0.51,
    configuration: {
      ...state.configuration,
      presetConfigurationVersion: 12,
      layerGraphVersion: 2,
      smartGroupConfigurationVersion: 2,
      canonicalMigrationCompleted: false,
      userCustomized: true,
    },
    layers: [oldOfficial, customOverlay],
    groups: [],
    scenes: state.scenes.map(scene => ({ ...scene, layerIds: ['neon-marquee-frame', 'user-star-overlay'] })),
    editor: { ...state.editor, selectedLayerId: 'neon-marquee-frame' },
    performance: { ...state.performance, enabled: true, intensity: 0.73, seed: 4242 },
    audioAssignments: state.audioAssignments.map(assignment => ({
      ...assignment,
      targetId: assignment.targetScope === 'layer' ? 'neon-marquee-frame' : assignment.targetId,
    })),
  }
}

describe('Marquee Sign Cycle canonical component graph', () => {
  it('registers every native component layer and Smart Group exactly once', () => {
    const layerIds = SETTINGS.layers!.map(layer => layer.id)
    const groupIds = SETTINGS.groups!.map(group => group.id)

    expect(layerIds).toHaveLength(12)
    for (const id of REQUIRED_LAYER_IDS) expect(layerIds.filter(candidate => candidate === id)).toHaveLength(1)
    for (const id of REQUIRED_GROUP_IDS) expect(groupIds.filter(candidate => candidate === id)).toHaveLength(1)
    expect(layerIds).not.toContain('neon-marquee-frame')

    for (const group of SETTINGS.groups!) {
      expect(group.layerScope?.length ?? 0).toBeGreaterThan(0)
      expect(group.mask.kind).toBe('layerAlpha')
      expect(group.layerScope).not.toContain('neon-marquee-frame')
      expect(group.layerScope?.every(id => REQUIRED_LAYER_IDS.includes(id as typeof REQUIRED_LAYER_IDS[number]))).toBe(true)
    }
  })

  it('uses ordinary generic animation descriptors while keeping every component on one large-boundary sign identity', () => {
    const animationSource = resolvePixGridLayerAnimation.toString().toLowerCase()
    expect(animationSource).not.toContain('marquee')

    const frame = previewFrame({
      motionClockSectionType: 'verse',
      motionClockSectionBeat: 32,
      motionClockSectionBar: 8,
      signClock: 1,
      motionClockSign: 1,
    })
    for (const layer of SETTINGS.layers!) {
      const asset = PIX_GRID_BUILT_IN_ASSET_BY_ID.get(layer.assetId)!
      expect(resolvePixGridLayerAnimation(layer, asset, frame, 1).frameIndex).toBe(1)
    }
    expect(SETTINGS.layers!.find(layer => layer.id === 'marquee-bulbs-a')?.animations.some(animation => animation.mode === 'blink')).toBe(true)
    expect(SETTINGS.layers!.find(layer => layer.id === 'marquee-letter-lights-a')?.animations.some(animation => animation.mode === 'revealColumn')).toBe(true)
    expect(SETTINGS.layers!.find(layer => layer.id === 'marquee-structure')?.animations).toHaveLength(1)
  })
})

describe('Marquee frame-aware semantic masks', () => {
  it('partitions every non-black source cell exactly once and excludes every opaque-black background cell', () => {
    const frames = getPixGridNeonMarqueeFrames()
    for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
      const frame = frames[frameIndex]
      for (let y = 0; y < PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT; y += 1) {
        for (let x = 0; x < PIX_GRID_NEON_MARQUEE_FRAME_WIDTH; x += 1) {
          const offset = (y * PIX_GRID_NEON_MARQUEE_FRAME_WIDTH + x) * 3
          const source = [frame[offset], frame[offset + 1], frame[offset + 2]] as const
          const members = PIX_GRID_NEON_MARQUEE_COMPONENT_IDS.filter(component => (
            pixGridNeonMarqueeComponentContainsCell(component, frameIndex, x, y)
          ))
          const isBlack = source[0] === 0 && source[1] === 0 && source[2] === 0
          expect(members).toHaveLength(isBlack ? 0 : 1)
          if (members[0]) {
            const sample = samplePixGridNeonMarqueeComponent(
              members[0],
              (x + 0.5) / PIX_GRID_NEON_MARQUEE_FRAME_WIDTH,
              (y + 0.5) / PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT,
              frameIndex,
            )
            expect(sample.alpha).toBe(1)
            expect(sample.color).toEqual(source)
          }
        }
      }
    }
  })

  it('keeps component masks deterministic, bounded, and semantically sparse', () => {
    for (let frameIndex = 0; frameIndex < PIX_GRID_NEON_MARQUEE_FRAME_ORDER.length; frameIndex += 1) {
      const frameId = PIX_GRID_NEON_MARQUEE_FRAME_ORDER[frameIndex].id
      for (const component of PIX_GRID_NEON_MARQUEE_COMPONENT_IDS) {
        let counted = 0
        for (let y = 0; y < 90; y += 1) {
          for (let x = 0; x < 160; x += 1) {
            const first = pixGridNeonMarqueeComponentContainsCell(component, frameIndex, x, y)
            const second = pixGridNeonMarqueeComponentContainsCell(component, frameIndex, x, y)
            expect(second).toBe(first)
            if (first) counted += 1
          }
        }
        expect(counted).toBe(PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS[component][frameId])
        expect(pixGridNeonMarqueeComponentContainsCell(component, frameIndex, -1, 0)).toBe(false)
        expect(pixGridNeonMarqueeComponentContainsCell(component, frameIndex, 160, 89)).toBe(false)
      }
    }

    for (const frameId of PIX_GRID_NEON_MARQUEE_FRAME_ORDER.map(frame => frame.id)) {
      expect(PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS.structure[frameId]).toBeGreaterThan(5_000)
      for (const bank of ['bulbs-a', 'bulbs-b', 'bulbs-c', 'bulbs-d'] as const) {
        expect(PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS[bank][frameId]).toBeGreaterThan(250)
        expect(PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS[bank][frameId]).toBeLessThan(450)
      }
    }
    expect(PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS['letter-a'].base).toBeGreaterThan(0)
    expect(PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS['letter-b'].rise).toBeGreaterThan(0)
    expect(PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS['letter-c'].peak).toBeGreaterThan(0)
    expect(
      PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS['letter-a'].rise
      + PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS['letter-b'].rise
      + PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS['letter-c'].rise,
    ).toBeGreaterThan(PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS.trim.rise)
    expect(
      PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS['letter-a'].peak
      + PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS['letter-b'].peak
      + PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS['letter-c'].peak,
    ).toBeGreaterThan(PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS.trim.peak)
    expect(PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS['letter-a'].release).toBe(0)
    expect(PIX_GRID_NEON_MARQUEE_COMPONENT_CELL_COUNTS.focal.release).toBeGreaterThan(300)
    expect(pixGridNeonMarqueeComponentContainsCell('structure', 3, 80, 45)).toBe(true)
    expect(pixGridNeonMarqueeComponentContainsCell('focal', 3, 80, 45)).toBe(false)
  })

  it('registers component assets at the exact native frame geometry', () => {
    for (const [component, assetId] of Object.entries(COMPONENT_ASSET_IDS) as Array<[PixGridNeonMarqueeComponentId, PixGridLayer['assetId']]>) {
      expect(PIX_GRID_BUILT_IN_ASSET_BY_ID.get(assetId)).toMatchObject({
        nativeSize: { width: 160, height: 90 },
        kind: 'frameBased',
        frameCount: 4,
      })
      const expected = samplePixGridNeonMarqueeComponent(component, 0.5, 0.5, 0)
      expect(samplePixGridBuiltInAsset(assetId, 0.5, 0.5, 0)).toEqual(expected)
    }
  })
})

describe('Marquee authored scenes and Editing Context ownership', () => {
  it('stores seven materially distinct scene configurations', () => {
    const settings = SETTINGS.sceneSettings!
    const sceneIds = ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'outro']
      .map(section => `${PRESET_ID}-${section}`)
    expect(Object.keys(settings).sort()).toEqual([...sceneIds].sort())
    expect(new Set(sceneIds.map(id => JSON.stringify(settings[id]))).size).toBe(7)

    const intro = settings[`${PRESET_ID}-intro`]
    const build = settings[`${PRESET_ID}-build`]
    const preDrop = settings[`${PRESET_ID}-preDrop`]
    const drop = settings[`${PRESET_ID}-drop`]
    const outro = settings[`${PRESET_ID}-outro`]
    expect(intro.hiddenLayerIds).toContain('marquee-equalizer-lights')
    expect(drop.hiddenLayerIds ?? []).toHaveLength(0)
    expect([intro, build, preDrop, drop, outro].every(scene => scene.motionMultiplier === 1)).toBe(true)
    const structureAnimation = SETTINGS.layers!.find(layer => layer.id === 'marquee-structure')!.animations[0]
    expect(structureAnimation.sectionSpeeds?.drop).toBeGreaterThan(structureAnimation.sectionSpeeds?.verse ?? 0)
    expect(structureAnimation.sectionSpeeds?.preDrop).toBe(0)
    expect(structureAnimation.sectionSpeeds?.outro).toBe(0)
    expect(preDrop.hiddenLayerIds!.length).toBeGreaterThan(build.hiddenLayerIds?.length ?? 0)
    expect(outro.hiddenLayerIds).toContain('marquee-trim-lights')

    expect(visibleLayerIdsFor(`${PRESET_ID}-intro`)).toEqual([
      'marquee-structure',
      'marquee-bulbs-a',
      'marquee-bulbs-b',
      'marquee-letter-lights-a',
      'marquee-trim-lights',
      'marquee-focal-lights',
    ])
    expect(visibleLayerIdsFor(`${PRESET_ID}-preDrop`)).toEqual([
      'marquee-structure',
      'marquee-bulbs-a',
      'marquee-letter-lights-b',
      'marquee-focal-lights',
    ])
    expect(visibleLayerIdsFor(`${PRESET_ID}-drop`)).toEqual([...REQUIRED_LAYER_IDS])
    expect(visibleLayerIdsFor(`${PRESET_ID}-outro`)).toEqual([
      'marquee-structure',
      'marquee-bulbs-a',
      'marquee-bulbs-b',
      'marquee-letter-lights-a',
    ])
  })

  it('honors Follow Track and Selected Scene ownership without overwriting manual choice', () => {
    const initial = currentState()
    const dropId = `${PRESET_ID}-drop`
    const introId = `${PRESET_ID}-intro`

    const followTrack = selectPixGridPreviewScene(initial, PIX_GRID_FOLLOW_TRACK_SCENE_VALUE)
    expect(resolvePixGridPreviewState(followTrack, dropId).selectedSceneId).toBe(dropId)

    const selectedDrop = selectPixGridPreviewScene(followTrack, dropId)
    expect(selectedDrop.editor.scenePreviewMode).toBe('selectedScene')
    expect(resolvePixGridPreviewState(selectedDrop, introId).selectedSceneId).toBe(dropId)
    expect(applyPixGridSelectedScenePreviewFrame(previewFrame(), selectedDrop)).toMatchObject({
      sectionType: 'drop',
      motionClockSectionType: 'drop',
      inputSource: 'editor-preview',
    })

    const selectedIntro = selectPixGridPreviewScene(selectedDrop, introId)
    expect(selectedIntro.selectedSceneId).toBe(introId)
    expect(applyPixGridSelectedScenePreviewFrame(previewFrame(), selectedIntro).sectionType).toBe('intro')

    const renderFrame = previewFrame({ autoPerformanceEnabled: false, motionClockBeat: 0 })
    const introPixels = composePixGridLogicalFrame(PRESET, selectedIntro, renderFrame).pixels
    const dropPixels = composePixGridLogicalFrame(PRESET, selectedDrop, renderFrame).pixels
    expect(dropPixels).not.toEqual(introPixels)
    expect(composePixGridLogicalFrame(PRESET, selectedIntro, renderFrame).pixels).toEqual(introPixels)
  })

  it('switches between semantic layer editing and Scene Pixels state', () => {
    const state = currentState()
    const focal = selectPixGridEditingTarget(state, 'marquee-focal-lights')
    expect(focal.editor.selectedLayerId).toBe('marquee-focal-lights')
    expect(focal.layers.find(layer => layer.id === focal.editor.selectedLayerId)?.name).toBe('Frenchie and Focal Lights')
    expect(selectPixGridEditingTarget(focal, null).editor.selectedLayerId).toBeNull()
  })
})

describe('Marquee legacy one-layer saved-state migration', () => {
  it('replaces the obsolete official layer, repairs scenes and routes, and preserves custom overlays and controls', () => {
    const legacy = legacyMarqueeState()
    const migrated = migratePixGridState(legacy, PRESET)

    expect(migrated.layers.filter(layer => layer.id === 'neon-marquee-frame')).toHaveLength(0)
    for (const id of REQUIRED_LAYER_IDS) expect(migrated.layers.filter(layer => layer.id === id)).toHaveLength(1)
    for (const id of REQUIRED_GROUP_IDS) expect(migrated.groups.filter(group => group.id === id)).toHaveLength(1)
    expect(migrated.layers.find(layer => layer.id === 'user-star-overlay')).toMatchObject({
      name: 'User Star Overlay',
      assetId: 'pix-five-point-star',
      mediaId: 'media-user-star',
      seed: 9876,
    })
    expect(migrated.scenes.every(scene => REQUIRED_LAYER_IDS.every(id => scene.layerIds.includes(id)))).toBe(true)
    expect(migrated.scenes.every(scene => scene.layerIds.includes('user-star-overlay'))).toBe(true)
    expect(migrated.audioAssignments.filter(route => route.targetScope === 'layer').every(route => route.targetId === 'marquee-structure')).toBe(true)
    expect(migrated.editor.selectedLayerId).toBe('marquee-structure')
    expect(migrated.performance).toMatchObject({ enabled: true, intensity: 0.73, seed: 4242 })
    expect(migrated).toMatchObject({
      qualityMode: 'fixed',
      backgroundMode: 'custom',
      backgroundColor: '#010203',
      backgroundBrightness: 0.42,
      cellGap: 0.23,
      glowAmount: 0.51,
    })
    expect(migrated.configuration.lastMigration).toMatchObject({
      applied: true,
      legacyLayersMapped: ['neon-marquee-frame->marquee-structure'],
      obsoleteOfficialLayersRemoved: ['neon-marquee-frame'],
      migrationCompleted: true,
    })
  })

  it('preserves the former maximum custom-overlay payload without truncation', () => {
    const legacy = legacyMarqueeState()
    const template = legacy.layers.find(layer => layer.id === 'user-star-overlay')!
    const additionalOverlays = Array.from({ length: 10 }, (_, index): PixGridLayer => ({
      ...template,
      id: `user-overlay-${index + 2}`,
      name: `User Overlay ${index + 2}`,
      mediaId: `media-user-overlay-${index + 2}`,
      position: { x: 0.1 + index * 0.03, y: 0.2 + index * 0.02 },
      zIndex: 31 + index,
      seed: 9900 + index,
      animations: [],
    }))
    const customIds = [template.id, ...additionalOverlays.map(layer => layer.id)]
    const maximumLegacy = {
      ...legacy,
      layers: [legacy.layers[0], template, ...additionalOverlays],
      scenes: legacy.scenes.map(scene => ({ ...scene, layerIds: ['neon-marquee-frame', ...customIds] })),
    }

    const migrated = migratePixGridState(maximumLegacy, PRESET)
    expect(migrated.layers).toHaveLength(REQUIRED_LAYER_IDS.length + customIds.length)
    expect(customIds.every(id => migrated.layers.some(layer => layer.id === id))).toBe(true)
    expect(migrated.scenes.every(scene => customIds.every(id => scene.layerIds.includes(id)))).toBe(true)
  })

  it('is idempotent and does not alter current canonical graphs for other built-in presets', () => {
    const once = migratePixGridState(legacyMarqueeState(), PRESET)
    const twice = migratePixGridState(once, PRESET)
    expect(twice.layers.map(layer => layer.id)).toEqual(once.layers.map(layer => layer.id))
    expect(twice.groups.map(group => group.id)).toEqual(once.groups.map(group => group.id))

    for (const presetId of ['pix-grid-bass-beacon', 'pix-grid-geometric-reactor', 'pix-grid-pixel-parade']) {
      const preset = PIX_GRID_PRESET_BY_ID.get(presetId)!
      const before = applyPixGridPresetSettings(createDefaultPixGridState(), presetId, preset.pixGridSettings)
      const after = migratePixGridState(before, preset)
      expect(after.layers).toEqual(before.layers)
      expect(after.groups).toEqual(before.groups)
      expect(after.scenes).toEqual(before.scenes)
    }
  })
})
