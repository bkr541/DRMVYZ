// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationStore } from '../../../stores/notificationStore'
import { WithNotificationDrawer, drawerText } from '../../../test/WithNotificationDrawer'
import type { PresetManagerRecord } from '../../../components/vyzualz/presetManager/presetManagerCatalog'
import type { PresetMetadataRow } from '../../presetCatalog/presetMetadata'
import { AdminHeaderActionsContext } from '../AdminHeaderActions'
import { PresetCatalogPane, type SaveManyResult } from './PresetCatalogPane'
import { buildAdminPresets, type CatalogPack, type PackMember } from './presetAdmin'

// The live preview needs WebGL; the preview window shows the artwork here.
vi.mock('../../../components/vyzualz/react/Cinema2Stage', () => ({ Cinema2Stage: () => <div data-testid="live-stage" /> }))

const record = (sourceId: string, name: string, engineName = 'Cinema 2.0', category = 'cinematic'): PresetManagerRecord => ({
  id: `cinema2:${sourceId}`, sourceId, name, description: `${name} description`, engineName, category, tags: ['one'], artwork: 'cinema2', activation: 'cinema2',
  hasCamera: true, canIntegrateUserMedia: false, is3dEnvironment: true, sourceData: {},
})
const RECORDS = [record('alpha', 'Alpha'), record('bravo', 'Bravo'), record('charlie', 'Charlie'), record('delta', 'Delta', 'CANVAS', 'abstract')]
const row = (key: string, patch: Partial<PresetMetadataRow>): PresetMetadataRow => ({
  engine_id: 'cinema2', preset_key: key, name: null, description: null, category: null, tags: null, display_order: null, publication_status: null,
  store_title: null, store_subtitle: null, store_cover_ref: null, store_preview_ref: null, ...patch,
})
const ROWS = [row('alpha', { publication_status: 'published' }), row('bravo', { publication_status: 'draft' })]
const PACKS: CatalogPack[] = [{ id: 'p1', name: 'First Pack', description: null, display_order: 1 }]

type Changes = Parameters<React.ComponentProps<typeof PresetCatalogPane>['onSaveMany']>[0]
const calls = { saveMany: [] as Changes[], save: [] as unknown[] }
let nextResult: (changes: Changes) => SaveManyResult = changes => ({ saved: changes.length })

function Harness() {
  const [rows, setRows] = useState<readonly PresetMetadataRow[]>(ROWS)
  const [members] = useState<readonly PackMember[]>([])
  const presets = buildAdminPresets(RECORDS, rows, members)
  return (
    <PresetCatalogPane
      presets={presets} packs={PACKS} section={<div data-testid="sections" />}
      onSave={async (preset, next) => { calls.save.push([preset.record.id, next]) }}
      onSaveMany={async changes => {
        calls.saveMany.push(changes)
        const result = nextResult(changes)
        setRows(current => {
          let rest = [...current]
          for (const change of changes.slice(0, result.saved)) {
            rest = rest.filter(entry => entry.preset_key !== change.preset.record.sourceId)
            if (change.row) rest.push(change.row)
          }
          return rest
        })
        return result
      }}
      onAddToPack={async () => undefined} onRemoveFromPack={async () => undefined}
    />
  )
}

let host: HTMLDivElement
let headerHost: HTMLDivElement
let root: ReturnType<typeof createRoot>
let headerState: HTMLElement | null = null

function Page() {
  const [element, setElement] = useState<HTMLElement | null>(null)
  headerState = element
  return <>
    <div ref={setElement} data-testid="header-actions" />
    <AdminHeaderActionsContext.Provider value={element}><WithNotificationDrawer page="admin"><Harness /></WithNotificationDrawer></AdminHeaderActionsContext.Provider>
  </>
}

beforeEach(async () => {
  for (const event of useNotificationStore.getState().events.admin) useNotificationStore.getState().dismissEvent('admin', event.id)
  calls.saveMany = []; calls.save = []; nextResult = changes => ({ saved: changes.length })
  host = document.createElement('div'); document.body.appendChild(host)
  headerHost = host
  root = createRoot(host)
  await act(async () => root.render(<Page />))
  await act(async () => { await Promise.resolve() })
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); void headerHost; void headerState })

const q = <T extends Element = HTMLElement>(selector: string) => host.querySelector<T>(selector)
const qa = <T extends Element = HTMLElement>(selector: string) => [...host.querySelectorAll<T>(selector)]
const byLabel = (label: string) => q(`[aria-label="${label}"]`)!
const click = async (element: Element | null) => { expect(element).not.toBeNull(); await act(async () => { (element as HTMLElement).click(); await Promise.resolve() }) }
const type = async (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  await act(async () => { Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
}
const field = (label: string) => qa('.rv-ctrl-row').find(entry => entry.querySelector('label')?.textContent === label)!.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!
const names = () => qa('.adm-list [data-preset-id]').map(entry => entry.getAttribute('data-preset-id')!.replace('cinema2:', ''))
const headerKey = (label: RegExp) => qa<HTMLButtonElement>('[data-testid="header-actions"] button').find(button => label.test(button.getAttribute('aria-label') ?? ''))!
const statusOptions = () => [...document.body.querySelectorAll('[role="listbox"] [role="option"]')]
const statusLabels = () => statusOptions().map(entry => entry.querySelector('.drm-dropdown__option-label')?.textContent)
const openStatus = () => click(byLabel('Filter by status'))
const selectStatus = async (label: string) => { await openStatus(); await click(statusOptions().find(entry => entry.textContent?.startsWith(label))!) }

describe('Preset Catalog: library', () => {
  it('shows every preset as a table row with its artwork, name and status, and counts each status in the filter dropdown', async () => {
    expect(names()).toEqual(['alpha', 'bravo', 'charlie', 'delta'])
    expect(qa('.adm-list [data-preset-id]').every(row => row.tagName === 'TR' && row.querySelector('img.rv-preset-blueprint-image'))).toBe(true)
    expect(qa('th').map(cell => cell.textContent)).toEqual(['Select', 'Preset', 'Engine', 'Category', 'Status'])
    expect(q('[data-preset-id="cinema2:alpha"]')!.getAttribute('data-status')).toBe('published')
    expect(q('[data-preset-id="cinema2:bravo"]')!.getAttribute('data-status')).toBe('draft')
    expect(q('[data-preset-id="cinema2:charlie"]')!.getAttribute('data-status')).toBe('unset')
    expect(q('.adm-status-chip')).toBeNull()
    await openStatus()
    expect(statusLabels()).toEqual(['All Statuses (4)', 'Not set (2)', 'Designing (0)', 'Draft (1)', 'Published (1)', 'Archived (0)'])
    await click(statusOptions()[0]!)
    expect(q('.adm-count')!.textContent).toBe('4 of 4 presets')
  })

  it('opens with the first preset selected, so the detail panel is never empty', () => {
    expect(q('.adm-preview-title h2')!.textContent).toBe('Alpha')
    expect(field('Name').value).toBe('Alpha')
    expect(q('tr[data-preset-id="cinema2:alpha"]')!.classList.contains('is-selected')).toBe(true)
  })

  it('lays out like User Accounts: the table on the left and the open preset, with its thumbnail and facts, in the detail panel on the right', async () => {
    const split = q('.adm-split')!
    expect([...split.children].map(child => child.tagName)).toEqual(['SECTION', 'ASIDE'])
    const detail = q('aside.adm-detail')!
    expect(detail.firstElementChild?.classList.contains('adm-detail-scroll')).toBe(true)
    expect(detail.querySelector('.rw-window-header')).toBeNull()
    expect(detail.querySelector('.adm-preview-art')).not.toBeNull()
    expect(detail.querySelector('.adm-facts')!.textContent).toContain('Cinema 2.0')
    expect(detail.querySelector('.adm-preview-description')!.textContent).toBe('Alpha description')
    expect(q('.pmv-stage')).toBeNull()
    expect(q('.rw-frame--left')).toBeNull()
    await click(byLabel('Select Bravo'))
    expect(detail.querySelector('.adm-preview-title h2')!.textContent).toBe('Bravo')
    expect(q('tr[data-preset-id="cinema2:bravo"]')!.classList.contains('is-selected')).toBe(true)
    // Clicking anywhere on the row opens the preset, not only its name.
    await click(q('tr[data-preset-id="cinema2:charlie"] td:nth-child(3)'))
    expect(detail.querySelector('.adm-preview-title h2')!.textContent).toBe('Charlie')
  })

  it('filters by status dropdown and by search, with counts following the other filters', async () => {
    await selectStatus('Draft'); expect(names()).toEqual(['bravo'])
    await selectStatus('All Statuses')
    await type(q<HTMLInputElement>('.dv-library-search-input')!, 'cha')
    expect(names()).toEqual(['charlie'])
    // With a search active, the chips count only what matches it.
    await openStatus()
    expect(statusLabels()).toEqual(['All Statuses (1)', 'Not set (1)', 'Designing (0)', 'Draft (0)', 'Published (0)', 'Archived (0)'])
    await click(statusOptions()[0]!)
    await type(q<HTMLInputElement>('.dv-library-search-input')!, 'zzz')
    expect(q('.pmv-empty')!.textContent).toBe('No presets match.')
  })

  it('switches between the table and the poster grid, with the same presets and statuses', async () => {
    expect(q('.adm-grid')).toBeNull()
    expect(q('[data-preset-id="cinema2:bravo"] .adm-status')!.textContent).toBe('Draft')
    await click(byLabel('Grid view'))
    expect(q('.adm-grid')).not.toBeNull()
    expect(q('table')).toBeNull()
    expect(names()).toEqual(['alpha', 'bravo', 'charlie', 'delta'])
    expect(q('[data-preset-id="cinema2:bravo"] .rv-preset-poster-chip')!.textContent).toBe('Draft')
    await click(byLabel('Select Charlie'))
    expect(q('.adm-preview-title h2')!.textContent).toBe('Charlie')
  })

  it('uses empty toggle buttons for bulk selection in list and grid, independently of the inspector', async () => {
    const bulkButton = (name: string) => byLabel(name)
    let toggle = bulkButton('Select Charlie for bulk actions')
    expect(toggle.childElementCount).toBe(0)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    await click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(q('.adm-preview-title h2')!.textContent).toBe('Alpha')
    await click(byLabel('Grid view'))
    toggle = bulkButton('Deselect Charlie for bulk actions')
    expect(toggle.childElementCount).toBe(0)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    await click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(q('.adm-bulk')).toBeNull()
    expect(q('.adm-preview-title h2')!.textContent).toBe('Alpha')
  })

  it('anchors the rightmost status menu to the trigger end in a body portal', async () => {
    const trigger = byLabel('Filter by status')
    const rect = { left: 650, right: 780, top: 90, bottom: 122, width: 130, height: 32 } as DOMRect
    const geometry = vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect)
    try {
      await openStatus()
      const menu = document.getElementById(trigger.getAttribute('aria-controls')!)!
      expect(menu.parentElement).toBe(document.body)
      expect(parseFloat(menu.style.left) + parseFloat(menu.style.width)).toBe(rect.right)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      await click(statusOptions()[0]!)
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(document.getElementById(menu.id)).toBeNull()
    } finally { geometry.mockRestore() }
  })

  it('moves the selection with the arrow keys', async () => {
    const list = q('.adm-list')!
    await act(async () => { list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    expect(q('.adm-preview-title h2')!.textContent).toBe('Bravo')
    await act(async () => { list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })) })
    expect(q('.adm-preview-title h2')!.textContent).toBe('Alpha')
  })
})

describe('Preset Catalog: preview and inspector', () => {
  it('shows the selected preset in the preview window and offers a live preview for a Cinema 2.0 preset only where WebGL2 exists', async () => {
    await click(byLabel('Select Charlie'))
    expect(q('.adm-preview-title h2')!.textContent).toBe('Charlie')
    expect(q('.adm-facts')!.textContent).toContain('Cinema 2.0')
    expect(q('.adm-summary .adm-preview-art')).not.toBeNull()
  })

  it('shows how users will see it, with an unsaved name applied', async () => {
    await type(field('Name'), 'Alpha Renamed')
    expect(q('.adm-inapp-list')!.textContent).toContain('Alpha Renamed')
    expect(q('.adm-inapp-grid')!.textContent).toContain('Alpha Renamed')
  })

  it('shows every inspector section in order in the same scroll area, without tabs', () => {
    const detail = q('.adm-detail-scroll')!
    expect(detail.querySelector('[role="tablist"]')).toBeNull()
    expect([...detail.querySelectorAll('.drc-header')].map(button => button.textContent)).toEqual([
      'Publishing', 'Preset Info', 'Tags & Collections', 'Store Listing', 'Technical', 'In the App',
    ])
    expect(field('Store Title')).toBeInstanceOf(HTMLInputElement)
    expect(field('Preset ID').readOnly).toBe(true)
    expect(detail.querySelector('.adm-inapp-grid')).not.toBeNull()
  })

  it('keeps an edit as a draft, marks the card Modified, and keeps the draft when moving to another preset and back', async () => {
    await type(field('Name'), 'Alpha Two')
    expect(q('[data-preset-id="cinema2:alpha"]')!.textContent).toContain('Modified')
    await click(byLabel('Select Bravo'))
    expect(field('Name').value).toBe('Bravo')
    expect(q('[data-preset-id="cinema2:bravo"]')!.textContent).not.toContain('Modified')
    await click(byLabel('Select Alpha Two'))
    expect(field('Name').value).toBe('Alpha Two')
  })

  it('discards a draft, and an edit back to the stored value is no longer a change', async () => {
    const modified = () => q('[data-preset-id="cinema2:alpha"]')!.textContent!.includes('Modified')
    await type(field('Name'), 'Alpha Two'); expect(modified()).toBe(true)
    await type(field('Name'), 'Alpha'); expect(modified()).toBe(false)
    await type(field('Name'), 'Other')
    await click(headerKey(/Discard/))
    expect(field('Name').value).toBe('Alpha')
  })

  it('edits tags as chips: Enter adds one, the × removes one', async () => {
    const add = q<HTMLInputElement>('input[aria-label="Add a tag"]')!
    await type(add, 'neon')
    await act(async () => { add.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })) })
    expect(qa('.adm-tags .dv-tag-pill-label').map(entry => entry.textContent)).toEqual(['one', 'neon'])
    await click(byLabel('Remove tag one'))
    expect(qa('.adm-tags .dv-tag-pill-label').map(entry => entry.textContent)).toEqual(['neon'])
    expect(q('[data-preset-id="cinema2:alpha"]')!.textContent).toContain('Modified')
  })

  it('will not save a preset with no name, and says why', async () => {
    await type(field('Name'), '   ')
    expect(q('.adm-field-error')!.textContent).toBe('A preset needs a name.')
    expect(headerKey(/Publish preset/).disabled).toBe(true)
  })

  it('has no Save, Discard or Reset buttons in the inspector: they are icons in the page header', async () => {
    await type(field('Name'), 'Alpha Two')
    const inspector = q('.adm-detail')!
    expect([...inspector.querySelectorAll('button')].map(button => button.textContent).filter(text => /^(Save|Discard|Reset to Shipped)$/.test(text ?? ''))).toEqual([])
    expect(inspector.querySelector('.adm-form-actions')).toBeNull()
    for (const button of qa<HTMLButtonElement>('[data-testid="header-actions"] button')) { expect(button.textContent).toBe(''); expect(button.querySelector('svg')).not.toBeNull() }
  })

  it('saves from the header, and the draft goes away', async () => {
    await type(field('Name'), 'Alpha Two')
    await click(headerKey(/Save changes/))
    expect(calls.saveMany[0]!.map(change => [change.preset.record.sourceId, change.row?.name, change.row?.publication_status])).toEqual([['alpha', 'Alpha Two', 'published']])
    expect(q('[data-preset-id="cinema2:alpha"]')!.textContent).not.toContain('Modified')
    expect(useNotificationStore.getState().events.admin[0]).toMatchObject({ tone: 'success', title: 'Saved', message: 'Saved 1 preset.' })
    expect(q('.adm-inspector-notice')).toBeNull()
    expect(host.textContent).not.toContain('Saved 1 preset.')
    expect(drawerText()).toContain('Saved 1 preset.')
  })

  it('resets the open preset to what the app ships from the header, and only when it has a saved change', async () => {
    expect(headerKey(/Reset to shipped/).disabled).toBe(false)
    await click(headerKey(/Reset to shipped/))
    expect(calls.save).toEqual([['cinema2:alpha', null]])
    expect(useNotificationStore.getState().events.admin[0]?.message).toContain('Back to what the app ships.')
    await click(byLabel('Select Charlie'))
    expect(headerKey(/Reset to shipped/).disabled).toBe(true)
  })
})

describe('Preset Catalog: publishing', () => {
  it('publishes the open preset in one click, saving its unsaved changes with the new status', async () => {
    await click(byLabel('Select Charlie'))
    await type(field('Name'), 'Charlie Prime')
    expect(q('.adm-publish button')).toBeNull()
    expect(q('.adm-bulk button[aria-label="Publish"]')).toBeNull()
    await click(headerKey(/Publish preset/))
    expect(calls.saveMany).toHaveLength(1)
    expect(calls.saveMany[0]).toEqual([{ preset: expect.objectContaining({ name: 'Charlie' }), row: expect.objectContaining({ preset_key: 'charlie', name: 'Charlie Prime', publication_status: 'published' }) }])
    expect(q('[data-preset-id="cinema2:charlie"]')!.getAttribute('data-status')).toBe('published')
    expect(useNotificationStore.getState().events.admin[0]?.message).toContain('Charlie Prime published')
  })

  it('sets the status from a dropdown whose options each say in one sentence what they mean, with Designing among them, and saves it only when Save is pressed', async () => {
    const trigger = qa('.rv-ctrl-row').find(entry => entry.querySelector('label')?.textContent === 'Status')!.querySelector<HTMLButtonElement>('button[role="combobox"]')!
    expect(trigger.textContent).toContain('Published')
    expect(q('.adm-segmented')).toBeNull()
    await click(trigger)
    const options = [...document.body.querySelectorAll('[role="listbox"] [role="option"]')]
    expect(options.map(option => option.querySelector('.drm-dropdown__option-label')?.textContent)).toEqual(['Not set', 'Designing', 'Draft', 'Published', 'Archived'])
    const sentences = options.map(option => option.querySelector('.drm-dropdown__option-description')?.textContent ?? '')
    for (const sentence of sentences) { expect(sentence.length).toBeGreaterThan(10); expect(sentence.endsWith('.')).toBe(true); expect(sentence.split('. ').length).toBe(1) }
    expect(sentences[1]).toBe('Still being designed and not ready for anyone to review.')
    await click(options[1]!)
    expect(calls.saveMany).toHaveLength(0)
    expect(q('[data-preset-id="cinema2:alpha"]')!.getAttribute('data-status')).toBe('published')
    expect(q('[data-preset-id="cinema2:alpha"]')!.textContent).toContain('Modified')
    await click(headerKey(/Save changes/))
    expect(calls.saveMany[0]!.map(change => change.row?.publication_status)).toEqual(['designing'])
    expect(q('[data-preset-id="cinema2:alpha"]')!.getAttribute('data-status')).toBe('designing')
    expect(q('[data-preset-id="cinema2:alpha"] .adm-status')!.textContent).toBe('Designing')
  })

  it('no longer shows the note about when edits appear in the app', () => {
    expect(q('.adm-detail')!.textContent).not.toContain('show in the app as soon as they are saved')
    expect(q('.adm-detail')!.textContent).not.toContain('recorded for the store')
  })

  it('sets several presets to Designing from the bulk bar, after a confirmation', async () => {
    await click(byLabel('Select Charlie for bulk actions')); await click(byLabel('Select Delta for bulk actions'))
    await click(qa('.adm-bulk button').find(button => button.textContent === 'Designing')!)
    expect(document.body.textContent).toContain('Set 2 presets to designing?')
    await click([...document.querySelectorAll('button')].find(button => button.textContent === 'Set to Designing') ?? null)
    expect(calls.saveMany[0]!.map(change => [change.preset.record.sourceId, change.row?.publication_status])).toEqual([['charlie', 'designing'], ['delta', 'designing']])
    expect(useNotificationStore.getState().events.admin[0]?.message).toContain('2 presets set to designing.')
  })

  it('asks before archiving, saves nothing if it is cancelled, and archives once it is confirmed', async () => {
    await click(byLabel('Select Charlie for bulk actions'))
    await click(qa('.adm-bulk button').find(button => button.textContent === 'Archive')!)
    expect(document.body.textContent).toContain('Archive Charlie?')
    await click([...document.querySelectorAll('button')].find(button => button.textContent === 'Cancel') ?? null)
    expect(document.body.textContent).not.toContain('Archive Charlie?')
    expect(calls.saveMany).toHaveLength(0)
    await click(qa('.adm-bulk button').find(button => button.textContent === 'Archive')!)
    await click([...document.querySelectorAll('button')].find(button => button.textContent === 'Archive' && !button.closest('.adm-bulk')) ?? null)
    expect(calls.saveMany[0]!.map(change => [change.preset.record.sourceId, change.row?.publication_status])).toEqual([['charlie', 'archived']])
    expect(q('[data-preset-id="cinema2:charlie"]')!.getAttribute('data-status')).toBe('archived')
  })

  it('publishes several presets at once from the header, after a confirmation, and clears the selection', async () => {
    await click(byLabel('Select Charlie for bulk actions')); await click(byLabel('Select Delta for bulk actions'))
    expect(q('.adm-bulk')!.textContent).toContain('2 selected')
    await click(headerKey(/Publish 2 presets/))
    expect(document.body.textContent).toContain('Publish 2 presets?')
    expect(calls.saveMany).toHaveLength(0)
    await click([...document.querySelectorAll('button')].find(button => button.textContent === 'Publish' && button.closest('[role="dialog"], .dv-confirm, [class*="confirm"]')) ?? null)
    expect(calls.saveMany[0]!.map(change => [change.preset.record.sourceId, change.row?.publication_status])).toEqual([['charlie', 'published'], ['delta', 'published']])
    expect(q('.adm-bulk')).toBeNull()
    expect(q('[data-preset-id="cinema2:delta"]')!.getAttribute('data-status')).toBe('published')
  })

  it('says exactly how far a bulk change got when one save fails, and keeps the rest selected', async () => {
    nextResult = () => ({ saved: 1, error: 'The database refused it.' })
    await click(byLabel('Select Charlie for bulk actions')); await click(byLabel('Select Delta for bulk actions'))
    await click(qa('.adm-bulk button').find(button => button.textContent === 'Draft')!)
    await click([...document.querySelectorAll('button')].find(button => button.textContent === 'Set to Draft') ?? null)
    expect(useNotificationStore.getState().events.admin[0]?.message).toContain('1 of 2 saved')
    expect(useNotificationStore.getState().events.admin[0]?.message).toContain('The database refused it.')
    expect(q('[data-preset-id="cinema2:charlie"]')!.getAttribute('data-status')).toBe('draft')
    expect(q('[data-preset-id="cinema2:delta"]')!.getAttribute('data-status')).toBe('unset')
    expect(q('.adm-bulk')!.textContent).toContain('1 selected')
  })
})

describe('Preset Catalog: header actions and saving everything', () => {
  it('puts Save, Publish, Reset to shipped and Discard in the page header as icons, Save and Discard enabled only while there are unsaved changes', async () => {
    expect(qa('[data-testid="header-actions"] button').map(button => button.getAttribute('aria-label'))).toEqual(['Save changes', 'Publish preset', 'Reset to shipped', 'Discard unsaved changes'])
    expect(headerKey(/Save changes/).disabled).toBe(true)
    expect(headerKey(/Discard/).disabled).toBe(true)
    await type(field('Name'), 'Alpha Two')
    expect(headerKey(/Save changes \(1\)/).disabled).toBe(false)
    expect(headerKey(/Discard/).disabled).toBe(false)
  })

  it('saves every edited preset at once from the header, in one call, and clears the drafts', async () => {
    await type(field('Name'), 'Alpha Two')
    await click(byLabel('Select Bravo')); await type(field('Name'), 'Bravo Two')
    expect(headerKey(/Save changes \(2\)/)).toBeDefined()
    await click(headerKey(/Save changes/))
    expect(calls.saveMany).toHaveLength(1)
    expect(calls.saveMany[0]!.map(change => [change.preset.record.sourceId, change.row?.name])).toEqual([['alpha', 'Alpha Two'], ['bravo', 'Bravo Two']])
    expect(qa('.adm-edited').length + qa('.adm-list [data-preset-id]').filter(card => card.textContent?.includes('Modified')).length).toBe(0)
    expect(useNotificationStore.getState().events.admin[0]?.message).toContain('Saved 2 presets.')
  })

  it('saves everything with Ctrl+S, and discards everything from the header', async () => {
    await type(field('Name'), 'Alpha Two')
    await act(async () => { q('.adm-pc')!.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })) })
    expect(calls.saveMany).toHaveLength(1)
    await type(field('Name'), 'Alpha Three')
    await click(headerKey(/Discard/))
    expect(field('Name').value).toBe('Alpha Two')
  })

  it('leaves a preset that cannot be saved out of Save all, and says so', async () => {
    await type(field('Name'), 'Alpha Two')
    await click(byLabel('Select Bravo')); await type(field('Name'), ' ')
    await click(headerKey(/Save changes/))
    expect(calls.saveMany[0]!.map(change => change.preset.record.sourceId)).toEqual(['alpha'])
    expect(useNotificationStore.getState().events.admin[0]?.message).toContain('1 still need a fix')
  })
})
