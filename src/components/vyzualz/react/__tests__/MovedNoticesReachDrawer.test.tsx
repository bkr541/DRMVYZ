// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drawerText, WithNotificationDrawer } from '../../../../test/WithNotificationDrawer'
import { handleReactPersistenceStatus, useReactPersistenceStatusStore } from '../../../../stores/reactPersistenceStatusStore'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactPersistenceStatus } from '../ReactPersistenceStatus'
import { RecordingPanel } from '../../recording/RecordingPanel'
import { FontLibraryPanel } from '../FontLibraryPanel'
import { OscillatorSourceDiagnostics } from '../ReactEnginePanel'
import { LaserDmxRendererNotice } from '../LaserDmxRendererDiagnosticsPanel'
import {
  clearLaserDmxRendererDiagnostics,
  publishLaserDmxRendererDiagnostics,
  getLaserDmxRendererDiagnostics,
} from '../LaserDmxRendererDiagnosticsStore'
import { DEFAULT_OSCILLATOR_SETTINGS } from '../ReactTypes'

vi.mock('../useFontPreviewPreload', () => ({ useFontPreviewPreload: () => ({}) }))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  useReactPersistenceStatusStore.getState().reset()
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useReactPersistenceStatusStore.getState().reset()
  clearLaserDmxRendererDiagnostics()
})

const show = (node: React.ReactNode) => act(async () => { root.render(<WithNotificationDrawer>{node}</WithNotificationDrawer>) })

describe('save failure', () => {
  it('is listed in the Notifications drawer with the reason and a working retry', async () => {
    const retry = vi.fn().mockResolvedValue(true)
    await show(<ReactPersistenceStatus />)
    act(() => handleReactPersistenceStatus({ phase: 'error', storageName: 'react', error: 'IndexedDB unavailable', retry }))
    expect(drawerText()).toContain('Changes not safely stored')
    expect(drawerText()).toContain('IndexedDB unavailable')

    const button = [...document.body.querySelectorAll<HTMLButtonElement>('.vz-notifications-drawer button')].find(b => /Retry save/.test(b.textContent ?? ''))!
    await act(async () => { button.click(); await Promise.resolve() })
    expect(retry).toHaveBeenCalledTimes(1)
  })
})

describe('recording notices', () => {
  const panel = (props: { recorderError: string | null; recorderState?: 'idle' | 'recording'; liveFps?: number }) => (
    <RecordingPanel
      canvas={document.createElement('canvas')}
      recorderState={props.recorderState ?? 'idle'}
      recordingMode={props.recorderState === 'recording' ? 'video-audio' : null}
      recordingTime={5}
      recorderError={props.recorderError}
      fps={60}
      liveFps={props.liveFps ?? 60}
      onFpsChange={() => undefined}
      onStartRecording={() => undefined}
      onStopRecording={() => undefined}
      hasActiveProgramAudio
      onExportPng={() => undefined}
    />
  )

  it('lists a recording error and the FPS warning in the drawer instead of inside the panel', async () => {
    await show(panel({ recorderError: 'Failed to start recording: encoder busy', recorderState: 'recording', liveFps: 20 }))
    expect(drawerText()).toContain('Recording error')
    expect(drawerText()).toContain('encoder busy')
    expect(drawerText()).toContain('FPS drop')
    expect(container.textContent).not.toContain('encoder busy')
  })

  it('lists nothing while recording is healthy', async () => {
    await show(panel({ recorderError: null, recorderState: 'recording', liveFps: 60 }))
    expect(drawerText()).not.toContain('Recording error')
    expect(drawerText()).not.toContain('FPS drop')
  })
})

describe('Font Library errors', () => {
  it('list each failed step in the drawer', async () => {
    useReactStore.setState({ fontUploadError: 'Font file is too large', fontRemoveError: 'Could not delete', fontSelectError: null, fontLoadError: null })
    await show(<FontLibraryPanel />)
    const text = drawerText()
    expect(text).toContain('Font upload failed')
    expect(text).toContain('Font file is too large')
    expect(text).toContain('Font could not be removed')
    expect(text).not.toContain('Font could not be applied')
    expect(container.textContent).not.toContain('Font file is too large')
    useReactStore.setState({ fontUploadError: null, fontRemoveError: null })
  })
})

describe('Sound Drawing source notices', () => {
  const diag = (osc: Partial<typeof DEFAULT_OSCILLATOR_SETTINGS>) => (
    <OscillatorSourceDiagnostics
      osc={{ ...DEFAULT_OSCILLATOR_SETTINGS, ...osc }}
      glyphAssets={[]}
      fontAssets={[{ id: 'f1', name: 'Broken', parseError: 'Font file could not be parsed' } as never]}
      glyphCache={{}}
      allMediaItems={[]}
    />
  )

  it('lists an unreadable font as an error and empty text as information', async () => {
    await show(diag({ sourceType: 'text', text: '', textFontId: 'f1' }))
    const text = drawerText()
    expect(text).toContain('Font could not be read')
    expect(text).toContain('Font file could not be parsed')
    expect(text).toContain('Text is empty')
  })

  it('shows nothing for a text source that is fine', async () => {
    await show(diag({ sourceType: 'text', text: 'HELLO', textFontId: null }))
    expect(drawerText()).not.toContain('Text is empty')
    expect(drawerText()).not.toContain('Font could not be read')
  })
})

describe('LaserDMX renderer fallback', () => {
  const publish = (patch: Record<string, unknown>) => act(() => {
    publishLaserDmxRendererDiagnostics({ ...getLaserDmxRendererDiagnostics(), activeRenderer: 'canvas2d', ...patch } as never)
  })

  it('is listed in the drawer with a retry, even though Renderer Diagnostics is collapsed', async () => {
    await show(<LaserDmxRendererNotice />)
    publish({ fallbackReason: 'WebGL2 is unavailable', contextLossCount: 2, manualRetryAvailable: true, presentationMode: 'edit' })
    const text = drawerText()
    expect(text).toContain('LaserDMX is using a fallback renderer')
    expect(text).toContain('WebGL2 is unavailable')
    expect(text).toContain('lost 2 times')
    expect(text).toContain('Retry WebGL')
  })

  it('stays quiet when the WebGL renderer is running or the engine is idle', async () => {
    await show(<LaserDmxRendererNotice />)
    publish({ activeRenderer: 'webgl2', fallbackReason: null, finalFallbackReason: null })
    expect(drawerText()).not.toContain('fallback renderer')
  })
})
