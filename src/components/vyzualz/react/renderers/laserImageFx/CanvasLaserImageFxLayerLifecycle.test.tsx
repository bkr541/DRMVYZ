/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedPerformanceContext } from '../../../../../features/performanceCore'
import { DEFAULT_CANVAS_PRESET_SETTINGS, type CanvasMediaItem } from '../../ReactTypes'
import { CanvasLaserImageFxLayer } from './CanvasLaserImageFxLayer'
import { LaserImageFxRenderer, type LaserImageFxSourceElement } from './LaserImageFxRenderer'

const activeItem: CanvasMediaItem = {
  id: 'laser-layer-lifecycle-image',
  name: 'Laser Layer Lifecycle Image',
  type: 'image',
  objectUrl: 'data:image/png;base64,AA==',
  createdAt: '2026-08-10T00:00:00.000Z',
  mediaRevision: 1,
}

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('CanvasLaserImageFxLayer lifecycle ownership', () => {
  it('is completely inert while another renderer owns the Canvas surface', () => {
    const sourceRef = createRef<LaserImageFxSourceElement>()
    const performanceContextRef = createRef<SharedPerformanceContext>()
    const onCanvasReady = vi.fn()
    const onStatusChange = vi.fn()
    const create = vi.spyOn(LaserImageFxRenderer, 'create')

    try {
      act(() => root.render(
        <CanvasLaserImageFxLayer
          active={false}
          activeItem={activeItem}
          sourceRef={sourceRef}
          settings={DEFAULT_CANVAS_PRESET_SETTINGS}
          fitMode="contain"
          sourceTransform={{ scale: 1, positionX: 0, positionY: 0, rotation: 0 }}
          performanceContextRef={performanceContextRef}
          isPlaying={false}
          isPaused
          onCanvasReady={onCanvasReady}
          onStatusChange={onStatusChange}
          outputAlpha={1}
        />,
      ))

      expect(host.querySelector('canvas.rv-canvas-laser-image-fx-layer')).toBeNull()
      expect(create).not.toHaveBeenCalled()
      expect(onCanvasReady).not.toHaveBeenCalled()
      expect(onStatusChange).not.toHaveBeenCalled()
    } finally {
      create.mockRestore()
    }
  })
})
