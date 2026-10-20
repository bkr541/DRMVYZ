// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PRESET_MANAGER_CARD_CONCEPTS, PresetManagerCardStyleGallery } from '../PresetManagerCardStyleGallery'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<PresetManagerCardStyleGallery />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('Preset Manager card studies', () => {
  it('shows five studies, each with four sample cards', () => {
    expect(PRESET_MANAGER_CARD_CONCEPTS).toHaveLength(5)
    expect(container.querySelectorAll('[data-preset-card-concept]')).toHaveLength(5)
    for (const concept of PRESET_MANAGER_CARD_CONCEPTS) {
      expect(container.querySelectorAll(`[data-preset-card="${concept.id}"]`)).toHaveLength(4)
    }
  })

  it('names the engine, the scope (SYSTEM or USER) and at least one badge on every card', () => {
    const cards = [...container.querySelectorAll<HTMLElement>('[data-preset-card]')]
    expect(cards).toHaveLength(20)
    for (const card of cards) {
      expect(card.textContent).toMatch(/Cinema 2\.0|Canvas|Headliner/)
      expect(card.textContent).toMatch(/SYSTEM|USER/)
      expect(card.querySelectorAll('.dv-badge').length).toBeGreaterThan(0)
    }
    const scopes = new Set(cards.map(card => card.getAttribute('data-scope')))
    expect([...scopes].sort()).toEqual(['SYSTEM', 'USER'])
  })
})
