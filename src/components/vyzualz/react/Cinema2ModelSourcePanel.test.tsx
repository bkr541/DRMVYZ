// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const MODEL_ID = 'c0000000-0000-4000-8000-000000000001'
const mocks = vi.hoisted(() => ({ get: vi.fn(), getVersion: vi.fn(), signedUrl: vi.fn(), listVersions: vi.fn(), notify: vi.fn(), selectProps: {} as Record<string, unknown> }))
vi.mock('../../../features/models/data/modelAssetRepository', () => ({ modelAssetRepository: { get: mocks.get, getVersion: mocks.getVersion, signedUrl: mocks.signedUrl, listVersions: mocks.listVersions } }))
vi.mock('../../../stores/notificationStore', async importOriginal => ({ ...await importOriginal<typeof import('../../../stores/notificationStore')>(), notify: mocks.notify }))
vi.mock('../media/ModelLibraryCards', () => ({
  ModelLibraryCards: (props: Record<string, unknown>) => { mocks.selectProps = props; return <div data-testid="cards">{props.searchControl as React.ReactNode}</div> },
}))

import { WithNotificationDrawer, drawerText } from '../../../test/WithNotificationDrawer'
import { Cinema2ModelRuntimeNotices } from './Cinema2ModelRuntimeNotices'
import { Cinema2ModelSourcePanel, findCinema2UserModelParameter } from './Cinema2ModelSourcePanel'
import { CINEMA2_BASS_SIGIL_PRESET_MANIFEST } from '../cinema2/presets/Cinema2BassSigilPreset'
import { useModelEditorStore } from '../../../features/models/state/modelEditorStore'
import { CINEMA2_MONUMENT_PRESET_MANIFEST } from '../cinema2/presets/Cinema2MonumentPreset'
import { compileCinema2ParameterPlan } from '../cinema2/parameters/Cinema2ParameterSchema'
import { Cinema2ParameterState } from '../cinema2/parameters/Cinema2ParameterState'
import { CINEMA2_COLOSSUS_PRESET_MANIFEST } from '../cinema2/presets/Cinema2ColossusPreset'
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
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); mocks.get.mockReset().mockResolvedValue(asset()); mocks.getVersion.mockReset().mockResolvedValue({}); mocks.signedUrl.mockReset().mockResolvedValue({ url: "https://example.test/model.png" }); mocks.listVersions.mockReset().mockResolvedValue([]); mocks.notify.mockReset() })
afterEach(() => { act(() => root.unmount()); container.remove() })
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() }) }
const button = (label: RegExp) => [...document.body.querySelectorAll('button')].find(item => label.test(item.textContent ?? ''))
const openActions = async () => { await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Source actions"]')!.click() }) }
const text = () => (container.textContent ?? '') + drawerText()
const render = async (initial: string, diagnostics: { code: string; message: string }[] = [], presetId?: string) => {
  const fake = fakeRuntime(initial, diagnostics, presetId)
  const parameterId = presetId === CINEMA2_COLOSSUS_PRESET_MANIFEST.id ? 'colossus-model' : 'p'
  await act(async () => { root.render(<WithNotificationDrawer><Cinema2ModelRuntimeNotices runtime={fake.runtime} /><Cinema2ModelSourcePanel runtime={fake.runtime} parameterId={parameterId as never} /></WithNotificationDrawer>) }); await flush()
  return fake
}

describe('model slot detection', () => {
  it('finds the model parameter of Bass Sigil, Chamber and the 3D preview presets, and none on a preset without a slot', () => {
    expect(findCinema2UserModelParameter(CINEMA2_BASS_SIGIL_PRESET_MANIFEST)).toBe('bass-sigil-model')
    expect(findCinema2UserModelParameter(CINEMA2_CHAMBER_PRESET_MANIFEST)).toBe('chamber-model')
    expect(findCinema2UserModelParameter(CINEMA2_COLOSSUS_PRESET_MANIFEST)).toBe('colossus-model')
    expect(findCinema2UserModelParameter(CINEMA2_MONUMENT_PRESET_MANIFEST)).toBe('monument-model')
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

  it('keeps Colossus pinned to the chosen version through publication, removal and reselection', async () => {
    const source = () => container.querySelector('[data-cinema2-active-source]')!
    const fake = await render(`user-model:${MODEL_ID}:1`, [], CINEMA2_COLOSSUS_PRESET_MANIFEST.id)
    expect(source().textContent).toContain('Pure Diamond · v1')
    mocks.get.mockResolvedValue(asset({ currentVersion: 2 }))
    mocks.signedUrl.mockImplementation(async (_id, version) => ({ url: `https://example.test/v${version}.png` }))
    await act(async () => useModelEditorStore.setState(s => ({ libraryRevision: s.libraryRevision + 1 }))); await flush()
    expect(source().textContent).toContain('Pure Diamond · v1')
    expect(source().textContent).toContain('A newer version is available')
    expect(source().querySelector('img')?.getAttribute('src')).toContain('v1.png')
    expect(fake.state.setPersistentValue).not.toHaveBeenCalled()
    await openActions(); await act(async () => button(/Use v2/)!.click()); await flush()
    expect(fake.state.setPersistentValue).toHaveBeenCalledWith('colossus-model', `user-model:${MODEL_ID}:2`)
    expect(source().textContent).toContain('Pure Diamond · v2')
    expect(source().querySelector('img')?.getAttribute('src')).toContain('v2.png')
    await openActions(); await act(async () => button(/Remove model/)!.click()); await flush()
    expect(source().textContent).toContain('Built-in model')
    expect(source().querySelector('img')).toBeNull()
    await act(async () => { (mocks.selectProps.onSelect as (asset: ModelAsset) => void)(asset({ currentVersion: 1 })) }); await flush()
    expect(source().textContent).toContain('Pure Diamond · v1')
  })

  it('does not advertise a missing pinned Colossus version or silently advance it', async () => {
    const source = () => container.querySelector('[data-cinema2-active-source]')!
    const fake = await render(`user-model:${MODEL_ID}:1`, [], CINEMA2_COLOSSUS_PRESET_MANIFEST.id)
    mocks.get.mockResolvedValue(asset({ currentVersion: 2 }))
    mocks.getVersion.mockRejectedValue(new Error('Version not found'))
    await act(async () => useModelEditorStore.setState(s => ({ libraryRevision: s.libraryRevision + 1 }))); await flush()
    expect(source().textContent).toContain('pinned version is unavailable')
    expect(source().querySelector('img')).toBeNull()
    await openActions()
    expect(button(/Use v2/)).toBeUndefined()
    expect(button(/Remove model/)).toBeDefined()
    expect(button(/Open Media Manager/)).toBeUndefined()
    expect(fake.state.setPersistentValue).not.toHaveBeenCalled()
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


describe('Monument typography and model source authority', () => {
  const plan = compileCinema2ParameterPlan(CINEMA2_MONUMENT_PRESET_MANIFEST)
  const modelParameter = findCinema2UserModelParameter(CINEMA2_MONUMENT_PRESET_MANIFEST)!
  const secondId = 'c0000000-0000-4000-8000-000000000002'
  const source = () => container.querySelector('[data-cinema2-active-source]')!
  const renderMonument = async (state = new Cinema2ParameterState(plan)) => {
    const runtime = {
      getCompiledPresetPlan: () => ({ presetId: CINEMA2_MONUMENT_PRESET_MANIFEST.id }),
      getParameterState: () => state,
      getModuleRuntimeSnapshot: () => ({ modules: [{ moduleId: 'monument-hall', inspection: { userModel: { binding: state.getValue(modelParameter), status: 'ready', message: null } } }] }),
    } as never
    await act(async () => root.render(<Cinema2ModelSourcePanel runtime={runtime} parameterId={modelParameter} />)); await flush()
    return state
  }
  const select = async (model: ModelAsset) => {
    await act(async () => (mocks.selectProps.onSelect as (asset: ModelAsset) => void)(model)); await flush()
  }
  const action = async (label: RegExp) => {
    await openActions(); await act(async () => button(label)!.click()); await flush()
  }
  it('pins, replaces, removes and reselects models atomically without changing saved typography', async () => {
    const state = await renderMonument()
    expect(source().textContent).toContain('Built-in typography')
    const typography = { 'monument-text': 'MY SHOW', 'monument-line-2': 'LIVE', 'monument-font': 'stageless' }
    await act(async () => { expect(state.setPersistentValues(typography).ok).toBe(true) })
    expect(source().textContent).toContain('MY SHOW / LIVE')
    expect(source().textContent).toContain('Custom typography · STAGELESS Sans Bold')
    mocks.get.mockImplementation(async id => id === secondId ? asset({ id: secondId, name: 'Second Hero', currentVersion: 3 }) : asset())
    const snapshots: unknown[] = []
    const unsubscribe = state.subscribe(() => snapshots.push(state.getSnapshot().persistentValues))
    await select(asset())
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({ 'monument-content-type': 'model', 'monument-model': `user-model:${MODEL_ID}:1` })
    expect(source().textContent).toContain('Pure Diamond · v1')
    await select(asset({ id: secondId, currentVersion: 3 }))
    expect(source().textContent).toContain('Second Hero · v3')
    expect(mocks.selectProps.activeId).toBe(secondId)
    await openActions()
    expect(document.querySelectorAll('[role="menuitem"]')).not.toHaveLength(0)
    expect([...document.querySelectorAll('[role="menuitem"]')].filter(item => /Remove model/.test(item.textContent ?? ''))).toHaveLength(1)
    expect(button(/Open Media Manager/)).toBeUndefined()
    await act(async () => button(/Remove model/)!.click()); await flush()
    expect(state.getSnapshot().persistentValues).toMatchObject({ ...typography, 'monument-model': 'default-model', 'monument-content-type': 'text' })
    expect(source().textContent).toContain('MY SHOW / LIVE')
    expect(mocks.selectProps.activeId).toBeNull()
    const restored = new Cinema2ParameterState(plan)
    expect(restored.restore(state.serialize()).ok).toBe(true)
    expect(restored.getSnapshot().persistentValues).toMatchObject(typography)
    await select(asset()); expect(source().textContent).toContain('Pure Diamond · v1')
    await act(async () => state.resetAll()); await flush()
    expect(source().textContent).toContain('Built-in typography')
    await select(asset()); expect(source().textContent).toContain('Pure Diamond · v1')
    unsubscribe()
  })

  it('respects an older saved text mode with a dormant pin and handles unavailable versions', async () => {
    const state = new Cinema2ParameterState(plan)
    state.setPersistentValues({ 'monument-model': `user-model:${MODEL_ID}:1`, 'monument-content-type': 'text', 'monument-text': 'SAVED TEXT' })
    await renderMonument(state)
    expect(source().textContent).toContain('SAVED TEXT')
    expect(source().querySelector('img')).toBeNull()
    expect(mocks.selectProps.activeId).toBeNull()
    await action(/Use saved model/)
    expect(source().textContent).toContain('Pure Diamond · v1')
    await action(/Use typography/)
    expect(source().textContent).toContain('SAVED TEXT')
    expect(state.getValue(modelParameter)).toBe(`user-model:${MODEL_ID}:1`)
    await action(/Use saved model/)
    mocks.get.mockResolvedValue(asset({ currentVersion: 2 }))
    mocks.getVersion.mockRejectedValue(new Error('Version not found'))
    await act(async () => useModelEditorStore.setState(s => ({ libraryRevision: s.libraryRevision + 1 }))); await flush()
    expect(source().textContent).toContain('pinned version is unavailable')
    expect(source().textContent).toContain('typography is the fallback')
    await openActions(); expect(button(/Use v2/)).toBeUndefined()
    await act(async () => button(/Remove model/)!.click()); await flush()
    expect(source().textContent).toContain('SAVED TEXT')
  })
})
