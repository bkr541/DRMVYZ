/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasEngineSurface } from '../../ReactCanvasEngineShell'
import { useReactStore } from '../../../../../stores/reactStore'
import { useMediaStore, type UploadedMedia } from '../../../../../stores/mediaStore'
import { CanvasPreloadManager } from '../../canvasPerformance/CanvasPreloadManager'
import { createCanvasShowManagerShow, CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY, CANVAS_SHOW_MANAGER_DEFAULT_FX, CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION } from '../../../showManager/CanvasShowManagerDomain'
import { DataBleedRenderer } from './DataBleedRenderer'
import type { CanvasOutputCapability } from '../../canvasFracturesOutputContract'

let root: Root, host: HTMLDivElement
let id = 0, raf: Map<number, FrameRequestCallback>
let published: HTMLCanvasElement | null, capability: CanvasOutputCapability | null
let draws: Array<{ canvas: HTMLCanvasElement; source: unknown; alpha: number }>
const renderer = { resize: vi.fn(), resetHistory: vi.fn(), dispose: vi.fn(), render: vi.fn((frame: { source: HTMLImageElement | null }) => Boolean(frame.source?.complete && frame.source.naturalWidth)) }
const asset: UploadedMedia = { id: 'phase4-source', name: 'source.svg', type: 'image', mimeType: 'image/svg+xml', url: 'https://media.test/source.svg?token=one&expires=1', metadata: { width: 640, height: 360 }, meta: 'SVG', mediaRole: 'svg', tags: [], collectionIds: [], favorite: false, thumbnailUrl: null, revision: 1 }
const onCanvasReady = (canvas: HTMLCanvasElement | null) => { published = canvas }
const onOutputCapabilityChange = (value: CanvasOutputCapability) => { capability = value }

async function mount(props: Partial<React.ComponentProps<typeof CanvasEngineSurface>> = {}) { await act(async () => root.render(<CanvasEngineSurface isPlaying={false} isPaused={false} onCanvasReady={onCanvasReady} onOutputCapabilityChange={onOutputCapabilityChange} {...props} />)) }
async function tick() {
  const callbacks = [...raf.values()]; raf.clear()
  await act(async () => { callbacks.forEach(cb => cb(performance.now() + 17)) })
}
async function load() {
  const image = host.querySelector('img.rv-canvas-live-media') as HTMLImageElement
  Object.defineProperties(image, { complete: { value: true, configurable: true }, naturalWidth: { value: 640, configurable: true }, naturalHeight: { value: 360, configurable: true } })
  await act(async () => image.dispatchEvent(new Event('load')))
  await tick(); await tick()
  return image
}

beforeEach(async () => {
  published = null; capability = null; draws = []; raf = new Map(); id = 0
  vi.clearAllMocks()
  await useReactStore.persist.rehydrate()
  useReactStore.getState().resetReactView()
  useMediaStore.setState({ items: [{ ...asset }] })
  useReactStore.getState().selectCanvasMediaItem(asset.id)
  useReactStore.getState().selectCanvasPreset('canvas-data-bleed')
  vi.spyOn(DataBleedRenderer, 'create').mockReturnValue({ renderer: renderer as unknown as DataBleedRenderer, error: null })
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { raf.set(++id, cb); return id })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(key => { raf.delete(key) })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 640, height: 360 } as DOMRect)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function(this: HTMLCanvasElement) {
    const canvas = this, stack: number[] = []
    const target = { canvas, globalAlpha: 1, clearRect: vi.fn(), save() { stack.push(this.globalAlpha) }, restore() { this.globalAlpha = stack.pop() ?? 1 }, drawImage(source: unknown) { draws.push({ canvas, source, alpha: this.globalAlpha }) }, getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) }) }
    return new Proxy(target, { get(object, key) { return key in object ? object[key as keyof typeof target] : vi.fn() } }) as unknown as CanvasRenderingContext2D
  })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })

describe('Data Bleed actual CANVAS surface', () => {
  it.each([{ amount: 0 }, { sourceMix: 1 }])('owns exact native-source reconstruction at %j without double rendering', async patch => {
    await mount(); const image = await load()
    const settings = useReactStore.getState().canvasPresetSettings.dataBleed
    await act(async () => useReactStore.getState().setCanvasPresetSettings({ dataBleed: { ...settings, ...patch } }))
    draws = []; await tick()
    expect(image.style.opacity).toBe('1')
    expect((host.querySelector('.rv-canvas-data-bleed-layer') as HTMLElement).style.opacity).toBe('0')
    expect(draws.some(draw => draw.source === image && draw.alpha === 1)).toBe(true)
    expect(capability?.status).toBe('available')
  })
  it('publishes forward seek discontinuities through Core and refreshes a paused output once', async () => {
    const intervals: Array<() => void> = []
    vi.spyOn(window, 'setInterval').mockImplementation(handler => { if (typeof handler === 'function') intervals.push(handler as () => void); return 1 as unknown as ReturnType<typeof window.setInterval> })
    let time = 5
    const getAudioTime = () => time
    await mount({ isPlaying: true, getAudioTime }); await load()
    await mount({ isPlaying: true, isPaused: true, getAudioTime }); await tick()
    const count = renderer.render.mock.calls.length
    time = 25
    await act(async () => { intervals.forEach(fn => fn()) }); await tick()
    expect(renderer.render.mock.calls.length).toBe(count + 1)
    expect(renderer.render.mock.lastCall?.[0]).toMatchObject({ performance: { positionReset: true, motionTimeSec: 25 } })
    await tick()
    expect(renderer.render.mock.calls.length).toBe(count + 1)
    time = 25.125
    await act(async () => { intervals.forEach(fn => fn()) }); await tick()
    expect(renderer.render.mock.calls.length).toBe(count + 2)
    expect(renderer.render.mock.lastCall?.[0]).toMatchObject({ performance: { positionReset: true, motionTimeSec: 25.125 } })
  })
  it('unpublishes missing/deleted/failed sources and never advertises a stale capture', async () => {
    await mount()
    expect(capability?.status).toBe('unavailable')
    expect(published).toBeNull()
    await load()
    expect(capability?.status).toBe('available')
    expect(published).not.toBeNull()
    await act(async () => host.querySelector('img')!.dispatchEvent(new Event('error')))
    expect(capability?.status).toBe('unavailable')
    expect(published).toBeNull()
    await act(async () => useMediaStore.setState({ items: [] }))
    expect(published).toBeNull()
    expect(host.querySelector('.rv-canvas-data-bleed-layer')).toBeNull()
  })

  it('applies legacy mix and output opacity once, with no dry image doubled under processed alpha', async () => {
    useReactStore.getState().setCanvasPresetSettings({ sourceMixMode: 'legacyComposite', drySourceMix: 0.25 })
    useReactStore.getState().setCanvasEngineSettings({ opacity: 0.4 })
    await mount(); const image = await load()
    expect(image.style.opacity).toBe('0')
    expect((host.querySelector('.rv-canvas-data-bleed-layer') as HTMLElement).style.opacity).toBe('0.25')
    draws = []; await tick()
    expect(draws.some(draw => draw.source === image)).toBe(false)
    expect(draws.some(draw => draw.alpha === 0.25 && draw.source instanceof HTMLCanvasElement)).toBe(true)
    expect(draws.some(draw => draw.canvas === published && draw.alpha === 0.4)).toBe(true)
  })

  it('keeps the original drawable/capture available when WebGL2 initialization fails', async () => {
    vi.mocked(DataBleedRenderer.create).mockReturnValueOnce({ renderer: null, error: 'WebGL2 unavailable' })
    await mount(); const image = await load()
    expect(image.style.opacity).toBe('1')
    expect(capability?.status).toBe('available')
    expect(published).not.toBeNull()
    expect(host.textContent).toContain('Showing the original source')
  })

  it('replaces signed URL/revision resources without altering the URL or source selection', async () => {
    await mount(); await load()
    const changed = { ...asset, url: 'https://media.test/source.svg?token=two&expires=2', revision: 2 }
    await act(async () => useMediaStore.setState({ items: [changed] }))
    expect(published).toBeNull()
    expect(host.querySelector('img')?.getAttribute('src')).toBe(changed.url)
    await load()
    expect(useReactStore.getState().activeCanvasMediaId).toBe(asset.id)
    expect(renderer.dispose).toHaveBeenCalled()
  })

  it('hands output to a Show Manager composition and releases the direct GPU layer', async () => {
    await mount(); const image = await load(); const direct = published
    vi.spyOn(CanvasPreloadManager.prototype, 'getHandle').mockReturnValue(image)
    vi.spyOn(CanvasPreloadManager.prototype, 'isReady').mockReturnValue(true)
    const show = createCanvasShowManagerShow('Legacy composition')
    show.mediaElements = [{ id: 'e', mediaId: asset.id, layer: 0, showStartSec: 0, showEndSec: 8, sourceInSec: null, sourceOutSec: null,
      display: { ...CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY }, fx: { ...CANVAS_SHOW_MANAGER_DEFAULT_FX },
      transitions: { in: { ...CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION }, out: { ...CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION } } }]
    await act(async () => useReactStore.setState({ canvasShowManagerShows: [show], canvasShowManagerActiveShowId: show.id }))
    await tick()
    expect(host.querySelector('.rv-canvas-data-bleed-layer')).toBeNull()
    expect(host.querySelector('[aria-label="CANVAS orchestrated media surface"]')).not.toBeNull()
    expect(renderer.dispose).toHaveBeenCalled()
    expect(published).not.toBeNull()
    expect(published).not.toBe(direct)
    expect(capability?.status).toBe('available')
  })

  it('keeps authored Layers unprocessed and visible with the Data Bleed dry mix at zero', async () => {
    await mount(); const image = await load()
    vi.spyOn(CanvasPreloadManager.prototype, 'getHandle').mockReturnValue(image)
    vi.spyOn(CanvasPreloadManager.prototype, 'isReady').mockReturnValue(true)
    const settings = useReactStore.getState().canvasOrchestrationSettings
    await act(async () => useReactStore.setState({ canvasOrchestrationSettings: { ...settings, renderMode: 'layers', authoredLayers: [
      { id: 'authored', mediaId: asset.id, effects: [], order: 0, enabled: true, solo: false, ownership: 'manual', pinned: true },
    ] } }))
    draws = []; await tick(); await tick()
    expect(host.querySelector('.rv-canvas-data-bleed-layer')).toBeNull()
    expect(published).not.toBeNull()
    expect(draws.some(draw => draw.source === image && draw.alpha > 0)).toBe(true)
    expect(draws.some(draw => draw.canvas === published && draw.alpha === 1)).toBe(true)
  })
})
