// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ admin: false }))
vi.mock('../../context/AudioEngineContext', () => ({ useSharedAudio: () => ({ source: 'file' }) }))
vi.mock('../../lib/adminAccess', () => ({ useAdminAccess: () => fixture.admin, hasAdminAccess: () => fixture.admin }))

import { VyzualzSidebar } from '../../components/vyzualz/VyzualzSidebar'
import { AdminView } from './AdminView'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null
const mount = (node: React.ReactElement) => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  act(() => root?.render(node))
}
afterEach(() => { fixture.admin = false; if (root) act(() => root?.unmount()); container?.remove(); root = null; container = null })

describe('Admin entrance and workspace', () => {
  it('puts no Admin button in the left navigation for an account that is not an admin', () => {
    mount(<VyzualzSidebar compact appView="react" />)
    expect(container!.querySelector('[aria-label="Admin"]')).toBeNull()
    expect(container!.querySelector('[aria-label="Profile and settings"]')).not.toBeNull()
  })

  it('shows it for an admin, directly above Profile, opens the Admin view and marks it current', () => {
    fixture.admin = true
    const onAppViewChange = vi.fn()
    mount(<VyzualzSidebar compact appView="react" onAppViewChange={onAppViewChange} />)
    const button = container!.querySelector<HTMLButtonElement>('[aria-label="Admin"]')!
    expect(button).not.toBeNull()
    expect(button.nextElementSibling?.getAttribute('aria-label')).toBe('Profile and settings')
    act(() => button.click())
    expect(onAppViewChange).toHaveBeenCalledWith('admin')
    expect(button.getAttribute('aria-current')).toBeNull()
    act(() => root?.render(<VyzualzSidebar compact appView="admin" onAppViewChange={onAppViewChange} />))
    expect(container!.querySelector('[aria-label="Admin"]')?.getAttribute('aria-current')).toBe('page')
  })

  it('renders the Admin workspace as a blank canvas', () => {
    fixture.admin = true
    mount(<AdminView />)
    const view = container!.querySelector('[data-testid="admin-view"]')!
    expect(view).not.toBeNull()
    expect(view.textContent).toBe('')
  })
})
