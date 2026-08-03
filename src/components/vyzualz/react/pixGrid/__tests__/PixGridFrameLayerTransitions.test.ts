import { describe, expect, it } from 'vitest'
import {
  PIX_GRID_LEGACY_SIGN_RUNTIME_PRESET as PRESET,
  PIX_GRID_LEGACY_SIGN_RUNTIME_PRESET_ID as PRESET_ID,
} from './__fixtures__/PixGridLegacySignRuntimeFixture'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { pixGridCellTransitionMix } from '../PixGridCellTransitions'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import {
  applyPixGridSelectedScenePreviewFrame,
  resolvePixGridPreviewState,
} from '../PixGridScenePreview'
import { applyPixGridPresetSettings } from '../PixGridState'
import { migratePixGridState } from '../PixGridStateMigration'
import type { PixGridAudioFrame, PixGridLayer, PixGridState } from '../PixGridTypes'
import { normalizePixGridState } from '../PixGridValidation'

const preset = PRESET

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
    absoluteBar: 0,
    signClock: 0,
    motionClockSign: 0,
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

function activeCellCount(pixels: Uint8Array): number {
  let count = 0
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] > 0) count += 1
  }
  return count
}

function totalAlpha(pixels: Uint8Array): number {
  let total = 0
  for (let offset = 3; offset < pixels.length; offset += 4) total += pixels[offset]
  return total
}

function resolved(layer: PixGridLayer, frame: PixGridAudioFrame) {
  return resolvePixGridLayerAnimation(layer, PIX_GRID_BUILT_IN_ASSET_BY_ID.get(layer.assetId)!, frame, 1)
}

describe('generic PixGrid cell transition grammar', () => {
  it('resolves every supported cell transition deterministically', () => {
    const types = ['cut', 'crossfade', 'pixelDissolve', 'rowWipe', 'columnWipe', 'checkerWipe', 'radialReveal', 'paletteFade', 'powerOn', 'powerOff'] as const
    for (const type of types) {
      const first = Array.from({ length: 32 }, (_, index) => pixGridCellTransitionMix(type, index % 8, Math.floor(index / 8), 8, 4, 0.5, 917))
      const second = Array.from({ length: 32 }, (_, index) => pixGridCellTransitionMix(type, index % 8, Math.floor(index / 8), 8, 4, 0.5, 917))
      expect(second).toEqual(first)
      expect(first.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true)
    }
  })

  it('resolves power transitions as coherent whole-sign fades rather than noisy cell recruitment', () => {
    for (const type of ['powerOn', 'powerOff'] as const) {
      const values = Array.from({ length: 512 }, (_, index) => (
        pixGridCellTransitionMix(type, index % 32, Math.floor(index / 32), 32, 16, 0.5, 917)
      ))
      expect(new Set(values)).toEqual(new Set([0.5]))
    }
  })

  it('supports deterministic direction and origin without runtime state', () => {
    expect(pixGridCellTransitionMix('rowWipe', 1, 0, 4, 4, 0.3, 1, 'forward')).toBe(1)
    expect(pixGridCellTransitionMix('rowWipe', 1, 0, 4, 4, 0.3, 1, 'reverse')).toBe(0)
    expect(pixGridCellTransitionMix('radialReveal', 0, 0, 4, 4, 0.2, 1, 'forward', { x: 0, y: 0 })).toBe(1)
  })

  it('resolves exact start and completion masks for every non-cut transition', () => {
    const types = ['crossfade', 'pixelDissolve', 'rowWipe', 'columnWipe', 'checkerWipe', 'radialReveal', 'paletteFade', 'powerOn', 'powerOff'] as const
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
    const boundary = resolved(structure, audio({ signClock: 1, motionClockSign: 1 }))
    const middle = resolved(structure, audio({ signClock: 1.0625, motionClockSign: 1.0625 }))
    const complete = resolved(structure, audio({ signClock: 1.125, motionClockSign: 1.125 }))
    expect(boundary).toMatchObject({ previousFrameIndex: 0, frameIndex: 1, frameTransitionType: 'crossfade', frameTransitionProgress: 0 })
    expect(middle.frameTransitionProgress).toBeGreaterThan(0)
    expect(middle.frameTransitionProgress).toBeLessThan(1)
    expect(complete.frameTransitionProgress).toBe(1)
    expect(middle.frameTransitionDuration).toBeCloseTo(1 / 8)
    expect(resolved(structure, audio({ signClock: 1.0625, motionClockSign: 1.0625 })).frameTransitionSeed).toBe(middle.frameTransitionSeed)
  })

  it('prefers an authoritative transition source over local frame subtraction', () => {
    const sectionReset = resolved(structure, audio({
      signClock: 0,
      motionClockSign: 0,
      signTransitionClock: 0,
      motionClockSignTransition: 0,
      signTransitionSourceFrame: 2,
      signTransitionTargetFrame: 0,
      motionClockSignTransitionSourceFrame: 2,
      motionClockSignTransitionTargetFrame: 0,
    }))
    expect(sectionReset).toMatchObject({
      previousFrameIndex: 2,
      frameIndex: 0,
      frameTransitionProgress: 0,
    })
    expect(sectionReset.previousFrameIndex).not.toBe(3)
  })

  it('uses section-authored transition language without changing sign cadence', () => {
    const build = resolved(structure, audio({ sectionType: 'build', motionClockSectionType: 'build', signClock: 1, motionClockSign: 1 }))
    const preDrop = resolved(structure, audio({ sectionType: 'preDrop', motionClockSectionType: 'preDrop', signClock: 1.5, motionClockSign: 1.5 }))
    const drop = resolved(structure, audio({ sectionType: 'drop', motionClockSectionType: 'drop', signClock: 2, motionClockSign: 2 }))
    expect(build.frameTransitionType).toBe('rowWipe')
    expect(preDrop.frameIndex).toBe(1)
    expect(preDrop.frameTransitionType).toBe('cut')
    expect(drop.frameTransitionType).toBe('radialReveal')
  })

  it('provides deterministic section-entry power transitions for held intro and outro signs', () => {
    const introStart = resolved(structure, audio({ sectionType: 'intro', motionClockSectionType: 'intro', motionClockSectionBar: 0, barsSinceSectionStart: 0 }))
    const introComplete = resolved(structure, audio({ sectionType: 'intro', motionClockSectionType: 'intro', motionClockSectionBar: 0, barsSinceSectionStart: 0.75, motionMultiplier: 0 }))
    const outroStart = resolved(structure, audio({ sectionType: 'outro', motionClockSectionType: 'outro', motionClockSectionBar: 0, barsSinceSectionStart: 0 }))
    expect(introStart).toMatchObject({ frameIndex: 0, previousFrameIndex: 0, frameTransitionType: 'powerOn', frameTransitionProgress: 0 })
    expect(introComplete.frameTransitionProgress).toBe(1)
    expect(introComplete.frameTransitionCompletedState).toBe('target')
    expect(outroStart.frameTransitionType).toBe('powerOff')
    expect(outroStart.frameTransitionCompletedState).toBe('transparent')
  })

  it('renders a stable destination frame while stopped or immediately after transport reconstruction', () => {
    const stoppedIntro = resolved(structure, audio({
      sectionType: 'intro',
      motionClockSectionType: 'intro',
      barsSinceSectionStart: 0,
      stableInspectionFrame: true,
      isPlaying: false,
      transportState: 'stopped',
    }))
    const seekDestination = resolved(structure, audio({
      signClock: 2.0625,
      motionClockSign: 2.0625,
      suppressFrameTransitions: true,
      timingDiscontinuity: true,
    }))

    expect(stoppedIntro).toMatchObject({
      frameIndex: 0,
      previousFrameIndex: 0,
      frameTransitionType: 'cut',
      frameTransitionProgress: 1,
    })
    expect(seekDestination.previousFrameIndex).toBe(seekDestination.frameIndex)
    expect(seekDestination.frameTransitionType).toBe('cut')
    expect(seekDestination.frameTransitionProgress).toBe(1)
  })

  it('is seek, loop, pause, and remount deterministic', () => {
    const position = audio({ signClock: 1.50390625, motionClockSign: 1.50390625, transportState: 'playing' })
    const first = resolved(structure, position)
    const seekForward = resolved(structure, audio({ signClock: 2.50390625, motionClockSign: 2.50390625 }))
    expect(seekForward.frameIndex).not.toBe(first.frameIndex)
    expect(resolved(structure, position)).toEqual(first)
    expect(resolved(structure, { ...position, transportState: 'paused', isPlaying: false })).toEqual(first)
    expect(resolved(structure, { ...position, timingDiscontinuity: true })).toEqual(first)
    expect(resolved(structure, audio({ signClock: 5.50390625, motionClockSign: 5.50390625 }))).toEqual(first)
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
  it('holds power-off transparent at and after completion, restores on power-on, and seeks deterministically', () => {
    const base = structureOnly()
    const render = (
      sectionType: 'intro' | 'verse' | 'outro',
      sectionBar: number,
      overrides: Partial<PixGridAudioFrame> = {},
    ) => composePixGridLogicalFrame(
      preset,
      base,
      audio({
        sectionType,
        motionClockSectionType: sectionType,
        motionClockSectionBar: sectionBar,
        barsSinceSectionStart: sectionBar,
        signClock: 0,
        motionClockSign: 0,
        signTransitionClock: null,
        motionClockSignTransition: null,
        ...overrides,
      }),
    ).pixels

    const offStart = render('outro', 0)
    const offMiddle = render('outro', 0.25)
    const offJustBefore = render('outro', 0.749999)
    const offComplete = render('outro', 0.75)
    const offAfter = render('outro', 1.5)
    const onStart = render('intro', 0)
    const onMiddle = render('intro', 0.375)
    const onComplete = render('intro', 0.75)
    const onAfter = render('intro', 1.5)
    const stoppedInspection = render('intro', 0, {
      stableInspectionFrame: true,
      isPlaying: false,
      transportState: 'stopped',
    })
    const seekBackward = render('verse', 0.5)

    expect(activeCellCount(offStart)).toBeGreaterThan(0)
    expect(totalAlpha(offMiddle)).toBeGreaterThan(0)
    expect(totalAlpha(offMiddle)).toBeLessThan(totalAlpha(offStart))
    expect(totalAlpha(offJustBefore)).toBeLessThanOrEqual(totalAlpha(offMiddle))
    expect(totalAlpha(offComplete)).toBe(0)
    expect(offAfter).toEqual(offComplete)

    expect(totalAlpha(onStart)).toBe(0)
    expect(totalAlpha(onMiddle)).toBeGreaterThan(0)
    expect(totalAlpha(onComplete)).toBeGreaterThan(totalAlpha(onMiddle))
    expect(onAfter).toEqual(onComplete)
    expect(stoppedInspection).toEqual(onComplete)
    expect(render('intro', 0.75, { motionMultiplier: 0, motionClockSectionBar: 0 })).toEqual(onComplete)
    expect(render('outro', 0.75, { motionMultiplier: 0, motionClockSectionBar: 0 })).toEqual(offComplete)
    expect(activeCellCount(seekBackward)).toBeGreaterThan(0)
    expect(render('outro', 1.5)).toEqual(offAfter)
    expect(render('outro', 0.75, { isPlaying: false, transportState: 'paused' })).toEqual(offAfter)
    expect(render('outro', 0.75, { transportState: 'playing' })).toEqual(offAfter)
    expect(render('outro', 0.75, { timingDiscontinuity: true })).toEqual(offAfter)
    expect(composePixGridLogicalFrame(preset, structureOnly(), audio({
      sectionType: 'outro',
      motionClockSectionType: 'outro',
      motionClockSectionBar: 0.75,
      barsSinceSectionStart: 0.75,
      signClock: 0,
      motionClockSign: 0,
      signTransitionClock: null,
      motionClockSignTransition: null,
    })).pixels).toEqual(offAfter)
  })

  it('allows authored power-off transitions to opt out of terminal holding', () => {
    const base = structureOnly()
    const layer = base.layers[0]
    const noHoldLayer = {
      ...layer,
      animations: layer.animations.map((animation) => {
        const outro = animation.sectionFrameTransitions?.outro
        if (animation.mode !== 'frameCycle' || !outro) return animation
        return {
          ...animation,
          sectionFrameTransitions: {
            ...animation.sectionFrameTransitions,
            outro: { ...outro, holdAfterCompletion: false },
          },
        }
      }),
    }
    const noHold = normalizePixGridState({ ...base, layers: [noHoldLayer] })
    const complete = composePixGridLogicalFrame(preset, noHold, audio({
      sectionType: 'outro',
      motionClockSectionType: 'outro',
      motionClockSectionBar: 0.75,
      barsSinceSectionStart: 0.75,
      signTransitionClock: null,
      motionClockSignTransition: null,
    })).pixels

    expect(resolved(noHold.layers[0], audio({
      sectionType: 'outro',
      motionClockSectionType: 'outro',
      motionClockSectionBar: 0,
      barsSinceSectionStart: 0.75,
      motionMultiplier: 0,
      signTransitionClock: null,
      motionClockSignTransition: null,
    })).frameTransitionCompletedState).toBe('target')
    expect(activeCellCount(complete)).toBeGreaterThan(0)
  })

  it('completes non-power-off transitions on the target frame without stale source state', () => {
    const base = structureOnly()
    const transitionTypes = [
      'crossfade',
      'pixelDissolve',
      'rowWipe',
      'columnWipe',
      'checkerWipe',
      'radialReveal',
      'paletteFade',
      'powerOn',
    ] as const
    const cutLayer = {
      ...base.layers[0],
      animations: base.layers[0].animations.map(animation => animation.mode === 'frameCycle'
        ? { ...animation, frameTransition: { type: 'cut' as const, durationFraction: 0 }, sectionFrameTransitions: {} }
        : animation),
    }
    const exactTarget = composePixGridLogicalFrame(
      preset,
      normalizePixGridState({ ...base, layers: [cutLayer] }),
      audio({ signClock: 1.25, motionClockSign: 1.25 }),
    ).pixels

    for (const type of transitionTypes) {
      const layer = {
        ...base.layers[0],
        animations: base.layers[0].animations.map(animation => animation.mode === 'frameCycle'
          ? { ...animation, frameTransition: { type, durationFraction: 0.25 }, sectionFrameTransitions: {} }
          : animation),
      }
      const complete = composePixGridLogicalFrame(
        preset,
        normalizePixGridState({ ...base, layers: [layer] }),
        audio({ signClock: 1.25, motionClockSign: 1.25 }),
      ).pixels
      expect(complete).toEqual(exactTarget)
    }
  })

  it('renders a coherent interpolated crossfade and completes exactly on the target frame', () => {
    const base = structureOnly()
    const sourceFrame = composePixGridLogicalFrame(preset, base, audio({ signClock: 0.99875, motionClockSign: 0.99875 })).pixels
    const intermediate = composePixGridLogicalFrame(preset, base, audio({ signClock: 1.0625, motionClockSign: 1.0625 })).pixels
    const target = composePixGridLogicalFrame(preset, base, audio({ signClock: 1.125, motionClockSign: 1.125 })).pixels
    const cutLayer = { ...base.layers[0], animations: base.layers[0].animations.map(animation => animation.mode === 'frameCycle'
      ? { ...animation, frameTransition: { type: 'cut' as const, durationFraction: 0 }, sectionFrameTransitions: {} }
      : animation) }
    const cutState = normalizePixGridState({ ...base, layers: [cutLayer] })
    const exactTarget = composePixGridLogicalFrame(preset, cutState, audio({ signClock: 1.125, motionClockSign: 1.125 })).pixels

    expect(hash(intermediate)).not.toBe(hash(sourceFrame))
    expect(hash(intermediate)).not.toBe(hash(target))
    expect(target).toEqual(exactTarget)
    let interpolatedCells = 0
    for (let offset = 0; offset < intermediate.length; offset += 4) {
      const pixel = Array.from(intermediate.slice(offset, offset + 4)).join(',')
      const source = Array.from(sourceFrame.slice(offset, offset + 4)).join(',')
      const destination = Array.from(target.slice(offset, offset + 4)).join(',')
      if (pixel !== source && pixel !== destination) interpolatedCells += 1
    }
    expect(interpolatedCells).toBeGreaterThan(0)
  })

  it('keeps stable structure fixed while authored light layers animate at one sign identity', () => {
    const full = state()
    const fixedSignA = audio({ sectionType: 'drop', motionClockSectionType: 'drop', motionClockSectionBar: 1, motionClockSectionBeat: 4, signClock: 2.25, motionClockSign: 2.25 })
    const fixedSignB = audio({ sectionType: 'drop', motionClockSectionType: 'drop', motionClockSectionBar: 1.25, motionClockSectionBeat: 5, signClock: 2.25, motionClockSign: 2.25 })
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
    const atSectionStart = audio({ sectionType: 'drop', motionClockSectionType: 'drop', motionClockSectionBar: 0, signClock: 2.5, motionClockSign: 2.5 })
    const structure = base.layers.find(layer => layer.id === 'marquee-structure')!
    expect(resolved(structure, atSectionStart).frameIndex).toBe(2)
    expect(introState.selectedSceneId).not.toBe(dropState.selectedSceneId)
    const signChange = resolved(structure, { ...atSectionStart, signClock: 3.125, motionClockSign: 3.125, motionClockSectionBar: 2.0625 })
    expect(signChange.frameIndex).toBe(3)
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
      absoluteBar: 5.25,
      barIndex: 5,
      barProgress: 0.25,
      beatIndex: 21,
      beatPhase: 0,
      motionClockSectionBar: 99,
      motionClockSectionBeat: 396,
    }), selected)
    expect(previewFrame).toMatchObject({
      sectionType: 'drop',
      motionClockSectionType: undefined,
      barsSinceSectionStart: 5.25,
      beatsSinceSectionStart: 21,
      previewElapsedBar: 5.25,
      previewLoopBars: 16,
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
    const hashes = [0.125, 1.125, 2.125, 3.125].map(motionClockSign => {
      const pixels = composePixGridLogicalFrame(preset, base, audio({
        signClock: motionClockSign,
        motionClockSign,
      })).pixels
      let blackCells = 0
      let visibleCells = 0
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset] === 0 && pixels[offset + 1] === 0 && pixels[offset + 2] === 0) blackCells += 1
        if (pixels[offset + 3] > 0) visibleCells += 1
      }
      expect(blackCells / (pixels.length / 4)).toBeGreaterThan(0.15)
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
    expect(migrated.version).toBe(19)
    expect(structure.animations.find(animation => animation.mode === 'frameCycle')?.sectionFrameTransitions?.drop?.type).toBe('radialReveal')
    expect(migrated.layers.some(layer => layer.id === custom.id)).toBe(true)
    expect(migratePixGridState(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated)
  })
})
