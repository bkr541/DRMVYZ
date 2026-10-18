// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drawerText, WithNotificationDrawer } from '../../../../test/WithNotificationDrawer'
import { cinema2NativePresetRegistry } from '../../cinema2'
import { Cinema2Stage } from '../Cinema2Stage'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  // No WebGL2 context: the runtime reports itself unavailable.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0, toJSON: () => ({}),
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Cinema 2.0 Stage status', () => {
  it('is listed in the Notifications drawer, not drawn over the canvas', async () => {
    const presetId = cinema2NativePresetRegistry.list()[0]!.id
    await act(async () => root.render(
      <WithNotificationDrawer>
        <Cinema2Stage presetId={presetId} isPlaying={false} analysisActive={false} analyser={null} getAudioTime={() => 0} />
      </WithNotificationDrawer>,
    ))
    expect(container.querySelector('[data-cinema2-stage="runtime"]')?.getAttribute('data-runtime-available')).toBe('false')
    expect(drawerText()).toContain('Cinema 2.0 unavailable')
    expect(drawerText()).toContain('Cinema 2.0 requires WebGL2')
    expect(container.textContent).not.toContain('Cinema 2.0 requires WebGL2')
  })
})
