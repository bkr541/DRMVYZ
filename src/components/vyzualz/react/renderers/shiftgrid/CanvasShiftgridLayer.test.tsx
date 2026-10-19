/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CanvasMediaItem } from '../../ReactTypes'
import { CanvasShiftgridLayer } from './CanvasShiftgridLayer'
import { DEFAULT_CANVAS_SHIFTGRID_SETTINGS } from './ShiftgridSettings'

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

describe('CanvasShiftgridLayer P0 lifecycle', () => {
  it('shows an explicit development notice and never renders fallback artwork', () => {
    const mediaItems: CanvasMediaItem[] = [{
      id: 'source-a',
      name: 'Source A',
      type: 'image',
      objectUrl: 'https://example.test/source-a.png',
      createdAt: new Date(0).toISOString(),
    }]
    act(() => root.render(
      <CanvasShiftgridLayer
        settings={DEFAULT_CANVAS_SHIFTGRID_SETTINGS}
        activeMediaId="source-a"
        activePool={null}
        mediaItems={mediaItems}
      />,
    ))

    expect(host.querySelector('[data-renderer-kind="shiftgrid"]')).not.toBeNull()
    expect(host.textContent).toContain('Tile rendering arrives in Phase 1')
    expect(host.querySelector('canvas, img, video')).toBeNull()
  })
})
