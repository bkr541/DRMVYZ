// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue } from '../../../types/lyrics'
import { calculateLyricCueProgress, LyricPreviewPanel } from './LyricPreviewPanel'
import { validateLyricCues } from '../utils/lyricValidation'

const cue: LyricCue = {
  id: 'cue-1',
  startMs: 1_000,
  endMs: 3_000,
  text: '',
  reviewStatus: 'unreviewed',
  words: [{ id: 'word-1', text: 'word', startMs: 500, endMs: 1_200 }],
}

describe('LyricPreviewPanel', () => {
  it('calculates authoritative cue progress before, during, and after a cue with offset', () => {
    expect(calculateLyricCueProgress(1_400, cue, 500)).toBe(0)
    expect(calculateLyricCueProgress(2_500, cue, 500)).toBe(50)
    expect(calculateLyricCueProgress(3_500, cue, 500)).toBe(100)
    expect(calculateLyricCueProgress(2_000, { startMs: 2_000, endMs: 2_000 }, 0)).toBe(100)
  })

  it('explains how to resolve the empty-document notice shown in Notifications', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      await act(async () => root.render(<LyricPreviewPanel cues={[]} document={null} />))
      const card = [...container.querySelectorAll('.dv-notice')].find(el => el.querySelector('.dv-notice-title')?.textContent === 'No cues in document')
      expect(card).toBeTruthy()
      expect(card?.querySelector('.dv-notice-body')?.textContent).toContain('Add a lyric cue, import a lyric document, or extract lyrics')
    } finally { await act(async () => root.unmount()); container.remove() }
  })

  it('routes actionable cue and word issues through the navigation callback', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const navigate = vi.fn()
    await act(async () => root.render(
      <LyricPreviewPanel
        cues={[cue]}
        document={null}
        onNavigateToIssue={navigate}
      />,
    ))

    const issueButton = [...container.querySelectorAll<HTMLButtonElement>('.dv-notice-open')]
      .find(button => button.getAttribute('aria-label')?.includes('word 1'))
    const errors = validateLyricCues([cue]).issues.filter(issue => issue.severity === 'error')
    const cards = [...container.querySelectorAll('.dv-notice[data-tone="error"]')]
    expect(cards).toHaveLength(errors.length)
    expect(cards.map(card => card.querySelector('.dv-notice-title')?.textContent)).toEqual(errors.map(issue => issue.message))
    expect(cards.every(card => card.getAttribute('role') === 'alert')).toBe(true)
    expect(cards.every(card => card.querySelector('.dv-notice-body')?.textContent?.trim())).toBe(true)
    expect(issueButton).toBeTruthy()
    await act(async () => issueButton?.click())
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ cueId: 'cue-1', wordId: 'word-1' }))

    await act(async () => root.unmount())
    container.remove()
  })
})
