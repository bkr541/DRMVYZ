/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Recorder } from '../../../hooks/useRecorder'
import { useReactStore } from '../../../stores/reactStore'
import {
  CANVAS_FRACTURES_OUTPUT_DEFERRED,
  CANVAS_OUTPUT_AVAILABLE,
  CANVAS_OUTPUT_UNAVAILABLE,
  isCanvasFracturesOutputDeferred,
  resolveCanvasOutputCapability,
  type CanvasOutputCapability,
} from './canvasFracturesOutputContract'
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

const genericFrame = {
  layers: [{ processor: null }],
}

const fracturesFrame = {
  layers: [{
    processor: {
      kind: 'fractures',
      presetId: 'canvas-fractures',
      identity: 'fractures-output-test',
      overrides: {},
    },
  }],
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

function renderOutputPanel(outputCapability: CanvasOutputCapability) {
  act(() => root.render(
    <ReactOutputWorkspacePanel
      canvas={null}
      outputCapability={outputCapability}
      recorder={recorder}
      liveFps={60}
      hasActiveProgramAudio={false}
      onStartRecording={vi.fn()}
    />,
  ))
}

describe('effective Canvas output capability', () => {
  it('derives direct and orchestrated capability from the renderer that owns the frame', () => {
    expect(resolveCanvasOutputCapability({
      selectedPresetId: 'canvas-fractures',
      orchestrationRenderable: false,
      orchestrationFrame: null,
    })).toBe(CANVAS_FRACTURES_OUTPUT_DEFERRED)

    expect(resolveCanvasOutputCapability({
      selectedPresetId: 'canvas-clean-playback',
      orchestrationRenderable: false,
      orchestrationFrame: null,
    })).toBe(CANVAS_OUTPUT_AVAILABLE)

    expect(resolveCanvasOutputCapability({
      selectedPresetId: 'canvas-clean-playback',
      orchestrationRenderable: true,
      orchestrationFrame: fracturesFrame as never,
    })).toBe(CANVAS_FRACTURES_OUTPUT_DEFERRED)

    expect(resolveCanvasOutputCapability({
      selectedPresetId: 'canvas-fractures',
      orchestrationRenderable: true,
      orchestrationFrame: genericFrame as never,
    })).toBe(CANVAS_OUTPUT_AVAILABLE)
  })

  it('fails safely for an unrecognized specialized renderer', () => {
    expect(resolveCanvasOutputCapability({
      selectedPresetId: 'canvas-clean-playback',
      orchestrationRenderable: true,
      orchestrationFrame: { layers: [{ processor: { kind: 'future-renderer' } }] } as never,
    })).toBe(CANVAS_OUTPUT_UNAVAILABLE)
  })

  it('fails safely when orchestration claims ownership without a resolved frame', () => {
    expect(resolveCanvasOutputCapability({
      selectedPresetId: 'canvas-clean-playback',
      orchestrationRenderable: true,
      orchestrationFrame: null,
    })).toBe(CANVAS_OUTPUT_UNAVAILABLE)
  })

  it('shows the deferred recording placeholder from the canonical runtime capability', () => {
    renderOutputPanel(CANVAS_FRACTURES_OUTPUT_DEFERRED)

    expect(isCanvasFracturesOutputDeferred(CANVAS_FRACTURES_OUTPUT_DEFERRED)).toBe(true)
    expect(host.querySelector('[aria-label="Fractures recording unavailable"]')).not.toBeNull()
    expect(host.querySelector<HTMLButtonElement>('button[disabled]')?.textContent).toContain('Recording unavailable')
    expect(host.querySelector('[aria-label="standard recording controls"]')).toBeNull()

    renderOutputPanel(CANVAS_OUTPUT_AVAILABLE)
    expect(host.querySelector('[aria-label="Fractures recording unavailable"]')).toBeNull()
    expect(host.querySelector('[aria-label="standard recording controls"]')).not.toBeNull()
  })
})
