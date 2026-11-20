// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationPageProvider, useNotificationStore } from '../../../stores/notificationStore'
import { WithNotificationDrawer, drawerText } from '../../../test/WithNotificationDrawer'
import { Cinema2ModelRuntimeNotices } from './Cinema2ModelRuntimeNotices'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'

let host: HTMLDivElement, root: ReturnType<typeof createRoot>
const warning = { code: 'CINEMA2_USER_MODEL_SLICES_OPEN', message: 'Only closed contours receive cut-face caps.' }
beforeEach(() => { vi.useFakeTimers(); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })
const fake = (diagnostics = [warning]) => {
  const modules = [{ diagnostics }, { diagnostics }]
  return { modules, runtime: { getModuleRuntimeSnapshot: () => ({ modules }) } as unknown as Cinema2Runtime }
}

describe('Cinema 2.0 model notification placement', () => {
  it('registers one warning while the drawer is closed and renders no inline card', async () => {
    const { runtime } = fake()
    await act(async () => root.render(<NotificationPageProvider value="react"><Cinema2ModelRuntimeNotices runtime={runtime} /></NotificationPageProvider>))
    expect(host.textContent).toBe(''); expect(useNotificationStore.getState().pages.react).toHaveLength(1)
    expect(useNotificationStore.getState().pages.react[0].tone).toBe('warning')
    await act(async () => root.render(<WithNotificationDrawer><Cinema2ModelRuntimeNotices runtime={runtime} /></WithNotificationDrawer>))
    expect(host.textContent).toBe(''); expect(drawerText().split(warning.message)).toHaveLength(2)
  })
  it('removes resolved warnings, updates changed diagnostics, and clears them when the runtime retires', async () => {
    const { runtime, modules } = fake()
    const render = async (value: Cinema2Runtime | null) => act(async () => root.render(<WithNotificationDrawer><Cinema2ModelRuntimeNotices runtime={value} /></WithNotificationDrawer>))
    await render(runtime); expect(drawerText()).toContain(warning.message)
    modules.forEach(module => { module.diagnostics = [] })
    await act(async () => vi.advanceTimersByTime(500)); expect(drawerText()).not.toContain(warning.message)
    modules[0].diagnostics = [{ code: 'CINEMA2_USER_MODEL_MISSING', message: 'Pinned model missing.' }]
    await act(async () => vi.advanceTimersByTime(500)); expect(drawerText()).toContain('Pinned model missing.')
    expect(drawerText()).toContain('The model could not be shown')
    await render(null); expect(useNotificationStore.getState().pages.react).toHaveLength(0)
  })
  it('reports every distinct model warning without admitting transient loading or unrelated diagnostics', async () => {
    const { runtime, modules } = fake()
    modules[0].diagnostics.push({ code: 'CINEMA2_USER_MODEL_VOXEL_SHELL', message: 'Using the actual surface shell.' }, { code: 'CINEMA2_USER_MODEL_LOADING', message: 'Loading…' }, { code: 'OTHER_WARNING', message: 'Unrelated.' })
    await act(async () => root.render(<WithNotificationDrawer><Cinema2ModelRuntimeNotices runtime={runtime} /></WithNotificationDrawer>))
    expect(useNotificationStore.getState().pages.react).toHaveLength(2)
    expect(drawerText()).toContain(warning.message); expect(drawerText()).toContain('Using the actual surface shell.')
    expect(drawerText()).not.toContain('Loading…'); expect(drawerText()).not.toContain('Unrelated.')
  })
})
