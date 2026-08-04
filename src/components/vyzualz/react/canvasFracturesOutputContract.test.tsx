/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Recorder } from '../../../hooks/useRecorder'
import { useReactStore } from '../../../stores/reactStore'
import { isCanvasFracturesOutputDeferred } from './canvasFracturesOutputContract'
import { ReactOutputWorkspacePanel } from './panels/ReactWorkspacePanels'

vi.mock('./ReactRecordingPanel', () => ({
  ReactRecordingPanel: () => <div aria-label="standard recording controls">Standard recording controls</div>,
}))

vi.mock('./output/ProductionOutputPanel', () => ({
  ProductionOutputPanel: () => <div>Production output controls</div>,
}))

const recorder: Recorder = {
  recorderState: 'idle',
  recordingMode: null,
  recordingTime: 0,
  recorderError: null,
  fps: 30,
  setFps: vi.fn(),
  startVideoRecording: vi.fn(),
  stopRecording: vi.fn(),
  exportRingBuffer: vi.fn(),
  exportPNG: vi.fn(),
}

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('canvas')
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('Fractures output deferral', () => {
  it('derives recording and cast deferral from the explicit renderer contract', () => {
    expect(isCanvasFracturesOutputDeferred('canvas', 'canvas-fractures')).toBe(true)
    expect(isCanvasFracturesOutputDeferred('canvas', 'canvas-particle-aura')).toBe(false)
    expect(isCanvasFracturesOutputDeferred('canvas', 'canvas-clean-playback')).toBe(false)
    expect(isCanvasFracturesOutputDeferred('pixGrid', 'canvas-fractures')).toBe(false)
  })

  it('shows the disabled recording placeholder only for Fractures', () => {
    useReactStore.getState().selectCanvasPreset('canvas-fractures')
    act(() => root.render(
      <ReactOutputWorkspacePanel
        canvas={null}
        recorder={recorder}
        liveFps={60}
        hasActiveProgramAudio={false}
        onStartRecording={vi.fn()}
      />,
    ))

    expect(host.querySelector('[aria-label="Fractures recording unavailable"]')).not.toBeNull()
    expect(host.querySelector<HTMLButtonElement>('button[disabled]')?.textContent).toContain('Recording unavailable')
    expect(host.querySelector('[aria-label="standard recording controls"]')).toBeNull()

    act(() => useReactStore.getState().selectCanvasPreset('canvas-particle-aura'))
    expect(host.querySelector('[aria-label="Fractures recording unavailable"]')).toBeNull()
    expect(host.querySelector('[aria-label="standard recording controls"]')).not.toBeNull()

    act(() => useReactStore.getState().selectCanvasPreset('canvas-clean-playback'))
    expect(host.querySelector('[aria-label="Fractures recording unavailable"]')).toBeNull()
    expect(host.querySelector('[aria-label="standard recording controls"]')).not.toBeNull()
  })
})
