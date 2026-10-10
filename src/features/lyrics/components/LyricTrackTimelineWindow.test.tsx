// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LyricTrackTimelineWindow } from './LyricTrackTimelineWindow'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function render(extra: Partial<React.ComponentProps<typeof LyricTrackTimelineWindow>> = {}) {
  return act(async () => root.render(
    <LyricTrackTimelineWindow
      durationMs={100_000}
      currentTimeMs={0}
      zoom={2}
      sections={[]}
      beatGrid={[]}
      trackId={null}
      trackUrl={null}
      waveformPeaks={null}
      waveformLoading={false}
      beatGridStatus="trusted"
      beatGridStatusMessage={null}
      actions={<div data-testid="actions" />}
      toolbar={<div data-testid="toolbar" />}
      cueTimeline={<div data-testid="cues" />}
      {...extra}
    />,
  ))
}

describe('LyricTrackTimelineWindow', () => {
  it('puts the actions row above the lanes and the toolbar below them, with one playhead over all lanes', async () => {
    await render()
    const position = (a: Element, b: Element) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
    const lanes = container.querySelector('.lmv-track-timeline-lanes')!
    expect(position(container.querySelector('[data-testid="actions"]')!, lanes)).toBeTruthy()
    expect(position(lanes, container.querySelector('[data-testid="toolbar"]')!)).toBeTruthy()
    expect(lanes.querySelectorAll('[data-testid="lyric-playhead"]')).toHaveLength(1)
  })

  it('seeks when a reference lane is clicked or dragged', async () => {
    const onSeek = vi.fn()
    await render({ onSeek, zoom: 1 })
    const layer = container.querySelector<HTMLElement>('.lmv-track-timeline-playhead-layer')!
    layer.getBoundingClientRect = () => ({ left: 100, width: 200, right: 300, top: 0, bottom: 0, height: 0, x: 100, y: 0, toJSON() {} })
    const lane = container.querySelector<HTMLElement>('.lmv-track-timeline-lane--waveform')!
    const fire = (type: string, clientX: number) => act(async () => {
      lane.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, clientX }))
    })
    await fire('pointerdown', 200)
    await fire('pointermove', 250)
    await fire('pointerup', 250)
    await fire('pointermove', 300)
    expect(onSeek.mock.calls.map(call => call[0])).toEqual([50_000, 75_000])
  })

  it('zooms with the mouse wheel over the lanes', async () => {
    const onZoomChange = vi.fn()
    await render({ onZoomChange, zoom: 2 })
    const lanes = container.querySelector<HTMLElement>('.lmv-track-timeline-lanes')!
    const up = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 })
    await act(async () => { lanes.dispatchEvent(up) })
    expect(up.defaultPrevented).toBe(true)
    expect(onZoomChange.mock.calls[0]![0]).toBeGreaterThan(2)
    await act(async () => { lanes.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 })) })
    expect(onZoomChange.mock.calls[1]![0]).toBeLessThan(2)
  })
})
