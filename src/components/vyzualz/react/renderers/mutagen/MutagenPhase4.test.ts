import { describe, expect, it } from 'vitest'
import { CANVAS_PRESET_BY_ID } from '../../ReactTypes'
import { CANVAS_OUTPUT_AVAILABLE, CANVAS_FRACTURES_OUTPUT_DEFERRED } from '../../canvasFracturesOutputContract'
import { isMutagenOwnerPending, resolveMutagenCaptureCapability, resolveMutagenSourceAlpha } from './MutagenOutputContract'
import { resolveMutagenFramePlan } from './MutagenRenderPlan'
import { resolveMutagenRenderSize } from './MutagenRenderer'
import { DEFAULT_CANVAS_MUTAGEN_SETTINGS as defaults } from './MutagenSettings'
import { mergeReactStoreState, reactStorePartialize, useReactStore } from '../../../../../stores/reactStore'

describe('MUTAGEN Phase 4 ownership and compatibility', () => {
  it('waits for the requested authored/show owner and rejects an old show frame', () => {
    expect(isMutagenOwnerPending({ showId: 'new', authored: false, frame: { runtimeMode: 'show', frameIdentity: 'canvas-show:old:e' } })).toBe(true)
    expect(isMutagenOwnerPending({ showId: 'new', authored: false, frame: { runtimeMode: 'show', frameIdentity: 'canvas-show:new:e' } })).toBe(false)
    expect(isMutagenOwnerPending({ showId: null, authored: true, frame: null })).toBe(true)
    expect(isMutagenOwnerPending({ showId: null, authored: true, frame: { runtimeMode: 'authored', frameIdentity: 'layers' } })).toBe(false)
  })

  it('retains legacy alpha only as a single processed/fallback contribution', () => {
    expect(resolveMutagenSourceAlpha({ sourceMixMode: 'dryOnly', drySourceMix: 0 })).toBe(1)
    expect(resolveMutagenSourceAlpha({ sourceMixMode: 'legacyComposite', drySourceMix: 0.25 })).toBe(0.25)
    expect(resolveMutagenSourceAlpha({ sourceMixMode: 'legacyComposite', drySourceMix: 0 })).toBe(0)
  })

  it('reports missing source/handoff as unavailable, a drawable fallback as available, and preserves other output contracts', () => {
    const input = { base: CANVAS_OUTPUT_AVAILABLE, selected: true, orchestrationRenderable: false, ownerPending: false, sourceReady: false }
    expect(resolveMutagenCaptureCapability(input).status).toBe('unavailable')
    expect(resolveMutagenCaptureCapability({ ...input, sourceReady: true }).status).toBe('available')
    expect(resolveMutagenCaptureCapability({ ...input, sourceReady: true, ownerPending: true }).status).toBe('unavailable')
    expect(resolveMutagenCaptureCapability({ ...input, orchestrationRenderable: true }).status).toBe('available')
    expect(resolveMutagenCaptureCapability({ ...input, orchestrationRenderable: true, base: CANVAS_FRACTURES_OUTPUT_DEFERRED })).toBe(CANVAS_FRACTURES_OUTPUT_DEFERRED)
    expect(resolveMutagenCaptureCapability({ ...input, selected: false })).toBe(CANVAS_OUTPUT_AVAILABLE)
  })

  it.each([[1280, 720, 'balanced', 1280], [1920, 1080, 'balanced', 1920], [3840, 2160, 'low', 960]] as const)('keeps Auto resolution and shader/history budgets consistent at %d × %d', (width, height, tier, internalWidth) => {
    const size = resolveMutagenRenderSize(width, height, 1, 'auto')
    const plan = resolveMutagenFramePlan({ ...defaults, quality: 'auto', feedback: 1 }, width, height)
    expect(size.width).toBe(internalWidth)
    expect(plan.tier).toBe(tier)
    expect(plan.feedbackScale).toBe(tier === 'low' ? 0.5 : 0.75)
    expect(plan.heightSteps).toBe(tier === 'low' ? 10 : 16)
    expect(plan.maxTargets).toBe(4)
    expect(plan.feedbackPasses).toBe(1)
  })

  it('round-trips settings/media locks without putting media or renderer state into SYSTEM recipes', () => {
    useReactStore.getState().resetReactView()
    useReactStore.getState().selectCanvasMediaItem('user-only-media')
    useReactStore.getState().selectCanvasPreset('canvas-mutagen')
    useReactStore.getState().setCanvasPresetSettings({ mutagen: { ...defaults, pattern: 'terraform', deterministicSeed: 71 } })
    const saved = JSON.parse(JSON.stringify(reactStorePartialize(useReactStore.getState())))
    const hydrated = mergeReactStoreState(saved, useReactStore.getState())
    expect(hydrated.canvasPresetSettings.mutagen.pattern).toBe('terraform')
    expect(hydrated.canvasEngineSettings.manualMediaOverrideId).toBe('user-only-media')
    expect(hydrated.activeCanvasMediaId).toBe('user-only-media')
    expect(JSON.stringify(CANVAS_PRESET_BY_ID['canvas-mutagen'])).not.toContain('user-only-media')
    expect(CANVAS_PRESET_BY_ID['canvas-mutagen'].settings.mutagen).toEqual(defaults)
  })
})
