/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { useReactStore } from '../../../../../stores/reactStore'
import { MutagenDesignControls } from './MutagenDesignControls'
import { MUTAGEN_PATTERNS } from './MutagenSettings'

describe('MUTAGEN scoped Design controls', () => {
  it('exposes exactly the current pattern subcontrol and preserves unrelated recipes', async () => {
    useReactStore.getState().selectCanvasPreset('canvas-mutagen')
    const host = document.createElement('div'); document.body.append(host)
    const root = createRoot(host)
    const conditional = ['Vortex Twist', 'Cell Size', 'Terrain Height', 'Shard Separation', 'Tear Bands', 'Recursion Depth', 'Shape Detail']
    const other = useReactStore.getState().canvasPresetSettings.shiftgrid
    try {
      await act(async () => root.render(<MutagenDesignControls />))
      for (const [index, pattern] of MUTAGEN_PATTERNS.entries()) {
        await act(async () => useReactStore.getState().setCanvasPresetSettings({ mutagen: { ...useReactStore.getState().canvasPresetSettings.mutagen, pattern } }))
        const labels = [...host.querySelectorAll('.rv-ctrl-label')].map(element => element.textContent)
        expect(labels.filter(label => conditional.includes(label!))).toEqual(index === 0 ? [] : [conditional[index - 1]])
        expect(labels).toContain('Pattern Transition')
      }
      expect(useReactStore.getState().canvasPresetSettings.shiftgrid).toEqual(other)
    } finally { await act(async () => root.unmount()); host.remove() }
  })
})
