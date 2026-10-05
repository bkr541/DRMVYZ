// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../components/vyzualz/shared/VyzualzHeaderActions', () => ({
  VyzualzHeaderActions: ({ leading }: { leading?: React.ReactNode }) => <div className="header-actions-stub">{leading}</div>,
}))

import { LyricManagerHeader } from './LyricManagerHeader'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

const handlers = { onToggleLyricsDisplay: vi.fn(), onSave: vi.fn(), onSaveAndMakeActive: vi.fn() }

async function render(overrides: Partial<React.ComponentProps<typeof LyricManagerHeader>> = {}) {
  await act(async () => root.render(
    <LyricManagerHeader isSaving={false} saveStatus="saved" lyricsDisplayEnabled hasDocument dirty={false} {...handlers} {...overrides} />,
  ))
}

const keys = () => [...container.querySelectorAll<HTMLButtonElement>('.vz-header-group button')]
const key = (label: string) => keys().find(button => button.getAttribute('aria-label') === label)!

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

describe('LyricManagerHeader control group', () => {
  it('is three icon-only keys: Show Lyrics, Save and Save + Make Active', async () => {
    await render()
    expect(keys().map(button => button.getAttribute('aria-label'))).toEqual(['Show Lyrics', 'Save', 'Save + Make Active'])
    for (const button of keys()) {
      expect(button.textContent?.trim()).toBe('')
      expect(button.querySelector('svg')).not.toBeNull()
      expect(button.title).not.toBe('')
    }
  })

  it('shows the lyrics toggle state with aria-pressed and flips it on click', async () => {
    await render({ lyricsDisplayEnabled: false })
    expect(key('Show Lyrics').getAttribute('aria-pressed')).toBe('false')
    await act(async () => key('Show Lyrics').click())
    expect(handlers.onToggleLyricsDisplay).toHaveBeenCalledTimes(1)
    await render({ lyricsDisplayEnabled: true })
    expect(key('Show Lyrics').getAttribute('aria-pressed')).toBe('true')
  })

  it('wires Save and Save + Make Active, and disables both while saving or with nothing to save', async () => {
    await render({ dirty: true })
    await act(async () => key('Save').click())
    await act(async () => key('Save + Make Active').click())
    expect(handlers.onSave).toHaveBeenCalledTimes(1)
    expect(handlers.onSaveAndMakeActive).toHaveBeenCalledTimes(1)

    await render({ isSaving: true, dirty: true })
    expect(key('Save').disabled).toBe(true)
    expect(key('Save').title).toBe('Saving…')
    await render({ hasDocument: false, dirty: false })
    expect(key('Save').disabled).toBe(true)
    expect(key('Save + Make Active').disabled).toBe(true)
  })
})
