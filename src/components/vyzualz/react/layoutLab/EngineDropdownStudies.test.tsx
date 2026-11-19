// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EngineDropdownStudies } from './EngineDropdownStudies'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from '../reactEngineCatalog'

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('Layout Lab engine dropdown studies', () => {
  it('shows five blueprint rows and four artwork rows with every engine choice', async () => {
    await act(async () => root.render(<EngineDropdownStudies />))
    const rows = [...host.querySelectorAll<HTMLElement>('[data-engine-study]')]
    expect(rows.map(row => row.dataset.engineStudy)).toEqual(['rail', 'tile', 'wash', 'grid', 'inset', 'cinema-still', 'film-gate', 'sleeve', 'lightbox'])
    for (const row of rows) {
      const cards = [...row.querySelectorAll<HTMLButtonElement>('button[role="option"]')]
      expect(cards.map(card => card.dataset.engine)).toEqual([...REACT_ENGINE_IDS])
      expect(cards.map(card => card.querySelector('.rv-engine-dropdown-label')?.textContent)).toEqual(REACT_ENGINE_IDS.map(id => REACT_ENGINE_CATALOG[id].label))
      if (row.dataset.engineStudyArtwork === 'true') {
        const sources = cards.map(card => card.querySelector('img')?.getAttribute('src'))
        expect(sources.every(Boolean)).toBe(true)
        expect(new Set(sources).size).toBe(REACT_ENGINE_IDS.length)
        expect(cards.find(card => card.dataset.engine === 'headliner')?.querySelector('img')?.getAttribute('src')).toBe('/layout-lab/headliner.png')
      } else {
        expect(cards.every(card => card.querySelector('.rv-engine-dropdown-icon svg'))).toBe(true)
      }
    }
  })

  it('keeps selection local to each row', async () => {
    await act(async () => root.render(<EngineDropdownStudies />))
    const item = (row: string, engine: string) => host.querySelector<HTMLButtonElement>(`[data-engine-study-item="${row}-${engine}"]`)!
    expect(item('rail', 'cinema2').getAttribute('aria-selected')).toBe('true')
    await act(async () => item('rail', 'canvas').click())
    expect(item('rail', 'canvas').getAttribute('aria-selected')).toBe('true')
    expect(item('rail', 'cinema2').getAttribute('aria-selected')).toBe('false')
    expect(item('inset', 'cinema2').getAttribute('aria-selected')).toBe('true')
  })
})
