import { describe, expect, it } from 'vitest'
import {
  PIX_GRID_LEGACY_SIGN_RUNTIME_PRESET as PRESET,
  PIX_GRID_LEGACY_SIGN_RUNTIME_PRESET_ID as PRESET_ID,
} from './__fixtures__/PixGridLegacySignRuntimeFixture'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import type { PixGridGroupFrameEffect } from '../PixGridFrameEffects'
import { PixGridFrameGroupCompiler } from '../PixGridGroupCompiler'
import { pixGridMaskHasCell } from '../PixGridGroups'
import { applyPixGridRuntimeControls, PixGridMotionClock } from '../PixGridRuntimeControls'
import { PixGridSelectedScenePreviewClock } from '../PixGridScenePreview'
import { applyPixGridPresetSignClock } from '../PixGridSignClock'
import { applyPixGridPresetSettings } from '../PixGridState'
import type { PixGridAudioFrame, PixGridGroup, PixGridState } from '../PixGridTypes'
import { normalizePixGridState } from '../PixGridValidation'


const WIDTH = 160
const HEIGHT = 90

function state(
  scene: 'intro' | 'verse' | 'drop' | 'outro' = 'verse',
  layerIds?: readonly string[],
): PixGridState {
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, PRESET.pixGridSettings)
  const selectedSceneId = `${PRESET_ID}-${scene}`
  return normalizePixGridState({
    ...applied,
    selectedSceneId,
    editor: { ...applied.editor, scenePreviewMode: 'selectedScene' },
    performance: { ...applied.performance, enabled: false },
    audioAssignments: [],
    groups: applied.groups.map(group => ({ ...group, reactions: [] })),
    scenes: layerIds
      ? applied.scenes.map(candidate => candidate.id === selectedSceneId
          ? { ...candidate, layerIds: [...layerIds] }
          : candidate)
      : applied.scenes,
  })
}

function frame(overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  const absoluteBar = overrides.absoluteBar ?? 0
  const barIndex = Math.floor(absoluteBar)
  const barProgress = absoluteBar - barIndex
  return {
    audioTime: absoluteBar * 2,
    bass: 0,
    mid: 0,
    high: 0,
    volume: 0,
    beatHit: false,
    beatPhase: (barProgress * 4) % 1,
    isPlaying: true,
    beatIndex: Math.floor(absoluteBar * 4),
    barIndex,
    barProgress,
    absoluteBar,
    barsSinceSectionStart: absoluteBar,
    beatsSinceSectionStart: absoluteBar * 4,
    sectionType: 'verse',
    motionClockSectionType: 'verse',
    sectionProgress: 0,
    sectionOccurrence: 0,
    phraseIndex: Math.floor(absoluteBar / 4),
    motionClockSectionBar: absoluteBar,
    motionClockSectionBeat: absoluteBar * 4,
    motionClockSectionProgress: 0,
    sectionBarTimeline: [{ id: 'fixture-verse', type: 'verse', startBar: 0, endBar: 128 }],
    signClock: 0,
    motionClockSign: 0,
    signTransitionClock: null,
    motionClockSignTransition: null,
    signTransitionSourceFrame: null,
    signTransitionTargetFrame: null,
    motionClockSignTransitionSourceFrame: null,
    motionClockSignTransitionTargetFrame: null,
    transportState: 'playing',
    trackIdentity: 'marquee-black-square-seek-test',
    autoPerformanceEnabled: false,
    sourceValues: {},
    ...overrides,
  }
}

function effect(groupId: string, overrides: Partial<PixGridGroupFrameEffect> = {}): PixGridGroupFrameEffect {
  return {
    id: `test-${groupId}`,
    groupId,
    kind: 'visibility',
    source: 'manual',
    stage: 'manual',
    priority: 1_000,
    amount: 0,
    blend: 'replace',
    membership: 'rendered',
    ...overrides,
  }
}

function pixelEquals(left: Uint8Array, right: Uint8Array, index: number): boolean {
  const offset = index * 4
  return left[offset] === right[offset]
    && left[offset + 1] === right[offset + 1]
    && left[offset + 2] === right[offset + 2]
    && left[offset + 3] === right[offset + 3]
}

function activeCells(pixels: Uint8Array): number {
  let count = 0
  for (let offset = 3; offset < pixels.length; offset += 4) count += Number(pixels[offset] > 0)
  return count
}

function selectedPreview(
  selectedState: PixGridState,
  absoluteBar: number,
  previewClock = new PixGridSelectedScenePreviewClock(),
  motionClock = new PixGridMotionClock(),
): PixGridAudioFrame {
  const trackDerived = applyPixGridRuntimeControls(frame({
    absoluteBar,
    audioTime: absoluteBar * 2,
    timingDiscontinuity: true,
    sectionType: 'outro',
    motionClockSectionType: 'outro',
    barsSinceSectionStart: 16,
    beatsSinceSectionStart: 64,
    sectionProgress: 1,
    signClock: 99,
    signTransitionClock: 0.04,
    signTransitionRate: 0.25,
    signTransitionSourceFrame: 2,
    signTransitionTargetFrame: 3,
    motionClockTime: 999,
    motionClockBeat: 999,
    motionClockBar: 999,
    motionClockSign: 99,
    motionClockSignTransition: 0.04,
    motionClockSignTransitionSourceFrame: 2,
    motionClockSignTransitionTargetFrame: 3,
    restoringFromTransparency: true,
    restorationElapsedBar: 0.75,
    trackMapCueEvent: true,
    trackMapCueIdentity: 'track-outro-blackout',
  }), { bassReactivity: 1, motion: 1 })
  const projected = previewClock.apply(trackDerived, selectedState)
  return motionClock.apply(applyPixGridPresetSignClock(projected, PRESET_ID))
}

describe('Marquee non-destructive semantic composition', () => {
  it('restores the pre-semantic backdrop when a letter bank is hidden and leaves exact non-members untouched', () => {
    const layerIds = [
      'marquee-structure',
      'marquee-letter-lights-a',
      'marquee-letter-lights-b',
      'marquee-letter-lights-c',
    ]
    const focused = state('verse', layerIds)
    const structureOnly = state('verse', ['marquee-structure'])
    const sourceFrame = frame()
    const baseline = composePixGridLogicalFrame(PRESET, focused, sourceFrame).pixels
    const expectedBackdrop = composePixGridLogicalFrame(PRESET, structureOnly, sourceFrame).pixels
    const compiler = new PixGridFrameGroupCompiler()
    const hidden = composePixGridLogicalFrame(
      PRESET,
      focused,
      sourceFrame,
      undefined,
      undefined,
      undefined,
      undefined,
      [effect('marquee-letter-group')],
      compiler,
    ).pixels
    const letterGroup = focused.groups.find(group => group.id === 'marquee-letter-group')!
    const mask = compiler.compile(letterGroup, 'rendered')

    let memberCount = 0
    let changedMemberCount = 0
    let minX = WIDTH
    let minY = HEIGHT
    let maxX = -1
    let maxY = -1
    for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
      const member = pixGridMaskHasCell(mask.bits, index)
      if (!member) {
        expect(pixelEquals(hidden, baseline, index)).toBe(true)
        continue
      }
      memberCount += 1
      changedMemberCount += Number(!pixelEquals(baseline, expectedBackdrop, index))
      expect(pixelEquals(hidden, expectedBackdrop, index)).toBe(true)
      expect(hidden[index * 4 + 3]).toBe(expectedBackdrop[index * 4 + 3])
      const x = index % WIDTH
      const y = Math.floor(index / WIDTH)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }

    let rectangularNonMember = -1
    for (let y = minY; y <= maxY && rectangularNonMember < 0; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const index = y * WIDTH + x
        if (!pixGridMaskHasCell(mask.bits, index)) {
          rectangularNonMember = index
          break
        }
      }
    }

    expect(memberCount).toBeGreaterThan(100)
    expect(changedMemberCount).toBeGreaterThan(100)
    expect(rectangularNonMember).toBeGreaterThanOrEqual(0)
    expect(pixelEquals(hidden, baseline, rectangularNonMember)).toBe(true)
  })

  it('keeps stable structure out of animated transition recruitment', () => {
    const transitionGroup = state().groups.find(group => group.id === 'marquee-transition-group')!
    expect(transitionGroup.layerScope).not.toContain('marquee-structure')
    expect(transitionGroup.layerScope).toEqual([
      'marquee-trim-lights',
      'marquee-bulbs-a',
      'marquee-bulbs-c',
    ])
  })

  it('preserves authored opaque black through backdrop restoration instead of treating RGB zero as transparency', () => {
    const group: PixGridGroup = {
      id: 'marquee-black-artwork-test',
      name: 'Opaque Black Artwork',
      source: 'layerAlpha',
      mask: { kind: 'layerAlpha', threshold: 0.01, foreground: true },
      cellRuns: [],
      layerId: 'semantic-black-test',
      layerScope: ['semantic-black-test'],
      smartRuleId: 'layerAlpha',
      enabled: true,
      visible: true,
      contentVisible: true,
      priority: 1,
      overlapBehavior: 'stack',
      reactions: [],
      displayColor: '#000000',
    }
    const compiler = new PixGridFrameGroupCompiler()
    const pixels = new Uint8Array([0, 0, 0, 255, 12, 18, 24, 255])
    compiler.beginFrame([group], 2, 1, new Set(['semantic-black-test']))
    compiler.captureLayerBackdrop('semantic-black-test', pixels)
    compiler.recordPixel('semantic-black-test', 0, [255, 255, 255], 1)
    pixels.set([255, 255, 255, 255], 0)
    const mask = compiler.compile(group)

    expect(compiler.restoreBackdrop(group, pixels, mask.bits, 0)).toBe(1)
    expect(Array.from(pixels.slice(0, 4))).toEqual([0, 0, 0, 255])
  })

  it('fully initializes reused logical buffers and keeps Edit Target out of production output', () => {
    const sourceState = state('drop')
    const sourceFrame = frame({ sectionType: 'drop', motionClockSectionType: 'drop' })
    const fresh = composePixGridLogicalFrame(PRESET, sourceState, sourceFrame).pixels
    const reusable = new Uint8Array(fresh.length)
    reusable.fill(173)
    const reused = composePixGridLogicalFrame(PRESET, sourceState, sourceFrame, reusable).pixels
    const editTargetState = normalizePixGridState({
      ...sourceState,
      editor: { ...sourceState.editor, selectedLayerId: 'marquee-equalizer-lights' },
    })
    const editTarget = composePixGridLogicalFrame(PRESET, editTargetState, sourceFrame).pixels

    expect(reused).toEqual(fresh)
    expect(editTarget).toEqual(fresh)
  })
})

describe('Marquee coherent source-target transition composition', () => {
  it('uses one transition descriptor for structure, equalizer, and every semantic light layer', () => {
    const sourceState = state('verse')
    const middle = frame({
      signClock: 1,
      motionClockSign: 1,
      signTransitionClock: 1 / 16,
      motionClockSignTransition: 1 / 16,
      signTransitionSourceFrame: 0,
      signTransitionTargetFrame: 1,
      motionClockSignTransitionSourceFrame: 0,
      motionClockSignTransitionTargetFrame: 1,
    })
    const descriptors = sourceState.layers
      .filter(layer => layer.animations.some(animation => animation.mode === 'frameCycle'))
      .map(layer => {
        const resolved = resolvePixGridLayerAnimation(
          layer,
          PIX_GRID_BUILT_IN_ASSET_BY_ID.get(layer.assetId)!,
          middle,
          1,
        )
        return {
          layerId: layer.id,
          source: resolved.previousFrameIndex,
          target: resolved.frameIndex,
          type: resolved.frameTransitionType,
          progress: resolved.frameTransitionProgress,
          duration: resolved.frameTransitionDuration,
          seed: resolved.frameTransitionSeed,
          direction: resolved.frameTransitionDirection,
          origin: resolved.frameTransitionOrigin,
        }
      })
    const [{ layerId: _firstLayerId, ...expected }, ...rest] = descriptors

    expect(rest.length).toBeGreaterThan(8)
    for (const { layerId: _layerId, ...descriptor } of rest) expect(descriptor).toEqual(expected)
  })

  it('interpolates coherent source and target colors instead of recruiting random logical cells', () => {
    const sourceState = state('verse')
    const sourceFrame = frame({ signClock: 0, motionClockSign: 0 })
    const targetFrame = frame({ signClock: 1, motionClockSign: 1 })
    const middleFrame = frame({
      signClock: 1,
      motionClockSign: 1,
      signTransitionClock: 1 / 16,
      motionClockSignTransition: 1 / 16,
      signTransitionSourceFrame: 0,
      signTransitionTargetFrame: 1,
      motionClockSignTransitionSourceFrame: 0,
      motionClockSignTransitionTargetFrame: 1,
    })
    const source = composePixGridLogicalFrame(PRESET, sourceState, sourceFrame).pixels
    const target = composePixGridLogicalFrame(PRESET, sourceState, targetFrame).pixels
    const middle = composePixGridLogicalFrame(PRESET, sourceState, middleFrame).pixels

    let selectedSource = 0
    let selectedTarget = 0
    let interpolated = 0
    for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
      if (pixelEquals(middle, source, index)) selectedSource += 1
      else if (pixelEquals(middle, target, index)) selectedTarget += 1
      else interpolated += 1
    }

    expect(interpolated).toBeGreaterThan(0)
    expect(selectedSource).toBeGreaterThan(0)
    expect(selectedTarget).toBeGreaterThan(0)
  })
})

describe('Selected Scene deterministic seek ownership', () => {
  it.each(['verse', 'intro', 'drop'] as const)('reconstructs %s identically across repeated direct and backward seeks', scene => {
    const selectedState = state(scene)
    const previewClock = new PixGridSelectedScenePreviewClock()
    const motionClock = new PixGridMotionClock()
    selectedPreview(selectedState, 4, previewClock, motionClock)
    const first = selectedPreview(selectedState, 60, previewClock, motionClock)
    selectedPreview(selectedState, 12, previewClock, motionClock)
    const repeated = selectedPreview(selectedState, 60, previewClock, motionClock)
    const direct = selectedPreview(selectedState, 60)
    const firstPixels = composePixGridLogicalFrame(PRESET, selectedState, first).pixels
    const repeatedPixels = composePixGridLogicalFrame(PRESET, selectedState, repeated).pixels
    const directPixels = composePixGridLogicalFrame(PRESET, selectedState, direct).pixels

    expect(first).toMatchObject({
      sectionType: scene,
      previewElapsedBar: 60,
      restoringFromTransparency: false,
      trackMapCueEvent: false,
      trackMapCueIdentity: null,
    })
    expect(first.signClock).toBe(repeated.signClock)
    expect(first.signClock).toBe(direct.signClock)
    expect(first.motionClockSign).toBe(repeated.motionClockSign)
    expect(first.motionClockSign).toBe(direct.motionClockSign)
    expect(first.signTransitionSourceFrame).toBe(repeated.signTransitionSourceFrame)
    expect(first.signTransitionTargetFrame).toBe(repeated.signTransitionTargetFrame)
    expect(firstPixels).toEqual(repeatedPixels)
    expect(firstPixels).toEqual(directPixels)
    expect(activeCells(firstPixels)).toBeGreaterThan(8_000)
  })

  it('lets a manually selected Outro use only its own preview power lifecycle', () => {
    const selectedState = state('outro')
    const early = selectedPreview(selectedState, 0.25)
    const repeated = selectedPreview(selectedState, 0.25)
    const complete = selectedPreview(selectedState, 60)
    const earlyPixels = composePixGridLogicalFrame(PRESET, selectedState, early).pixels
    const repeatedPixels = composePixGridLogicalFrame(PRESET, selectedState, repeated).pixels
    const completePixels = composePixGridLogicalFrame(PRESET, selectedState, complete).pixels

    expect(early).toMatchObject({
      sectionType: 'outro',
      previewElapsedBar: 0.25,
      restoringFromTransparency: false,
    })
    expect(earlyPixels).toEqual(repeatedPixels)
    expect(activeCells(earlyPixels)).toBeGreaterThan(0)
    expect(activeCells(completePixels)).toBe(0)
  })
})
