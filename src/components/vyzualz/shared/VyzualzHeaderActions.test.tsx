// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabase: {}, supabaseConfigured: false }))
vi.mock('../../../lib/profileDb', () => ({ getProfile: vi.fn() }))
vi.mock('../settings/SettingsModal', () => ({ SettingsModal: () => null }))

import { VyzualzHeaderActions } from './VyzualzHeaderActions'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('VyzualzHeaderActions order', () => {
  it('places the page status directly left of the CPU readout, then the activity ring, then the account button', async () => {
    await act(async () => root.render(
      <VyzualzHeaderActions page="lyric-manager" leading={<span data-testid="page-status">Unsaved</span>} />,
    ))
    const order = [...container.children].map(el => (el as HTMLElement).dataset.testid ?? el.className)
    expect(order[0]).toBe('page-status')
    expect(order[1]).toContain('vz-header-cpu')
    expect(order[2]).toContain('vz-header-activity')
    expect(order[3]).toContain('vsm-settings-btn')
  })

  it('renders nothing extra when a page has no status to show', async () => {
    await act(async () => root.render(<VyzualzHeaderActions page="media-manager" />))
    expect(container.children[0]?.className).toContain('vz-header-cpu')
  })
})
