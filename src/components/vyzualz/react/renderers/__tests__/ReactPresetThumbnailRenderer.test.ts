import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_REACT_PRESETS, type ReactPreset } from '../../ReactTypes'
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
  getReactPresetThumbnailFrameBudgetForTests,
  readCachedReactPresetThumbnail,
  renderReactPresetThumbnail,
  setReactPresetThumbnailSchedulerForTests,
  type ReactPresetThumbnailScheduler,
} from '../ReactPresetThumbnailRenderer'

interface FakeCanvas extends Partial<HTMLCanvasElement> {
  width: number
  height: number
  getContext: ReturnType<typeof vi.fn>
  toDataURL: ReturnType<typeof vi.fn>
}

interface ManualYield {
  signal: AbortSignal
  release: () => void
}

const canvases: FakeCanvas[] = []
const immediateScheduler: ReactPresetThumbnailScheduler = { yield: async () => {} }

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

function createManualScheduler() {
  const pending: ManualYield[] = []
  const scheduler: ReactPresetThumbnailScheduler = {
    yield: vi.fn((signal: AbortSignal): Promise<void> => {
      if (signal.aborted) return Promise.resolve()
      return new Promise<void>(resolve => {
        let settled = false
        const release = () => {
          if (settled) return
          settled = true
          signal.removeEventListener('abort', release)
          resolve()
        }
        signal.addEventListener('abort', release, { once: true })
        pending.push({ signal, release })
      })
    }),
  }
  return {
    scheduler,
    pending,
    async flushOne() {
      const next = pending.shift()
      if (!next) return false
      next.release()
      await Promise.resolve()
      await Promise.resolve()
      return true
    },
  }
}

async function flushManualScheduler(
  manual: ReturnType<typeof createManualScheduler>,
  done: () => boolean,
): Promise<void> {
  for (let guard = 0; guard < 200 && !done(); guard += 1) {
    if (!(await manual.flushOne())) await Promise.resolve()
  }
  expect(done()).toBe(true)
}

function preset(id: string): ReactPreset {
  return DEFAULT_REACT_PRESETS.find(candidate => candidate.id === id)!
}

describe('React preset thumbnail renderer scheduling', () => {
  beforeEach(() => {
    clearReactPresetThumbnailCacheForTests()
    setReactPresetThumbnailSchedulerForTests(immediateScheduler)
    canvases.length = 0
    mocks.renderReactEngine.mockClear()
    mocks.clearLaserDmxVisualState.mockClear()
    mocks.disposeLaserDmxRenderer.mockClear()
    mocks.clearNeonLatticeVisualState.mockClear()
    mocks.disposeCinematicPortalRenderer.mockClear()
    vi.stubGlobal('document', { createElement: vi.fn(() => createFakeCanvas()) })
  })

  afterEach(() => {
    clearReactPresetThumbnailCacheForTests()
    setReactPresetThumbnailSchedulerForTests(null)
    vi.unstubAllGlobals()
  })

  it('fingerprints every persisted appearance input and dimensions independently', () => {
    const source = preset('preset-crimson-collapse')
    const baseline = fingerprintReactPresetThumbnail(source)
    const changed = {
      ...source,
      palette: { ...source.palette, accent: '#123456' },
      cinematicConfig: {
        ...source.cinematicConfig!,
        seed: source.cinematicConfig!.seed + 1,
        material: { ...source.cinematicConfig!.material, bloom: 0.12 },
        worldSettings: source.cinematicConfig!.worldSettings.mode === 'reactiveConstellation'
          ? {
              mode: 'reactiveConstellation' as const,
              settings: { ...source.cinematicConfig!.worldSettings.settings, nodeCount: 17 },
            }
          : source.cinematicConfig!.worldSettings,
      },
      scenes: source.scenes.map((scene, index) => index === 0
        ? { ...scene, params: { ...scene.params, motion: 0.91 } }
        : scene),
    }
    expect(fingerprintReactPresetThumbnail(changed)).not.toBe(baseline)
    expect(fingerprintReactPresetThumbnail(structuredClone(source))).toBe(baseline)
  })

  it('uses a bounded engine-aware warm-up and low-cost thumbnail quality without mutating the live preset', async () => {
    const source = preset('preset-cyan-reverie')
    const originalQuality = source.cinematicConfig?.qualityTier
    const laserBefore = useReactStore.getState().laserDmxSettings
    const budget = getReactPresetThumbnailFrameBudgetForTests(source)

    await expect(renderReactPresetThumbnail(source, { width: 240, height: 135 }))
      .resolves.toBe('data:image/png;base64,exact-preview')

    expect(budget).toBeLessThan(12)
    expect(mocks.renderReactEngine).toHaveBeenCalledTimes(budget)
    expect(mocks.renderReactEngine.mock.calls[0][1]).toMatchObject({ timingDiscontinuity: true, isPlaying: true })
    expect(mocks.renderReactEngine.mock.calls[0][2]).toMatchObject({
      cinematicConfig: expect.objectContaining({ qualityTier: 'low' }),
    })
    expect(source.cinematicConfig?.qualityTier).toBe(originalQuality)
    expect(mocks.disposeCinematicPortalRenderer).toHaveBeenCalledTimes(1)
    expect(mocks.disposeLaserDmxRenderer).toHaveBeenCalledTimes(1)
    expect(useReactStore.getState().laserDmxSettings).toBe(laserBefore)
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 })
  })

  it('does not synchronously drain the collection and limits WebGL work to one job', async () => {
    const manual = createManualScheduler()
    setReactPresetThumbnailSchedulerForTests(manual.scheduler)
    const promises = [
      renderReactPresetThumbnail(preset('preset-crimson-collapse')),
      renderReactPresetThumbnail(preset('preset-cyan-reverie')),
      renderReactPresetThumbnail(preset('preset-trapwire')),
    ]

    expect(mocks.renderReactEngine).not.toHaveBeenCalled()
    expect(getReactPresetThumbnailDiagnosticsForTests()).toMatchObject({
      activeJobs: 0,
      queuedJobs: 3,
      concurrencyLimit: 1,
    })

    await manual.flushOne()
    expect(getReactPresetThumbnailDiagnosticsForTests()).toMatchObject({ activeJobs: 1, queuedJobs: 2 })
    expect(mocks.renderReactEngine).toHaveBeenCalledTimes(1)

    await flushManualScheduler(manual, () => getReactPresetThumbnailDiagnosticsForTests().pendingJobs === 0)
    await expect(Promise.all(promises)).resolves.toEqual([
      'data:image/png;base64,exact-preview',
      'data:image/png;base64,exact-preview',
      'data:image/png;base64,exact-preview',
    ])
  })

  it('deduplicates duplicate consumers onto one render job', async () => {
    const source = preset('preset-cyan-reverie')
    const first = renderReactPresetThumbnail(source)
    const second = renderReactPresetThumbnail(source)

    expect(getReactPresetThumbnailDiagnosticsForTests()).toMatchObject({ queuedJobs: 1, pendingJobs: 1 })
    await expect(Promise.all([first, second])).resolves.toEqual([
      'data:image/png;base64,exact-preview',
      'data:image/png;base64,exact-preview',
    ])
    expect(mocks.renderReactEngine).toHaveBeenCalledTimes(getReactPresetThumbnailFrameBudgetForTests(source))
    expect(canvases).toHaveLength(1)
  })

  it('removes a queued job when its last subscriber unmounts', async () => {
    const manual = createManualScheduler()
    setReactPresetThumbnailSchedulerForTests(manual.scheduler)
    const controller = new AbortController()
    const result = renderReactPresetThumbnail(preset('preset-cyan-reverie'), { signal: controller.signal })

    expect(getReactPresetThumbnailDiagnosticsForTests()).toMatchObject({ queuedJobs: 1, pendingJobs: 1 })
    controller.abort()

    await expect(result).resolves.toBeNull()
    expect(getReactPresetThumbnailDiagnosticsForTests()).toMatchObject({ queuedJobs: 0, pendingJobs: 0 })
    expect(mocks.renderReactEngine).not.toHaveBeenCalled()
  })

  it('observes cancellation between active render steps, releases resources, and skips the cache', async () => {
    const manual = createManualScheduler()
    setReactPresetThumbnailSchedulerForTests(manual.scheduler)
    const controller = new AbortController()
    const source = preset('preset-crimson-collapse')
    const result = renderReactPresetThumbnail(source, { signal: controller.signal })

    await manual.flushOne()
    expect(mocks.renderReactEngine).toHaveBeenCalledTimes(1)
    expect(getReactPresetThumbnailDiagnosticsForTests().activeJobs).toBe(1)

    controller.abort()
    await expect(result).resolves.toBeNull()
    await flushManualScheduler(manual, () => getReactPresetThumbnailDiagnosticsForTests().pendingJobs === 0)

    expect(mocks.renderReactEngine).toHaveBeenCalledTimes(1)
    expect(readCachedReactPresetThumbnail(source)).toBeNull()
    expect(mocks.disposeCinematicPortalRenderer).toHaveBeenCalledTimes(1)
    expect(mocks.disposeLaserDmxRenderer).toHaveBeenCalledTimes(1)
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 })
  })

  it('invalidates an old engine generation before allowing the replacement job to run', async () => {
    const manual = createManualScheduler()
    setReactPresetThumbnailSchedulerForTests(manual.scheduler)
    const oldGeneration = new AbortController()
    const nextGeneration = new AbortController()
    const oldPreset = preset('preset-crimson-collapse')
    const nextPreset = preset('preset-trapwire')

    const oldResult = renderReactPresetThumbnail(oldPreset, { signal: oldGeneration.signal })
    await manual.flushOne()
    expect(mocks.renderReactEngine).toHaveBeenCalledTimes(1)

    oldGeneration.abort()
    const nextResult = renderReactPresetThumbnail(nextPreset, { signal: nextGeneration.signal })
    await flushManualScheduler(manual, () => getReactPresetThumbnailDiagnosticsForTests().pendingJobs === 0)

    await expect(oldResult).resolves.toBeNull()
    await expect(nextResult).resolves.toBe('data:image/png;base64,exact-preview')
    expect(readCachedReactPresetThumbnail(oldPreset)).toBeNull()
    expect(readCachedReactPresetThumbnail(nextPreset)).toBe('data:image/png;base64,exact-preview')
  })

  it('handles Strict Mode-style active unmount and remount without overlapping duplicate jobs', async () => {
    const manual = createManualScheduler()
    setReactPresetThumbnailSchedulerForTests(manual.scheduler)
    const source = preset('preset-cyan-reverie')
    const firstMount = new AbortController()
    const first = renderReactPresetThumbnail(source, { signal: firstMount.signal })

    await manual.flushOne()
    expect(getReactPresetThumbnailDiagnosticsForTests()).toMatchObject({ activeJobs: 1, pendingJobs: 1 })
    expect(mocks.renderReactEngine).toHaveBeenCalledTimes(1)

    firstMount.abort()
    const secondMount = new AbortController()
    const second = renderReactPresetThumbnail(source, { signal: secondMount.signal })
    expect(getReactPresetThumbnailDiagnosticsForTests()).toMatchObject({ activeJobs: 1, queuedJobs: 0, pendingJobs: 1 })

    await flushManualScheduler(manual, () => getReactPresetThumbnailDiagnosticsForTests().pendingJobs === 0)
    await expect(first).resolves.toBeNull()
    await expect(second).resolves.toBe('data:image/png;base64,exact-preview')
    expect(canvases).toHaveLength(2)
    expect(getReactPresetThumbnailDiagnosticsForTests().concurrencyLimit).toBe(1)
  })

  it('serves cached thumbnails without scheduling or rendering again', async () => {
    const source = preset('preset-minimal-skeleton')
    await expect(renderReactPresetThumbnail(source)).resolves.toBe('data:image/png;base64,exact-preview')
    const renders = mocks.renderReactEngine.mock.calls.length
    const yields = vi.fn(async () => {})
    setReactPresetThumbnailSchedulerForTests({ yield: yields })

    await expect(renderReactPresetThumbnail(source)).resolves.toBe('data:image/png;base64,exact-preview')
    expect(mocks.renderReactEngine).toHaveBeenCalledTimes(renders)
    expect(yields).not.toHaveBeenCalled()
  })

  it('falls back to null and still disposes when preview serialization fails', async () => {
    const source = preset('preset-minimal-skeleton')
    vi.mocked(document.createElement).mockImplementationOnce(() => {
      const canvas = createFakeCanvas()
      canvas.toDataURL.mockImplementation(() => { throw new Error('serialization failed') })
      return canvas as HTMLCanvasElement
    })

    await expect(renderReactPresetThumbnail(source)).resolves.toBeNull()
    expect(mocks.disposeCinematicPortalRenderer).toHaveBeenCalledTimes(1)
    expect(mocks.disposeLaserDmxRenderer).toHaveBeenCalledTimes(1)
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 })
    expect(getReactPresetThumbnailDiagnosticsForTests().cacheEntries).toBe(0)
  })
})
