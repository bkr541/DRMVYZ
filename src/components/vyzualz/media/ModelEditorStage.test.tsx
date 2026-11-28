// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelEditorStage } from './ModelEditorStage'
import { Group } from 'three'
import { useModelEditorStore } from '../../../features/models/state/modelEditorStore'
import { createDefaultModelRecipe } from '../../../features/models/generator/createModelArtifact'

let container: HTMLDivElement, root: ReturnType<typeof createRoot>
beforeEach(() => { useModelEditorStore.getState().reset(); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove(); useModelEditorStore.getState().reset() })
const message = () => container.querySelector('.mm-model-stage-empty')?.textContent

describe('3D model stage message', () => {
  it('keeps detailed failures out of the visualizer', async () => {
    useModelEditorStore.setState({ status: 'error', error: 'SVG exceeds the 1 MiB input budget.' })
    await act(async () => root.render(<ModelEditorStage />))
    expect(message()).not.toContain('SVG exceeds the 1 MiB input budget.')
    expect(message()).toContain('See Notifications for details.')
  })
  it('keeps the generic message when there is no specific reason', async () => {
    useModelEditorStore.setState({ status: 'error', error: null })
    await act(async () => root.render(<ModelEditorStage />))
    expect(message()).toContain('Model unavailable. See Notifications for details.')
  })
  it('provides a central Generate 3D Model button, gated by confirmation and wired to the shared action', async () => {
    const recipe = createDefaultModelRecipe(), preview = new Blob(['preview'])
    const generate = vi.spyOn(useModelEditorStore.getState(), 'generate').mockResolvedValue(undefined)
    try {
      useModelEditorStore.setState({ recipe, source: preview, preview, preparedTraceKey: JSON.stringify([recipe.foreground, recipe.trace, recipe.quality]), status: 'awaiting-generation', needsConfirmation: true, confirmed: false })
      await act(async () => root.render(<ModelEditorStage />))
      const button = () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Generate 3D Model')!
      expect(button().disabled).toBe(true)
      await act(async () => { useModelEditorStore.setState({ confirmed: true }) })
      expect(button().disabled).toBe(false)
      await act(async () => button().click())
      expect(generate).toHaveBeenCalledOnce()
    } finally { generate.mockRestore() }
  })
  it('keeps the creation guide and button mounted while source settings are processed', async () => {
    const recipe = createDefaultModelRecipe(), preview = new Blob(['preview'])
    useModelEditorStore.setState({ recipe, source: preview, preview, preparedTraceKey: JSON.stringify([recipe.foreground, recipe.trace, recipe.quality]), status: 'awaiting-generation' })
    await act(async () => root.render(<ModelEditorStage />))
    const button = [...container.querySelectorAll('button')].find(b => b.textContent === 'Generate 3D Model')!
    await act(async () => useModelEditorStore.setState({ status: 'preparing', generationPending: true }))
    expect(container.contains(button)).toBe(true)
    expect(button.disabled).toBe(true)
    expect(message()).toContain('Create your 3D model')
    expect(message()).not.toContain('Cancel operation')
    await act(async () => useModelEditorStore.setState({ status: 'awaiting-generation', generationPending: false }))
    expect(container.contains(button)).toBe(true)
    expect(button.disabled).toBe(false)
  })
  it('keeps the other states', async () => {
    useModelEditorStore.setState({ status: 'generating' })
    await act(async () => root.render(<ModelEditorStage />))
    expect(message()).toContain('Generating 3D model')
    await act(async () => { useModelEditorStore.setState({ status: 'idle' }) })
    expect(message()).toContain('Create your 3D model')
    expect(container.textContent).not.toContain('Drag to orbit')
  })
})

describe('floor grid and lines toggle', () => {
  const toggle = () => container.querySelector<HTMLButtonElement>('button[aria-label="Floor grid and axis lines"]')
  const withModel = () => useModelEditorStore.setState({ model: { group: new Group(), dispose: () => undefined, stats: { triangles: 1, vertices: 3, meshes: 1, bounds: { min: [0, 0, 0], max: [1, 1, 1] } } } as never, status: 'ready' })

  it('is an icon-only button in the corner that is on by default and toggles off and on for an existing model', async () => {
    withModel()
    await act(async () => root.render(<ModelEditorStage />))
    expect(toggle()!.textContent?.trim()).toBe('')
    expect(toggle()!.querySelector('svg')).not.toBeNull()
    expect(toggle()!.getAttribute('aria-pressed')).toBe('true')
    await act(async () => toggle()!.click())
    expect(toggle()!.getAttribute('aria-pressed')).toBe('false')
    expect(toggle()!.title).toBe('Show floor grid and lines')
    await act(async () => toggle()!.click())
    expect(toggle()!.getAttribute('aria-pressed')).toBe('true')
  })

  it('is not offered until there is a model to show', async () => {
    await act(async () => root.render(<ModelEditorStage />))
    expect(toggle()).toBeNull()
  })

  it('stays in step with the Preview grid setting of a generated model', async () => {
    withModel()
    useModelEditorStore.setState({ recipe: createDefaultModelRecipe() })
    await act(async () => root.render(<ModelEditorStage />))
    expect(toggle()!.getAttribute('aria-pressed')).toBe('true')
    await act(async () => toggle()!.click())
    expect(useModelEditorStore.getState().recipe?.preview.grid).toBe(false)
    expect(toggle()!.getAttribute('aria-pressed')).toBe('false')
    await act(async () => { useModelEditorStore.getState().setRecipe({ preview: { ...useModelEditorStore.getState().recipe!.preview, grid: true } }) })
    expect(toggle()!.getAttribute('aria-pressed')).toBe('true')
  })
})
