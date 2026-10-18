/** @vitest-environment jsdom */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/wavExport', () => ({
  encodeWAV: vi.fn(() => new Blob(['wav'], { type: 'audio/wav' })),
  downloadBlob: vi.fn(),
}))

import { useRecorder, type Recorder } from './useRecorder'
import { useNotificationStore } from '../stores/notificationStore'
import { downloadBlob } from '../utils/wavExport'

const cards = () => useNotificationStore.getState().events['react']

describe('Recorder export problems reach the Notifications drawer', () => {
  let root: Root
  let host: HTMLDivElement
  let recorder: Recorder
  const alertSpy = vi.fn()

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.stubGlobal('alert', alertSpy)
    alertSpy.mockClear()
    vi.mocked(downloadBlob).mockClear()
    useNotificationStore.setState({ events: { ...useNotificationStore.getState().events, react: [] } })
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    function Probe() {
      recorder = useRecorder()
      return null
    }
    act(() => root.render(React.createElement(Probe)))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
  })

  it('says so when there is no canvas to export, instead of a browser alert', () => {
    recorder.exportPNG(null)
    expect(alertSpy).not.toHaveBeenCalled()
    expect(cards()[0]).toMatchObject({ tone: 'warning', title: 'Nothing to export' })
    expect(cards()[0]!.message).toContain('no visual output')
  })

  it('says so when no audio has been captured', () => {
    recorder.exportRingBuffer(null, 10)
    expect(alertSpy).not.toHaveBeenCalled()
    expect(cards()[0]).toMatchObject({ tone: 'warning', title: 'Nothing to export' })
    expect(cards()[0]!.message).toContain('No audio has been captured')
  })

  it('says so when the capture buffer is empty, and exports nothing', () => {
    recorder.exportRingBuffer({ read: () => new Float32Array(0), sampleRate: 48_000 }, 10)
    expect(cards()[0]!.message).toContain('buffer is empty')
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('stays quiet when there is audio to export', () => {
    recorder.exportRingBuffer({ read: () => new Float32Array([0.1, 0.2]), sampleRate: 48_000 }, 2)
    expect(cards()).toHaveLength(0)
    expect(downloadBlob).toHaveBeenCalledTimes(1)
  })
})
