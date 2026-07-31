import { describe, expect, it } from 'vitest'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { pixGridCellTransitionMix } from '../PixGridCellTransitions'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import {
  applyPixGridSelectedScenePreviewFrame,
  resolvePixGridPreviewState,
} from '../PixGridScenePreview'
import { applyPixGridPresetSettings } from '../PixGridState'
import { migratePixGridState } from '../PixGridStateMigration'
import type { PixGridAudioFrame, PixGridLayer, PixGridState } from '../PixGridTypes'
import { normalizePixGridState } from '../PixGridValidation'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!

function audio(overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  return {
    audioTime: 0,
    bass: 0,
    mid: 0,
    high: 0,
    volume: 0,
    beatHit: false,
    beatPhase: 0,
    isPlaying: true,
    beatIndex: 0,
    barIndex: 0,
    sectionType: 'verse',
    motionClockSectionType: 'verse',
    sectionProgress: 0.5,
    motionClockSectionProgress: 0.5,
    beatsSinceSectionStart: 0,
    barsSinceSectionStart: 0,
    motionClockSectionBeat: 0,
    motionClockSectionBar: 0,
    motionClockBeat: 0,
    motionClockBar: 0,
    motionClockTime: 0,
    motionMultiplier: 1,
    autoPerformanceEnabled: false,
    ...overrides,
  }
}

function state(): PixGridState {
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, preset.pixGridSettings)
  return normalizePixGridState({
    ...applied,
    quality: 'low',
    selectedSceneId: `${PRESET_ID}-verse`,
    performance: { ...applied.performance, enabled: false },
    audioAssignments: [],
    groups: applied.groups.map(group => ({ ...group, reactions: [] })),
  })
}

function structureOnly(base = state()): PixGridState {
  const layer = base.layers.find(candidate => candidate.id === 'marquee-structure')!
  return normalizePixGridState({
    ...base,
    layers: [layer],
    scenes: base.scenes.map(scene => ({ ...scene, layerIds: ['marquee-structure'] })),
    selectedSceneId: `${PRESET_ID}-verse`,
  })
}

function hash(pixels: Uint8Array): string {
  let value = 0x811c9dc5
  for (const byte of pixels) {
    value ^= byte
    value = Math.imul(value, 0x01000193)
  }
  return (value >>> 0).toString(16)
}

function resolved(layer: PixGridLayer, frame: PixGridAudioFrame) {
  return resolvePixGridLayerAnimation(layer, PIX_GRID_BUILT_IN_ASSET_BY_ID.get(layer.assetId)!, frame, 1)
}

describe('generic PixGrid cell transition grammar', () => {
  it('resolves every supported cell transition deterministically', () => {
    const types = ['cut', 'pixelDissolve', 'rowWipe', 'columnWipe', 'checkerWipe', 'radialReveal', 'paletteFade', 'powerOn', 'powerOff'] as const
    for (const type of types) {
      const first = Array.from({ length: 32 }, (_, index) => pixGridCellTransitionMix(type, index % 8, Math.floor(index / 8), 8, 4, 0.5, 917))
      const second = Array.from({ length: 32 }, (_, index) => pixGridCellTransitionMix(type, index % 8, Math.floor(index / 8), 8, 4, 0.5, 917))
      expect(second).toEqual(first)
      expect(first.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true)
    }
  })

  it('supports deterministic direction and origin without runtime state', () => {
    expect(pixGridCellTransitionMix('rowWipe', 1, 0, 4, 4, 0.3, 1, 'forward')).toBe(1)
    expect(pixGridCellTransitionMix('rowWipe', 1, 0, 4, 4, 0.3, 1, 'reverse')).toBe(0)
    expect(pixGridCellTransitionMix('radialReveal', 0, 0, 4, 4, 0.2, 1, 'forward', { x: 0, y: 0 })).toBe(1)
  })

  it('resolves exact start and completion masks for every non-cut transition', () => {
    const types = ['pixelDissolve', 'rowWipe', 'columnWipe', 'checkerWipe', 'radialReveal', 'paletteFade', 'powerOn', 'powerOff'] as const
    for (const type of types) {
      const start = Array.from({ length: 32 }, (_, index) => pixGridCellTransitionMix(type, index % 8, Math.floor(index / 8), 8, 4, 0, 917))
      const complete = Array.from({ length: 32 }, (_, index) => pixGridCellTransitionMix(type, index % 8, Math.floor(index / 8), 8, 4, 1, 917))
      expect(start.every(value => value === 0)).toBe(true)
      expect(complete.every(value => value === 1)).toBe(true)
    }
  })
})

describe('frameCycle transition resolution', () => {
  const marquee = state()
  const structure = marquee.layers.find(layer => layer.id === 'marquee-structure')!

  it('resolves previous frame, target frame, progress, duration, type, and seed from the musical clock', () => {
    const boundary = resolved(structure, audio({ motionClockSectionBar: 8, barsSinceSectionStart: 8 }))
    const middle = resolved(structure, audio({ motionClockSectionBar: 8.0625, barsSinceSectionStart: 8.0625 }))
    const complete = resolved(structure, audio({ motionClockSectionBar: 8.125, barsSinceSectionStart: 8.125 }))
    expect(boundary).toMatchObject({ previousFrameIndex: 0, frameIndex: 1, frameTransitionType: 'pixelDissolve', frameTransitionProgress: 0 })
    expect(middle.frameTransitionProgress).toBeGreaterThan(0)
    expect(middle.frameTransitionProgress).toBeLessThan(1)
    expect(complete.frameTransitionProgress).toBe(1)
    expect(middle.frameTransitionDuration).toBeCloseTo(1 / 64)
    expect(resolved(structure, audio({ motionClockSectionBar: 8.0625 })).frameTransitionSeed).toBe(middle.frameTransitionSeed)
  })

  it('uses section-authored transition language without changing sign cadence', () => {
    const build = resolved(structure, audio({ sectionType: 'build', motionClockSectionType: 'build', motionClockSectionBar: 4 }))
    const preDrop = resolved(structure, audio({ sectionType: 'preDrop', motionClockSectionType: 'preDrop', motionClockSectionBar: 12 }))
    const drop = resolved(structure, audio({ sectionType: 'drop', motionClockSectionType: 'drop', motionClockSectionBar: 4 }))
    expect(build.frameTransitionType).toBe('rowWipe')
    expect(preDrop.frameIndex).toBe(0)
    expect(preDrop.frameTransitionType).toBe('cut')
    expect(drop.frameTransitionType).toBe('radialReveal')
  })

  it('provides deterministic section-entry power transitions for held intro and outro signs', () => {
    const introStart = resolved(structure, audio({ sectionType: 'intro', motionClockSectionType: 'intro', motionClockSectionBar: 0 }))
    const introComplete = resolved(structure, audio({ sectionType: 'intro', motionClockSectionType: 'intro', motionClockSectionBar: 0.25 }))
    const outroStart = resolved(structure, audio({ sectionType: 'outro', motionClockSectionType: 'outro', motionClockSectionBar: 0 }))
    expect(introStart).toMatchObject({ frameIndex: 0, previousFrameIndex: 0, frameTransitionType: 'powerOn', frameTransitionProgress: 0 })
    expect(introComplete.frameTransitionProgress).toBe(1)
    expect(outroStart.frameTransitionType).toBe('powerOff')
  })

  it('is seek, loop, pause, and remount deterministic', () => {
    const position = audio({ motionClockSectionBar: 12.03125, barsSinceSectionStart: 12.03125, transportState: 'playing' })
    const first = resolved(structure, position)
    const seekForward = resolved(structure, audio({ motionClockSectionBar: 20.03125, barsSinceSectionStart: 20.03125 }))
    expect(seekForward.frameIndex).not.toBe(first.frameIndex)
    expect(resolved(structure, position)).toEqual(first)
    expect(resolved(structure, { ...position, transportState: 'paused', isPlaying: false })).toEqual(first)
    expect(resolved(structure, { ...position, timingDiscontinuity: true })).toEqual(first)
    expect(resolved(structure, audio({ motionClockSectionBar: 44.03125, barsSinceSectionStart: 44.03125 }))).toEqual(first)
    expect(resolved({ ...structure, animations: structure.animations.map(animation => ({ ...animation })) }, position)).toEqual(first)
  })

  it('normalizes invalid transition metadata to finite bounded values', () => {
    const invalid = normalizePixGridState({
      ...marquee,
      layers: marquee.layers.map(layer => layer.id === structure.id ? {
        ...layer,
        animations: layer.animations.map(animation => animation.mode === 'frameCycle' ? {
          ...animation,
          frameTransition: {
            type: 'pixelDissolve' as const,
            durationFraction: Number.NaN,
            seed: Number.POSITIVE_INFINITY,
            origin: { x: Number.NEGATIVE_INFINITY, y: Number.NaN },
          },
        } : animation),
      } : layer),
    })
    const config = invalid.layers.find(layer => layer.id === structure.id)!.animations.find(animation => animation.mode === 'frameCycle')!.frameTransition!
    expect(config.durationFraction).toBe(0)
    expect(config.seed).toBe(1)
    expect(config.origin).toEqual({ x: 0.5, y: 0.5 })
  })
})

describe('Marquee logical visual acceptance', () => {
  it('renders at least one exact-cell intermediate state and completes exactly on the target frame', () => {
    const base = structureOnly()
    const sourceFrame = composePixGridLogicalFrame(preset, base, audio({ motionClockSectionBar: 7.99 })).pixels
    const intermediate = composePixGridLogicalFrame(preset, base, audio({ motionClockSectionBar: 8.0625 })).pixels
    const target = composePixGridLogicalFrame(preset, base, audio({ motionClockSectionBar: 8.125 })).pixels
    const cutLayer = { ...base.layers[0], animations: base.layers[0].animations.map(animation => animation.mode === 'frameCycle'
      ? { ...animation, frameTransition: { type: 'cut' as const, durationFraction: 0 }, sectionFrameTransitions: {} }
      : animation) }
    const cutState = normalizePixGridState({ ...base, layers: [cutLayer] })
    const exactTarget = composePixGridLogicalFrame(preset, cutState, audio({ motionClockSectionBar: 8.125 })).pixels

    expect(hash(intermediate)).not.toBe(hash(sourceFrame))
    expect(hash(intermediate)).not.toBe(hash(target))
    expect(target).toEqual(exactTarget)
    for (let offset = 0; offset < intermediate.length; offset += 4) {
      const pixel = Array.from(intermediate.slice(offset, offset + 4)).join(',')
      const source = Array.from(sourceFrame.slice(offset, offset + 4)).join(',')
      const destination = Array.from(target.slice(offset, offset + 4)).join(',')
      expect(pixel === source || pixel === destination).toBe(true)
    }
  })

  it('keeps stable structure fixed while authored light layers animate at one sign identity', () => {
    const full = state()
    const fixedSignA = audio({ sectionType: 'drop', motionClockSectionType: 'drop', motionClockSectionBar: 1, motionClockSectionBeat: 4 })
    const fixedSignB = audio({ sectionType: 'drop', motionClockSectionType: 'drop', motionClockSectionBar: 1.25, motionClockSectionBeat: 5 })
    const fullA = composePixGridLogicalFrame(preset, full, fixedSignA).pixels
    const fullB = composePixGridLogicalFrame(preset, full, fixedSignB).pixels
    const structure = structureOnly({ ...full, selectedSceneId: `${PRESET_ID}-drop` })
    const structureA = composePixGridLogicalFrame(preset, structure, fixedSignA).pixels
    const structureB = composePixGridLogicalFrame(preset, structure, fixedSignB).pixels
    expect(hash(fullA)).not.toBe(hash(fullB))
    expect(structureA).toEqual(structureB)
  })

  it('keeps scene ownership and sign ownership independent', () => {
    const base = state()
    const introState = { ...base, selectedSceneId: `${PRESET_ID}-intro` }
    const dropState = { ...base, selectedSceneId: `${PRESET_ID}-drop` }
    const atSectionStart = audio({ sectionType: 'drop', motionClockSectionType: 'drop', motionClockSectionBar: 0 })
    const structure = base.layers.find(layer => layer.id === 'marquee-structure')!
    expect(resolved(structure, atSectionStart).frameIndex).toBe(0)
    expect(introState.selectedSceneId).not.toBe(dropState.selectedSceneId)
    const signChange = resolved(structure, { ...atSectionStart, motionClockSectionBar: 4.125 })
    expect(signChange.frameIndex).toBe(1)
    expect(dropState.selectedSceneId).toBe(`${PRESET_ID}-drop`)
  })


  it('gives Selected Scene a deterministic local motion clock and restores Follow Track ownership', () => {
    const base = state()
    const selected = normalizePixGridState({
      ...base,
      selectedSceneId: `${PRESET_ID}-drop`,
      editor: { ...base.editor, scenePreviewMode: 'selectedScene' },
    })
    expect(resolvePixGridPreviewState(selected, `${PRESET_ID}-intro`).selectedSceneId).toBe(`${PRESET_ID}-drop`)
    const previewFrame = applyPixGridSelectedScenePreviewFrame(audio({
      motionClockBar: 5.25,
      motionClockBeat: 21,
      motionClockSectionBar: 99,
      motionClockSectionBeat: 396,
    }), selected)
    expect(previewFrame).toMatchObject({
      sectionType: 'drop',
      motionClockSectionType: 'drop',
      motionClockSectionBar: 1.25,
      motionClockSectionBeat: 5,
      inputSource: 'editor-preview',
    })

    const follow = normalizePixGridState({
      ...base,
      editor: { ...base.editor, scenePreviewMode: 'followTrack' },
    })
    expect(resolvePixGridPreviewState(follow, `${PRESET_ID}-intro`).selectedSceneId).toBe(`${PRESET_ID}-intro`)
  })

  it('completes to four distinct readable sign frames while retaining true-black cell gaps', () => {
    const base = state()
    const hashes = [0.125, 8.125, 16.125, 24.125].map(motionClockSectionBar => {
      const pixels = composePixGridLogicalFrame(preset, base, audio({
        motionClockSectionBar,
        motionClockSectionBeat: motionClockSectionBar * 4,
      })).pixels
      let blackCells = 0
      let visibleCells = 0
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset] === 0 && pixels[offset + 1] === 0 && pixels[offset + 2] === 0) blackCells += 1
        if (pixels[offset + 3] > 0) visibleCells += 1
      }
      expect(blackCells / (pixels.length / 4)).toBeGreaterThan(0.35)
      expect(visibleCells).toBeGreaterThan(500)
      return hash(pixels)
    })
    expect(new Set(hashes).size).toBe(4)
  })

  it('migrates Stage 2 state once, serializes transition metadata, and preserves custom layers', () => {
    const current = state()
    const custom = { ...current.layers[0], id: 'user-marquee-overlay', name: 'User Overlay', seed: 99191 }
    const legacy = {
      ...current,
      version: 17,
      layers: [...current.layers.map(layer => ({
        ...layer,
        animations: layer.animations.map(animation => {
          const { frameTransition: _frameTransition, sectionFrameTransitions: _sectionFrameTransitions, ...rest } = animation
          return rest
        }),
      })), custom],
      configuration: { ...current.configuration, presetConfigurationVersion: 14 },
    }
    const migrated = migratePixGridState(legacy)
    const structure = migrated.layers.find(layer => layer.id === 'marquee-structure')!
    expect(migrated.version).toBe(18)
    expect(structure.animations.find(animation => animation.mode === 'frameCycle')?.sectionFrameTransitions?.drop?.type).toBe('radialReveal')
    expect(migrated.layers.some(layer => layer.id === custom.id)).toBe(true)
    expect(migratePixGridState(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated)
  })
})
