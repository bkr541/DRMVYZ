/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../stores/reactStore'
import { useContextualHelpStore } from '../../../features/contextualHelp/contextualHelpStore'
import { CANVAS_REACT_CONTROL_GROUPS, CanvasEngineFxPanel, CanvasEngineSurface } from './ReactCanvasEngineShell'

vi.mock('../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => ({
    currentTrackId: null,
    currentAnalysis: null,
    duration: 0,
    currentTime: 12.5,
    getCurrentTime: () => 12.5,
  }),
}))

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  useContextualHelpStore.setState({ infoEnabled: true })
  useReactStore.getState().resetReactView()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('CANVAS right-panel control contract', () => {
  it('switches the active surface through the explicit renderer-kind contract', () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    const originalRequestAnimationFrame = window.requestAnimationFrame
    const originalCancelAnimationFrame = window.cancelAnimationFrame
    const fracturesContext = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      setTransform: vi.fn(),
      clearRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    HTMLCanvasElement.prototype.getContext = vi.fn(function getContext(this: HTMLCanvasElement, contextId: string) {
      return contextId === '2d' && this.classList.contains('rv-canvas-fractures-renderer-layer')
        ? fracturesContext
        : null
    }) as typeof HTMLCanvasElement.prototype.getContext
    window.requestAnimationFrame = vi.fn(() => 1)
    window.cancelAnimationFrame = vi.fn()

    try {
      useReactStore.setState({
        canvasMediaItems: [{
          id: 'fractures-contract-image',
          name: 'Fractures Contract Image',
          type: 'image',
          objectUrl: 'data:image/png;base64,AA==',
          createdAt: '2026-08-04T00:00:00.000Z',
          mediaRevision: 4,
        }],
        activeCanvasMediaId: 'fractures-contract-image',
      })
      useReactStore.getState().selectCanvasPreset('canvas-fractures')
      act(() => root.render(<CanvasEngineSurface isPlaying={false} isPaused />))
      expect(host.querySelector('[data-renderer-kind="fragmentCollage"]')).not.toBeNull()
      expect(host.querySelector('canvas.rv-canvas-fractures-renderer-layer[data-renderer-backend="canvas2d"]')).not.toBeNull()
      const fracturesCanvas = host.querySelector<HTMLCanvasElement>('canvas.rv-canvas-fractures-renderer-layer')
      expect(fracturesCanvas?.dataset.fracturesSourcePath).toBe('raster-image')
      expect(fracturesCanvas?.dataset.fracturesTopologyId).toBeTruthy()
      expect(fracturesCanvas?.dataset.fracturesLayoutId).toBeTruthy()
      expect(fracturesCanvas?.dataset.fracturesPlacementMode).toBe('balanced')
      expect(fracturesCanvas?.dataset.fracturesTransitionProgress).toBe('1')

      act(() => useReactStore.getState().selectCanvasPreset('canvas-particle-aura'))
      expect(host.querySelector('[data-renderer-kind="particleAura"]')).not.toBeNull()

      act(() => useReactStore.getState().selectCanvasPreset('canvas-clean-playback'))
      expect(host.querySelector('[data-renderer-kind="standard"]')).not.toBeNull()
      expect(host.querySelector('canvas.rv-canvas-fractures-renderer-layer')).toBeNull()
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext
      window.requestAnimationFrame = originalRequestAnimationFrame
      window.cancelAnimationFrame = originalCancelAnimationFrame
    }
  })

  it('exposes Particle Quality with the other particle controls', () => {
    const particleGroup = CANVAS_REACT_CONTROL_GROUPS.find(group => group.title === 'Motion + Particles')

    expect(particleGroup?.controls).toEqual(expect.arrayContaining([
      'particleDensity',
      'particleSize',
      'particleColorMode',
      'particleQuality',
    ]))
  })

  it('renders Display before orchestration and CANVAS React Controls', () => {
    act(() => root.render(<CanvasEngineFxPanel />))
    const labels = [...host.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .map(button => button.textContent?.trim())
    const sourceIndex = labels.indexOf('CANVAS Source Link')
    const displayIndex = labels.indexOf('Display')
    const orchestrationIndex = labels.indexOf('Performance Orchestration')
    const reactControlsIndex = labels.indexOf('CANVAS React Controls')
    const timingIndex = labels.indexOf('Video Timing')

    expect(sourceIndex).toBeGreaterThanOrEqual(0)
    expect(displayIndex).toBeGreaterThan(sourceIndex)
    expect(orchestrationIndex).toBeGreaterThan(displayIndex)
    expect(reactControlsIndex).toBeGreaterThan(orchestrationIndex)
    expect(timingIndex).toBeGreaterThan(reactControlsIndex)
  })

  it('shows the Fractures-only groups, canonical controls, and help ownership only when selected', () => {
    useReactStore.getState().selectCanvasPreset('canvas-fractures')
    act(() => root.render(<CanvasEngineFxPanel />))

    const labels = [...host.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .map(button => button.textContent?.trim())
    expect(labels).toEqual(expect.arrayContaining([
      'Fractures Controls',
      'Structure',
      'Motion',
      'Effects',
      'Audio',
    ]))
    expect(labels).not.toContain('CANVAS React Controls')

    const effectsGroup = [...host.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .find(button => button.textContent?.trim() === 'Effects')
    act(() => effectsGroup?.click())

    const helpIds = [...host.querySelectorAll<HTMLButtonElement>('.drm-help-info-trigger')]
      .map(button => button.dataset.helpId)
    expect(helpIds).toEqual(expect.arrayContaining([
      'react.canvas.fractures.structure.intensity',
      'react.canvas.fractures.structure.mode',
      'react.canvas.fractures.structure.anchorMode',
      'react.canvas.fractures.structure.topologyInterval',
      'react.canvas.fractures.motion.transition',
      'react.canvas.fractures.motion.refracture',
      'react.canvas.fractures.effects.colorSource',
      'react.canvas.fractures.effects.roleWeight.anchor',
    ]))

    const intensityLabel = [...host.querySelectorAll<HTMLLabelElement>('label')]
      .find(label => label.textContent === 'Fracture Intensity')
    const intensityInput = intensityLabel?.htmlFor
      ? host.ownerDocument.getElementById(intensityLabel.htmlFor) as HTMLInputElement | null
      : null
    expect(intensityInput).not.toBeNull()
    act(() => {
      if (!intensityInput) return
      intensityInput.value = '0.73'
      intensityInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(useReactStore.getState().canvasPresetSettings.fractureIntensity).toBe(0.73)

    act(() => {
      useReactStore.getState().selectCanvasPreset('canvas-clean-playback')
    })
    const standardLabels = [...host.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .map(button => button.textContent?.trim())
    expect(standardLabels).toContain('CANVAS React Controls')
    expect(standardLabels).not.toContain('Fractures Controls')
  })

  it('wires Fractures manual commands into persisted canonical state', () => {
    useReactStore.getState().selectCanvasPreset('canvas-fractures')
    act(() => root.render(<CanvasEngineFxPanel />))

    const findAction = (label: string) => {
      const labelNode = [...host.querySelectorAll<HTMLElement>('.rv-ctrl-label')]
        .find(node => node.textContent?.trim() === label)
      return labelNode?.closest('.rv-canvas-react-control-help')
        ?.querySelector<HTMLButtonElement>('button.rv-canvas-fractures-action') ?? null
    }

    const initial = useReactStore.getState().canvasPresetSettings
    act(() => findAction('Shuffle Layout')?.click())
    let settings = useReactStore.getState().canvasPresetSettings
    expect(settings).toMatchObject({
      fractureTopologyRevision: initial.fractureTopologyRevision,
      fractureLayoutRevision: initial.fractureLayoutRevision + 1,
      fractureLastManualAction: 'shuffleLayout',
      fractureManualTransitionPositionSec: 12.5,
      fractureReturnToAnchor: false,
    })

    act(() => findAction('Refracture')?.click())
    settings = useReactStore.getState().canvasPresetSettings
    expect(settings).toMatchObject({
      fractureTopologyRevision: initial.fractureTopologyRevision + 1,
      fractureLayoutRevision: initial.fractureLayoutRevision + 2,
      fractureLastManualAction: 'refracture',
      fractureManualTransitionPositionSec: 12.5,
    })

    act(() => findAction('Return to Anchor')?.click())
    settings = useReactStore.getState().canvasPresetSettings
    expect(settings).toMatchObject({
      fractureTopologyRevision: initial.fractureTopologyRevision + 1,
      fractureLayoutRevision: initial.fractureLayoutRevision + 3,
      fractureLastManualAction: 'returnToAnchor',
      fractureReturnToAnchor: true,
    })

    const freezeLabel = [...host.querySelectorAll<HTMLElement>('.rv-ctrl-label')]
      .find(node => node.textContent?.trim() === 'Freeze Layout')
    const freezeToggle = freezeLabel?.closest('.rv-canvas-react-control-help')
      ?.querySelector<HTMLButtonElement>('button.rv-ctrl-toggle') ?? null
    act(() => freezeToggle?.click())
    settings = useReactStore.getState().canvasPresetSettings
    expect(settings).toMatchObject({
      fractureFreezeLayout: true,
      fractureFreezePositionSec: 12.5,
    })

    const liveFreezeToggle = [...host.querySelectorAll<HTMLElement>('.rv-ctrl-label')]
      .find(node => node.textContent?.trim() === 'Freeze Layout')
      ?.closest('.rv-canvas-react-control-help')
      ?.querySelector<HTMLButtonElement>('button.rv-ctrl-toggle') ?? null
    act(() => liveFreezeToggle?.click())
    settings = useReactStore.getState().canvasPresetSettings
    expect(settings).toMatchObject({
      fractureFreezeLayout: false,
      fractureLastManualAction: 'releaseFreeze',
      fractureManualTransitionPositionSec: 12.5,
    })
  })

  it('places explicit info triggers beside CANVAS controls without changing the control contract', () => {
    act(() => root.render(<CanvasEngineFxPanel />))

    const helpIds = [...host.querySelectorAll<HTMLButtonElement>('.drm-help-info-trigger')]
      .map(button => button.dataset.helpId)

    expect(helpIds).toEqual(expect.arrayContaining([
      'react.canvas.sourceAndDisplay.sourceLink.autoSelect',
      'react.canvas.sourceAndDisplay.display.fitMode',
      'react.canvas.sourceAndDisplay.display.scale',
      'react.canvas.sourceAndDisplay.display.positionX',
      'react.canvas.sourceAndDisplay.display.positionY',
      'react.canvas.sourceAndDisplay.display.rotation',
      'react.canvas.sourceAndDisplay.display.outputOpacity',
      'react.canvas.performanceOrchestration.autoPerformance',
      'react.canvas.performanceOrchestration.performanceShow',
      'react.canvas.performanceOrchestration.autoRole',
      'react.canvas.performanceOrchestration.composition',
      'react.canvas.performanceOrchestration.layerComplexity',
      'react.canvas.performanceOrchestration.transitionDensity',
      'react.canvas.performanceOrchestration.effectIntensity',
      'react.canvas.performanceOrchestration.motionIntensity',
      'react.canvas.performanceOrchestration.cutDensity',
      'react.canvas.reactControls.sourceAndReactivity.drySourceMix',
      'react.canvas.reactControls.sourceAndReactivity.visualIntensity',
      'react.canvas.reactControls.sourceAndReactivity.bassReactivity',
      'react.canvas.reactControls.sourceAndReactivity.beatPulse',
      'react.canvas.reactControls.fx.glowAmount',
      'react.canvas.reactControls.fx.trailAmount',
      'react.canvas.reactControls.fx.rgbSplit',
      'react.canvas.reactControls.fx.glitchAmount',
      'react.canvas.reactControls.fx.stutterRate',
      'react.canvas.reactControls.fx.lumaThreshold',
      'react.canvas.videoTiming.triggerOn',
      'react.canvas.videoTiming.clipStartSeconds',
      'react.canvas.videoTiming.clipEndSeconds',
      'react.canvas.videoTiming.loopClipRange',
      'react.canvas.videoTiming.loopFullVideo',
      'react.canvas.videoTiming.restartOnDrop',
      'react.canvas.videoTiming.restartOnSectionChange',
      'react.canvas.videoTiming.restartOnManualPresetChange',
      'react.canvas.videoTiming.sectionTriggerMapping.overview',
    ]))

    const motionGroup = [...host.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .find(button => button.textContent?.includes('Motion + Particles'))
    expect(motionGroup).toBeDefined()
    act(() => motionGroup?.click())

    const expandedHelpIds = [...host.querySelectorAll<HTMLButtonElement>('.drm-help-info-trigger')]
      .map(button => button.dataset.helpId)
    expect(expandedHelpIds).toEqual(expect.arrayContaining([
      'react.canvas.reactControls.motionAndParticles.motionAmount',
      'react.canvas.reactControls.motionAndParticles.turbulence',
      'react.canvas.reactControls.motionAndParticles.particleDensity',
      'react.canvas.reactControls.motionAndParticles.particleSize',
      'react.canvas.reactControls.motionAndParticles.particleColorMode',
      'react.canvas.reactControls.motionAndParticles.particleQuality',
    ]))
  })
})
