// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userScenes: {} as Record<string, unknown>,
  updateUserScene: vi.fn(),
  addUserScene: vi.fn(),
  requestRecompile: vi.fn(),
}))
const definition = { id: 'user-glow', name: 'Glow Tunnel', category: 'tunnel', fragSrc: 'void main(){}' }

vi.mock('../library/ShaderLibraryStore', () => ({
  useShaderLibraryStore: () => ({ userScenes: mocks.userScenes, updateUserScene: mocks.updateUserScene, addUserScene: mocks.addUserScene }),
}))
vi.mock('./shaderPanelStore', () => {
  const state = {
    activeShaderId: 'user-glow', compileStatus: { state: 'idle' }, compileError: null, performanceMetrics: null,
    effectiveQualityTier: 'high', passInfo: null, requestPreviewCompile: vi.fn(), requestPreviewReset: vi.fn(),
    requestRecompile: (...args: unknown[]) => mocks.requestRecompile(...args),
  }
  return { useShaderPanelStore: Object.assign((selector: (value: typeof state) => unknown) => selector(state), { getState: () => state }) }
})
vi.mock('../registry', () => ({ shaderRegistry: { get: () => definition } }))
vi.mock('../editor/ShaderCompilePanel', () => ({ ShaderCompilePanel: () => null }))
vi.mock('../editor/ShaderPassInspector', () => ({ ShaderPassInspector: () => null }))
vi.mock('../editor/ShaderCodeEditor', () => ({
  ShaderCodeEditor: ({ onSave }: { onSave: (def: unknown) => void }) => <button data-testid="save" onClick={() => onSave(definition)}>save</button>,
}))
vi.mock('../../ReactControlRows', () => ({ Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))

import { ShaderInspectorPanel } from './ShaderInspectorPanel'
import { useNotificationStore } from '../../../../../stores/notificationStore'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
const cards = () => useNotificationStore.getState().events['react']

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mocks.userScenes = {}
  mocks.updateUserScene.mockReset()
  mocks.addUserScene.mockReset()
  mocks.requestRecompile.mockReset()
  useNotificationStore.setState({ events: { ...useNotificationStore.getState().events, react: [] } })
})
afterEach(() => { act(() => root.unmount()); container.remove() })

async function save() {
  await act(async () => { root.render(<ShaderInspectorPanel />) })
  await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="save"]')!.click() })
}

describe('Shader editor Save', () => {
  it('confirms an updated user scene and recompiles it', async () => {
    mocks.userScenes = { 'user-glow': {} }
    mocks.updateUserScene.mockReturnValue({ ok: true })
    await save()
    expect(mocks.requestRecompile).toHaveBeenCalledWith('user-glow')
    expect(cards()[0]).toMatchObject({ tone: 'success', title: 'Shader saved', message: 'Changes to "Glow Tunnel" were saved.' })
  })

  it('tells the user why an update was refused, instead of logging it', async () => {
    mocks.userScenes = { 'user-glow': {} }
    mocks.updateUserScene.mockReturnValue({ ok: false, error: 'Fragment shader is empty' })
    await save()
    expect(mocks.requestRecompile).not.toHaveBeenCalled()
    expect(cards()).toHaveLength(1)
    expect(cards()[0]).toMatchObject({ tone: 'error', title: 'Shader not saved' })
    expect(cards()[0]!.message).toContain('Fragment shader is empty')
  })

  it('confirms a bundled scene saved as a new user scene, and reports a refused add', async () => {
    mocks.addUserScene.mockReturnValue({ ok: true })
    await save()
    expect(cards()[0]).toMatchObject({ tone: 'success', title: 'Shader saved', message: '"Glow Tunnel" was added to your shader scenes.' })

    mocks.addUserScene.mockReturnValue({ ok: false, error: 'Scene ID "user-glow" already exists' })
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="save"]')!.click() })
    expect(cards()[0]).toMatchObject({ tone: 'error', title: 'Shader not saved' })
    expect(cards()[0]!.message).toContain('already exists')
  })
})
