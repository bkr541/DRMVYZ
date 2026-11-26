// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const MODEL_ID = 'c0000000-0000-4000-8000-000000000001'
const mocks = vi.hoisted(() => ({ get: vi.fn(), getVersion: vi.fn(), signedUrl: vi.fn(), notify: vi.fn(), selectProps: {} as Record<string, unknown> }))
vi.mock('../../../features/models/data/modelAssetRepository', () => ({ modelAssetRepository: { get: mocks.get, getVersion: mocks.getVersion, signedUrl: mocks.signedUrl } }))
vi.mock('../../../stores/notificationStore', async importOriginal => ({ ...await importOriginal<typeof import('../../../stores/notificationStore')>(), notify: mocks.notify }))
vi.mock('../media/ModelLibraryCards', () => ({
  ModelLibraryCards: (props: Record<string, unknown>) => { mocks.selectProps = props; return <div data-testid="cards">{props.searchControl as React.ReactNode}</div> },
}))

import { WithNotificationDrawer, drawerText } from '../../../test/WithNotificationDrawer'
import { Cinema2ModelRuntimeNotices } from './Cinema2ModelRuntimeNotices'
import { Cinema2ModelSourcePanel, findCinema2UserModelParameter } from './Cinema2ModelSourcePanel'
import { CINEMA2_BASS_SIGIL_PRESET_MANIFEST } from '../cinema2/presets/Cinema2BassSigilPreset'
import { CINEMA2_CHAMBER_PRESET_MANIFEST } from '../cinema2/presets/Cinema2ChamberPreset'
import { CINEMA2_CRATE_PRESET_MANIFESTS } from '../cinema2/presets/Cinema2CratePresets'
import { createCinema2UserModelPreset } from '../cinema2/presets/Cinema2UserModelPresetFactory'
import type { ModelAsset } from '../../../features/models/domain/modelAssetTypes'

const asset = (overrides: Partial<ModelAsset> = {}): ModelAsset => ({ id: MODEL_ID, userId: 'u', kind: 'imported', sourceMediaId: null, name: 'Pure Diamond', description: null, favorite: false, currentVersion: 1, status: 'ready', createdAt: '', updatedAt: '', ...overrides })

function fakeRuntime(initial: string, diagnostics: { code: string; message: string }[] = [], presetId = 'drmvyz.cinema2.other-model-slot') {
  let value = initial; const listeners = new Set<() => void>()
  const state = {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) },
    getValue: () => value,
    setPersistentValue: vi.fn((_id: string, next: string) => { value = next; listeners.forEach(listener => listener()); return { ok: true } }),
  }
  return { state, runtime: { getCompiledPresetPlan: () => ({ presetId }), getParameterState: () => state, getModuleRuntimeSnapshot: () => ({ modules: [{ diagnostics }] }) } as never }
}
let container: HTMLDivElement, root: ReturnType<typeof createRoot>
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); mocks.get.mockReset().mockResolvedValue(asset()); mocks.getVersion.mockReset().mockResolvedValue({}); mocks.signedUrl.mockReset().mockResolvedValue({ url: "https://example.test/model.png" }); mocks.notify.mockReset() })
afterEach(() => { act(() => root.unmount()); container.remove() })
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() }) }
const button = (label: RegExp) => [...document.body.querySelectorAll('button')].find(item => label.test(item.textContent ?? ''))
const openActions = async () => { await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Source actions"]')!.click() }) }
const text = () => (container.textContent ?? '') + drawerText()
const render = async (initial: string, diagnostics: { code: string; message: string }[] = []) => {
  const fake = fakeRuntime(initial, diagnostics)
  await act(async () => { root.render(<WithNotificationDrawer><Cinema2ModelRuntimeNotices runtime={fake.runtime} /><Cinema2ModelSourcePanel runtime={fake.runtime} parameterId={'p' as never} /></WithNotificationDrawer>) }); await flush()
  return fake
}

describe('model slot detection', () => {
  it('finds the model parameter of Bass Sigil, Chamber and the 3D preview presets, and none on a preset without a slot', () => {
    expect(findCinema2UserModelParameter(CINEMA2_BASS_SIGIL_PRESET_MANIFEST)).toBe('bass-sigil-model')
    expect(findCinema2UserModelParameter(CINEMA2_CHAMBER_PRESET_MANIFEST)).toBe('chamber-model')
    const preview = CINEMA2_CRATE_PRESET_MANIFESTS.find(manifest => manifest.id === 'drmvyz.cinema2.crate-paradox-weave')
    expect(findCinema2UserModelParameter(preview)).toBeNull()
    expect(findCinema2UserModelParameter(createCinema2UserModelPreset('form'))).toBe('user-model-form-model')
    expect(findCinema2UserModelParameter(undefined)).toBeNull()
  })
})

describe('the model Source panel', () => {
  it.each([CINEMA2_BASS_SIGIL_PRESET_MANIFEST.id, CINEMA2_CHAMBER_PRESET_MANIFEST.id, ...(['form', 'dust', 'hologram', 'shatter', 'slices', 'voxel'] as const).map(kind => createCinema2UserModelPreset(kind).id)])('keeps required content non-removable for %s while retaining model selection', async presetId => {
    const fake = fakeRuntime(`user-model:${MODEL_ID}:1`, [], presetId)
    const openMediaManager = vi.fn()
    await act(async () => root.render(<Cinema2ModelSourcePanel runtime={fake.runtime} parameterId={'p' as never} onOpenMediaManager={openMediaManager} />))
    await flush()
    expect(container.querySelector('[data-testid="cards"]')).not.toBeNull()
    expect(mocks.selectProps.activeId).toBe(MODEL_ID)
    expect(container.querySelector('[data-cinema2-active-source]')).not.toBeNull()
    await openActions()
    expect(button(/Remove model|Open Media Manager/)).toBeUndefined()
    await act(async () => { (mocks.selectProps.onSelect as (asset: ModelAsset) => void)(asset({ currentVersion: 2 })) })
    expect(fake.state.setPersistentValue).toHaveBeenCalledWith('p', `user-model:${MODEL_ID}:2`)
    expect(openMediaManager).not.toHaveBeenCalled()
  })


  it('asks for a model when none is chosen', async () => {
    await render('default-model')
    expect(text()).toContain('Built-in model'); expect(text()).toContain('Pick one of your 3D models'); expect(button(/Remove model/)).toBeUndefined()
  })

  it('pins the current version of the model that is clicked', async () => {
    const fake = await render('default-model')
    await act(async () => { (mocks.selectProps.onSelect as (asset: ModelAsset) => void)(asset({ currentVersion: 3 })) }); await flush()
    expect(fake.state.setPersistentValue).toHaveBeenCalledWith('p', `user-model:${MODEL_ID}:3`)
  })

  it('refuses a model with no saved version', async () => {
    const fake = await render('default-model')
    await act(async () => { (mocks.selectProps.onSelect as (asset: ModelAsset) => void)(asset({ currentVersion: 0, status: 'draft' })) })
    expect(fake.state.setPersistentValue).not.toHaveBeenCalled(); expect(mocks.notify).toHaveBeenCalledWith('react', expect.objectContaining({ tone: 'error' }))
  })

  it('shows the pinned model, marks it active, and removes it', async () => {
    mocks.get.mockResolvedValue(asset())
    const fake = await render(`user-model:${MODEL_ID}:1`)
    expect(text()).toContain('Pure Diamond · v1'); expect(mocks.selectProps.activeId).toBe(MODEL_ID)
    await openActions()
    await act(async () => { button(/Remove model/)!.click() })
    expect(fake.state.setPersistentValue).toHaveBeenCalledWith('p', 'default-model')
  })

  it('offers a newer version of the pinned model and never applies it by itself', async () => {
    mocks.get.mockResolvedValue(asset({ currentVersion: 2 }))
    const fake = await render(`user-model:${MODEL_ID}:1`)
    expect(text()).toContain('A newer version is available'); expect(fake.state.setPersistentValue).not.toHaveBeenCalled()
    await openActions()
    await act(async () => { button(/Use v2/)!.click() })
    expect(fake.state.setPersistentValue).toHaveBeenCalledWith('p', `user-model:${MODEL_ID}:2`)
  })

  it('says when the pinned model was deleted, and when the scene could not show it', async () => {
    mocks.get.mockResolvedValue(asset({ status: 'deletion_pending' }))
    await render(`user-model:${MODEL_ID}:1`, [{ code: 'CINEMA2_USER_MODEL_MISSING', message: 'The selected model or pinned version is unavailable or deleted.' }])
    expect(text()).toContain('deleted or is unavailable'); expect(text()).toContain('The model could not be shown')
  })

  it.each(['SLICES_OPEN', 'SHATTER_LIMIT', 'HOLOGRAM_EDGES', 'VOXEL_SHELL'])('presents %s as an effect limitation without claiming the model failed to load', async code => {
    await render(`user-model:${MODEL_ID}:1`, [{ code: `CINEMA2_USER_MODEL_${code}`, message: 'The model remains visible with a bounded effect.' }])
    expect(drawerText()).toContain('Model effect preparation'); expect(container.querySelector('[data-cinema2-model-source]')?.textContent).not.toContain('The model remains visible with a bounded effect.'); expect(text()).not.toContain('The model could not be shown')
    expect(mocks.selectProps.activeId).toBe(MODEL_ID)
  })

  it('keeps transient model loading out of the Notifications warnings', async () => {
    mocks.get.mockResolvedValue(asset())
    await render(`user-model:${MODEL_ID}:1`, [{ code: 'CINEMA2_USER_MODEL_LOADING', message: 'Loading your model…' }])
    expect(drawerText()).not.toContain('Loading your model…'); expect(container.querySelector('[data-testid="cards"]')).not.toBeNull()
  })
})
