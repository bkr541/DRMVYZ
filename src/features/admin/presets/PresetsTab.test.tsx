// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PresetMetadataRow } from '../../presetCatalog/presetMetadata'

const data = vi.hoisted(() => ({
  rows: [] as unknown[],
  saves: [] as { key: string; status: string | null; name: string | null; before: number }[],
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
  loadPacks: async () => [],
  loadPackMembers: async () => [],
  // Like the real one: the rows it is given are the rows it builds on.
  savePresetMetadata: async (engineId: string, presetKey: string, row: PresetMetadataRow | null, current: readonly PresetMetadataRow[]) => {
    if (data.failOn === presetKey) throw new Error('The database refused it.')
    data.saves.push({ key: presetKey, status: row?.publication_status ?? null, name: row?.name ?? null, before: current.length })
    const others = current.filter(entry => !(entry.engine_id === engineId && entry.preset_key === presetKey))
    return row ? [...others, row] : others
  },
  addPackMember: async () => undefined, removePackMember: async () => undefined, createPack: async () => undefined, updatePack: async () => undefined, deletePack: async () => undefined, movePackMember: async () => undefined,
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
  data.rows = []; data.saves = []; data.failOn = null
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
    expect(qa('.fw-app-header [data-app-header-slot="controls"] .adm-header-actions button').map(button => button.getAttribute('aria-label'))).toEqual(['Save changes', 'Publish preset', 'Discard unsaved changes'])
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
    expect(qa('.adm-header-actions button')).toHaveLength(3)
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
    expect(qa('.adm-status-chip').map(chip => chip.textContent)).toEqual(['All3', 'Published3', 'Draft0', 'Not set0', 'Archived0'])
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
})
