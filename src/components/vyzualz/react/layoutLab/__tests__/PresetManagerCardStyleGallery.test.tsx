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
  it('shows ten studies, each with four sample cards', () => {
    expect(PRESET_MANAGER_CARD_CONCEPTS).toHaveLength(10)
    expect(container.querySelectorAll('[data-preset-card-concept]')).toHaveLength(10)
    for (const concept of PRESET_MANAGER_CARD_CONCEPTS) {
      expect(container.querySelectorAll(`[data-preset-card="${concept.id}"]`)).toHaveLength(4)
    }
  })

  it('names the engine, the scope (SYSTEM or USER) and at least one badge on every card', () => {
    const cards = [...container.querySelectorAll<HTMLElement>('[data-preset-card]')]
    expect(cards).toHaveLength(40)
    for (const card of cards) {
      expect(card.textContent).toMatch(/Cinema 2\.0|Canvas|Headliner/)
      expect(card.textContent).toMatch(/SYSTEM|USER/)
      expect(card.querySelectorAll('.dv-badge').length).toBeGreaterThan(0)
    }
    const scopes = new Set(cards.map(card => card.getAttribute('data-scope')))
    expect([...scopes].sort()).toEqual(['SYSTEM', 'USER'])
  })

  it('builds the flat studies (06–10) on the Lyric Manager track row and draws no card background or border of their own', () => {
    for (const id of ['track-row', 'inline-meta', 'scope-rail', 'split-line', 'key-value-row']) {
      const cards = [...container.querySelectorAll<HTMLElement>(`[data-preset-card="${id}"]`)]
      expect(cards, id).toHaveLength(4)
      for (const card of cards) {
        expect(card.classList.contains('vz-track-row'), id).toBe(true)
        expect(card.classList.contains('vz-track-row--list'), id).toBe(true)
        expect(card.classList.contains('llpm-card'), id).toBe(false)
      }
    }
    // The selected sample shows the track card's bare dot, not a capsule or a word.
    expect(container.querySelectorAll('[data-preset-card="track-row"] .vz-track-row-selected-dot')).toHaveLength(1)
  })
})
