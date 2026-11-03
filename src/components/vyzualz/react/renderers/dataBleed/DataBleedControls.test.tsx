/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { DataBleedControls } from './DataBleedControls'
import { useReactStore } from '../../../../../stores/reactStore'
import { useMediaStore, type UploadedMedia } from '../../../../../stores/mediaStore'
import { DEFAULT_CANVAS_DATA_BLEED_SETTINGS as defaults, getDataBleedClearRevision } from './DataBleedSettings'
describe('Data Bleed Design', () => {
  it('scopes mode-dependent controls, manual authority, commands and reset without changing media or MUTAGEN', async () => {
    await useReactStore.persist.rehydrate(); useReactStore.getState().resetReactView()
    useReactStore.getState().selectCanvasPreset('canvas-data-bleed'); useReactStore.getState().selectCanvasMediaItem('source')
    const other = useReactStore.getState().canvasPresetSettings.mutagen
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
    const labels = () => [...host.querySelectorAll('.rv-ctrl-label')].map(e => e.textContent)
    try {
      await act(async () => root.render(<DataBleedControls />))
      expect(labels()).not.toContain('Motion Sensitivity'); expect(labels()).toContain('Flow Speed')
      await act(async () => useMediaStore.setState({ items: [{ id: 'source', type: 'video' } as UploadedMedia] }))
      expect(labels()).toContain('Motion Sensitivity')
      await act(async () => useReactStore.getState().setCanvasPresetSettings({ dataBleed: { ...defaults, flowMode: 'motion', autoPerformance: true } }))
      expect(labels()).not.toContain('Flow Speed'); expect(labels()).not.toContain('Direction Bias')
      const before = getDataBleedClearRevision()
      await act(async () => (host.querySelectorAll('button') && [...host.querySelectorAll('button')].find(b => b.textContent === 'Clear History'))!.click())
      expect(getDataBleedClearRevision()).not.toBe(before)
      await act(async () => (host.querySelector('[aria-label="Reset Data Bleed settings"]') as HTMLButtonElement).click())
      expect(useReactStore.getState().canvasPresetSettings.dataBleed).toEqual(defaults)
      expect(useReactStore.getState().activeCanvasMediaId).toBe('source')
      expect(useReactStore.getState().canvasPresetSettings.mutagen).toEqual(other)
    } finally { await act(async () => root.unmount()); host.remove() }
  })
})
