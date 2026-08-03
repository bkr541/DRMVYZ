import { describe, expect, it } from 'vitest'
import type { ReactPreset } from '../../ReactTypes'
import { compilePixGridDeckRasterFrame, createPixGridDeckCompilerCacheKey } from '../PixGridDeckCompilerCore'
import type {
  PixGridDeckConcreteTransitionMode,
  PixGridDeckTransitionPlan,
  PixGridPreparedFrame,
  PixGridPreparedFrameSet,
} from '../PixGridDeckCompilerContracts'
import {
  DEFAULT_PIX_GRID_DECK_CONFIGURATION,
  type PixGridDeckDefinition,
  type PixGridDeckTransitionMode,
} from '../PixGridDeckDomain'
import {
  compilePixGridDeckPreparedFrameTransition,
  createPixGridDeckTransitionCacheKey,
} from '../PixGridDeckTransitionPlanner'
import {
  composePixGridDeckRuntimeFrame,
  createPixGridDeckCompositorScratch,
} from '../PixGridDeckCompositor'
import {
  pixGridDeckGeneratedGroupId,
  resolvePixGridDeckRuntimeFrameSource,
  type PixGridDeckRuntimeFrameSource,
} from '../PixGridDeckRuntime'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { updatePixGridLayer } from '../PixGridAuthoring'
import { resolvePixGridLayerFrameSource } from '../PixGridFrameSources'
import { mergePixGridCanonicalLayerGraph, repairPixGridLayerReferences } from '../PixGridCanonicalGraph'
import { PixGridFrameGroupCompiler } from '../PixGridGroupCompiler'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import type { PixGridAudioFrame, PixGridGroup, PixGridLayer, PixGridState } from '../PixGridTypes'
import { normalizePixGridState } from '../PixGridValidation'
import type { PixGridSequencePlan } from '../PixGridSequenceClock'

const WIDTH = 64
const HEIGHT = 36
const DECK_ID = 'runtime-deck'
const PRESET_ID = 'pix-grid-deck:runtime-deck'
const SOURCE_ITEM_ID = 'runtime-item-source'
const TARGET_ITEM_ID = 'runtime-item-target'

function preparedFrame(input: {
  id: string
  mediaId: string
  lit: (x: number, y: number) => boolean
  color: readonly [number, number, number]
}): PixGridPreparedFrame {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
  const alpha = new Uint8Array(WIDTH * HEIGHT)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (!input.lit(x, y)) continue
      const cell = y * WIDTH + x
      const offset = cell * 4
      pixels[offset] = input.color[0]
      pixels[offset + 1] = input.color[1]
      pixels[offset + 2] = input.color[2]
      pixels[offset + 3] = 255
      alpha[cell] = 255
    }
  }
  return compilePixGridDeckRasterFrame({
    cacheKey: createPixGridDeckCompilerCacheKey({
      sourceFingerprint: `sha256:${input.id}`,
      sourceRevision: 1,
      mimeType: 'image/png',
      width: WIDTH,
      height: HEIGHT,
      transparentBackground: '#000000',
      hasAlpha: true,
    }),
    mediaId: input.mediaId,
    sourceFingerprint: `sha256:${input.id}`,
    sourceRevision: 1,
    rasterPixels: pixels,
    sourceAlpha: alpha,
    width: WIDTH,
    height: HEIGHT,
    transparentBackground: '#000000',
    hasAlpha: true,
  })
}

const sourceFrame = preparedFrame({
  id: 'source',
  mediaId: 'runtime-media-source',
  lit: (x, y) => x >= 8 && x <= 15 && y >= 10 && y <= 25,
  color: [0, 217, 255],
})
const targetFrame = preparedFrame({
  id: 'target',
  mediaId: 'runtime-media-target',
  lit: (x, y) => x >= 42 && x <= 49 && y >= 8 && y <= 23,
  color: [0, 217, 130],
})

function deck(revision = 1): PixGridDeckDefinition {
  return {
    schemaVersion: 1,
    id: DECK_ID,
    name: 'Runtime Deck',
    revision,
    generatedPresetId: PRESET_ID,
    items: [
      {
        id: SOURCE_ITEM_ID,
        mediaId: sourceFrame.mediaId,
        enabled: true,
        order: 0,
        revision: 1,
        timingOverrideBeats: null,
        source: {
          mediaRevision: 1,
          fingerprint: 'sha256:source',
          fileName: 'source.png',
          mimeType: 'image/png',
          width: WIDTH,
          height: HEIGHT,
          hasAlpha: true,
          transparentBackground: '#000000',
        },
      },
      {
        id: TARGET_ITEM_ID,
        mediaId: targetFrame.mediaId,
        enabled: true,
        order: 1,
        revision: 1,
        timingOverrideBeats: null,
        source: {
          mediaRevision: 1,
          fingerprint: 'sha256:target',
          fileName: 'target.png',
          mimeType: 'image/png',
          width: WIDTH,
          height: HEIGHT,
          hasAlpha: true,
          transparentBackground: '#000000',
        },
      },
    ],
    configuration: {
      ...DEFAULT_PIX_GRID_DECK_CONFIGURATION,
      transitionPolicy: { ...DEFAULT_PIX_GRID_DECK_CONFIGURATION.transitionPolicy },
    },
  }
}

function frameSet(revision = 1): PixGridPreparedFrameSet {
  return {
    schemaVersion: 1,
    deckId: DECK_ID,
    deckRevision: revision,
    width: WIDTH,
    height: HEIGHT,
    frameCacheKeys: [sourceFrame.cacheKey, targetFrame.cacheKey],
    frames: [sourceFrame, targetFrame],
  }
}

function transitionPlan(mode: PixGridDeckTransitionMode): PixGridDeckTransitionPlan {
  const settings = {
    requestedMode: mode,
    sourceItemId: SOURCE_ITEM_ID,
    targetItemId: TARGET_ITEM_ID,
    durationFraction: 0.25,
  } as const
  return compilePixGridDeckPreparedFrameTransition({
    cacheKey: createPixGridDeckTransitionCacheKey({
      sourceFrameCacheKey: sourceFrame.cacheKey,
      targetFrameCacheKey: targetFrame.cacheKey,
      settings,
    }),
    source: sourceFrame,
    target: targetFrame,
    settings,
  })
}

function sequencePlan(progress: number, mode: PixGridDeckTransitionMode): PixGridSequencePlan {
  return {
    clockId: 'PixGridSequenceClock',
    deckId: DECK_ID,
    presetId: PRESET_ID,
    order: 'forward',
    absoluteBar: 1 + progress,
    sequenceBar: 1 + progress,
    frameEpoch: 1,
    sequenceCycle: 0,
    activeItemId: SOURCE_ITEM_ID,
    activeFrameId: sourceFrame.cacheKey,
    nextItemId: TARGET_ITEM_ID,
    nextFrameId: targetFrame.cacheKey,
    sourceItemId: SOURCE_ITEM_ID,
    sourceFrameId: sourceFrame.cacheKey,
    targetItemId: TARGET_ITEM_ID,
    targetFrameId: targetFrame.cacheKey,
    eligibleItemIds: [SOURCE_ITEM_ID, TARGET_ITEM_ID],
    eligibleFrameIds: [sourceFrame.cacheKey, targetFrame.cacheKey],
    boundaryIdentity: 'runtime-boundary:1',
    transitionArmedBy: null,
    transitionWindow: {
      permitted: true,
      active: true,
      startBar: 1,
      endBar: 1.25,
      progress,
      boundaryIdentity: 'runtime-boundary:1',
      quantization: 'bar',
      mode,
      durationBeats: 1,
      durationFraction: 0.25,
      pairOverride: false,
    },
    hold: { active: false, reason: null, behavior: null },
    effect: 'none',
  }
}

function resolveSource(
  progress: number,
  requestedMode: PixGridDeckTransitionMode,
  plan: PixGridDeckTransitionPlan | null = transitionPlan(requestedMode),
): PixGridDeckRuntimeFrameSource {
  const resolution = resolvePixGridDeckRuntimeFrameSource({
    deck: deck(),
    preparedFrameSet: frameSet(),
    sequencePlan: sequencePlan(progress, requestedMode),
    transitionPlan: plan,
    width: WIDTH,
    height: HEIGHT,
  })
  expect(['ready', 'ready-fallback']).toContain(resolution.status)
  expect(resolution.source).not.toBeNull()
  return resolution.source!
}

function audioFrame(): PixGridAudioFrame {
  return {
    audioTime: 1,
    bass: 0,
    mid: 0,
    high: 0,
    volume: 0,
    beatHit: false,
    beatPhase: 0,
    isPlaying: true,
    motionMultiplier: 1,
    autoPerformanceEnabled: false,
  }
}

function deckState(
  group?: PixGridGroup,
  compatibilityAssetId: string = 'pix-checkerboard',
): Readonly<{ preset: ReactPreset; state: PixGridState; layerId: string }> {
  const canonicalPreset = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), canonicalPreset.id, canonicalPreset.pixGridSettings)
  const baseLayer = applied.layers[0]!
  const layerId = 'runtime-deck-layer'
  const layer = {
    ...baseLayer,
    assetId: compatibilityAssetId,
    id: layerId,
    name: 'Runtime Deck Layer',
    frameSource: { kind: 'deck' as const, deckId: DECK_ID },
    mediaId: null,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal' as const,
    position: { x: 0.5, y: 0.5 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    flipX: false,
    flipY: false,
    clipMode: 'clip' as const,
    animations: [],
    audioReactivity: undefined,
    densityRank: 0,
  } as unknown as PixGridLayer
  const sceneId = 'runtime-deck-scene'
  const state = normalizePixGridState({
    ...applied,
    quality: 'draft',
    selectedPresetId: PRESET_ID,
    selectedSceneId: sceneId,
    pattern: 'mediaDeck',
    layers: [layer],
    scenes: [{ id: sceneId, name: 'Runtime Deck Scene', layerIds: [layerId], pixelOverrides: [] }],
    groups: group ? [group] : [],
    audioAssignments: [],
    pixelOverrides: [],
    performance: { ...applied.performance, enabled: false },
    editor: { ...applied.editor, selectedLayerId: layerId },
  })
  const preset: ReactPreset = {
    ...canonicalPreset,
    id: PRESET_ID,
    name: 'Runtime Deck Fixture',
    pixGridSettings: {
      ...canonicalPreset.pixGridSettings,
      pattern: 'mediaDeck',
      layers: [layer],
      groups: group ? [group] : [],
      audioAssignments: [],
    },
  }
  return { preset, state, layerId }
}

function alphaCellCount(pixels: Uint8Array): number {
  let count = 0
  for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset]! > 0) count += 1
  return count
}

function hash(pixels: Uint8Array): string {
  let value = 0x811c9dc5
  for (const byte of pixels) {
    value ^= byte
    value = Math.imul(value, 0x01000193)
  }
  return (value >>> 0).toString(16)
}

describe('PixGrid Deck Stage 6 runtime rendering', () => {
  it('normalizes Deck frame sources while preserving legacy asset and media aliases', () => {
    const base = createDefaultPixGridState().layers[0]!
    expect(resolvePixGridLayerFrameSource({ ...base, frameSource: { kind: 'deck', deckId: DECK_ID } }))
      .toEqual({ kind: 'deck', deckId: DECK_ID })
    expect(resolvePixGridLayerFrameSource({ ...base, frameSource: undefined, mediaId: 'legacy-media' }))
      .toEqual({ kind: 'media', mediaId: 'legacy-media' })
    expect(resolvePixGridLayerFrameSource({ ...base, frameSource: undefined, mediaId: null }))
      .toEqual({ kind: 'asset', assetId: base.assetId })

    const state = createDefaultPixGridState()
    const layer = state.layers[0]!
    const mediaState = updatePixGridLayer(state, layer.id, { mediaId: 'legacy-editor-media' })
    expect(resolvePixGridLayerFrameSource(mediaState.layers[0]!))
      .toEqual({ kind: 'media', mediaId: 'legacy-editor-media' })
    const assetState = updatePixGridLayer(mediaState, layer.id, { mediaId: null, assetId: 'pix-five-point-star' })
    expect(resolvePixGridLayerFrameSource(assetState.layers[0]!))
      .toEqual({ kind: 'asset', assetId: 'pix-five-point-star' })
  })

  it('preserves a Deck source that collides with a canonical layer ID as a referenced overlay', () => {
    const canonicalPreset = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!
    const applied = applyPixGridPresetSettings(createDefaultPixGridState(), canonicalPreset.id, canonicalPreset.pixGridSettings)
    const canonicalLayer = applied.layers[0]!
    const deckLayer = {
      ...canonicalLayer,
      frameSource: { kind: 'deck' as const, deckId: DECK_ID },
      mediaId: null,
    }
    const authored = normalizePixGridState({
      ...applied,
      layers: [deckLayer, ...applied.layers.slice(1)],
    })
    const merged = mergePixGridCanonicalLayerGraph(authored, canonicalPreset)
    const overlayId = merged.layerIdMap.get(canonicalLayer.id)
    expect(overlayId).toBe(`${canonicalLayer.id}-user-overlay`)
    expect(merged.layers.find(layer => layer.id === canonicalLayer.id)?.frameSource?.kind).toBe('asset')
    expect(resolvePixGridLayerFrameSource(merged.layers.find(layer => layer.id === overlayId)!))
      .toEqual({ kind: 'deck', deckId: DECK_ID })

    const repaired = repairPixGridLayerReferences(
      authored,
      canonicalPreset,
      merged.layers,
      merged.layerIdMap,
      authored.groups,
      authored.audioAssignments,
    )
    const scene = repaired.scenes.find(candidate => candidate.id === authored.selectedSceneId)!
    expect(scene.layerIds).toContain(canonicalLayer.id)
    expect(scene.layerIds).toContain(overlayId)
  })

  it('reconstructs exact source and target endpoints for every concrete transition mode', () => {
    const modes: PixGridDeckTransitionMode[] = [
      'pixelTransport', 'pixelDissolve', 'crossfade', 'rowWipe', 'columnWipe',
      'checkerWipe', 'radialReveal', 'hardCut',
    ]
    const scratch = createPixGridDeckCompositorScratch()
    for (const requestedMode of modes) {
      const plan = transitionPlan(requestedMode)
      const start = composePixGridDeckRuntimeFrame(resolveSource(0, requestedMode, plan), scratch)
      expect(Array.from(start.pixels), `${requestedMode} source endpoint`).toEqual(Array.from(sourceFrame.pixels))
      const end = composePixGridDeckRuntimeFrame(resolveSource(1, requestedMode, plan), scratch)
      expect(Array.from(end.pixels), `${requestedMode} target endpoint`).toEqual(Array.from(targetFrame.pixels))
      const middle = composePixGridDeckRuntimeFrame(resolveSource(0.5, requestedMode, plan), scratch)
      expect(middle.pixels.length).toBe(WIDTH * HEIGHT * 4)
      expect(alphaCellCount(middle.pixels)).toBeGreaterThan(0)
      expect(Object.values(middle.masks).every(mask => mask.length === WIDTH * HEIGHT)).toBe(true)
    }
  })

  it('reuses Deck compositor buffers across frames at a stable matrix size', () => {
    const scratch = createPixGridDeckCompositorScratch()
    const first = composePixGridDeckRuntimeFrame(resolveSource(0.25, 'crossfade'), scratch)
    const pixelBuffer = first.pixels
    const maskBuffers = Object.fromEntries(Object.entries(first.masks))
    const second = composePixGridDeckRuntimeFrame(resolveSource(0.75, 'crossfade'), scratch)
    expect(second.pixels).toBe(pixelBuffer)
    for (const [name, mask] of Object.entries(maskBuffers)) {
      expect(second.masks[name as keyof typeof second.masks]).toBe(mask)
    }
  })

  it('uses immutable prepared artifacts and deterministic output at arbitrary seeks', () => {
    const sourceBefore = sourceFrame.pixels.slice()
    const targetBefore = targetFrame.pixels.slice()
    const plan = transitionPlan('pixelTransport')
    const source = resolveSource(0.375, 'pixelTransport', plan)
    const first = composePixGridDeckRuntimeFrame(source).pixels.slice()
    const second = composePixGridDeckRuntimeFrame(resolveSource(0.375, 'pixelTransport', plan)).pixels.slice()
    expect(second).toEqual(first)
    expect(sourceFrame.pixels).toEqual(sourceBefore)
    expect(targetFrame.pixels).toEqual(targetBefore)
  })

  it('rejects stale Deck revisions and matrix sizes and falls back safely for a stale pair plan', () => {
    expect(resolvePixGridDeckRuntimeFrameSource({
      deck: deck(2), preparedFrameSet: frameSet(1), sequencePlan: sequencePlan(0.5, 'crossfade'),
      transitionPlan: transitionPlan('crossfade'), width: WIDTH, height: HEIGHT,
    })).toMatchObject({ status: 'revision-mismatch', source: null })

    expect(resolvePixGridDeckRuntimeFrameSource({
      deck: deck(), preparedFrameSet: frameSet(), sequencePlan: sequencePlan(0.5, 'crossfade'),
      transitionPlan: transitionPlan('crossfade'), width: 96, height: 54,
    })).toMatchObject({ status: 'resolution-mismatch', source: null })

    const staleSourceFrame = { ...sourceFrame, sourceRevision: sourceFrame.sourceRevision + 1 }
    expect(resolvePixGridDeckRuntimeFrameSource({
      deck: deck(),
      preparedFrameSet: {
        ...frameSet(),
        frameCacheKeys: [staleSourceFrame.cacheKey, targetFrame.cacheKey],
        frames: [staleSourceFrame, targetFrame],
      },
      sequencePlan: sequencePlan(0.5, 'crossfade'),
      transitionPlan: transitionPlan('crossfade'),
      width: WIDTH,
      height: HEIGHT,
    })).toMatchObject({ status: 'missing-frame', source: null })

    const stalePlan = {
      ...transitionPlan('pixelTransport'),
      sourceFrameCacheKey: 'stale-source-frame',
    }
    const fallback = resolvePixGridDeckRuntimeFrameSource({
      deck: deck(), preparedFrameSet: frameSet(), sequencePlan: sequencePlan(0.5, 'pixelTransport'),
      transitionPlan: stalePlan, width: WIDTH, height: HEIGHT,
    })
    expect(fallback.status).toBe('ready-fallback')
    expect(fallback.source?.transitionMode).toBe('pixelDissolve')
    expect(fallback.source?.fallbackReason).toBe('invalid-transition-plan')
  })

  it('keeps Deck runtime pixels independent of the legacy compatibility asset alias', () => {
    const source = resolveSource(0.5, 'crossfade')
    const render = (compatibilityAssetId: string) => {
      const { preset, state } = deckState(undefined, compatibilityAssetId)
      return composePixGridLogicalFrame(
        preset,
        state,
        audioFrame(),
        undefined,
        undefined,
        undefined,
        null,
        [],
        undefined,
        null,
        source,
        createPixGridDeckCompositorScratch(),
      ).pixels
    }

    const neutral = render('pix-checkerboard')
    const legacyAlias = render('pix-neon-marquee-cycle')
    expect(Array.from(legacyAlias)).toEqual(Array.from(neutral))
    expect(hash(neutral)).toBe(hash(composePixGridDeckRuntimeFrame(source).pixels))
  })

  it('renders through the canonical logical compositor and registers generated Smart Group masks', () => {
    const { preset, state, layerId } = deckState()
    const compiler = new PixGridFrameGroupCompiler()
    const source = resolveSource(0, 'crossfade')
    const logical = composePixGridLogicalFrame(
      preset,
      state,
      audioFrame(),
      undefined,
      undefined,
      undefined,
      null,
      [],
      compiler,
      null,
      source,
      createPixGridDeckCompositorScratch(),
    )
    expect(logical.width).toBe(WIDTH)
    expect(logical.height).toBe(HEIGHT)
    expect(hash(logical.pixels)).toBe(hash(sourceFrame.pixels))
    const foregroundId = pixGridDeckGeneratedGroupId(DECK_ID, layerId, 'foreground')
    const foreground = compiler.compile({
      id: foregroundId,
      name: 'Deck Foreground',
      source: 'foregroundBackground',
      mask: { kind: 'runs', runs: [] },
      cellRuns: [],
      layerId,
      layerScope: [layerId],
      smartRuleId: `deck:${DECK_ID}:foreground`,
      enabled: true,
      visible: true,
      contentVisible: true,
      priority: 0,
      overlapBehavior: 'stack',
      reactions: [],
      displayColor: null,
    })
    expect(foreground.cellCount).toBe(sourceFrame.metrics.foregroundCellCount)
    expect(compiler.compiledGroupIds).toContain(foregroundId)
  })

  it('lets a generated Smart Group participate in canonical content visibility', () => {
    const layerId = 'runtime-deck-layer'
    const foregroundId = pixGridDeckGeneratedGroupId(DECK_ID, layerId, 'foreground')
    const group: PixGridGroup = {
      id: foregroundId,
      name: 'Deck Foreground',
      source: 'foregroundBackground',
      mask: { kind: 'runs', runs: [] },
      cellRuns: [],
      layerId,
      layerScope: [layerId],
      smartRuleId: `deck:${DECK_ID}:foreground`,
      enabled: true,
      visible: true,
      contentVisible: false,
      priority: 0,
      overlapBehavior: 'stack',
      reactions: [],
      displayColor: '#ffffff',
    }
    const { preset, state } = deckState(group)
    const logical = composePixGridLogicalFrame(
      preset,
      state,
      audioFrame(),
      undefined,
      undefined,
      undefined,
      null,
      [],
      new PixGridFrameGroupCompiler(),
      null,
      resolveSource(0, 'crossfade'),
      createPixGridDeckCompositorScratch(),
    )
    expect(alphaCellCount(logical.pixels)).toBe(0)
  })

  it('renders a transparent safe state when a Deck layer has no ready runtime source', () => {
    const { preset, state } = deckState()
    const logical = composePixGridLogicalFrame(preset, state, audioFrame())
    expect(alphaCellCount(logical.pixels)).toBe(0)
  })

  it('keeps the concrete transition mode aligned with the precompiled plan', () => {
    const requested: PixGridDeckTransitionMode[] = [
      'pixelTransport', 'pixelDissolve', 'crossfade', 'rowWipe', 'columnWipe',
      'checkerWipe', 'radialReveal', 'hardCut',
    ]
    for (const mode of requested) {
      const plan = transitionPlan(mode)
      const runtime = resolveSource(0.5, mode, plan)
      expect(runtime.transitionMode).toBe(plan.mode as PixGridDeckConcreteTransitionMode)
    }
  })
})
