// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PresetMetadataRow } from '../../presetCatalog/presetMetadata'

const data = vi.hoisted(() => ({
  rows: [] as unknown[],
  saves: [] as { key: string; status: string | null; name: string | null; before: number }[],
  packs: [] as { id: string; name: string; description: string | null; display_order: number }[],
  members: [] as { pack_id: string; engine_id: string; preset_key: string; position: number }[],
  failOn: null as string | null,
}))

vi.mock('../../../lib/adminAccess', () => ({ useAdminAccess: () => true, useAdminAccessStatus: () => 'granted', hasAdminAccess: () => true }))
vi.mock('../../../context/AudioEngineContext', () => ({ useSharedAudio: () => ({ source: 'file' }) }))
vi.mock('../../../components/vyzualz/shared/VyzualzHeaderActions', () => ({ VyzualzHeaderActions: () => <div data-react-header-status /> }))
vi.mock('../../../components/vyzualz/react/LayoutLabModal', () => ({ LayoutLabModal: () => null }))
vi.mock('../../../components/vyzualz/react/Cinema2Stage', () => ({ Cinema2Stage: () => null }))
vi.mock('../users/UsersTab', () => ({ UsersTab: () => <p>Users</p> }))
vi.mock('../messages/MessagesTab', () => ({ MessagesTab: () => <p>Messages</p> }))
vi.mock('../../../components/vyzualz/presetManager/presetManagerCatalog', () => {
  const make = (sourceId: string, name: string) => ({
    id: `cinema2:${sourceId}`, sourceId, name, description: `${name} description`, engineName: 'Cinema 2.0', category: 'cinematic', tags: ['one'], artwork: 'cinema2', activation: 'cinema2',
    hasCamera: false, canIntegrateUserMedia: false, is3dEnvironment: false, sourceData: {},
  })
  return { PRESET_MANAGER_PRESETS: [make('alpha', 'Alpha'), make('bravo', 'Bravo'), make('charlie', 'Charlie')] }
})
vi.mock('./presetsApi', () => ({
  loadPresetMetadata: async () => data.rows,
  loadPacks: async () => data.packs,
  loadPackMembers: async () => data.members,
  // Like the real one: the rows it is given are the rows it builds on.
  savePresetMetadata: async (engineId: string, presetKey: string, row: PresetMetadataRow | null, current: readonly PresetMetadataRow[]) => {
    if (data.failOn === presetKey) throw new Error('The database refused it.')
    data.saves.push({ key: presetKey, status: row?.publication_status ?? null, name: row?.name ?? null, before: current.length })
    const others = current.filter(entry => !(entry.engine_id === engineId && entry.preset_key === presetKey))
    return row ? [...others, row] : others
  },
  addPackMember: async () => undefined, removePackMember: async () => undefined, createPack: async (name: string, order: number) => { const pack = { id: `pack-${data.packs.length + 1}`, name, description: null, display_order: order }; data.packs = [...data.packs, pack]; return pack }, updatePack: async () => undefined, deletePack: async () => undefined, movePackMember: async () => undefined,
}))

import { AdminView } from '../AdminView'
import { ApplicationWorkspaceFrame } from '../../../components/vyzualz/layout/ApplicationWorkspaceFrame'

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve() }) }
const until = async (done: () => boolean) => { for (let i = 0; i < 200 && !done(); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) }) }
const q = (selector: string) => host.querySelector<HTMLElement>(selector)
const qa = (selector: string) => [...host.querySelectorAll<HTMLElement>(selector)]
const click = async (element: Element | null) => { expect(element).not.toBeNull(); await act(async () => { (element as HTMLElement).click(); await Promise.resolve() }); await flush() }

beforeEach(async () => {
  data.rows = []; data.saves = []; data.failOn = null; data.packs = [{ id: 'p1', name: 'Starters', description: 'The first pack.', display_order: 1 }]; data.members = [{ pack_id: 'p1', engine_id: 'cinema2', preset_key: 'bravo', position: 1 }]
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  await act(async () => root.render(<ApplicationWorkspaceFrame appView="admin" onAppViewChange={() => {}}><AdminView /></ApplicationWorkspaceFrame>))
  await until(() => !!q('[data-testid="admin-view"]'))
  await click(qa('[role="tab"]').find(tab => tab.textContent === 'Preset Catalog')!)
  await until(() => !!q('.adm-pc'))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('Admin Preset Catalog inside the real Admin page', () => {
  it('shows the three windows under the section tabs, and puts its actions in the page header', () => {
    expect(qa('.adm-tabs-surface [role="tab"]').map(tab => tab.textContent)).toEqual(['User Accounts', 'Preset Catalog', 'Message Center'])
    expect(q('.adm-pc .pmv-content')).not.toBeNull()
    expect(qa('.adm-pc .pmv-content > .fw-surface').length).toBeGreaterThanOrEqual(3)
    expect(qa('.fw-app-header [data-app-header-slot="controls"] .adm-header-actions button').map(button => button.getAttribute('aria-label'))).toEqual(['Save changes', 'Publish preset', 'Reset to shipped', 'Discard unsaved changes'])
    // The header is the page's own, so the stand-in is not showing.
    expect(q('.fw-app-header-fallback')!.hidden).toBe(true)
    expect(qa('[data-preset-id]')).toHaveLength(3)
  })

  it('takes the header actions away again when another tab opens, and brings them back', async () => {
    await click(qa('[role="tab"]').find(tab => tab.textContent === 'Message Center')!)
    expect(q('.adm-pc')).toBeNull()
    expect(qa('.adm-header-actions button')).toHaveLength(0)
    await click(qa('[role="tab"]').find(tab => tab.textContent === 'Preset Catalog')!)
    await until(() => !!q('.adm-pc'))
    expect(qa('.adm-header-actions button')).toHaveLength(4)
  })

  it('publishes several presets in a row and shows every one of them as published afterwards (each save builds on the rows the one before left)', async () => {
    await click(q('[aria-label="Select Alpha for bulk actions"]'))
    await click(q('[aria-label="Select Bravo for bulk actions"]'))
    await click(q('[aria-label="Select Charlie for bulk actions"]'))
    await click(qa('.adm-bulk button').find(button => button.textContent === 'Publish')!)
    await click([...document.querySelectorAll('button')].find(button => button.textContent === 'Publish' && !button.closest('.adm-bulk') && !button.closest('.adm-publish')) ?? null)
    await until(() => qa('[data-preset-id][data-status="published"]').length === 3)
    expect(data.saves.map(save => [save.key, save.status, save.before])).toEqual([['alpha', 'published', 0], ['bravo', 'published', 1], ['charlie', 'published', 2]])
    expect(qa('[data-preset-id]').map(card => card.getAttribute('data-status'))).toEqual(['published', 'published', 'published'])
    expect(qa('.adm-status-chip').map(chip => chip.textContent)).toEqual(['All3', 'Not set0', 'Designing0', 'Draft0', 'Published3', 'Archived0'])
  })

  it('keeps the ones that were saved when a later one fails, and reports where it stopped', async () => {
    data.failOn = 'bravo'
    await click(q('[aria-label="Select Alpha for bulk actions"]'))
    await click(q('[aria-label="Select Bravo for bulk actions"]'))
    await click(q('[aria-label="Select Charlie for bulk actions"]'))
    await click(qa('.adm-bulk button').find(button => button.textContent === 'Draft')!)
    await click([...document.querySelectorAll('button')].find(button => button.textContent === 'Set to Draft') ?? null)
    await until(() => !!q('.adm-inspector-notice')?.textContent?.includes('of 3 saved'))
    expect(q('.adm-inspector-notice')!.textContent).toContain('1 of 3 saved')
    expect(q('[data-preset-id="cinema2:alpha"]')!.getAttribute('data-status')).toBe('draft')
    expect(q('[data-preset-id="cinema2:bravo"]')!.getAttribute('data-status')).toBe('unset')
    expect(q('[data-preset-id="cinema2:charlie"]')!.getAttribute('data-status')).toBe('unset')
  })

  it('lays the Presets tab out like User Accounts, and keeps the three windows on the Packs tab, with the same tabs, search row and header', async () => {
    const windows = () => qa('.adm-pane:not([hidden]) .pmv-content > .fw-surface').length
    expect(q('.adm-pane:not([hidden]) .adm-split--catalog > .adm-main')).not.toBeNull()
    expect(q('.adm-pane:not([hidden]) .adm-split--catalog > .adm-detail')).not.toBeNull()
    expect(windows()).toBe(0)
    expect(qa('.adm-pane:not([hidden]) > .adm-pc > [role="tablist"] [role="tab"]').map(tab => tab.textContent)).toEqual(['Presets', 'Packs'])
    await click(qa('.adm-pane:not([hidden]) [role="tab"]').find(tab => tab.textContent === 'Packs')!)
    expect(q('.adm-pane:not([hidden]) [aria-label="Preset packs"]')).not.toBeNull()
    expect(windows()).toBeGreaterThanOrEqual(3)
    expect(q('.adm-pane:not([hidden]) .rw-frame--left')!.textContent).toContain('Preset Catalog')
    expect(qa('.adm-pane:not([hidden]) .rw-frame--left [role="tab"]').map(tab => tab.textContent)).toEqual(['Presets', 'Packs'])
    expect(q('.adm-pane:not([hidden]) .adm-browser .vz-md-search-row')).not.toBeNull()
    // The old two-column pack layout is gone.
    expect(q('.adm-pane:not([hidden]) .adm-split')).toBeNull()
    expect(qa('.adm-pane:not([hidden]) .adm-card').map(card => card.textContent)).toEqual([expect.stringContaining('Starters')])
  })

  it('shows a pack in the centre window and edits it in the inspector, with Save pack and Delete pack as header icons', async () => {
    await click(qa('[role="tab"]').find(tab => tab.textContent === 'Packs')!)
    expect(qa('.fw-app-header [data-app-header-slot="controls"] .adm-header-actions button').map(button => button.getAttribute('aria-label')).filter(label => /pack/i.test(label ?? ''))).toEqual([])
    await click(qa('.adm-pane:not([hidden]) .adm-card-button')[0]!)
    const stage = q('.adm-pane:not([hidden]) .adm-stage')!
    expect(stage.querySelector('.adm-preview-title h2')!.textContent).toBe('Starters')
    expect(stage.textContent).toContain('The first pack.')
    expect(stage.querySelectorAll('.adm-pack-grid .adm-tile')).toHaveLength(1)
    expect(stage.querySelector('.adm-pack-grid')!.textContent).toContain('Bravo')
    expect(qa('.adm-pane:not([hidden]) .pmv-inspector .rv-ctrl-row label').map(label => label.textContent)).toEqual(expect.arrayContaining(['Name', 'Description', 'Display Order']))
    expect(qa('.adm-header-actions button').map(button => button.getAttribute('aria-label'))).toEqual(['Save pack', 'Delete pack'])
    expect(q('.adm-pane:not([hidden]) .pmv-inspector .adm-form-actions')).toBeNull()
    expect(qa('.adm-header-actions button').every(button => button.textContent === '')).toBe(true)
    expect((qa('.adm-header-actions button')[0] as HTMLButtonElement).disabled).toBe(true)
  })

  it('creates a pack from the library window and opens it', async () => {
    await click(qa('[role="tab"]').find(tab => tab.textContent === 'Packs')!)
    const input = q('.adm-pane:not([hidden]) .adm-new-pack input')! as HTMLInputElement
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Late Night'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    await click(qa('.adm-pane:not([hidden]) .adm-new-pack button').find(button => button.textContent === 'Create Pack')!)
    await until(() => qa('.adm-pane:not([hidden]) .adm-card').length === 2)
    expect(q('.adm-pane:not([hidden]) .adm-stage .adm-preview-title h2')!.textContent).toBe('Late Night')
  })

  it('keeps unsaved edits on the Presets tab while the Packs tab is open, and the header takes only the showing tab\'s actions', async () => {
    const nameInput = () => qa('.adm-pane:not([hidden]) .rv-ctrl-row').find(entry => entry.querySelector('label')?.textContent === 'Name')!.querySelector<HTMLInputElement>('input')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(nameInput(), 'Alpha Edited'); nameInput().dispatchEvent(new Event('input', { bubbles: true })) })
    expect(qa('.adm-header-actions button').map(button => button.getAttribute('aria-label'))[0]).toBe('Save changes (1)')
    await click(qa('[role="tab"]').find(tab => tab.textContent === 'Packs')!)
    expect(qa('.adm-header-actions button')).toHaveLength(0)
    await click(qa('.adm-pane:not([hidden]) [role="tab"]').find(tab => tab.textContent === 'Presets')!)
    expect(nameInput().value).toBe('Alpha Edited')
    expect(qa('.adm-header-actions button').map(button => button.getAttribute('aria-label'))[0]).toBe('Save changes (1)')
  })

  it('lines the search row up with the dropdown rows under it, in the Preset Catalog\'s own styles', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/features/admin/admin.css'), 'utf8')
    // The manager layout insets the search row by 26px; the admin library overrides that to the 12px its dropdown rows use.
    expect(css).toMatch(/\.adm-browser\.vz-media-browser--manager \.vz-md-search-row \{ padding-inline: 12px; \}/)
    expect(css).toMatch(/\.adm-filter-grid \{[^}]*padding: 4px 12px 0;/)
    expect(css).toMatch(/\.adm-status-chips \{[^}]*padding: 10px 12px 0;/)
  })
})
