import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_REACT_PRESETS } from '../../ReactTypes'
import { useReactStore } from '../../../../../stores/reactStore'

const mocks = vi.hoisted(() => ({
  renderReactEngine: vi.fn(),
  clearLaserDmxVisualState: vi.fn(),
  disposeLaserDmxRenderer: vi.fn(),
  clearNeonLatticeVisualState: vi.fn(),
  disposeCinematicPortalRenderer: vi.fn(),
}))

vi.mock('../ReactEngineRenderer', () => ({ renderReactEngine: mocks.renderReactEngine }))
vi.mock('../LaserDmxRenderer', () => ({
  clearLaserDmxVisualState: mocks.clearLaserDmxVisualState,
  disposeLaserDmxRenderer: mocks.disposeLaserDmxRenderer,
}))
vi.mock('../NeonLatticeRenderer', () => ({ clearNeonLatticeVisualState: mocks.clearNeonLatticeVisualState }))
vi.mock('../CinematicPortalRenderer', () => ({ disposeCinematicPortalRenderer: mocks.disposeCinematicPortalRenderer }))

import {
  clearReactPresetThumbnailCacheForTests,
  fingerprintReactPresetThumbnail,
  getReactPresetThumbnailDiagnosticsForTests,
  renderReactPresetThumbnail,
} from '../ReactPresetThumbnailRenderer'

interface FakeCanvas extends Partial<HTMLCanvasElement> {
  width: number
  height: number
  getContext: ReturnType<typeof vi.fn>
  toDataURL: ReturnType<typeof vi.fn>
}

const canvases: FakeCanvas[] = []

function createFakeCanvas(): FakeCanvas {
  const context = { clearRect: vi.fn() } as unknown as CanvasRenderingContext2D
  const canvas: FakeCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toDataURL: vi.fn(() => 'data:image/png;base64,exact-preview'),
  }
  canvases.push(canvas)
  return canvas
}

describe('React preset thumbnail renderer final audit', () => {
  beforeEach(() => {
    clearReactPresetThumbnailCacheForTests()
    canvases.length = 0
    mocks.renderReactEngine.mockClear()
    mocks.clearLaserDmxVisualState.mockClear()
    mocks.disposeLaserDmxRenderer.mockClear()
    mocks.clearNeonLatticeVisualState.mockClear()
    mocks.disposeCinematicPortalRenderer.mockClear()
    vi.stubGlobal('document', { createElement: vi.fn(() => createFakeCanvas()) })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fingerprints all Reactive Constellation appearance payloads', () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'preset-crimson-collapse')!
    const baseline = fingerprintReactPresetThumbnail(preset)
    const changed = {
      ...preset,
      palette: { ...preset.palette, accent: '#123456' },
      cinematicConfig: {
        ...preset.cinematicConfig!,
        seed: preset.cinematicConfig!.seed + 1,
        material: { ...preset.cinematicConfig!.material, bloom: 0.12 },
        worldSettings: preset.cinematicConfig!.worldSettings.mode === 'reactiveConstellation'
          ? {
              mode: 'reactiveConstellation' as const,
              settings: { ...preset.cinematicConfig!.worldSettings.settings, nodeCount: 17 },
            }
          : preset.cinematicConfig!.worldSettings,
      },
      scenes: preset.scenes.map((scene, index) => index === 0
        ? { ...scene, params: { ...scene.params, motion: 0.91 } }
        : scene),
    }
    expect(fingerprintReactPresetThumbnail(changed)).not.toBe(baseline)
    expect(fingerprintReactPresetThumbnail(structuredClone(preset))).toBe(baseline)
  })

  it('warms the actual engine deterministically and disposes all owned transient resources', async () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'preset-cyan-reverie')!
    const laserBefore = useReactStore.getState().laserDmxSettings

    await expect(renderReactPresetThumbnail(preset, { width: 240, height: 135 }))
      .resolves.toBe('data:image/png;base64,exact-preview')

    expect(mocks.renderReactEngine).toHaveBeenCalledTimes(54)
    expect(mocks.renderReactEngine.mock.calls[0][1]).toMatchObject({ timingDiscontinuity: true, isPlaying: true })
    expect(mocks.renderReactEngine.mock.calls[mocks.renderReactEngine.mock.calls.length - 1]?.[1]).toMatchObject({ isPlaying: true })
    expect(mocks.disposeCinematicPortalRenderer).toHaveBeenCalledTimes(1)
    expect(mocks.disposeLaserDmxRenderer).toHaveBeenCalledTimes(1)
    expect(useReactStore.getState().laserDmxSettings).toBe(laserBefore)
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 })
  })

  it('bounds concurrent context creation and releases queued previews', async () => {
    const presets = ['preset-crimson-collapse', 'preset-cyan-reverie', 'preset-trapwire']
      .map(id => DEFAULT_REACT_PRESETS.find(candidate => candidate.id === id)!)
    const promises = presets.map(preset => renderReactPresetThumbnail(preset))

    expect(getReactPresetThumbnailDiagnosticsForTests()).toMatchObject({
      activeJobs: 2,
      queuedJobs: 1,
      concurrencyLimit: 2,
    })

    await expect(Promise.all(promises)).resolves.toEqual([
      'data:image/png;base64,exact-preview',
      'data:image/png;base64,exact-preview',
      'data:image/png;base64,exact-preview',
    ])
    expect(getReactPresetThumbnailDiagnosticsForTests()).toMatchObject({ activeJobs: 0, queuedJobs: 0 })
    expect(mocks.disposeCinematicPortalRenderer).toHaveBeenCalledTimes(3)
    expect(mocks.disposeLaserDmxRenderer).toHaveBeenCalledTimes(3)
  })

  it('falls back to null and still disposes when preview serialization fails', async () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'preset-minimal-skeleton')!
    vi.mocked(document.createElement).mockImplementationOnce(() => {
      const canvas = createFakeCanvas()
      canvas.toDataURL.mockImplementation(() => { throw new Error('serialization failed') })
      return canvas as HTMLCanvasElement
    })

    await expect(renderReactPresetThumbnail(preset)).resolves.toBeNull()
    expect(mocks.disposeCinematicPortalRenderer).toHaveBeenCalledTimes(1)
    expect(mocks.disposeLaserDmxRenderer).toHaveBeenCalledTimes(1)
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 })
    expect(getReactPresetThumbnailDiagnosticsForTests().cacheEntries).toBe(0)
  })
})
