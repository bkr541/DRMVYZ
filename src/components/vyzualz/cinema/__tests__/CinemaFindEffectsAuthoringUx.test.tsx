/** @vitest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CinemaInspectorPanel } from '../../react/CinemaInspectorPanel'
import { createCinemaFoundationPersistedState } from '../CinemaFoundation'
import { useCinemaStore } from '../CinemaStore'

let root: Root | null = null
let host: HTMLDivElement | null = null

function setTextInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useCinemaStore.getState().hydrateCinemaState(createCinemaFoundationPersistedState())
  host = document.createElement('div')
  host.className = 'rv-shell'
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  host?.remove()
  host = null
  vi.unstubAllGlobals()
})

describe('Cinema Find Effects authoring UX', () => {
  it('presents the effect catalog as browse-only reference content without inventing a Show Manager authoring action', async () => {
    await act(async () => root?.render(<CinemaInspectorPanel />))

    const findEffectsHeader = [...(host?.querySelectorAll<HTMLButtonElement>('.drc-header') ?? [])]
      .find(button => button.textContent?.includes('Find Effects'))
    expect(findEffectsHeader).not.toBeUndefined()

    await act(async () => findEffectsHeader?.click())

    const group = findEffectsHeader?.closest<HTMLElement>('.drc-group') ?? null
    const results = group?.querySelector<HTMLElement>('.rv-cinema-effect-results') ?? null
    const search = group?.querySelector<HTMLInputElement>('input[aria-label="Search Cinema effects"]') ?? null

    expect(group?.textContent).toContain('Browse only')
    expect(group?.textContent).toContain('Cinema effect structure cannot currently be authored in Show Manager.')
    expect(group?.querySelector('.drc-body button, .drc-body a[href], .drc-body [role="button"]')).toBeNull()
    expect(results?.querySelectorAll('[data-cinema-effect-reference="true"]').length).toBeGreaterThan(0)
    expect(results?.querySelector('button, [role="button"], [tabindex]')).toBeNull()
    expect(search).not.toBeNull()

    const before = useCinemaStore.getState().compositions
    const firstReference = results?.querySelector<HTMLElement>('[data-cinema-effect-reference="true"]') ?? null
    await act(async () => {
      firstReference?.click()
      firstReference?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      firstReference?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    })
    expect(useCinemaStore.getState().compositions).toBe(before)

    await act(async () => {
      if (search) setTextInputValue(search, '__no_effect_matches_this__')
    })
    expect(group?.textContent).toContain('No effects match this search.')

    await act(async () => {
      if (search) setTextInputValue(search, 'chromatic')
    })
    expect(results?.textContent).toContain('Chromatic Aberration')
  })
})
