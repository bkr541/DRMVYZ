import { beforeEach, describe, expect, it } from 'vitest'
import { CANVAS_PRESET_BY_ID, type CanvasMediaItem } from '../components/vyzualz/react/ReactTypes'
import { useReactStore } from './reactStore'

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('canvas')
})

describe('CANVAS orchestration persistence and compatibility', () => {
  it('keeps orchestration opt-in and preserves every existing CANVAS preset', () => {
    expect(useReactStore.getState().canvasOrchestrationSettings.enabled).toBe(false)
    expect(Object.keys(CANVAS_PRESET_BY_ID)).toEqual(expect.arrayContaining([
      'canvas-clean-playback',
      'canvas-bass-bloom',
      'canvas-ghost-echo',
      'canvas-glitch-pulse',
      'canvas-luma-melt',
      'canvas-frame-stutter',
      'canvas-particle-aura',
    ]))
  })

  it('adds manual selections to the multi-media pool without changing manual selection or Auto Select locks', () => {
    useReactStore.getState().setCanvasAutoSelectEnabled(true)
    useReactStore.getState().selectCanvasMediaItem('library-video-1')
    expect(useReactStore.getState().activeCanvasMediaId).toBe('library-video-1')
    expect(useReactStore.getState().canvasEngineSettings.manualMediaOverrideId).toBe('library-video-1')
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toContain('library-video-1')

    useReactStore.getState().applyCanvasAutoSelection({ mediaId: 'library-image-2', presetId: 'canvas-bass-bloom' })
    expect(useReactStore.getState().activeCanvasMediaId).toBe('library-video-1')
  })

  it('removes cleared local media from pools, roles, and locks without disturbing library references', () => {
    const local: CanvasMediaItem = {
      id: 'local-video',
      name: 'Local video',
      type: 'video',
      objectUrl: 'blob:local-video',
      thumbnailUrl: null,
      mimeType: 'video/mp4',
      meta: 'VIDEO',
      source: 'legacySession',
      createdAt: new Date(0).toISOString(),
    }
    useReactStore.getState().addCanvasMediaItems([local])
    useReactStore.getState().selectCanvasMediaItem(local.id)
    useReactStore.getState().setCanvasMediaRoles(local.id, ['hero'])
    useReactStore.getState().setCanvasMediaLock('hero', local.id)
    useReactStore.getState().toggleCanvasMediaPoolItem('library-keep', true)
    const revisionBefore = useReactStore.getState().canvasOrchestrationSettings.poolRevision

    useReactStore.getState().clearCanvasMediaItems()

    const state = useReactStore.getState()
    expect(state.canvasOrchestrationSettings.mediaPoolIds).toEqual(['library-keep'])
    expect(state.canvasOrchestrationSettings.mediaRolesById[local.id]).toBeUndefined()
    expect(state.canvasOrchestrationSettings.mediaLocksByLayer.hero).toBeUndefined()
    expect(state.canvasOrchestrationSettings.poolRevision).toBe(revisionBefore + 1)
  })

  it('persists user-facing roles and locks but resets volatile orchestration choices cleanly', () => {
    useReactStore.getState().selectCanvasMediaItem('hero-a')
    useReactStore.getState().setCanvasMediaRoles('hero-a', ['hero', 'dropAsset'])
    useReactStore.getState().setCanvasMediaLock('hero', 'hero-a')
    useReactStore.getState().setCanvasLayerLock('hero', true)
    useReactStore.getState().setCanvasOrchestrationSettings({
      enabled: true,
      programId: 'canvas-dreamstate-media-tunnel',
      complexity: 0.9,
      transitionDensity: 0.63,
      effectIntensity: 0.74,
      motionIntensity: 0.58,
      cutDensity: 0.67,
      compositionPreference: 'echoTunnel',
    })

    expect(useReactStore.getState().canvasOrchestrationSettings).toMatchObject({
      enabled: true,
      programId: 'canvas-dreamstate-media-tunnel',
      complexity: 0.9,
      transitionDensity: 0.63,
      effectIntensity: 0.74,
      motionIntensity: 0.58,
      cutDensity: 0.67,
      compositionPreference: 'echoTunnel',
      mediaRolesById: { 'hero-a': ['hero', 'dropAsset'] },
      mediaLocksByLayer: { hero: 'hero-a' },
      layerLocks: { hero: true },
    })

    useReactStore.getState().resetCanvasOrchestration()
    expect(useReactStore.getState().canvasOrchestrationSettings.enabled).toBe(false)
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toContain('hero-a')
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaRolesById['hero-a']).toEqual(['hero', 'dropAsset'])
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaLocksByLayer).toEqual({})
  })
})
