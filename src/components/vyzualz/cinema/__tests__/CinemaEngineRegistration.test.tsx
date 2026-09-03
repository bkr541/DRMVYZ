/** @vitest-environment jsdom */

import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactEngineBrowser } from '../../react/ReactEngineBrowser'
import { CinemaRenderedDiagnostics, CinemaWorkspace, resolveCinemaWorkspaceModel } from '../../react/CinemaWorkspace'
import { CinemaInspectorPanel } from '../../react/CinemaInspectorPanel'
import { CinemaLayersPanel, CinemaLibraryPanel, CinemaPresetsPanel } from '../../react/CinemaWorkspacePanels'
import { CinemaResizeObserverMock, createCinemaMockWebGL } from './CinemaWebGLTestUtils'
import { buildCinemaWorkspaceFrameBridge } from '../../react/CinemaWorkspaceFrameBridge'
import type { CinemaWorkspaceRuntimeFrameConfig } from '../../react/CinemaWorkspaceRuntimeFrameSource'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import {
  acquireReactLiveEngineOwnership,
  getReactLiveEngineOwnershipDiagnosticsForTests,
  resetReactLiveEngineOwnershipForTests,
} from '../../react/renderers/ReactLiveEngineOwnership'
import {
  CINEMA_FOUNDATION_COMPOSITION,
  CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION,
  CINEMA_SHADER_REFERENCE_COMPOSITION,
  CINEMA_FOUNDATION_GRADIENT_NODE_ID,
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  CINEMA_STAGE16_REFERENCE_COMPOSITION_ID,
  createCinemaFoundationPersistedState,
} from '../CinemaFoundation'
import { createCinemaDiagnosticSnapshot } from '../CinemaDiagnostics'
import {
  getDrmvyzWebGLContextDiagnosticsForTests,
  resetDrmvyzWebGLContextDiagnosticsForTests,
} from '../../react/shaders/runtime/WebGLContextLifecycle'
import { useCinemaStore } from '../CinemaStore'
import { createCinemaCinematicWorldComposition } from '../CinemaCinematicWorldAdapter'
import { CINEMA_3D_OBJECT_PARAMETER_IDS } from '../Cinema3DObjectState'

let root: Root | null = null
let host: HTMLDivElement | null = null

function LegacyOwnershipProbe({ retire }: { retire: () => void }) {
  const engineId = useReactStore(state => state.activeReactEngineId)
  useEffect(() => {
    if (engineId === 'cinema') return
    const ownership = acquireReactLiveEngineOwnership(engineId, retire)
    ownership.markStable()
    return () => ownership.retire('unmount')
  }, [engineId, retire])
  return null
}

const productionFrameBridge = buildCinemaWorkspaceFrameBridge({
  width: 1,
  height: 1,
  dpr: 1,
  audioTimeSec: 0,
  durationSec: null,
  trackId: null,
  playing: false,
  paused: false,
  bpm: null,
})

function ProductionSelectionHarness({
  retire,
  onCanvasReady,
  runtimeFrameConfig,
}: {
  retire: () => void
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  runtimeFrameConfig?: Readonly<CinemaWorkspaceRuntimeFrameConfig> | null
}) {
  const engineId = useReactStore(state => state.activeReactEngineId)
  return (
    <>
      <ReactEngineBrowser />
      <LegacyOwnershipProbe retire={retire} />
      {engineId === 'cinema' ? (
        <CinemaWorkspace
          surface="stage"
          frameBridge={productionFrameBridge}
          runtimeFrameConfig={runtimeFrameConfig}
          onCanvasReady={onCanvasReady}
        />
      ) : <div data-legacy-engine={engineId} />}
    </>
  )
}

function ComposerSelectionHarness() {
  const engineId = useReactStore(state => state.activeReactEngineId)
  return (
    <>
      <ReactEngineBrowser />
      {engineId === 'cinema' ? (
        <>
          <CinemaWorkspace surface="panel" frameBridge={productionFrameBridge} />
          <CinemaPresetsPanel />
          <CinemaLayersPanel />
          <CinemaLibraryPanel />
          <CinemaInspectorPanel />
        </>
      ) : <div data-composer-legacy-engine={engineId} />}
    </>
  )
}

function ProductionLiveControlHarness() {
  const engineId = useReactStore(state => state.activeReactEngineId)
  return (
    <>
      <ReactEngineBrowser />
      {engineId === 'cinema' ? (
        <>
          <CinemaWorkspace surface="stage" frameBridge={productionFrameBridge} />
          <CinemaInspectorPanel />
        </>
      ) : <div data-live-control-legacy-engine={engineId} />}
    </>
  )
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  CinemaResizeObserverMock.reset()
  vi.stubGlobal('ResizeObserver', CinemaResizeObserverMock)
  resetReactLiveEngineOwnershipForTests()
  resetDrmvyzWebGLContextDiagnosticsForTests()
  useReactStore.getState().resetReactView()
  useCinemaStore.getState().hydrateCinemaState(createCinemaFoundationPersistedState())
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  host?.remove()
  host = null
  resetReactLiveEngineOwnershipForTests()
  resetDrmvyzWebGLContextDiagnosticsForTests()
  vi.unstubAllGlobals()
})

describe('Cinema production engine registration', () => {
  it('hot-applies 50+ Inspector slider changes through the production workspace without recreating renderer resources', async () => {
    const gl = createCinemaMockWebGL()
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { callbacks.delete(id) }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => (
      kind === 'webgl2' ? gl : null
    ) as RenderingContext | null)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0, toJSON: () => ({}),
    })
    expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_FOUNDATION_COMPOSITION.id).ok).toBe(true)
    expect(useCinemaStore.getState().setCinemaEditorSelection(
      CINEMA_FOUNDATION_COMPOSITION.id,
      CINEMA_FOUNDATION_GRADIENT_NODE_ID,
    ).ok).toBe(true)

    await act(async () => root?.render(<ProductionLiveControlHarness />))
    const angleLabel = [...(host?.querySelectorAll<HTMLLabelElement>('label') ?? [])]
      .find(label => label.textContent?.trim() === 'Angle')
    const angleInput = angleLabel?.htmlFor
      ? document.getElementById(angleLabel.htmlFor) as HTMLInputElement | null
      : null
    expect(angleInput?.type).toBe('range')
    const initialPrograms = gl.__calls.createdPrograms
    const initialDeletedPrograms = gl.__calls.deletedPrograms
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    expect(valueSetter).toBeDefined()

    for (let index = 0; index < 55; index += 1) {
      await act(async () => {
        valueSetter?.call(angleInput, String(-100 + index))
        angleInput?.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }

    const activeInstanceId = useCinemaStore.getState().activeInstanceId
    const activeInstance = useCinemaStore.getState().instances.find(instance => instance.id === activeInstanceId)
    expect(activeInstance?.revision).toBe(55)
    expect(gl.__calls.createdPrograms).toBe(initialPrograms)
    expect(gl.__calls.deletedPrograms).toBe(initialDeletedPrograms)

    const scheduled = [...callbacks.entries()][0]
    expect(scheduled).toBeDefined()
    callbacks.delete(scheduled[0])
    await act(async () => scheduled[1](16.67))
    expect(gl.uniform1f).toHaveBeenCalledWith(expect.anything(), -46 * Math.PI / 180)
    expect(host?.querySelector('[data-cinema-output-rendered="true"]')).not.toBeNull()
  }, 15_000)

  it('keeps one production runtime while switching from a Shader Scene to a Cinematic World', async () => {
    const gl = createCinemaMockWebGL()
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { callbacks.delete(id) }))
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => (
      kind === 'webgl2' ? gl : null
    ) as RenderingContext | null)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0, toJSON: () => ({}),
    })

    const shaderNode = CINEMA_SHADER_REFERENCE_COMPOSITION.nodes.find(node => node.family === 'shader')
    const worldNode = CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.nodes.find(node => node.family === 'procedural')
    expect(shaderNode).toBeDefined()
    expect(worldNode).toBeDefined()
    expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_SHADER_REFERENCE_COMPOSITION.id).ok).toBe(true)
    expect(useCinemaStore.getState().setCinemaEditorSelection(CINEMA_SHADER_REFERENCE_COMPOSITION.id, shaderNode!.id).ok).toBe(true)

    await act(async () => root?.render(<ProductionLiveControlHarness />))
    expect(getContext).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(1)

    const shaderFrame = [...callbacks.entries()][0]
    expect(shaderFrame).toBeDefined()
    callbacks.delete(shaderFrame[0])
    await act(async () => shaderFrame[1](16.67))
    expect(host?.querySelector('[data-cinema-output-rendered="true"]')).not.toBeNull()
    const shaderDrawCount = gl.__calls.drawCount
    expect(shaderDrawCount).toBeGreaterThan(0)

    await act(async () => {
      expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.id).ok).toBe(true)
      expect(useCinemaStore.getState().setCinemaEditorSelection(
        CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.id,
        worldNode!.id,
      ).ok).toBe(true)
    })

    expect(getContext).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(1)
    expect(host?.querySelector('[data-cinema-output-rendered="false"]')).not.toBeNull()
    expect(host?.textContent).toContain('Camera resources (1)')

    const worldFrame = [...callbacks.entries()][0]
    expect(worldFrame).toBeDefined()
    callbacks.delete(worldFrame[0])
    await act(async () => worldFrame[1](33.34))
    expect(host?.querySelector('[data-cinema-output-rendered="true"]')).not.toBeNull()
    expect(gl.__calls.drawCount).toBeGreaterThan(shaderDrawCount)
    expect(getContext).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(1)
  }, 15_000)

  it('shows only renderer-supported Inspector controls and refreshes them on production preset switches', async () => {
    const shaderNode = CINEMA_SHADER_REFERENCE_COMPOSITION.nodes.find(node => node.family === 'shader')
    const unsupportedMaster = CINEMA_SHADER_REFERENCE_COMPOSITION.masterParameters.find(parameter => parameter.label === 'Master Glow')
    expect(shaderNode).toBeDefined()
    expect(unsupportedMaster).toBeDefined()
    const preservedMasterValue = unsupportedMaster
      ? CINEMA_SHADER_REFERENCE_COMPOSITION.masterValues[unsupportedMaster.id]
      : undefined

    expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_SHADER_REFERENCE_COMPOSITION.id).ok).toBe(true)
    expect(useCinemaStore.getState().setCinemaEditorSelection(
      CINEMA_SHADER_REFERENCE_COMPOSITION.id,
      shaderNode!.id,
    ).ok).toBe(true)

    await act(async () => root?.render(<ComposerSelectionHarness />))
    expect(host?.textContent).toContain('Master Appearance')
    expect(host?.textContent).not.toContain('Camera resources (')
    expect(host?.textContent).toContain('Master Intensity')
    expect(host?.textContent).toContain('Master Motion')
    expect(host?.textContent).not.toContain('Master Glow')
    expect(host?.textContent).not.toContain('Master Trail Decay')
    expect(host?.textContent).not.toContain('Master Particle Density')
    expect(host?.textContent).toContain('Glow')

    const shaderAfterRender = useCinemaStore.getState().compositions.find(
      composition => composition.id === CINEMA_SHADER_REFERENCE_COMPOSITION.id,
    )
    expect(unsupportedMaster && shaderAfterRender?.masterValues[unsupportedMaster.id]).toEqual(preservedMasterValue)

    await act(async () => {
      expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_FOUNDATION_COMPOSITION.id).ok).toBe(true)
      expect(useCinemaStore.getState().setCinemaEditorSelection(
        CINEMA_FOUNDATION_COMPOSITION.id,
        CINEMA_FOUNDATION_GRADIENT_NODE_ID,
      ).ok).toBe(true)
    })

    expect(host?.textContent).not.toContain('Master Appearance')
    expect(host?.textContent).not.toContain('Master Intensity')
    expect(host?.textContent).not.toContain('Camera resources (')
    expect(host?.textContent).toContain('Angle')
    expect(host?.textContent).toContain('Opacity')

    const worldNode = CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.nodes.find(node => node.family === 'procedural')
    expect(worldNode).toBeDefined()
    await act(async () => {
      expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.id).ok).toBe(true)
      expect(useCinemaStore.getState().setCinemaEditorSelection(
        CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.id,
        worldNode!.id,
      ).ok).toBe(true)
    })

    expect(host?.textContent).not.toContain('Master Appearance')
    expect(host?.textContent).toContain('Camera resources (1)')

    await act(async () => {
      expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_SHADER_REFERENCE_COMPOSITION.id).ok).toBe(true)
      expect(useCinemaStore.getState().setCinemaEditorSelection(
        CINEMA_SHADER_REFERENCE_COMPOSITION.id,
        shaderNode!.id,
      ).ok).toBe(true)
    })
    expect(host?.textContent).toContain('Master Appearance')
    expect(host?.textContent).toContain('Master Intensity')
    expect(host?.textContent).not.toContain('Camera resources (')
  })

  it('shows semantic Background for Event Horizon and hot-applies it without rebuilding renderer resources', async () => {
    const gl = createCinemaMockWebGL()
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { callbacks.delete(id) }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => (
      kind === 'webgl2' ? gl : null
    ) as RenderingContext | null)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0, toJSON: () => ({}),
    })

    const eventHorizonNode = CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.nodes.find(node => node.family === 'procedural')
    expect(eventHorizonNode).toBeDefined()
    expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.id).ok).toBe(true)
    expect(useCinemaStore.getState().setCinemaEditorSelection(
      CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.id,
      eventHorizonNode!.id,
    ).ok).toBe(true)

    await act(async () => root?.render(<ProductionLiveControlHarness />))
    expect(host?.querySelector<HTMLButtonElement>('.rv-ctrl-palette-swatch[aria-label="Primary"]')).not.toBeNull()
    expect(host?.querySelector<HTMLButtonElement>('.rv-ctrl-palette-swatch[aria-label="Secondary"]')).not.toBeNull()
    expect(host?.querySelector<HTMLButtonElement>('.rv-ctrl-palette-swatch[aria-label="Accent"]')).not.toBeNull()
    const background = host?.querySelector<HTMLButtonElement>('.rv-ctrl-palette-swatch[aria-label="Background"]')
    expect(background).not.toBeNull()
    expect(host?.querySelector<HTMLButtonElement>('.rv-ctrl-palette-swatch[aria-label="Highlight"]')).toBeNull()
    expect(host?.querySelector<HTMLButtonElement>('.rv-ctrl-palette-swatch[aria-label="Foreground"]')).toBeNull()
    const programsBeforeEdit = gl.__calls.createdPrograms

    await act(async () => background?.click())
    const colorHex = document.body.querySelector<HTMLInputElement>('.rv-ctrl-palette-popover-hex')
    expect(colorHex).not.toBeNull()
    await act(async () => {
      if (!colorHex) return
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(colorHex, '#ff0000')
      colorHex.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(gl.__calls.createdPrograms).toBe(programsBeforeEdit)

    const backgroundSchema = useCinemaStore.getState().definitions
      .find(definition => definition.id === eventHorizonNode!.typeId)
      ?.definition.parameters.find(parameter => parameter.label === 'Background Color')
    const activeInstanceId = useCinemaStore.getState().activeInstanceId
    const activeInstance = useCinemaStore.getState().instances.find(instance => instance.id === activeInstanceId)
    const eventHorizonOverride = activeInstance?.nodeOverrides.find(override => override.nodeId === eventHorizonNode!.id)
    expect(backgroundSchema && eventHorizonOverride?.values[backgroundSchema.id]).toEqual([1, 0, 0, 1])

    const scheduled = [...callbacks.entries()][0]
    expect(scheduled).toBeDefined()
    const uniformCallsBeforeFrame = vi.mocked(gl.uniform3f).mock.calls.length
    callbacks.delete(scheduled[0])
    await act(async () => scheduled[1](16.67))
    const newUniformCalls = vi.mocked(gl.uniform3f).mock.calls.slice(uniformCallsBeforeFrame)
    expect(newUniformCalls.some(([, red, green, blue]) => (
      Math.abs(red - 1) < 0.0001
      && Math.abs(green) < 0.0001
      && Math.abs(blue) < 0.0001
    ))).toBe(true)
    expect(gl.__calls.createdPrograms).toBe(programsBeforeEdit)
  })

  it('shows only mode-aware camera controls and hot-applies Field of View through the production Cinema runtime', async () => {
    const gl = createCinemaMockWebGL()
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { callbacks.delete(id) }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => (
      kind === 'webgl2' ? gl : null
    ) as RenderingContext | null)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0, toJSON: () => ({}),
    })
    expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.id).ok).toBe(true)

    await act(async () => root?.render(<ProductionLiveControlHarness />))
    expect(host?.textContent).not.toContain('Master Appearance')
    const cameraResources = [...(host?.querySelectorAll<HTMLButtonElement>('.drc-header') ?? [])]
      .find(button => button.textContent?.includes('Camera resources (1)'))
    expect(cameraResources).toBeDefined()
    await act(async () => cameraResources?.click())
    const cameraHeader = [...(host?.querySelectorAll<HTMLButtonElement>('.drc-header') ?? [])]
      .find(button => button.textContent?.includes('Event Horizon Shared Camera'))
    expect(cameraHeader).toBeDefined()
    await act(async () => cameraHeader?.click())

    const cameraBody = cameraHeader?.nextElementSibling as HTMLElement | null
    expect(cameraBody?.textContent).toContain('Orbit Radius')
    expect(cameraBody?.textContent).toContain('Orbit Speed')
    expect(cameraBody?.textContent).toContain('Orbit Elevation')
    expect(cameraBody?.textContent).not.toContain('Dolly Range')
    expect(cameraBody?.textContent).not.toContain('Dolly Speed')
    expect(cameraBody?.textContent).not.toContain('Fly Speed')
    expect(cameraBody?.textContent).not.toContain('Handheld')
    expect(cameraBody?.textContent).not.toContain('Near Plane')
    expect(cameraBody?.textContent).not.toContain('Far Plane')
    expect(cameraBody?.textContent).not.toContain('Focus Distance')
    expect(cameraBody?.textContent).not.toContain('Aperture')

    const fovLabel = [...(cameraBody?.querySelectorAll<HTMLLabelElement>('label') ?? [])]
      .find(label => label.textContent?.trim() === 'Field of View')
    const fovInput = fovLabel?.htmlFor
      ? document.getElementById(fovLabel.htmlFor) as HTMLInputElement | null
      : null
    expect(fovInput?.type).toBe('range')
    const initialPrograms = gl.__calls.createdPrograms
    const getUniformLocationMock = vi.mocked(gl.getUniformLocation)
    const fovUniformIndex = getUniformLocationMock.mock.calls.findIndex(([, name]) => name === 'uCameraFieldOfView')
    expect(fovUniformIndex).toBeGreaterThanOrEqual(0)
    const fovLocation = getUniformLocationMock.mock.results[fovUniformIndex]?.value
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    expect(valueSetter).toBeDefined()

    await act(async () => {
      valueSetter?.call(fovInput, '72')
      fovInput?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(gl.__calls.createdPrograms).toBe(initialPrograms)
    const activeInstanceId = useCinemaStore.getState().activeInstanceId
    const activeInstance = useCinemaStore.getState().instances.find(instance => instance.id === activeInstanceId)
    expect(activeInstance?.cameraOverrides[0]?.values).toMatchObject({ 'fov-degrees': 72 })

    const scheduled = [...callbacks.entries()][0]
    expect(scheduled).toBeDefined()
    const initialDrawCount = gl.__calls.drawCount
    callbacks.delete(scheduled[0])
    await act(async () => scheduled[1](16.67))
    expect(gl.uniform1f).toHaveBeenCalledWith(fovLocation, 72)
    expect(gl.__calls.createdPrograms).toBe(initialPrograms)
    expect(gl.__calls.drawCount).toBeGreaterThan(initialDrawCount)
    expect(host?.querySelector('[data-cinema-output-rendered="true"]')).not.toBeNull()
  })

  it('samples the high-precision audio clock on every production Cinema RAF without a React rerender', async () => {
    const gl = createCinemaMockWebGL()
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    })
    const cancelAnimationFrame = vi.fn((id: number) => { callbacks.delete(id) })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => (
      kind === 'webgl2' ? gl : null
    ) as RenderingContext | null)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0, toJSON: () => ({}),
    })
    let audioTime = 0
    const getAudioTime = vi.fn(() => audioTime)
    const runtimeFrameConfig: CinemaWorkspaceRuntimeFrameConfig = {
      analyser: null,
      getAudioTime,
      getMusicIntelligence: () => DEFAULT_MI_FRAME,
      durationSec: 120,
      trackId: 'track-a',
      playing: true,
      paused: false,
      bpm: 120,
    }

    await act(async () => root?.render(
      <ProductionSelectionHarness retire={vi.fn()} runtimeFrameConfig={runtimeFrameConfig} />,
    ))
    for (const [index, timestamp] of [16.67, 33.34, 50.01].entries()) {
      audioTime = index * 0.01667
      const scheduled = [...callbacks.entries()][0]
      expect(scheduled).toBeDefined()
      callbacks.delete(scheduled[0])
      await act(async () => scheduled[1](timestamp))
    }

    expect(useReactStore.getState().activeReactEngineId).toBe('cinema')
    expect(getAudioTime).toHaveBeenCalledTimes(3)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(4)
    await act(async () => root?.unmount())
    root = null
    expect(cancelAnimationFrame).toHaveBeenCalledOnce()
    expect(callbacks.size).toBe(0)
  })

  it('starts in Cinema, hides retired identities, and keeps one runtime across navigation away and re-entry', async () => {
    const retire = vi.fn()
    const onCanvasReady = vi.fn()
    const gl = createCinemaMockWebGL()
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    })
    const cancelAnimationFrame = vi.fn((id: number) => { callbacks.delete(id) })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => (
      kind === 'webgl2' ? gl : null
    ) as RenderingContext | null)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 960,
      height: 540,
      top: 0,
      left: 0,
      right: 960,
      bottom: 540,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    await act(async () => root?.render(<ProductionSelectionHarness retire={retire} onCanvasReady={onCanvasReady} />))

    const state = useReactStore.getState()
    const canvas = host?.querySelector<HTMLCanvasElement>('[data-cinema-output-canvas="true"]') ?? null
    expect(state.activeReactEngineId).toBe('cinema')
    expect(state.activeReactPresetId).toBeNull()
    expect(host?.querySelector('[data-cinema-workspace="runtime"]')).not.toBeNull()
    expect(canvas).not.toBeNull()
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'cinema',
      activeOwnerCount: 1,
      phase: 'stable',
    })
    expect(getContext).toHaveBeenCalledTimes(1)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(1)
    expect(onCanvasReady).toHaveBeenCalledWith(canvas)

    const runtimeFrame = [...callbacks.entries()][0]
    callbacks.delete(runtimeFrame[0])
    await act(async () => runtimeFrame[1](16.67))
    expect(gl.__calls.drawCount).toBe(2)
    expect(host?.querySelector('[data-cinema-output-rendered="true"]')).not.toBeNull()
    expect(host?.querySelector('.rv-cinema-workspace__stage-card')).toBeNull()

    const trigger = host?.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
    expect(trigger).not.toBeNull()
    await act(async () => trigger?.click())
    const options = [...(host?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
    expect(options.some(option => option.textContent?.includes('Shader Pads'))).toBe(false)
    expect(options.some(option => option.textContent?.includes('Cinematic Worlds'))).toBe(false)
    const soundDrawingOption = options.find(option => option.textContent?.includes('Sound Drawing'))
    expect(soundDrawingOption).not.toBeUndefined()
    await act(async () => soundDrawingOption?.click())

    expect(useReactStore.getState().activeReactEngineId).toBe('oscilloscope')
    expect(host?.querySelector('[data-legacy-engine="oscilloscope"]')).not.toBeNull()
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(0)
    expect(onCanvasReady).toHaveBeenLastCalledWith(null)
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'oscilloscope',
      activeOwnerCount: 1,
      phase: 'stable',
    })
    expect(retire).not.toHaveBeenCalled()

    const reentryTrigger = host?.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
    expect(reentryTrigger).not.toBeNull()
    await act(async () => reentryTrigger?.click())
    const reentryOptions = [...(host?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
    const cinemaOption = reentryOptions.find(option => option.textContent?.includes('Cinema'))
    expect(cinemaOption).not.toBeUndefined()
    await act(async () => cinemaOption?.click())

    const reenteredCanvas = host?.querySelector<HTMLCanvasElement>('[data-cinema-output-canvas="true"]') ?? null
    expect(useReactStore.getState().activeReactEngineId).toBe('cinema')
    expect(reenteredCanvas).not.toBeNull()
    expect(getContext).toHaveBeenCalledTimes(2)
    expect(callbacks.size).toBe(1)
    expect(onCanvasReady).toHaveBeenLastCalledWith(reenteredCanvas)
    expect(retire).toHaveBeenCalledTimes(1)
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'cinema',
      activeOwnerCount: 1,
      phase: 'stable',
    })

    const reentryFrame = [...callbacks.entries()][0]
    expect(reentryFrame).toBeDefined()
    callbacks.delete(reentryFrame[0])
    await act(async () => reentryFrame[1](33.34))
    expect(host?.querySelector('[data-cinema-output-rendered="true"]')).not.toBeNull()
    expect(callbacks.size).toBe(1)
  })

  it('surfaces the Stage 19 Composer through the canonical Cinema store and production workspace', async () => {
    const selected = useCinemaStore.getState().setActiveCinemaComposition(CINEMA_STAGE16_REFERENCE_COMPOSITION_ID)
    expect(selected.ok).toBe(true)

    await act(async () => root?.render(
      <CinemaWorkspace surface="panel" frameBridge={productionFrameBridge} />,
    ))

    expect(useCinemaStore.getState().activeCompositionId).toBe(CINEMA_STAGE16_REFERENCE_COMPOSITION_ID)
    expect(host?.textContent).toContain('Engine Mode')
    expect(host?.textContent).toContain('Shaders')
    expect(host?.textContent).toContain('Worlds')
    const rendererFamilies = host?.querySelector<HTMLElement>('[aria-label="Cinema renderer families"]') ?? null
    expect(rendererFamilies).not.toBeNull()
    expect(rendererFamilies?.querySelector('button')).toBeNull()
    expect(host?.textContent).toContain('this view is reference-only')
    expect(host?.textContent).not.toContain('Cinema Runtime')
  })

  it('exposes the moved runtime summary through the compact Rendered Diagnostics group', async () => {
    await act(async () => root?.render(
      <CinemaRenderedDiagnostics frameBridge={productionFrameBridge} runtimeSnapshot={null} />,
    ))

    expect(host?.textContent).toContain('Rendered Diagnostics')
    expect(host?.textContent).toContain('Active composition')
    expect(host?.textContent).toContain('Cinema runtime owns the stage')
  })

  it('enters the Cinema workspace with one preset selector and live Design overrides', async () => {
    await act(async () => root?.render(<ComposerSelectionHarness />))
    const trigger = host?.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
    await act(async () => trigger?.click())
    const cinemaOption = [...(host?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
      .find(option => option.textContent?.includes('Cinema'))
    await act(async () => cinemaOption?.click())

    expect(useReactStore.getState().activeReactEngineId).toBe('cinema')
    expect(host?.querySelector('[aria-label="Cinema presets"]')).not.toBeNull()
    expect(host?.textContent).toContain('Layers')
    expect(host?.textContent).toContain('Master Appearance')
    expect(host?.textContent).not.toContain('Find Effects')
    expect(host?.textContent).not.toContain('New Composition')
    expect(host?.textContent).not.toContain('Cinema Composer')

    const presetButton = host?.querySelector<HTMLButtonElement>('.rv-cinema-preset-tile')
    await act(async () => presetButton?.click())
    const layerButton = host?.querySelector<HTMLButtonElement>('.rv-cinema-layer-tree button')
    await act(async () => layerButton?.click())
    const swatch = host?.querySelector<HTMLButtonElement>('.rv-ctrl-palette-swatch')
    expect(swatch).not.toBeNull()
    await act(async () => swatch?.click())
    const colorHex = document.body.querySelector<HTMLInputElement>('.rv-ctrl-palette-popover-hex')
    expect(colorHex).not.toBeNull()
    await act(async () => {
      if (!colorHex) return
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(colorHex, '#123456')
      colorHex.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(useCinemaStore.getState().instances.some(instance => instance.metadata?.reactLiveOverride === true)).toBe(true)
  })

  it('recomputes consumed controls through production preset selection without stale sliders or persisted-value loss', async () => {
    await act(async () => root?.render(<ComposerSelectionHarness />))
    const trigger = host?.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
    await act(async () => trigger?.click())
    const cinemaOption = [...(host?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
      .find(option => option.textContent?.includes('Cinema'))
    await act(async () => cinemaOption?.click())

    const presetButton = (name: string) => [...(host?.querySelectorAll<HTMLButtonElement>('.rv-cinema-preset-tile') ?? [])]
      .find(button => button.querySelector('.rv-cinema-preset-tile-name')?.textContent === name)
    const selectedLayerText = () => [...(host?.querySelectorAll<HTMLButtonElement>('.drc-header') ?? [])]
      .find(button => button.textContent?.includes('Selected Layer'))
      ?.closest<HTMLElement>('.drc-group')?.textContent ?? ''

    const singularity = presetButton('Singularity Crown')
    expect(singularity).toBeDefined()
    await act(async () => singularity?.click())
    const singularityComposition = useCinemaStore.getState().compositions.find(composition => composition.metadata.name === 'Singularity Crown')
    const singularityNode = singularityComposition?.nodes.find(node => node.family === 'procedural')
    expect(singularityNode).toBeDefined()
    const preservedValues = singularityNode?.parameterValues

    expect(selectedLayerText()).toContain('Core Radius')
    expect(selectedLayerText()).not.toContain('Intensity')
    expect(selectedLayerText()).not.toContain('Motion')
    expect(selectedLayerText()).not.toContain('Glow')
    expect(selectedLayerText()).not.toContain('Environment Depth')
    expect(selectedLayerText()).not.toContain('Bloom Boost')

    const crystal = presetButton('Minimal Skeleton')
    expect(crystal).toBeDefined()
    await act(async () => crystal?.click())
    expect(selectedLayerText()).toContain('Intensity')
    expect(selectedLayerText()).toContain('Motion')
    expect(selectedLayerText()).toContain('Glow')
    expect(selectedLayerText()).not.toContain('Bass Reactivity')
    expect(selectedLayerText()).not.toContain('Particle Density')
    expect(selectedLayerText()).toContain('Environment Fog')
    expect(selectedLayerText()).toContain('Material Glow')
    expect(selectedLayerText()).not.toContain('Environment Depth')
    expect(selectedLayerText()).not.toContain('Visual Dna Profile')

    await act(async () => presetButton('Singularity Crown')?.click())
    expect(selectedLayerText()).not.toContain('Intensity')
    expect(selectedLayerText()).not.toContain('Motion')
    expect(selectedLayerText()).not.toContain('Environment Fog')
    const singularityAfterSwitch = useCinemaStore.getState().compositions.find(composition => composition.metadata.name === 'Singularity Crown')
      ?.nodes.find(node => node.family === 'procedural')
    expect(singularityAfterSwitch?.parameterValues).toEqual(preservedValues)
  })

  it('configures the adopting world 3D object through the real Cinema preset and Inspector path', async () => {
    await act(async () => root?.render(<ComposerSelectionHarness />))
    const engineTrigger = host?.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
    await act(async () => engineTrigger?.click())
    const cinemaOption = [...(host?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
      .find(option => option.textContent?.includes('Cinema'))
    await act(async () => cinemaOption?.click())

    const orbital = [...(host?.querySelectorAll<HTMLButtonElement>('.rv-cinema-preset-tile') ?? [])]
      .find(button => button.querySelector('.rv-cinema-preset-tile-name')?.textContent === 'Orbital Prism Array')
    expect(orbital).toBeDefined()
    await act(async () => orbital?.click())

    const selectedLayer = [...(host?.querySelectorAll<HTMLButtonElement>('.drc-header') ?? [])]
      .find(button => button.textContent?.includes('Selected Layer'))
      ?.closest<HTMLElement>('.drc-group') ?? null
    expect(selectedLayer?.textContent).toContain('3D Object')
    expect(selectedLayer?.textContent).toContain('Source')
    expect(selectedLayer?.textContent).toContain('Geometry')
    expect(selectedLayer?.textContent).toContain('Transform')
    expect(selectedLayer?.textContent).toContain('Appearance')
    expect(selectedLayer?.textContent).toContain('Source Type')
    expect(selectedLayer?.textContent).toContain('Text')
    expect(selectedLayer?.textContent).toContain('Font')
    expect(selectedLayer?.textContent).not.toContain('SVG Source')

    const sourceType = selectedLayer?.querySelector<HTMLButtonElement>('[role="combobox"][aria-label="Source Type"]')
    expect(sourceType).not.toBeNull()
    await act(async () => sourceType?.click())
    const svgOption = [...document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')]
      .find(option => option.textContent?.trim() === 'SVG')
    expect(svgOption).toBeDefined()
    await act(async () => svgOption?.click())

    expect(selectedLayer?.textContent).toContain('SVG Source')
    expect(selectedLayer?.textContent).not.toContain('Font')
    const activeComposition = useCinemaStore.getState().compositions.find(composition => composition.metadata.name === 'Orbital Prism Array')
    const worldNode = activeComposition?.nodes.find(node => node.family === 'procedural')
    const liveInstance = useCinemaStore.getState().instances.find(instance => instance.compositionId === activeComposition?.id && instance.metadata?.reactLiveOverride === true)
    const sourceOverride = liveInstance?.nodeOverrides.find(override => override.nodeId === worldNode?.id)?.values[CINEMA_3D_OBJECT_PARAMETER_IDS.sourceType]
    expect(sourceOverride).toBeTruthy()
  })

  it('does not render an empty Palette group when the selected production node exposes no consumed colors', async () => {
    const composition = useCinemaStore.getState().compositions.find(candidate => candidate.id === CINEMA_STAGE16_REFERENCE_COMPOSITION_ID)
    const effect = composition?.nodes.find(node => node.family === 'effect')
    expect(composition).toBeDefined()
    expect(effect).toBeDefined()
    expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_STAGE16_REFERENCE_COMPOSITION_ID).ok).toBe(true)
    expect(useCinemaStore.getState().setCinemaEditorSelection(CINEMA_STAGE16_REFERENCE_COMPOSITION_ID, effect!.id).ok).toBe(true)

    await act(async () => root?.render(<CinemaInspectorPanel />))
    const headers = [...(host?.querySelectorAll<HTMLButtonElement>('.drc-header') ?? [])].map(button => button.textContent?.trim())
    expect(headers.some(header => header?.includes('Palette'))).toBe(false)
    expect(headers.some(header => header?.includes('Selected Effect'))).toBe(true)
  })

  it('keeps only one active Cinema context and loop through a Strict Mode effect replay', async () => {
    const gl = createCinemaMockWebGL()
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    })
    const cancelAnimationFrame = vi.fn((id: number) => { callbacks.delete(id) })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => (
      kind === 'webgl2' ? gl : null
    ) as RenderingContext | null)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 640,
      height: 360,
      top: 0,
      left: 0,
      right: 640,
      bottom: 360,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    await act(async () => root?.render(
      <React.StrictMode>
        <CinemaWorkspace surface="stage" frameBridge={productionFrameBridge} />
      </React.StrictMode>,
    ))

    expect(getContext).toHaveBeenCalledTimes(2)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2)
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(1)
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'cinema',
      activeOwnerCount: 1,
      phase: 'stable',
    })
    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
      activeCount: 1,
      duplicateOwnershipCount: 0,
      activeLiveByEngine: { cinema: 1 },
    })
  })

  it('returns structured diagnostics and safe output for a stale active composition reference', () => {
    const model = resolveCinemaWorkspaceModel({
      activeCompositionId: 'cinema.composition.missing' as never,
      activeInstanceId: null,
      compositions: [],
      instances: [],
      lastDiagnostics: createCinemaDiagnosticSnapshot([]),
    })

    expect(model.activeComposition).toBeNull()
    expect(model.runtimeAvailable).toBe(true)
    expect(model.statusLabel).toBe('Needs attention')
    expect(model.diagnostics.diagnostics.some(diagnostic => (
      diagnostic.code === 'CINEMA_VALIDATION_FAILED'
      && diagnostic.attribution?.compositionId === 'cinema.composition.missing'
    ))).toBe(true)
    expect(model.diagnostics.diagnostics.some(diagnostic => (
      diagnostic.code === 'CINEMA_SAFE_OUTPUT_ACTIVE'
    ))).toBe(false)
  })
})
