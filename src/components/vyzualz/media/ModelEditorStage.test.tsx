// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ModelEditorStage } from './ModelEditorStage'
import { useModelEditorStore } from '../../../features/models/state/modelEditorStore'

let container: HTMLDivElement, root: ReturnType<typeof createRoot>
beforeEach(() => { useModelEditorStore.getState().reset(); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove(); useModelEditorStore.getState().reset() })
const message = () => container.querySelector('.mm-model-stage-empty')?.textContent

describe('3D model stage message', () => {
  it('says why the model could not be made, not just that it is unavailable', async () => {
    useModelEditorStore.setState({ status: 'error', error: 'SVG exceeds the 1 MiB input budget.' })
    await act(async () => root.render(<ModelEditorStage />))
    expect(message()).toBe('SVG exceeds the 1 MiB input budget.')
  })
  it('keeps the generic message when there is no specific reason', async () => {
    useModelEditorStore.setState({ status: 'error', error: null })
    await act(async () => root.render(<ModelEditorStage />))
    expect(message()).toBe('Model unavailable. Retry loading or select another asset.')
  })
  it('keeps the other states', async () => {
    useModelEditorStore.setState({ status: 'generating' })
    await act(async () => root.render(<ModelEditorStage />))
    expect(message()).toBe('Generating 3D geometry…')
    await act(async () => { useModelEditorStore.setState({ status: 'idle' }) })
    expect(message()).toBe('Prepare the source, then generate a 3D model.')
    expect(container.textContent).not.toContain('Drag to orbit')
  })
})
