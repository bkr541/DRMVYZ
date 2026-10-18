// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { drawerText, WithNotificationDrawer } from '../../../../test/WithNotificationDrawer'
import { ShaderParameterPanel } from '../shaders/ui/ShaderParameterPanel'
import { ShaderLibraryPanel } from '../shaders/ui/ShaderLibraryPanel'
import { useShaderPanelStore } from '../shaders/ui/shaderPanelStore'
import { shaderRegistry } from '../shaders/registry'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useShaderPanelStore.setState({ compileError: null })
})

const show = (node: React.ReactNode) => act(async () => { root.render(<WithNotificationDrawer>{node}</WithNotificationDrawer>) })

describe('Shader notices', () => {
  it('lists a compile error in the drawer and explains the empty parameter panel', async () => {
    const scene = shaderRegistry.getAll()[0]
    expect(scene).toBeTruthy()
    useShaderPanelStore.setState({ activeShaderId: scene!.id, compileError: "0:12: 'foo' : undeclared identifier" })
    await show(<ShaderParameterPanel />)
    expect(drawerText()).toContain('Shader compile error')
    expect(drawerText()).toContain("undeclared identifier")
    expect(container.textContent).toContain('Parameters are unavailable until the shader compiles.')
    expect(container.textContent).not.toContain('undeclared identifier')
  })

  it('lists a failed shader import in the drawer, and dismissing it removes it', async () => {
    await show(<ShaderLibraryPanel />)
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['this is not a shader package'], 'broken.json', { type: 'application/json' })] })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(drawerText()).toContain('Shader import failed')
    expect(container.textContent).not.toContain('Shader import failed')

    const dismiss = document.body.querySelector<HTMLButtonElement>('.vz-notifications-drawer [aria-label*="ismiss"]')
    expect(dismiss).not.toBeNull()
    await act(async () => dismiss!.click())
    expect(drawerText()).not.toContain('Shader import failed')
  })
})
