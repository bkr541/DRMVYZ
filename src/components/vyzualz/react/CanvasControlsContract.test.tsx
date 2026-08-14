/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../stores/reactStore'
import { useContextualHelpStore } from '../../../features/contextualHelp/contextualHelpStore'
import { useBrandKitStore } from '../../../features/personalization/brandKitStore'
import type { BrandKit } from '../../../features/personalization/BrandKitTypes'
import { CANVAS_REACT_CONTROL_GROUPS, CanvasEngineFxPanel, CanvasEngineSurface, resolveCanvasPresetControlGroups } from './ReactCanvasEngineShell'
import { CanvasFracturesRenderer } from './renderers/fractures/CanvasFracturesRenderer'
import { LaserImageFxRenderer } from './renderers/laserImageFx/LaserImageFxRenderer'

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
  useBrandKitStore.setState({ activeKit: null })
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
  it('exposes and activates the hybrid Pool automation controls with all required triggers', () => {
    act(() => root.render(<CanvasEngineFxPanel />))

    const poolLabel = [...host.querySelectorAll<HTMLElement>('.rv-ctrl-label')]
      .find(element => element.textContent?.trim() === 'Pool Automation')
    const poolButton = poolLabel?.closest('.rv-ctrl-toggle-row')?.querySelector<HTMLButtonElement>('button') ?? null
    expect(poolButton).not.toBeNull()

    act(() => poolButton?.click())
    expect(useReactStore.getState().canvasOrchestrationSettings).toMatchObject({
      poolAutomationEnabled: true,
      enabled: false,
      renderMode: 'layers',
    })

    const trigger = host.querySelector<HTMLButtonElement>('button[role="combobox"][aria-label="Pool Trigger"]')
    const transition = host.querySelector<HTMLButtonElement>('button[role="combobox"][aria-label="Pool Transition"]')
    expect(trigger?.disabled).toBe(false)
    expect(transition?.disabled).toBe(false)

    act(() => trigger?.click())
    const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')].map(option => option.textContent?.trim())
    expect(options).toEqual(expect.arrayContaining([
      'Beat', '4 Bar', '6 Bar', '8 Bar', '16 Bar', 'Track Sections', 'Kick Hit', 'Snare Hit',
    ]))
  })

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

      act(() => useReactStore.getState().selectCanvasPreset('canvas-laser-image-fx'))
      expect(host.querySelector('[data-renderer-kind="laserImageFx"]')).not.toBeNull()
      expect(host.querySelector('canvas.rv-canvas-laser-image-fx-layer[data-renderer-backend="webgl2"]')).not.toBeNull()

      act(() => useReactStore.getState().selectCanvasPreset('canvas-clean-playback'))
      expect(host.querySelector('[data-renderer-kind="standard"]')).not.toBeNull()
      expect(host.querySelector('canvas.rv-canvas-fractures-renderer-layer')).toBeNull()
      expect(host.querySelector('canvas.rv-canvas-laser-image-fx-layer')).toBeNull()
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext
      window.requestAnimationFrame = originalRequestAnimationFrame
      window.cancelAnimationFrame = originalCancelAnimationFrame
    }
  })

  it('survives repeated renderer transitions and keeps inactive Laser Image FX inert', () => {
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
    const laserCreate = vi.spyOn(LaserImageFxRenderer, 'create')

    try {
      useReactStore.setState({
        canvasMediaItems: [{
          id: 'renderer-transition-image',
          name: 'Renderer Transition Image',
          type: 'image',
          objectUrl: 'data:image/png;base64,AA==',
          createdAt: '2026-08-10T00:00:00.000Z',
          mediaRevision: 1,
        }],
        activeCanvasMediaId: 'renderer-transition-image',
      })

      act(() => root.render(<CanvasEngineSurface isPlaying={false} isPaused />))
      expect(host.querySelector('[data-renderer-kind="standard"]')).not.toBeNull()
      expect(laserCreate).not.toHaveBeenCalled()

      const transitions = [
        ['canvas-fractures', 'fragmentCollage', 0],
        ['canvas-particle-aura', 'particleAura', 0],
        ['canvas-laser-image-fx', 'laserImageFx', 1],
        ['canvas-clean-playback', 'standard', 1],
        ['canvas-laser-image-fx', 'laserImageFx', 2],
        ['canvas-fractures', 'fragmentCollage', 2],
      ] as const

      for (const [presetId, rendererKind, laserCreateCount] of transitions) {
        act(() => useReactStore.getState().selectCanvasPreset(presetId))
        expect(host.querySelector(`[data-renderer-kind="${rendererKind}"]`)).not.toBeNull()
        expect(laserCreate).toHaveBeenCalledTimes(laserCreateCount)
      }
    } finally {
      laserCreate.mockRestore()
      HTMLCanvasElement.prototype.getContext = originalGetContext
      window.requestAnimationFrame = originalRequestAnimationFrame
      window.cancelAnimationFrame = originalCancelAnimationFrame
    }
  })

  it('keeps the production controls committed across renderer-kind changes', () => {
    act(() => root.render(<CanvasEngineFxPanel />))

    const labels = () => [...host.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .map(button => button.textContent?.trim())

    expect(labels()).toContain('CANVAS React Controls')

    act(() => useReactStore.getState().selectCanvasPreset('canvas-fractures'))
    expect(labels()).toEqual(expect.arrayContaining(['Fractures Controls', 'Structure', 'Motion', 'Effects', 'Audio']))

    act(() => useReactStore.getState().selectCanvasPreset('canvas-particle-aura'))
    expect(labels()).toContain('CANVAS React Controls')

    act(() => useReactStore.getState().selectCanvasPreset('canvas-laser-image-fx'))
    expect(labels()).toContain('Laser Image FX Controls')

    act(() => useReactStore.getState().selectCanvasPreset('canvas-clean-playback'))
    expect(labels()).toContain('CANVAS React Controls')
  })

  it('exposes the production Laser Image FX control contract when selected', () => {
    useReactStore.getState().selectCanvasPreset('canvas-laser-image-fx')
    act(() => root.render(<CanvasEngineFxPanel />))

    const groupLabels = [...host.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .map(button => button.textContent?.trim())
    expect(groupLabels).toContain('Laser Image FX Controls')
    expect(groupLabels).not.toContain('Fractures Controls')

    const controlLabels = [...host.querySelectorAll<HTMLElement>('.rv-ctrl-label')]
      .map(node => node.textContent?.trim())
    expect(controlLabels).toEqual(expect.arrayContaining([
      'Image Effect',
      'Color Effect',
      'Intensity',
      'Speed',
      'Warp Amount',
      'Perspective',
      'Color Amount',
      'Bloom',
      'BPM Sync',
      'Laserize',
      'Dry Source Mix',
    ]))
  })

  it('passes the canonical active Brand Kit into the real Fractures render path', () => {
    const activeKit = {
      id: 'brand-kit-fractures',
      palette: {
        primary: '#102030',
        secondary: '#204060',
        accent: '#4080A0',
        background: '#000000',
        highlight: '#80C0E0',
        text: '#FFFFFF',
      },
    } as BrandKit
    useBrandKitStore.setState({ activeKit })
    useReactStore.setState({
      canvasMediaItems: [{
        id: 'fractures-brand-image',
        name: 'Fractures Brand Image',
        type: 'image',
        objectUrl: 'data:image/png;base64,AA==',
        createdAt: '2026-08-04T00:00:00.000Z',
        mediaRevision: 1,
      }],
      activeCanvasMediaId: 'fractures-brand-image',
    })
    useReactStore.getState().selectCanvasPreset('canvas-fractures')
    useReactStore.getState().setCanvasPresetSettings({ fractureColorSourceMode: 'brandKit' })
    const render = vi.fn(() => true)
    const create = vi.spyOn(CanvasFracturesRenderer, 'create').mockReturnValue({
      renderer: {
        backend: 'canvas2d',
        health: 'ready',
        planIdentity: null,
        setPlan: vi.fn(),
        resize: vi.fn(),
        render,
        invalidateFeedback: vi.fn(),
        dispose: vi.fn(),
      } as unknown as CanvasFracturesRenderer,
      error: null,
    })
    const originalRequestAnimationFrame = window.requestAnimationFrame
    const originalCancelAnimationFrame = window.cancelAnimationFrame
    window.requestAnimationFrame = vi.fn(() => 1)
    window.cancelAnimationFrame = vi.fn()
    try {
      act(() => root.render(<CanvasEngineSurface isPlaying={false} isPaused />))
      expect(render).toHaveBeenCalled()
      expect(render.mock.calls[0]?.[0]).toMatchObject({
        brandKit: activeKit,
        effects: { colorSourceMode: 'brandKit' },
      })
    } finally {
      create.mockRestore()
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

  it('filters renderer-specific unconsumed controls while preserving supported conditional controls and saved values', () => {
    useReactStore.getState().selectCanvasPreset('canvas-clean-playback')
    useReactStore.getState().setCanvasPresetSettings({ particleQuality: 'low' })
    act(() => root.render(<CanvasEngineFxPanel />))

    const groupLabels = () => [...host.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .map(button => button.textContent?.trim())
    const controlLabels = () => [...host.querySelectorAll<HTMLElement>('.rv-canvas-react-control-help .rv-ctrl-label')]
      .map(node => node.textContent?.trim())

    expect(groupLabels()).toEqual(expect.arrayContaining(['Source + Reactivity', 'FX', 'Motion + Particles']))
    expect(controlLabels()).toEqual(expect.arrayContaining([
      'Dry Source Mix',
      'Visual Intensity',
      'Bass Reactivity',
      'Beat Pulse',
      'Glow Amount',
      'Trail Amount',
      'RGB Split',
      'Glitch Amount',
      'Stutter Rate',
      'Luma Threshold',
    ]))
    expect(controlLabels()).not.toContain('Particle Size')
    expect(controlLabels()).not.toContain('Particle Color Mode')
    expect(controlLabels()).not.toContain('Particle Quality')
    expect(useReactStore.getState().canvasPresetSettings.particleQuality).toBe('low')

    const cleanMotionGroup = [...host.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .find(button => button.textContent?.trim() === 'Motion + Particles')
    act(() => cleanMotionGroup?.click())
    expect(controlLabels()).toEqual(expect.arrayContaining(['Motion Amount', 'Turbulence', 'Particle Density']))
    expect(controlLabels()).not.toContain('Particle Size')
    expect(controlLabels()).not.toContain('Particle Color Mode')
    expect(controlLabels()).not.toContain('Particle Quality')

    act(() => useReactStore.getState().selectCanvasPreset('canvas-particle-aura'))
    const particleMotionGroup = [...host.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .find(button => button.textContent?.trim() === 'Motion + Particles')
    expect(particleMotionGroup).toBeDefined()
    if (particleMotionGroup?.getAttribute('aria-expanded') !== 'true') act(() => particleMotionGroup?.click())
    expect(controlLabels()).toEqual(expect.arrayContaining([
      'Particle Density',
      'Particle Size',
      'Particle Color Mode',
      'Particle Quality',
    ]))

    act(() => useReactStore.getState().selectCanvasPreset('canvas-clean-playback'))
    expect(controlLabels()).not.toContain('Particle Size')
    expect(controlLabels()).not.toContain('Particle Color Mode')
    expect(controlLabels()).not.toContain('Particle Quality')
  })

  it('removes control groups that become empty after capability filtering', () => {
    const groups = resolveCanvasPresetControlGroups({ controls: ['drySourceMix'] })
    expect(groups.map(group => group.title)).toEqual(['Source + Reactivity'])
    expect(groups[0]?.controls).toEqual(['drySourceMix'])
  })

  it('hides the generic Composition preference for the fixed-composition Fractures performance show', () => {
    useReactStore.getState().setCanvasOrchestrationSettings({
      programId: 'canvas-fractures-performance',
      compositionPreference: 'fourPanelGrid',
    })
    act(() => root.render(<CanvasEngineFxPanel />))

    const controlLabels = () => [...host.querySelectorAll<HTMLElement>('.rv-ctrl-label')]
      .map(node => node.textContent?.trim())

    expect(controlLabels()).not.toContain('Composition')
    expect(host.querySelector('.rv-canvas-orchestration-summary')?.textContent).toContain('Fixed Fractures composition')
    expect(useReactStore.getState().canvasOrchestrationSettings.compositionPreference).toBe('fourPanelGrid')

    act(() => useReactStore.getState().setCanvasOrchestrationSettings({ programId: 'canvas-cinematic-bass-editor' }))
    expect(controlLabels()).toContain('Composition')
    expect(useReactStore.getState().canvasOrchestrationSettings.compositionPreference).toBe('fourPanelGrid')
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
      'react.canvas.fractures.effects.glow',
      'react.canvas.fractures.effects.trails',
      'react.canvas.fractures.effects.depth',
      'react.canvas.fractures.effects.duplication',
      'react.canvas.fractures.effects.colorTreatment',
      'react.canvas.fractures.effects.roleWeight.clean',
      'react.canvas.fractures.effects.roleWeight.texture',
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

    const cleanRoleLabel = [...host.querySelectorAll<HTMLLabelElement>('label')]
      .find(label => label.textContent === 'Clean Role')
    const cleanRoleInput = cleanRoleLabel?.htmlFor
      ? host.ownerDocument.getElementById(cleanRoleLabel.htmlFor) as HTMLInputElement | null
      : null
    expect(cleanRoleInput).not.toBeNull()
    act(() => {
      if (!cleanRoleInput) return
      cleanRoleInput.value = '0.61'
      cleanRoleInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(useReactStore.getState().canvasPresetSettings.fractureEffectRoleWeights.clean).toBe(0.61)

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

  it('places info triggers only beside controls supported by the active preset', () => {
    act(() => root.render(<CanvasEngineFxPanel />))

    const helpIds = () => [...host.querySelectorAll<HTMLButtonElement>('.drm-help-info-trigger')]
      .map(button => button.dataset.helpId)

    expect(helpIds()).toEqual(expect.arrayContaining([
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
    expect(helpIds()).not.toContain('react.canvas.reactControls.motionAndParticles.particleQuality')

    act(() => useReactStore.getState().selectCanvasPreset('canvas-particle-aura'))
    const motionGroup = [...host.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .find(button => button.textContent?.includes('Motion + Particles'))
    expect(motionGroup).toBeDefined()
    act(() => motionGroup?.click())

    expect(helpIds()).toEqual(expect.arrayContaining([
      'react.canvas.reactControls.motionAndParticles.motionAmount',
      'react.canvas.reactControls.motionAndParticles.turbulence',
      'react.canvas.reactControls.motionAndParticles.particleDensity',
      'react.canvas.reactControls.motionAndParticles.particleSize',
      'react.canvas.reactControls.motionAndParticles.particleColorMode',
      'react.canvas.reactControls.motionAndParticles.particleQuality',
    ]))
  })
})
