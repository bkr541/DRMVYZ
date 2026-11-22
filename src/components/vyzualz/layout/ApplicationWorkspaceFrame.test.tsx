// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { Suspense, act, createContext, useContext, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_VIEWS, APP_VIEW_LABELS, FLOATING_APP_VIEWS } from '../appView'
import type { AppView } from '../appView'
import { ApplicationHeaderControls, ApplicationWorkspaceFrame } from './ApplicationWorkspaceFrame'

const fixture = vi.hoisted(() => ({ source: 'file' as 'file' | 'microphone' }))
vi.mock('../../../context/AudioEngineContext', () => ({ useSharedAudio: () => fixture }))

// The sidebar's admin check talks to Supabase when the machine has a .env; a frame test does not need it.
vi.mock('../../../lib/adminAccess', () => ({ useAdminAccess: () => false, useAdminAccessStatus: () => 'denied', hasAdminAccess: () => false }))

// The real readouts start Supabase and the CPU meter, which a frame test does not need; the stand-in only has to place them.
vi.mock('../shared/VyzualzHeaderActions', () => ({
  VyzualzHeaderActions: ({ page }: { page: string }) => <div className="rv-header-status" data-react-header-status data-page={page} />,
}))

vi.mock('../react/LayoutLabModal', () => ({
  LayoutLabModal: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="Layout Lab"><button onClick={onClose}>Close</button></div>,
}))

const HEADER_PAGE: Record<AppView, string> = { react: 'react', performanceManager: 'performance-manager', presetManager: 'preset-manager', showManager: 'show-manager', lyrics: 'lyric-manager', media: 'media-manager', admin: 'admin' }
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
  return (
    <ApplicationWorkspaceFrame
      appView={appView}
      onAppViewChange={setAppView}
    >
      {children ?? <main data-testid="feature-content" />}
    </ApplicationWorkspaceFrame>
  )
}

function render(element: React.ReactElement) {
  return act(async () => root.render(element))
}

describe('application floating chrome (every workspace)', () => {
  it('activates every production workspace, the six creative ones and the admin-only one', () => {
    expect(APP_VIEWS).toEqual(['react', 'performanceManager', 'presetManager', 'showManager', 'lyrics', 'media', 'admin'])
    expect(FLOATING_APP_VIEWS.react).toBe(true)
    expect(FLOATING_APP_VIEWS.presetManager).toBe(true)
    expect(FLOATING_APP_VIEWS.media).toBe(true)
    expect(APP_VIEWS.every(view => FLOATING_APP_VIEWS[view])).toBe(true)
  })

  it('opens and closes Layout Lab from the sidebar launcher', async () => {
    await render(<Harness />)
    await act(async () => host.querySelector<HTMLButtonElement>('.fw-layout-lab-launcher')!.click())
    const dialog = host.querySelector('[role="dialog"][aria-label="Layout Lab"]')!
    expect(dialog).not.toBeNull()
    await act(async () => dialog.querySelector('button')!.click())
    expect(host.querySelector('[role="dialog"][aria-label="Layout Lab"]')).toBeNull()
  })

  it('opens the running mobile app from the only phone launcher', async () => {
    const popup = { document: document.implementation.createHTMLDocument(), focus: vi.fn(), close: vi.fn() }
    const open = vi.fn(() => popup)
    vi.stubGlobal('open', open)
    await render(<Harness />)

    const phone = host.querySelector<HTMLButtonElement>('[aria-label="Mobile App Preview"]')!
    expect(host.querySelectorAll('.az-sidebar [aria-label^="Mobile"]')).toHaveLength(1)
    await act(async () => phone.click())

    expect(open).toHaveBeenCalledWith('', 'drmvyz-mobile-app-preview', expect.stringContaining('popup=yes'))
    const iframe = popup.document.querySelector('iframe')!
    expect(iframe.getAttribute('src')).toBe(`${window.location.origin}${window.location.pathname}?mobilePreview=1`)
    expect(popup.focus).toHaveBeenCalledOnce()
  })

  it.each(APP_VIEWS)('keeps the shared header and rail single-owned on the %s route', async (view: AppView) => {
    await render(<Harness initialView={view}><main data-testid="route-stage" /></Harness>)
    const frame = host.querySelector(`[data-app-workspace="${view}"]`)
    expect(frame?.getAttribute('data-workspace-layout')).toBe('floating')
    expect(frame?.querySelectorAll('[data-workspace-slot="header"]')).toHaveLength(1)
    expect(frame?.querySelectorAll('[data-workspace-slot="navigation"]')).toHaveLength(1)
    expect(frame?.querySelectorAll('[data-workspace-slot="stage"]')).toHaveLength(1)
    expect(frame?.querySelectorAll('.fw-app-navigation .fw-sidebar-toggle')).toHaveLength(0)
    expect(frame?.querySelector('.az-sidebar--collapsed.az-sidebar--notched')).not.toBeNull()
    expect(frame?.querySelector('.fw-app-header .fw-sidebar-toggle')).toBeNull()
    expect(frame?.querySelectorAll('[aria-label="Layout Lab"]')).toHaveLength(1)
    const lab = frame?.querySelector('.az-sidebar-account > .fw-layout-lab-launcher')
    expect(lab).not.toBeNull()
    expect(lab?.previousElementSibling?.classList.contains('fw-mobile-app-preview-launcher')).toBe(true)
    expect(lab?.nextElementSibling?.classList.contains('az-sidebar-notifications')).toBe(true)
    expect(frame?.querySelector('.fw-app-header [data-app-icon="brand"]')).toBeNull()
    expect(frame?.querySelector('.fw-app-header')?.textContent).not.toContain('STAGELESS')
    expect(frame?.querySelectorAll('.az-sidebar')).toHaveLength(1)
    expect(frame?.querySelector('.fw-app-content [data-testid="route-stage"]')).not.toBeNull()
  })

  it('uses one unbranded global header on the Preset Manager route', async () => {
    await render(<Harness initialView="presetManager"><main className="pmv-root" aria-label="Preset Manager" /></Harness>)
    expect(host.querySelectorAll('.fw-app-header')).toHaveLength(1)
    expect(host.querySelectorAll('.fw-app-navigation .fw-sidebar-toggle')).toHaveLength(0)
    expect(host.querySelector('.fw-app-navigation .az-logo')).toBeNull()
    // Like every page, it has a stand-in header of its own while its controls are not in the slot.
    expect(host.querySelector('.fw-app-header-fallback .vz-header-brand-name')?.textContent).toBe('Preset Manager')
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

  it.each(APP_VIEWS)('gives the %s page its own header, never a bare label, until its controls arrive', async (view: AppView) => {
    await render(<Harness initialView={view}><main data-testid="route-stage" /></Harness>)
    const fallback = host.querySelector<HTMLElement>('.fw-app-header-fallback')!
    expect(fallback.hidden).toBe(false)
    expect(fallback.getAttribute('data-app-header-fallback')).toBe(view)
    expect(fallback.querySelector(':scope > .vz-header .vz-header-brand-logo')).not.toBeNull()
    expect(fallback.querySelector('.vz-header-brand-name')?.textContent).toBe(APP_VIEW_LABELS[view])
    expect(fallback.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe(`${APP_VIEW_LABELS[view]} controls`)
    expect(fallback.querySelector('[data-react-header-status]')?.getAttribute('data-page')).toBe(HEADER_PAGE[view])
  })

  it('swaps the stand-in for the page\'s own header and back, with one header in the bar at every moment', async () => {
    const page = (withHeader: boolean) => (
      <Harness initialView="media">
        <main className="mmv-root">
          {withHeader && <ApplicationHeaderControls><header className="mmv-header" data-own>Own header</header></ApplicationHeaderControls>}
        </main>
      </Harness>
    )
    const visibleHeaders = () => host.querySelectorAll('.fw-app-header-controls > *, .fw-app-header-fallback:not([hidden]) > *').length
    await render(page(false)); expect(visibleHeaders()).toBe(1)
    await render(page(true)); expect(host.querySelector<HTMLElement>('.fw-app-header-fallback')?.hidden).toBe(true); expect(host.querySelector('.fw-app-header-fallback .vz-header')).toBeNull(); expect(visibleHeaders()).toBe(1)
    await render(page(false)); expect(host.querySelector<HTMLElement>('.fw-app-header-fallback')?.hidden).toBe(false); expect(visibleHeaders()).toBe(1)
    await render(page(true)); expect(host.querySelector('.fw-app-header-controls [data-own]')).not.toBeNull()
  })

  it('keeps the header occupied while any page still has its controls in it', async () => {
    function Two({ first, second }: { first: boolean; second: boolean }) {
      return <main>
        {first && <ApplicationHeaderControls><span data-who="first">first</span></ApplicationHeaderControls>}
        {second && <ApplicationHeaderControls><span data-who="second">second</span></ApplicationHeaderControls>}
      </main>
    }
    const hidden = () => host.querySelector<HTMLElement>('.fw-app-header-fallback')!.hidden
    await render(<Harness><Two first second /></Harness>); expect(hidden()).toBe(true)
    await render(<Harness><Two first={false} second /></Harness>); expect(hidden()).toBe(true)
    await render(<Harness><Two first={false} second={false} /></Harness>); expect(hidden()).toBe(false)
  })

  it('finds the header after a page that suspends and is replaced, as when moving between lazy pages', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => { release = resolve })
    const Late = React.lazy(async () => { await gate; return { default: () => <ApplicationHeaderControls><span data-who="late">late</span></ApplicationHeaderControls> } })
    const Quick = () => <ApplicationHeaderControls><span data-who="quick">quick</span></ApplicationHeaderControls>
    const view = (node: React.ReactNode) => <Harness><Suspense fallback={<i data-loading />}>{node}</Suspense></Harness>
    await render(view(<Quick />)); expect(host.querySelector('.fw-app-header-controls [data-who="quick"]')).not.toBeNull()
    await render(view(<Late />)); expect(host.querySelector('[data-loading]')).not.toBeNull()
    expect(host.querySelector<HTMLElement>('.fw-app-header-fallback')!.hidden).toBe(false)
    await act(async () => { release(); await gate })
    await act(async () => { await Promise.resolve() })
    expect(host.querySelector('.fw-app-header-controls [data-who="late"]')).not.toBeNull()
    expect(host.querySelector<HTMLElement>('.fw-app-header-fallback')!.hidden).toBe(true)
    await render(view(<Quick />)); expect(host.querySelector('.fw-app-header-controls [data-who="quick"]')).not.toBeNull()
    expect(host.querySelector<HTMLElement>('.fw-app-header-fallback')!.hidden).toBe(true)
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
    expect(frame.querySelector('.fw-app-navigation .fw-sidebar-toggle')).toBeNull()
    expect(frame.querySelector('[data-workspace-slot="stage"] [data-testid="feature-content"]')).not.toBeNull()
    expect([...frame.querySelectorAll('.az-nav .az-nav-item')].map(item => item.getAttribute('aria-label'))).toEqual([
      'React', 'Performance Manager', 'Preset Manager', 'Show Manager', 'Lyric Manager', 'Media Manager',
    ])
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Preset Manager"]')!.click())
    expect(host.querySelector('[data-app-workspace="presetManager"]')).not.toBeNull()
    expect(host.querySelector('[aria-label="Preset Manager"]')?.getAttribute('aria-current')).toBe('page')
    expect(host.querySelectorAll('[data-app-icon="brand"]')).toHaveLength(0)
  })

  it('stays collapsed through route changes and moves the notch to the selected button', async () => {
    let notifyResize: (() => void) | undefined
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { notifyResize = callback }
      observe() {}
      disconnect() {}
    })
    const original = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { ...original.call(this),
        width: this.classList.contains('az-sidebar--collapsed') ? 72 : 240,
        top: this.getAttribute('aria-label') === 'Lyric Manager' ? 200 : 0,
        height: this.classList.contains('az-nav-item') ? 46 : 0,
      }
    }
    try {
      await render(<Harness />)
      const frame = host.querySelector<HTMLElement>('.az-root')!
      expect(frame.style.getPropertyValue('--vz-sidebar-width')).toBe('72px')
      await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Lyric Manager"]')!.click())
      await act(async () => notifyResize?.())
      const sidebar = host.querySelector<HTMLElement>('.az-sidebar--collapsed.az-sidebar--notched')!
      expect(sidebar).not.toBeNull()
      expect(sidebar.style.getPropertyValue('--az-sidebar-selected-y')).toBe('223px')
      expect(frame.style.getPropertyValue('--vz-sidebar-width')).toBe('72px')
      expect(host.querySelector('[title="Expand sidebar"], [title="Collapse sidebar"]')).toBeNull()
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
    expect(host.querySelector('.fw-app-header-fallback .vz-header-brand-name')?.textContent).toBe('React')
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
