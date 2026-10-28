// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { Suspense, act, createContext, useContext, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_VIEWS, FLOATING_APP_VIEWS } from '../appView'
import type { AppView } from '../appView'
import { ApplicationHeaderControls, ApplicationWorkspaceFrame } from './ApplicationWorkspaceFrame'

const fixture = vi.hoisted(() => ({ source: 'file' as 'file' | 'microphone' }))
vi.mock('../../../context/AudioEngineContext', () => ({ useSharedAudio: () => fixture }))

const FeatureContext = createContext('missing')
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  fixture.source = 'file'
  vi.unstubAllGlobals()
})

function Harness({ children, initialView = 'react' }: { children?: React.ReactNode; initialView?: AppView }) {
  const [appView, setAppView] = useState<AppView>(initialView)
  const [collapsed, setCollapsed] = useState(true)
  return (
    <ApplicationWorkspaceFrame
      appView={appView}
      onAppViewChange={setAppView}
      sidebarCollapsed={collapsed}
      onSidebarCollapsedChange={setCollapsed}
    >
      {children ?? <main data-testid="feature-content" />}
    </ApplicationWorkspaceFrame>
  )
}

function render(element: React.ReactElement) {
  return act(async () => root.render(element))
}

describe('application floating chrome (all five workspaces)', () => {
  it('activates all five production workspaces', () => {
    expect(APP_VIEWS).toEqual(['react', 'presetManager', 'showManager', 'lyrics', 'media'])
    expect(FLOATING_APP_VIEWS.react).toBe(true)
    expect(FLOATING_APP_VIEWS.presetManager).toBe(true)
    expect(FLOATING_APP_VIEWS.media).toBe(true)
    expect(APP_VIEWS.every(view => FLOATING_APP_VIEWS[view])).toBe(true)
  })

  it.each(APP_VIEWS)('keeps the shared header and rail single-owned on the %s route', async (view: AppView) => {
    await render(<Harness initialView={view}><main data-testid="route-stage" /></Harness>)
    const frame = host.querySelector(`[data-app-workspace="${view}"]`)
    expect(frame?.getAttribute('data-workspace-layout')).toBe('floating')
    expect(frame?.querySelectorAll('[data-workspace-slot="header"]')).toHaveLength(1)
    expect(frame?.querySelectorAll('[data-workspace-slot="navigation"]')).toHaveLength(1)
    expect(frame?.querySelectorAll('[data-workspace-slot="stage"]')).toHaveLength(1)
    expect(frame?.querySelectorAll('.fw-app-navigation .fw-sidebar-toggle')).toHaveLength(1)
    expect(frame?.querySelector('.fw-app-header .fw-sidebar-toggle')).toBeNull()
    expect(frame?.querySelector('.fw-sidebar-toggle')?.nextElementSibling?.classList.contains('az-sidebar-layout-lab')).toBe(true)
    expect(frame?.querySelector('.fw-app-header [data-app-icon="brand"]')).toBeNull()
    expect(frame?.querySelector('.fw-app-header')?.textContent).not.toContain('DRMVYZ')
    expect(frame?.querySelectorAll('.az-sidebar')).toHaveLength(1)
    expect(frame?.querySelector('.fw-app-content [data-testid="route-stage"]')).not.toBeNull()
  })

  it('uses one unbranded global header on the Preset Manager route', async () => {
    await render(<Harness initialView="presetManager"><main className="pmv-root" aria-label="Preset Manager" /></Harness>)
    expect(host.querySelectorAll('.fw-app-header')).toHaveLength(1)
    expect(host.querySelectorAll('.fw-app-navigation .fw-sidebar-toggle')).toHaveLength(1)
    expect(host.querySelector('.fw-app-navigation .az-logo')).toBeNull()
    expect(host.querySelector('.fw-app-header-fallback')).toBeNull()
    expect(host.querySelector('.fw-app-content > .pmv-root')).not.toBeNull()
    expect(host.querySelectorAll('.pmv-header')).toHaveLength(0)
  })

  it('portals Media Manager header actions into the shared header without duplicating the feature header', async () => {
    await render(
      <Harness initialView="media">
        <main className="mmv-root">
          <ApplicationHeaderControls fallbackWhenUnavailable>
            <header className="mmv-header"><button type="button" aria-label="Save Changes">Save</button></header>
          </ApplicationHeaderControls>
        </main>
      </Harness>,
    )
    expect(host.querySelector('[data-app-workspace="media"]')).not.toBeNull()
    expect(host.querySelectorAll('.fw-app-header .mmv-header')).toHaveLength(1)
    expect(host.querySelectorAll('.mmv-root .mmv-header')).toHaveLength(0)
    expect(host.querySelectorAll('[aria-label="Save Changes"]')).toHaveLength(1)
    const originalAction = host.querySelector<HTMLButtonElement>('[aria-label="Save Changes"]')
    expect(originalAction?.closest('.fw-app-header-controls')).not.toBeNull()
    expect(host.querySelector<HTMLSpanElement>('.fw-app-header-fallback')?.hidden).toBe(true)
    await render(<Harness initialView="media"><main className="mmv-root" /></Harness>)
    expect(host.querySelectorAll('.mmv-header')).toHaveLength(0)
    expect(host.querySelector<HTMLSpanElement>('.fw-app-header-fallback')?.hidden).toBe(false)
  })

  it('keeps feature-owned callbacks and provider state live through the header portal', async () => {
    const invoked = vi.fn()
    function FeatureAction() {
      const featureValue = useContext(FeatureContext)
      return (
        <ApplicationHeaderControls>
          <button type="button" aria-label="Apply Feature" onClick={() => invoked(featureValue)}>Apply</button>
        </ApplicationHeaderControls>
      )
    }
    await render(
      <Harness initialView="media">
        <FeatureContext.Provider value="current feature state"><FeatureAction /></FeatureContext.Provider>
      </Harness>,
    )
    const action = host.querySelector<HTMLButtonElement>('.fw-app-header-controls [aria-label="Apply Feature"]')
    expect(action).not.toBeNull()
    expect(host.querySelectorAll('[aria-label="Apply Feature"]')).toHaveLength(1)
    await act(async () => action?.click())
    expect(invoked).toHaveBeenCalledTimes(1)
    expect(invoked).toHaveBeenCalledWith('current feature state')
  })

  it('retains a local Media Manager header when mounted without a floating frame', async () => {
    await render(
      <main className="mmv-root">
        <ApplicationHeaderControls fallbackWhenUnavailable>
          <header className="mmv-header"><button type="button">Save</button></header>
        </ApplicationHeaderControls>
      </main>,
    )
    expect(host.querySelector('.mmv-root > .mmv-header button')?.textContent).toBe('Save')
  })

  it('has no header branding and preserves navigation order and aria-current', async () => {
    await render(<Harness />)
    const frame = host.querySelector('[data-workspace-layout="floating"]')!
    expect(frame.matches('.az-root.fw-app-frame')).toBe(true)
    expect(frame.querySelector(':scope > .az-shell.fw-app-shell')).not.toBeNull()
    expect(frame.querySelectorAll('[data-app-icon="brand"]')).toHaveLength(0)
    expect(frame.querySelector('.fw-app-navigation .az-logo')).toBeNull()
    expect(frame.querySelector('.fw-app-navigation .fw-sidebar-toggle')).not.toBeNull()
    expect(frame.querySelector('[data-workspace-slot="stage"] [data-testid="feature-content"]')).not.toBeNull()
    expect([...frame.querySelectorAll('.az-nav .az-nav-item')].map(item => item.getAttribute('aria-label'))).toEqual([
      'React', 'Preset Manager', 'Show Manager', 'Lyric Manager', 'Media Manager',
    ])
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Preset Manager"]')!.click())
    expect(host.querySelector('[data-app-workspace="presetManager"]')).not.toBeNull()
    expect(host.querySelector('[aria-label="Preset Manager"]')?.getAttribute('aria-current')).toBe('page')
    expect(host.querySelectorAll('[data-app-icon="brand"]')).toHaveLength(0)
  })

  it('keeps controlled collapse through route changes, with live sidebar width on .az-root', async () => {
    let notifyResize: (() => void) | undefined
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { notifyResize = callback }
      observe() {}
      disconnect() {}
    })
    const original = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { ...original.call(this), width: this.classList.contains('az-sidebar--collapsed') ? 72 : 240 }
    }
    try {
      await render(<Harness />)
      const frame = host.querySelector<HTMLElement>('.az-root')!
      expect(frame.style.getPropertyValue('--vz-sidebar-width')).toBe('72px')
      await act(async () => host.querySelector<HTMLButtonElement>('.fw-app-navigation .fw-sidebar-toggle')!.click())
      expect(host.querySelector('.az-sidebar--collapsed')).toBeNull()
      await act(async () => notifyResize?.())
      expect(frame.style.getPropertyValue('--vz-sidebar-width')).toBe('240px')
      await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Lyric Manager"]')!.click())
      expect(host.querySelector('.az-sidebar--collapsed')).toBeNull()
      expect(host.querySelector('.fw-app-navigation .fw-sidebar-toggle')?.getAttribute('aria-expanded')).toBe('true')
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original
    }
  })

  it('keeps microphone Show Manager guard in floating navigation', async () => {
    fixture.source = 'microphone'
    await render(<Harness />)
    const button = host.querySelector<HTMLButtonElement>('[aria-label="Show Manager"]')!
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    await act(async () => button.click())
    expect(host.querySelector('[data-app-workspace="react"]')).not.toBeNull()
  })

  it('shows a stable fallback during Suspense, portals controls exactly once, and restores fallback on unmount', async () => {
    const pending = new Promise<void>(() => {})
    function Deferred(): React.ReactElement { throw pending }
    await render(<Harness><Suspense fallback={<div>Loading workspace</div>}><Deferred /></Suspense></Harness>)
    expect(host.querySelector('.fw-app-header-fallback')?.textContent).toBe('React')
    expect(host.querySelector('.fw-app-header-controls')?.children).toHaveLength(0)

    const Feature = () => {
      const value = useContext(FeatureContext)
      return <ApplicationHeaderControls><button type="button" data-testid="feature-header">{value}</button></ApplicationHeaderControls>
    }
    await render(<Harness><FeatureContext.Provider value="Feature-owned state"><Feature /></FeatureContext.Provider></Harness>)
    expect(host.querySelectorAll('[data-testid="feature-header"]')).toHaveLength(1)
    expect(host.querySelector('[data-testid="feature-header"]')?.textContent).toBe('Feature-owned state')
    expect(host.querySelector<HTMLSpanElement>('.fw-app-header-fallback')?.hidden).toBe(true)

    await render(<Harness><main>Feature unmounted</main></Harness>)
    expect(host.querySelectorAll('[data-testid="feature-header"]')).toHaveLength(0)
    expect(host.querySelector<HTMLSpanElement>('.fw-app-header-fallback')?.hidden).toBe(false)
  })
})
