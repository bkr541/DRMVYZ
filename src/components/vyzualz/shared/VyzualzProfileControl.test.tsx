// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ configured: true, getUser: vi.fn(), getProfile: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ get supabaseConfigured() { return fixture.configured }, supabase: { auth: { getUser: fixture.getUser } } }))
vi.mock('../../../lib/profileDb', () => ({ getProfile: fixture.getProfile }))
vi.mock('../settings/SettingsModal', () => ({ SettingsModal: ({ onClose }: { onClose: () => void }) => <div role="dialog"><button onClick={onClose}>Close settings</button></div> }))
import { VyzualzProfileControl } from './VyzualzProfileControl'
let host: HTMLDivElement, root: ReturnType<typeof createRoot>
beforeEach(() => {
  fixture.configured = true
  fixture.getUser.mockReset().mockResolvedValue({ data: { user: { id: 'owner', email: 'owner@example.com' } } })
  fixture.getProfile.mockReset().mockResolvedValue({ profile: { display_name: 'Kody', avatar_url: '/avatar.png' } })
  host = document.createElement('div'); host.className = 'az-root'; document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const render = () => act(async () => root.render(<aside className="az-sidebar"><VyzualzProfileControl /></aside>))
const button = () => host.querySelector<HTMLButtonElement>('[aria-label="Profile and settings"]')!
describe('navigation profile control', () => {
  it('retains the owner avatar, opens settings outside the rail, and refreshes after closing', async () => {
    await render()
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/avatar.png')
    await act(async () => button().click())
    expect(button().getAttribute('aria-expanded')).toBe('true')
    expect(host.querySelector('aside [role="dialog"]')).toBeNull()
    expect(host.querySelector(':scope > [role="dialog"]')).not.toBeNull()
    fixture.getProfile.mockResolvedValue({ profile: { display_name: 'New Name', avatar_url: null } })
    await act(async () => host.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click())
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(button().getAttribute('aria-expanded')).toBe('false')
    expect(host.querySelector('.vz-header-avatar-initials')?.textContent).toBe('NE')
  })
  it('keeps settings available without cloud configuration', async () => {
    fixture.configured = false; await render()
    expect(fixture.getUser).not.toHaveBeenCalled()
    expect(host.querySelector('[data-app-icon="settings"]')).not.toBeNull()
    await act(async () => button().click())
    expect(host.querySelector('[role="dialog"]')).not.toBeNull()
  })
  it('falls back to account initials when no profile exists', async () => {
    fixture.getProfile.mockResolvedValue({ profile: null }); await render()
    expect(host.querySelector('.vz-header-avatar-initials')?.textContent).toBe('OW')
  })
  it('retains a usable settings button when account loading fails', async () => {
    fixture.getUser.mockRejectedValue(new Error('Offline')); await render()
    expect(host.querySelector('[data-app-icon="settings"]')).not.toBeNull()
    await act(async () => button().click())
    expect(host.querySelector('[role="dialog"]')).not.toBeNull()
  })
})
