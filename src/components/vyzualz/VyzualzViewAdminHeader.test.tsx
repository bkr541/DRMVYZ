// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApplicationHeaderControls } from './layout/ApplicationWorkspaceFrame'

/** A page's own header, put in the shared header slot the way every real page does. */
const ownHeader = (who: string, fallback = false) => <ApplicationHeaderControls fallbackWhenUnavailable={fallback}><div className="vz-header" data-who={who}>{who} header</div></ApplicationHeaderControls>

const access = vi.hoisted(() => ({ status: 'granted' as 'checking' | 'granted' | 'denied', listeners: new Set<() => void>() }))
vi.mock('../../lib/adminAccess', async () => {
  const react = await import('react')
  const useAdminAccessStatus = () => {
    const [, bump] = react.useReducer((n: number) => n + 1, 0)
    react.useEffect(() => { access.listeners.add(bump); return () => { access.listeners.delete(bump) } }, [])
    return access.status
  }
  return { hasAdminAccess: () => true, useAdminAccessStatus, useAdminAccess: () => useAdminAccessStatus() === 'granted' }
})
vi.mock('../../context/AudioEngineContext', () => ({ useSharedAudio: () => ({ source: 'file' }) }))
vi.mock('../../features/admin/users/usersApi', () => ({ loadAdminUsers: async () => [] }))
vi.mock('../../features/admin/messages/messagesApi', () => ({ loadAnnouncements: async () => [], loadAnnouncementStats: async () => [] }))
vi.mock('../../features/admin/presets/presetsApi', () => ({ loadPresetMetadata: async () => [], loadPacks: async () => [], loadPackMembers: async () => [] }))
vi.mock('./shared/VyzualzHeaderActions', () => ({ VyzualzHeaderActions: ({ page }: { page: string }) => <div data-react-header-status data-page={page} /> }))
vi.mock('./react/ReactView', () => ({ ReactView: () => <div>{ownHeader('react')}React workspace</div> }))
vi.mock('./performanceManager/PerformanceManagerView', () => ({ PerformanceManagerView: () => <div>{ownHeader('performance-manager')}PM</div> }))
vi.mock('./presetManager/PresetManagerView', () => ({ PresetManagerView: () => <main>{ownHeader('preset-manager', true)}Preset Manager</main> }))
vi.mock('./showManager/ShowManagerView', () => ({ ShowManagerView: () => <div>{ownHeader('show-manager', true)}Show</div> }))
vi.mock('../../features/media/MediaManagerView', () => ({ MediaManagerView: () => <div>{ownHeader('media-manager', true)}Media</div> }))
vi.mock('../../features/lyrics/LyricManagerView', () => ({ LyricManagerView: () => <div>{ownHeader('lyric-manager', true)}Lyrics</div> }))

import { VyzualzView } from './VyzualzView'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => { access.status = 'granted'; container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve() }) }
const until = async (done: () => boolean) => { for (let i = 0; i < 200 && !done(); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)) }) }
async function mount(initial = 'react') {
  await act(async () => root.render(<VyzualzView activeView="vyzualz" onNavigate={() => {}} initialAppView={initial as never} />))
  await flush()
}
async function go(label: string) {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(candidate => candidate.getAttribute('aria-label') === label)
  expect(button, label).toBeDefined()
  await act(async () => { button!.click(); await Promise.resolve() })
  if (label === 'Admin') await until(() => !!container.querySelector('[data-testid="admin-view"]'))
  await flush()
}
const setAccess = async (status: 'checking' | 'granted' | 'denied') => { access.status = status; await act(async () => { access.listeners.forEach(listener => listener()) }); await flush() }
const header = () => ({
  view: container.querySelector('[data-app-workspace]')?.getAttribute('data-app-workspace'),
  own: container.querySelector('[data-app-header-slot="controls"] [data-who]')?.getAttribute('data-who')
    ?? (container.querySelector('[data-app-header-slot="controls"] .vz-header')?.getAttribute('aria-label') ?? null),
  standIn: container.querySelector<HTMLElement>('.fw-app-header-fallback')?.hidden === false,
  inline: !!container.querySelector('.fw-app-content [data-who]'),
})

describe('every page keeps its own header across the Admin page', () => {
  it.each([
    ['Preset Manager', 'preset-manager'], ['Media Manager', 'media-manager'], ['Show Manager', 'show-manager'], ['Lyric Manager', 'lyric-manager'], ['React', 'react'],
  ])('Admin, then %s: that page\'s own header is in the bar, with no stand-in and no header inside the page', async (label, who) => {
    await mount('react')
    await go('Admin')
    expect(header()).toMatchObject({ view: 'admin', own: 'Admin Console header', standIn: false, inline: false })
    await go(label)
    expect(header()).toMatchObject({ own: who, standIn: false, inline: false })
  })

  it('goes round every page and back through Admin twice, ending on the page it started on with its own header', async () => {
    await mount('performanceManager')
    for (const label of ['Admin', 'Media Manager', 'Admin', 'Lyric Manager', 'Preset Manager', 'Admin', 'Show Manager', 'Admin', 'React']) {
      await go(label)
      const state = header()
      expect(state.inline, label).toBe(false)
      expect(state.standIn, label).toBe(false)
      expect(state.own, label).not.toBeNull()
    }
    expect(header()).toMatchObject({ view: 'react', own: 'react' })
  })

  it('shows the stand-in page header, not a bare label, while a page\'s own header is not in the bar', async () => {
    await mount('react')
    await go('Admin')
    const stand = container.querySelector('.fw-app-header-fallback')!
    expect((stand as HTMLElement).hidden).toBe(true)
    expect(stand.querySelector('.vz-header')).toBeNull()
  })
})

describe('Admin access and the Admin page', () => {
  it('stays on Admin while access is being re-checked, and leaves only once it is denied', async () => {
    await mount('react')
    await go('Admin')
    expect(header().view).toBe('admin')
    await setAccess('checking')
    // The Admin controls wait for a verified admin, but the page keeps a header of its own (brand, page name, readouts) in the meantime.
    expect(header()).toMatchObject({ view: 'admin', own: null, standIn: true })
    expect(container.querySelector('.fw-app-header-fallback .vz-header-brand-name')?.textContent).toBe('Admin')
    await setAccess('granted')
    expect(header()).toMatchObject({ view: 'admin', own: 'Admin Console header' })
    await setAccess('denied')
    expect(header()).toMatchObject({ view: 'react', own: 'react', standIn: false, inline: false })
  })
})
