// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricDocumentVersion } from '../lyricManagerTypes'
import { LyricDocumentSidebar } from './LyricDocumentSidebar'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

function doc(overrides: Partial<LyricDocumentVersion>): LyricDocumentVersion {
  return {
    id: 'doc-a',
    title: 'Approved Lyrics',
    artist: 'DVYDRM',
    sourceType: 'ai_transcription',
    isActive: false,
    cueCount: 31,
    language: 'English',
    documentReviewStatus: 'unreviewed',
    updatedAt: '2026-07-03T00:00:00.000Z',
    ...overrides,
  } as LyricDocumentVersion
}

const handlers = {
  onSelectDocument: vi.fn(),
  onDuplicateDocument: vi.fn(),
  onRenameDocument: vi.fn(),
  onActivateDocument: vi.fn(),
  onDeleteDocument: vi.fn(),
}

async function render(documents: LyricDocumentVersion[], openDocumentId: string | null = null) {
  await act(async () => root.render(
    <LyricDocumentSidebar documents={documents} loading={false} openDocumentId={openDocumentId} hasSelectedTrack {...handlers} />,
  ))
}

const cards = () => [...container.querySelectorAll<HTMLElement>('.lmv-doc-card')]
const badgeTexts = (card: HTMLElement) => [...card.querySelectorAll('.dv-badge')].map(badge => badge.textContent)
const action = (card: HTMLElement, label: string) => card.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)

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

describe('LyricDocumentSidebar version cards', () => {
  it('shows source, open, active, cue count and language as badges', async () => {
    await render([doc({ isActive: true })], 'doc-a')
    expect(badgeTexts(cards()[0]!)).toEqual(['AI', 'Open', 'Active', '31 cues', 'English'])
  })

  it('omits badges that do not apply and does not render a placeholder language badge', async () => {
    await render([doc({ id: 'doc-b', sourceType: 'manual', language: null, cueCount: 0 })])
    expect(badgeTexts(cards()[0]!)).toEqual(['Manual', '0 cues'])
  })

  it('gives only the active version the selected-track active styling hook', async () => {
    await render([doc({ id: 'doc-a', isActive: true }), doc({ id: 'doc-b', title: 'Alternate', isActive: false })], 'doc-b')
    const [active, open] = cards()
    expect(active!.classList.contains('lmv-doc-card--active')).toBe(true)
    expect(open!.classList.contains('lmv-doc-card--active')).toBe(false)
    expect(open!.classList.contains('lmv-doc-card--open')).toBe(true)
  })

  it('offers rename, duplicate and delete as icon buttons, plus Make Active only when inactive', async () => {
    await render([doc({ id: 'doc-a', isActive: true }), doc({ id: 'doc-b', title: 'Alternate' })])
    const [active, inactive] = cards()
    for (const label of ['Rename', 'Duplicate', 'Delete']) {
      const button = action(active!, label)
      expect(button?.querySelector('svg')).not.toBeNull()
      expect(button?.textContent?.trim()).toBe('')
    }
    expect(action(active!, 'Make Active')).toBeNull()
    expect(action(inactive!, 'Make Active')).not.toBeNull()
  })

  it('routes each icon action to its handler for that version', async () => {
    const docB = doc({ id: 'doc-b', title: 'Alternate' })
    await render([docB])
    const card = cards()[0]!
    await act(async () => action(card, 'Duplicate')!.click())
    await act(async () => action(card, 'Make Active')!.click())
    await act(async () => action(card, 'Delete')!.click())
    expect(handlers.onDuplicateDocument).toHaveBeenCalledWith(docB)
    expect(handlers.onActivateDocument).toHaveBeenCalledWith(docB)
    expect(handlers.onDeleteDocument).toHaveBeenCalledWith(docB)
    await act(async () => action(card, 'Rename')!.click())
    expect(container.querySelector('input[aria-label="Lyric document name"]')).not.toBeNull()
  })

  it('uses the same search and filter row as the Tracks window', async () => {
    await render([doc({})])
    const row = container.querySelector('.lmv-track-search-row')
    expect(row?.querySelector('.lmv-track-search-icon')).not.toBeNull()
    expect(row?.querySelector('input[aria-label="Search lyric versions"]')).not.toBeNull()
    expect(row?.querySelector('.lmv-track-filter-dropdown')).not.toBeNull()
  })
})
