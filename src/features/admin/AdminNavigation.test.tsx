// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ admin: false }))
vi.mock('../../context/AudioEngineContext', () => ({ useSharedAudio: () => ({ source: 'file' }) }))
vi.mock('./users/usersApi', () => ({ loadAdminUsers: async () => [] }))
vi.mock('./messages/messagesApi', () => ({ loadAnnouncements: async () => [], loadAnnouncementStats: async () => [] }))
vi.mock('./presets/presetsApi', () => ({ loadPresetMetadata: async () => [], loadPacks: async () => [], loadPackMembers: async () => [] }))
vi.mock('../../lib/adminAccess', () => ({ useAdminAccess: () => fixture.admin, hasAdminAccess: () => fixture.admin }))

import { VyzualzSidebar } from '../../components/vyzualz/VyzualzSidebar'
import { AdminView } from './AdminView'
import { ApplicationWorkspaceFrame } from '../../components/vyzualz/layout/ApplicationWorkspaceFrame'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null
const mount = (node: React.ReactElement) => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  act(() => root?.render(node))
}
afterEach(() => { fixture.admin = false; if (root) act(() => root?.unmount()); container?.remove(); root = null; container = null })

describe('Admin entrance and workspace', () => {
  it('puts no Admin button in the left navigation for an account that is not an admin', () => {
    mount(<VyzualzSidebar appView="react" />)
    expect(container!.querySelector('[aria-label="Admin"]')).toBeNull()
    expect(container!.querySelector('[aria-label="Profile and settings"]')).not.toBeNull()
  })

  it('shows it for an admin, directly above Profile, opens the Admin view and marks it current', () => {
    fixture.admin = true
    const onAppViewChange = vi.fn()
    mount(<VyzualzSidebar appView="react" onAppViewChange={onAppViewChange} />)
    const button = container!.querySelector<HTMLButtonElement>('[aria-label="Admin"]')!
    expect(button).not.toBeNull()
    expect(button.nextElementSibling?.getAttribute('aria-label')).toBe('Profile and settings')
    act(() => button.click())
    expect(onAppViewChange).toHaveBeenCalledWith('admin')
    expect(button.getAttribute('aria-current')).toBeNull()
    act(() => root?.render(<VyzualzSidebar appView="admin" onAppViewChange={onAppViewChange} />))
    expect(container!.querySelector('[aria-label="Admin"]')?.getAttribute('aria-current')).toBe('page')
  })

  it('uses the shared page header slot and brand without a duplicate window title', async () => {
    fixture.admin = true
    mount(<ApplicationWorkspaceFrame appView="admin" onAppViewChange={() => {}}><AdminView /></ApplicationWorkspaceFrame>)
    await act(async () => { await Promise.resolve() })
    const header = container!.querySelector('[data-app-header-slot="controls"] > .vz-header')!
    expect(header.querySelector('.vz-header-brand-logo')).not.toBeNull()
    expect(header.querySelector('.vz-header-brand-name')?.textContent).toBe('Admin Console')
    expect(header.querySelector('.vz-header-brand-divider')).not.toBeNull()
    expect(header.querySelector('[data-react-header-status]')).not.toBeNull()
    expect(container!.querySelector<HTMLElement>('.fw-app-header-fallback')?.hidden).toBe(true)
    expect(container!.querySelector('.admin-view-canvas .rw-window-header')).toBeNull()
  })

  it('renders the Admin Console with its three sections for an admin, and nothing at all for anyone else', async () => {
    fixture.admin = true
    mount(<AdminView />)
    await act(async () => { await Promise.resolve() })
    const view = container!.querySelector('[data-testid="admin-view"]')!
    expect([...view.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)).toEqual(['User Accounts', 'Preset Catalog', 'Message Center'])
    act(() => root?.unmount())
    container!.remove()
    fixture.admin = false
    mount(<AdminView />)
    expect(container!.querySelector('[data-testid="admin-view"]')!.textContent).toBe('')
  })
})
