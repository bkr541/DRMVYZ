// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useReactStore } from '../../../../stores/reactStore'
import { DEFAULT_REACT_PRESETS, type ReactEngineId } from '../ReactTypes'
import { ReactPerformancePads } from '../ReactPerformancePads'
import { getReactLowerSurfaces, resolveReactWorkspaceComposition } from '../reactWorkspaceComposition'

// Cinema 2.0 and Headliner used to hide the pads; PixGrid always had them. A set must run from whichever is loaded.
// (LaserDMX and CANVAS give some pad slots to their own contextual actions, so they are covered by ReactPerformanceActions.)
const LOADED_ENGINES = ['cinema2', 'headliner', 'xyScope', 'pixGrid'] as const satisfies readonly ReactEngineId[]

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  useReactStore.getState().resetReactView()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<ReactPerformancePads embedded />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const press = (key: string) => act(async () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
})
const padButton = (key: string) => [...container.querySelectorAll<HTMLButtonElement>('.rv-pad')]
  .find(button => button.title.includes(`[${key.toUpperCase()}]`))

describe('performance pads from every loaded engine', () => {
  // Pad A opens a Sound Drawing XY preset (a native destination rather than a React preset).
  const presetPad = useReactStore.getState().performancePads.find(pad => pad.id === 'pad-9')!
  const target = { engine: presetPad.destination!.engineId, presetId: presetPad.destination!.presetId }

  it('uses a default pad whose preset belongs to an engine other than most of the engines pressed from', () => {
    expect(target).toEqual({ engine: 'xyScope', presetId: 'conversation' })
    expect(LOADED_ENGINES.filter(engine => engine !== target.engine).length).toBeGreaterThanOrEqual(3)
  })

  it('keeps the pads mounted for the retired Shader engine id too, so no engine value can hide them', () => {
    expect(getReactLowerSurfaces(resolveReactWorkspaceComposition('shaderPads', 'beamMatrix', false))).toContain('performancePads')
  })

  for (const engine of LOADED_ENGINES) {
    it(`mounts the pads and jumps to the pad's preset by key and by click while ${engine} is loaded`, async () => {
      expect(getReactLowerSurfaces(resolveReactWorkspaceComposition(engine, 'beamMatrix', false))).toContain('performancePads')
      await act(async () => useReactStore.getState().selectReactEngine(engine))
      expect(useReactStore.getState().activeReactEngineId).toBe(engine)

      const pad = padButton('a')!
      expect(pad, `pad A while ${engine} is loaded`).toBeDefined()
      expect(pad.disabled).toBe(false)

      await press('a')
      expect(useReactStore.getState().activePadId).toBe('pad-9')
      expect(useReactStore.getState().activeReactEngineId).toBe(target.engine)
      expect(useReactStore.getState().xyScopeSettings.presetId).toBe(target.presetId)

      await act(async () => useReactStore.getState().selectReactEngine(engine))
      await act(async () => padButton('a')!.click())
      expect(useReactStore.getState().activeReactEngineId).toBe(target.engine)
    })
  }

  it('also cycles to a Cinema 2.0 pad and back to a React preset without leaving the pads', async () => {
    useReactStore.getState().updatePerformancePad('pad-6', {
      destination: { schemaVersion: 1, engineId: 'cinema2', presetId: 'drmvyz.cinema2.afterhours' },
      label: 'Afterhours',
    })
    await act(async () => useReactStore.getState().selectReactEngine('headliner'))

    await press('w')
    expect(useReactStore.getState().activeReactEngineId).toBe('cinema2')
    expect(useReactStore.getState().activePadId).toBe('pad-6')
    expect(useReactStore.getState().cinema2Workspace.activePresetId).toBe('drmvyz.cinema2.afterhours')

    await press('a')
    expect(useReactStore.getState().activeReactEngineId).toBe(target.engine)
    expect(useReactStore.getState().activePadId).toBe('pad-9')
  })
})
