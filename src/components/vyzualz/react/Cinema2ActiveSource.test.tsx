// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { Cinema2ActiveSource } from './Cinema2ActiveSource'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('Cinema 2.0 Active Source', () => {
  it('shows source status, opens the accessible menu and restores focus on Escape', async () => {
    const host = document.createElement('div'); document.body.appendChild(host)
    const root = createRoot(host), reset = vi.fn()
    try {
      await act(async () => root.render(<Cinema2ActiveSource name="Poster" type="Image" status="Loading media…" actions={[{ id: 'reset', label: 'Restore built-in', onSelect: reset }]} />))
      expect(host.textContent).toContain('Poster')
      expect(host.querySelector('[role="status"]')?.textContent).toContain('Loading media')
      const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Source actions"]')!
      expect(trigger.querySelector('[data-app-icon="more"]')).not.toBeNull()
      expect(trigger.classList.contains('dv-icon-chip')).toBe(false)
      await act(async () => trigger.click())
      expect(document.activeElement?.getAttribute('role')).toBe('menuitem')
      await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
      expect(document.activeElement).toBe(trigger)
      expect(document.querySelector('[aria-label="Active source actions"]')).toBeNull()
      await act(async () => trigger.click())
      await act(async () => document.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click())
      expect(reset).toHaveBeenCalledOnce()
    } finally { await act(async () => root.unmount()); host.remove() }
  })
})
