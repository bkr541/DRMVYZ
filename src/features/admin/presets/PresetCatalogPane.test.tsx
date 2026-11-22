// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    <AdminHeaderActionsContext.Provider value={element}><Harness /></AdminHeaderActionsContext.Provider>
  </>
}

beforeEach(async () => {
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
const names = () => qa('[data-preset-id]').map(entry => entry.getAttribute('data-preset-id')!.replace('cinema2:', ''))
const headerKey = (label: RegExp) => qa<HTMLButtonElement>('[data-testid="header-actions"] button').find(button => label.test(button.getAttribute('aria-label') ?? ''))!
const chip = (label: string) => qa<HTMLButtonElement>('.adm-status-chip').find(entry => entry.textContent?.startsWith(label))!

describe('Preset Catalog: library', () => {
  it('shows every preset as a card with its artwork, name and status, and counts each status on its chip', () => {
    expect(names()).toEqual(['alpha', 'bravo', 'charlie', 'delta'])
    expect(qa('[data-preset-id]').every(card => card.querySelector('img.rv-preset-blueprint-image'))).toBe(true)
    expect(q('[data-preset-id="cinema2:alpha"]')!.getAttribute('data-status')).toBe('published')
    expect(q('[data-preset-id="cinema2:bravo"]')!.getAttribute('data-status')).toBe('draft')
    expect(q('[data-preset-id="cinema2:charlie"]')!.getAttribute('data-status')).toBe('unset')
    expect(qa('.adm-status-chip').map(entry => entry.textContent)).toEqual(['All4', 'Published1', 'Draft1', 'Not set2', 'Archived0'])
    expect(q('.adm-count')!.textContent).toBe('4 of 4 presets')
  })

  it('opens with the first preset selected, so the preview and the inspector are never empty', () => {
    expect(q('.adm-preview-title h2')!.textContent).toBe('Alpha')
    expect(field('Name').value).toBe('Alpha')
  })

  it('filters by status chip and by search, and the chips count what clicking them shows', async () => {
    await click(chip('Draft')); expect(names()).toEqual(['bravo'])
    await click(chip('All'))
    await type(q<HTMLInputElement>('.vz-md-search-input')!, 'cha')
    expect(names()).toEqual(['charlie'])
    // With a search active, the chips count only what matches it.
    expect(qa('.adm-status-chip').map(entry => entry.textContent)).toEqual(['All1', 'Published0', 'Draft0', 'Not set1', 'Archived0'])
    await type(q<HTMLInputElement>('.vz-md-search-input')!, 'zzz')
    expect(q('.pmv-empty')!.textContent).toBe('No presets match.')
  })

  it('switches between the grid and the compact list, with the same presets and statuses', async () => {
    expect(q('.adm-grid')).not.toBeNull()
    await click(byLabel('List view'))
    expect(q('.adm-grid')).toBeNull()
    expect(names()).toEqual(['alpha', 'bravo', 'charlie', 'delta'])
    expect(q('[data-preset-id="cinema2:bravo"] .adm-status')!.textContent).toBe('Draft')
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
    expect(q('.adm-stage-preview .adm-preview-art')).not.toBeNull()
  })

  it('shows how users will see it, with an unsaved name applied', async () => {
    await type(field('Name'), 'Alpha Renamed')
    await click(qa('[role="tab"]').find(tab => tab.textContent === 'IN THE APP')!)
    expect(q('.adm-inapp-list')!.textContent).toContain('Alpha Renamed')
    expect(q('.adm-inapp-grid')!.textContent).toContain('Alpha Renamed')
  })

  it('keeps an edit as a draft, marks the card Modified, and keeps the draft when moving to another preset and back', async () => {
    await type(field('Name'), 'Alpha Two')
    expect(q('[data-preset-id="cinema2:alpha"]')!.textContent).toContain('Modified')
    expect(q('.adm-dirty')!.textContent).toBe('Unsaved changes')
    await click(byLabel('Select Bravo'))
    expect(field('Name').value).toBe('Bravo')
    expect(q('.adm-dirty')!.textContent).not.toBe('Unsaved changes')
    await click(byLabel('Select Alpha Two'))
    expect(field('Name').value).toBe('Alpha Two')
  })

  it('discards a draft, and an edit back to the stored value is no longer a change', async () => {
    await type(field('Name'), 'Alpha Two'); expect(q('.adm-dirty')!.textContent).toBe('Unsaved changes')
    await type(field('Name'), 'Alpha'); expect(q('.adm-dirty')!.textContent).not.toBe('Unsaved changes')
    await type(field('Name'), 'Other')
    await click(qa('button').find(button => button.textContent === 'Discard')!)
    expect(field('Name').value).toBe('Alpha')
  })

  it('edits tags as chips: Enter adds one, the × removes one', async () => {
    const add = q<HTMLInputElement>('input[aria-label="Add a tag"]')!
    await type(add, 'neon')
    await act(async () => { add.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })) })
    expect(qa('.adm-tags .adm-chip span').map(entry => entry.textContent)).toEqual(['one', 'neon'])
    await click(byLabel('Remove tag one'))
    expect(qa('.adm-tags .adm-chip span').map(entry => entry.textContent)).toEqual(['neon'])
    expect(q('[data-preset-id="cinema2:alpha"]')!.textContent).toContain('Modified')
  })

  it('will not save a preset with no name, and says why', async () => {
    await type(field('Name'), '   ')
    expect(q('.adm-field-error')!.textContent).toBe('A preset needs a name.')
    expect(qa<HTMLButtonElement>('button').find(button => button.textContent === 'Save')!.disabled).toBe(true)
    expect(qa<HTMLButtonElement>('.adm-publish button')[0]!.disabled).toBe(true)
  })

  it('saves the selected preset from the inspector, and the draft goes away', async () => {
    await type(field('Name'), 'Alpha Two')
    await click(qa('button').find(button => button.textContent === 'Save')!)
    expect(calls.save).toEqual([['cinema2:alpha', expect.objectContaining({ name: 'Alpha Two', publication_status: 'published' })]])
    expect(q('[data-preset-id="cinema2:alpha"]')!.textContent).not.toContain('Modified')
    expect(q('.adm-inspector-notice')!.textContent).toContain('show in the app now')
  })
})

describe('Preset Catalog: publishing', () => {
  it('publishes the open preset in one click, saving its unsaved changes with the new status', async () => {
    await click(byLabel('Select Charlie'))
    await type(field('Name'), 'Charlie Prime')
    expect(q('.adm-publish button')!.textContent).toBe('Save & Publish')
    await click(q('.adm-publish button'))
    expect(calls.saveMany).toHaveLength(1)
    expect(calls.saveMany[0]).toEqual([{ preset: expect.objectContaining({ name: 'Charlie' }), row: expect.objectContaining({ preset_key: 'charlie', name: 'Charlie Prime', publication_status: 'published' }) }])
    expect(q('[data-preset-id="cinema2:charlie"]')!.getAttribute('data-status')).toBe('published')
    expect(q('.adm-inspector-notice')!.textContent).toContain('Charlie Prime published')
  })

  it('sets a status by the segmented control without saving it until Save', async () => {
    await click(qa('.adm-segmented button').find(button => button.textContent === 'Archived')!)
    expect(calls.saveMany).toHaveLength(0)
    expect(q('[data-preset-id="cinema2:alpha"]')!.getAttribute('data-status')).toBe('published')
    expect(q('.adm-dirty')!.textContent).toBe('Unsaved changes')
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

  it('publishes several presets at once from the bulk bar, after a confirmation, and clears the selection', async () => {
    await click(byLabel('Select Charlie for bulk actions')); await click(byLabel('Select Delta for bulk actions'))
    expect(q('.adm-bulk')!.textContent).toContain('2 selected')
    await click(qa('.adm-bulk button').find(button => button.textContent === 'Publish')!)
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
    expect(q('.adm-inspector-notice')!.textContent).toContain('1 of 2 saved')
    expect(q('.adm-inspector-notice')!.textContent).toContain('The database refused it.')
    expect(q('[data-preset-id="cinema2:charlie"]')!.getAttribute('data-status')).toBe('draft')
    expect(q('[data-preset-id="cinema2:delta"]')!.getAttribute('data-status')).toBe('unset')
    expect(q('.adm-bulk')!.textContent).toContain('1 selected')
  })
})

describe('Preset Catalog: header actions and saving everything', () => {
  it('puts Save, Publish and Discard in the page header, Save and Discard enabled only while there are unsaved changes', async () => {
    expect(qa('[data-testid="header-actions"] button').map(button => button.getAttribute('aria-label'))).toEqual(['Save changes', 'Publish preset', 'Discard unsaved changes'])
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
    expect(qa('.adm-edited').length + qa('[data-preset-id]').filter(card => card.textContent?.includes('Modified')).length).toBe(0)
    expect(q('.adm-inspector-notice')!.textContent).toContain('Saved 2 presets.')
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
    expect(q('.adm-inspector-notice')!.textContent).toContain('1 still need a fix')
  })
})
