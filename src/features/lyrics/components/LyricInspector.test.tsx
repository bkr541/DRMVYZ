// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue, LyricStyle } from '../../../types/lyrics'
import { LyricCueInspector } from '../editor/LyricCueInspector'
import { LyricDocumentDefaultsPanel } from './LyricDocumentDefaultsPanel'
import { LyricDocumentPresentationPanel } from './LyricDocumentPresentationPanel'
import { LyricInspector, type LyricInspectorTab } from './LyricInspector'
import { LyricPreviewPanel } from './LyricPreviewPanel'
import type { LyricValidationIssue } from '../utils/lyricValidation'

const cueA: LyricCue = { id: 'cue-a', startMs: 1_000, endMs: 4_000, text: 'First line', source: 'manual', reviewStatus: 'unreviewed' }
// A word that falls outside its cue produces a navigable validation issue.
const cueB: LyricCue = {
  id: 'cue-b',
  startMs: 5_000,
  endMs: 7_000,
  text: 'Second line',
  source: 'manual',
  reviewStatus: 'unreviewed',
  words: [{ id: 'word-b1', text: 'Second', startMs: 100, endMs: 300 }],
}

const actions = new Proxy({}, { get: () => () => undefined }) as never

interface HarnessProps {
  onUpdateCue: (cueId: string, patch: Partial<LyricCue>) => void
  onUpdateDefaultStyle: (patch: Partial<LyricStyle>) => void
  onNavigateToIssue: (issue: LyricValidationIssue) => void
  onTitleChange: (title: string) => void
}

/** Mirrors the Lyric Manager's wiring: the tab and the selected cue live in the parent, panes are real components. */
function Harness({ onUpdateCue, onUpdateDefaultStyle, onNavigateToIssue, onTitleChange }: HarnessProps) {
  const [tab, setTab] = useState<LyricInspectorTab>('cue')
  const [selectedId, setSelectedId] = useState('cue-a')
  const [title, setTitle] = useState('Song')
  const cues = [cueA, cueB]
  const selected = cues.find(cue => cue.id === selectedId) ?? null
  return (
    <>
      <button type="button" data-testid="select-b" onClick={() => setSelectedId('cue-b')}>select B</button>
      <LyricInspector
        activeTab={tab}
        onTabChange={setTab}
        cue={selected ? (
          <LyricCueInspector
            key={selected.id}
            cue={selected}
            cues={cues}
            currentTimeMs={0}
            durationMs={10_000}
            actions={actions}
            canMergePrevious={false}
            canMergeNext={false}
            onUpdateCue={onUpdateCue}
            onUpdateWord={() => undefined}
          />
        ) : <div>Select a lyric cue</div>}
        document={(
          <>
            <LyricDocumentDefaultsPanel
              draftTitle={title}
              draftArtist="Artist"
              globalOffsetMs={0}
              onUpdateTitle={value => { setTitle(value); onTitleChange(value) }}
              onUpdateArtist={() => undefined}
              onUpdateGlobalOffset={() => undefined}
            />
            <LyricDocumentPresentationPanel
              defaultStyle={{}}
              defaultAnimation={{}}
              defaultEffects={{}}
              onUpdateDefaultStyle={onUpdateDefaultStyle}
              onUpdateDefaultAnimation={() => undefined}
              onUpdateDefaultEffects={() => undefined}
            />
          </>
        )}
        review={<LyricPreviewPanel cues={cues} document={null} onNavigateToIssue={onNavigateToIssue} />}
      />
    </>
  )
}

let container: HTMLElement
let root: ReturnType<typeof createRoot>
const handlers = {
  onUpdateCue: vi.fn(),
  onUpdateDefaultStyle: vi.fn(),
  onNavigateToIssue: vi.fn(),
  onTitleChange: vi.fn(),
}

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<Harness {...handlers} />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

const pane = (id: LyricInspectorTab) => container.querySelector<HTMLElement>(`[data-inspector-pane="${id}"]`)!
const tabButton = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent === label)!
const clickTab = async (label: string) => act(async () => tabButton(label).click())

async function typeInto(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

// Fields are the shared Sound Drawing control rows: <div.rv-ctrl-row><span.rv-ctrl-label-cluster><label for>…</label></span><input id/></div>.
const fieldByLabel = (scope: HTMLElement, label: string) => {
  const caption = [...scope.querySelectorAll<HTMLLabelElement>('label.rv-ctrl-label')].find(item => item.textContent === label)
  return (caption ? scope.ownerDocument.getElementById(caption.htmlFor) : null) as HTMLInputElement
}

describe('LyricInspector tabs', () => {
  it('renders Cue, Document and Review tabs with Cue active by default', () => {
    expect([...container.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)).toEqual(['Cue', 'Document', 'Review'])
    expect(tabButton('Cue').getAttribute('aria-selected')).toBe('true')
    expect(pane('cue').hidden).toBe(false)
    expect(pane('document').hidden).toBe(true)
    expect(pane('review').hidden).toBe(true)
  })

  it('shows the selected cue controls in the Cue tab, label above input, two per row', () => {
    const scope = pane('cue')
    expect(fieldByLabel(scope, 'Start time (ms)').value).toBe('1000')
    expect(fieldByLabel(scope, 'End time (ms)').value).toBe('4000')
    // Label above input: each control is the shared rv-ctrl-row whose first child is the caption cluster.
    const startRow = fieldByLabel(scope, 'Start time (ms)').closest('.rv-ctrl-row')!
    expect(startRow.firstElementChild?.classList.contains('rv-ctrl-label-cluster')).toBe(true)
    expect(fieldByLabel(scope, 'Start time (ms)').classList.contains('dv-text-input')).toBe(true)
    expect(scope.querySelector('.lyric-cue-inspector__grid')).not.toBeNull()
    const captions = [...scope.querySelectorAll('.lyric-cue-inspector__grid > .rv-ctrl-row > .rv-ctrl-label-cluster > label')].map(label => label.textContent)
    expect(captions).toEqual(['Text', 'Start time (ms)', 'End time (ms)', 'Section', 'Review state', 'Position', 'Text size', 'Duration (ms)', 'Confidence (0–1)'])
  })

  it('shows document identity and default presentation in the Document tab', async () => {
    await clickTab('Document')
    expect(pane('document').hidden).toBe(false)
    expect(pane('cue').hidden).toBe(true)
    expect(fieldByLabel(pane('document'), 'Title').value).toBe('Song')
    expect(fieldByLabel(pane('document'), 'Artist').value).toBe('Artist')
    expect(fieldByLabel(pane('document'), 'Global offset (ms)')).toBeTruthy()
    expect(pane('document').textContent).toContain('Default Style / Animation / Effects')
  })

  it('shows validation, stats and issue lists in the Review tab', async () => {
    await clickTab('Review')
    expect(pane('review').hidden).toBe(false)
    expect(pane('review').textContent).toContain('Validation')
    expect(pane('review').textContent).toContain('Document Stats')
  })

  it('switching tabs keeps in-progress cue edits, the selected cue and document edits', async () => {
    const text = fieldByLabel(pane('cue'), 'Text')
    await typeInto(text, 'Edited but not committed')
    await clickTab('Document')
    const title = fieldByLabel(pane('document'), 'Title')
    await typeInto(title, 'New title')
    await clickTab('Review')
    await clickTab('Cue')

    // Same DOM node, same value: the pane was never unmounted or reset.
    expect(fieldByLabel(pane('cue'), 'Text')).toBe(text)
    expect(text.value).toBe('Edited but not committed')
    expect(pane('cue').querySelector('.lyric-cue-inspector__heading strong')?.textContent).toBe('First line')
    await clickTab('Document')
    expect(fieldByLabel(pane('document'), 'Title').value).toBe('New title')
    // Tab changes alone commit nothing to the cue.
    expect(handlers.onUpdateCue).not.toHaveBeenCalled()
  })

  it('does not change tabs when the selected cue changes', async () => {
    await clickTab('Review')
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="select-b"]')!.click())
    expect(tabButton('Review').getAttribute('aria-selected')).toBe('true')
    expect(pane('review').hidden).toBe(false)
    await clickTab('Cue')
    expect(pane('cue').querySelector('.lyric-cue-inspector__heading strong')?.textContent).toBe('Second line')
  })

  it('cue controls update the selected cue only', async () => {
    const start = fieldByLabel(pane('cue'), 'Start time (ms)')
    await typeInto(start, '1500')
    await act(async () => { start.focus(); start.blur() })
    expect(handlers.onUpdateCue).toHaveBeenCalledWith('cue-a', { startMs: 1500, endMs: 4000 })

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="select-b"]')!.click())
    const text = fieldByLabel(pane('cue'), 'Text')
    await typeInto(text, 'Second line (fixed)')
    await act(async () => { text.focus(); text.blur() })
    expect(handlers.onUpdateCue).toHaveBeenLastCalledWith('cue-b', { text: 'Second line (fixed)' })
    expect(handlers.onUpdateCue.mock.calls.every(([id]) => id === 'cue-a' || id === 'cue-b')).toBe(true)
  })

  it('document controls update document defaults, never a cue', async () => {
    await clickTab('Document')
    const size = fieldByLabel(pane('document'), 'Font size')
    await typeInto(size, '64')
    expect(handlers.onUpdateDefaultStyle).toHaveBeenCalledWith({ fontSize: 64 })
    expect(handlers.onUpdateCue).not.toHaveBeenCalled()

    const title = fieldByLabel(pane('document'), 'Title')
    await typeInto(title, 'Renamed')
    expect(handlers.onTitleChange).toHaveBeenLastCalledWith('Renamed')
  })

  it('keeps document defaults and cue overrides separate: the cue tab offers inherit, the document tab does not', async () => {
    const cueSize = fieldByLabel(pane('cue'), 'Text size')
    const docSize = fieldByLabel(pane('document'), 'Font size')
    expect(cueSize.placeholder).toBe('Inherit')
    expect(docSize.placeholder).not.toBe('Inherit')
    await typeInto(cueSize, '40')
    expect(handlers.onUpdateCue).toHaveBeenCalledWith('cue-a', { style: { fontSize: 40 } })
    expect(handlers.onUpdateDefaultStyle).not.toHaveBeenCalled()
  })

  it('review issues still navigate to the affected cue and word', async () => {
    await clickTab('Review')
    const issue = [...pane('review').querySelectorAll<HTMLButtonElement>('.lmv-notice-issue-btn')]
      .find(button => button.textContent?.includes('word 1'))
    expect(issue).toBeTruthy()
    await act(async () => issue!.click())
    expect(handlers.onNavigateToIssue).toHaveBeenCalledWith(expect.objectContaining({ cueId: 'cue-b', wordId: 'word-b1' }))
  })
})
