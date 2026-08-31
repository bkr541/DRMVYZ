/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../stores/reactStore'
import { useContextualHelpStore } from '../../../features/contextualHelp/contextualHelpStore'
import { useBrandKitStore } from '../../../features/personalization/brandKitStore'
import type { BrandKit } from '../../../features/personalization/BrandKitTypes'
import { CANVAS_REACT_CONTROL_GROUPS, CanvasEngineFxPanel, CanvasEngineSurface, CanvasPerformanceAutomationControls, CanvasPresetFxControls, CanvasPresetMotionControls, CanvasPresetParticleControls, resolveCanvasPresetControlGroups } from './ReactCanvasEngineShell'
import type { CanvasPresetId } from './ReactTypes'
import { CanvasFracturesRenderer } from './renderers/fractures/CanvasFracturesRenderer'
import { LaserImageFxRenderer } from './renderers/laserImageFx/LaserImageFxRenderer'

// DualRailCollapsible's header button includes the label span plus a
// trailing disclosure arrow glyph in its textContent ("Display\u25be"),
// so group-label assertions read just the first (label) span instead of
// the whole button text.
function collapsibleLabelText(button: HTMLButtonElement): string | undefined {
  return button.querySelector('span')?.textContent?.trim()
}

// A store update after the shared `root` has already rendered once is not
// reliably reflected by calling `root.render()` again in this test
// environment (jsdom + threaded Vitest workers). Mounting a fresh root per
// snapshot sidesteps that and reads the current store state directly, which
// is what every assertion here actually needs — a true-at-call-time snapshot
// of what the component renders for the active preset.
function renderSnapshot(node: React.ReactElement): { host: HTMLDivElement; unmount: () => void } {
  const snapshotHost = document.createElement('div')
  document.body.appendChild(snapshotHost)
  const snapshotRoot = createRoot(snapshotHost)
  act(() => snapshotRoot.render(node))
  return {
    host: snapshotHost,
    unmount: () => {
      act(() => snapshotRoot.unmount())
      snapshotHost.remove()
    },
  }
}

function groupLabelsIn(container: HTMLElement): Array<string | undefined> {
  return [...container.querySelectorAll<HTMLButtonElement>('.drc-header')].map(collapsibleLabelText)
}

function controlLabelsIn(container: HTMLElement): Array<string | undefined> {
  return [...container.querySelectorAll<HTMLElement>('.rv-ctrl-label')].map(node => node.textContent?.trim())
}

function helpIdsIn(container: HTMLElement): Array<string | undefined> {
  return [...container.querySelectorAll<HTMLButtonElement>('.drm-help-info-trigger')].map(button => button.dataset.helpId)
}

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
  it('keeps manual preset protection without showing the routine Manual Override card', () => {
    useReactStore.getState().selectCanvasPreset('canvas-clean-playback')
    useReactStore.getState().setCanvasPresetSettings({ intensity: 0.75 })
    useReactStore.getState().resetCanvasPresetSettings()

    act(() => root.render(
      <>
        <CanvasEngineSurface isPlaying={false} isPaused />
        <CanvasEngineFxPanel />
      </>,
    ))

    expect(useReactStore.getState().canvasPresetOverride).toMatchObject({
      source: 'manual',
      presetId: 'canvas-clean-playback',
    })
    expect(host.textContent).not.toContain('Manual Override')
    expect(host.textContent).not.toContain('Clear Override')
    expect(host.textContent).not.toContain('Resume Auto Select')

    act(() => useReactStore.getState().setCanvasAutoSelectEnabled(true))

    expect(useReactStore.getState().canvasPresetOverride).toBeNull()
    expect(host.textContent).not.toContain('Manual Override')
    expect(host.textContent).not.toContain('Clear Override')
    expect(host.textContent).not.toContain('Resume Auto Select')

    act(() => useReactStore.getState().selectCanvasPreset('canvas-particle-aura'))
    expect(useReactStore.getState().canvasPresetOverride).toMatchObject({
      source: 'manual',
      presetId: 'canvas-particle-aura',
    })

    act(() => useReactStore.getState().applyCanvasAutoSelection({
      presetId: 'canvas-glitch-pulse',
      label: 'Auto: contract check',
    }))
    expect(useReactStore.getState().selectedCanvasPresetId).toBe('canvas-particle-aura')
    expect(useReactStore.getState().canvasPresetOverride).toMatchObject({
      source: 'manual',
      presetId: 'canvas-particle-aura',
    })

    act(() => useReactStore.getState().setCanvasAutoSelectEnabled(false))
    act(() => useReactStore.getState().setCanvasAutoSelectEnabled(true))
    expect(useReactStore.getState().canvasPresetOverride).toBeNull()
  })

  it('does not expose legacy compatibility recipe controls as manually selectable preset controls', () => {
    useReactStore.setState({
      selectedCanvasPresetId: 'canvas-bass-bloom',
      canvasPresetOverride: {
        source: 'auto',
        presetId: 'canvas-bass-bloom',
        label: 'Auto: compatibility recipe',
      },
    })

    act(() => root.render(<CanvasEngineFxPanel />))

    expect(host.textContent).not.toContain('Bass Bloom')
    expect(host.textContent).not.toContain('Reset Bass Bloom recipe')
    expect(host.textContent).not.toContain('CANVAS React Controls')
  })

  it('keeps Media Lock visible independently of the removed preset override card', () => {
    useReactStore.setState({
      canvasMediaItems: [{
        id: 'media-lock-contract-image',
        name: 'Media Lock Contract Image',
        type: 'image',
        objectUrl: 'data:image/png;base64,AA==',
        createdAt: '2026-08-29T00:00:00.000Z',
      }],
      activeCanvasMediaId: 'media-lock-contract-image',
    })
    useReactStore.getState().setCanvasAutoSelectEnabled(true)
    useReactStore.getState().selectCanvasMediaItem('media-lock-contract-image')

    act(() => root.render(<CanvasEngineSurface isPlaying={false} isPaused />))

    expect(host.textContent).toContain('Media Lock')
    expect(host.textContent).toContain('Auto Select can change presets, but this source stays selected.')
  })

  it('exposes and activates the hybrid Pool automation controls with all required triggers', () => {
    // Pool Automation is a Performance Automation (React tab) control now —
    // it changes the composition over time, so it moved out of Design.
    act(() => root.render(<CanvasPerformanceAutomationControls />))

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
    useReactStore.getState().selectCanvasPreset('canvas-clean-playback')
    let snapshot = renderSnapshot(<CanvasEngineFxPanel />)

    // "CANVAS React Controls" no longer exists as a single mixed group — Design
    // shows the Source + Reactivity group only. FX, Motion, and Particles all
    // live in the React tab instead (see CanvasPresetFxControls /
    // CanvasPresetMotionControls / CanvasPresetParticleControls elsewhere).
    expect(groupLabelsIn(snapshot.host)).not.toContain('CANVAS React Controls')
    expect(groupLabelsIn(snapshot.host)).toContain('Source + Reactivity')
    expect(groupLabelsIn(snapshot.host)).not.toContain('FX')
    expect(groupLabelsIn(snapshot.host)).not.toContain('Motion + Particles')
    expect(groupLabelsIn(snapshot.host)).not.toContain('Particles')
    snapshot.unmount()

    act(() => useReactStore.getState().selectCanvasPreset('canvas-fractures'))
    snapshot = renderSnapshot(<CanvasEngineFxPanel />)
    expect(groupLabelsIn(snapshot.host)).toEqual(expect.arrayContaining(['Fractures Controls', 'Structure', 'Motion', 'Effects', 'Audio']))
    snapshot.unmount()

    act(() => useReactStore.getState().selectCanvasPreset('canvas-particle-aura'))
    snapshot = renderSnapshot(<CanvasEngineFxPanel />)
    expect(groupLabelsIn(snapshot.host)).not.toContain('CANVAS React Controls')
    expect(groupLabelsIn(snapshot.host)).toEqual(expect.arrayContaining(['Source + Reactivity']))
    // Motion and Particles are React-tab concepts now — Design never shows them,
    // even for Particle Aura, which is the only preset that supports either.
    expect(groupLabelsIn(snapshot.host)).not.toContain('Motion + Particles')
    expect(groupLabelsIn(snapshot.host)).not.toContain('Particles')
    snapshot.unmount()

    act(() => useReactStore.getState().selectCanvasPreset('canvas-laser-image-fx'))
    snapshot = renderSnapshot(<CanvasEngineFxPanel />)
    expect(groupLabelsIn(snapshot.host)).toContain('Laser Image FX Controls')
    snapshot.unmount()

    act(() => useReactStore.getState().selectCanvasPreset('canvas-clean-playback'))
    snapshot = renderSnapshot(<CanvasEngineFxPanel />)
    expect(groupLabelsIn(snapshot.host)).not.toContain('CANVAS React Controls')
    expect(groupLabelsIn(snapshot.host)).toContain('Source + Reactivity')
    expect(groupLabelsIn(snapshot.host)).not.toContain('Motion + Particles')
    expect(groupLabelsIn(snapshot.host)).not.toContain('Particles')
    snapshot.unmount()
  })

  it('exposes the production Laser Image FX control contract when selected', () => {
    useReactStore.getState().selectCanvasPreset('canvas-laser-image-fx')
    act(() => root.render(<CanvasEngineFxPanel />))

    const groupLabels = [...host.querySelectorAll<HTMLButtonElement>('.drc-header')]
      .map(collapsibleLabelText)
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

    // Laser Image FX has its own animation controls (Speed, Warp Amount,
    // Perspective, BPM Sync, …) and must not inherit the generic Motion or
    // Particle Aura controls just because they exist in shared Canvas state.
    const laserHost = document.createElement('div')
    document.body.appendChild(laserHost)
    const laserRoot = createRoot(laserHost)
    act(() => laserRoot.render(<><CanvasPresetMotionControls /><CanvasPresetParticleControls /></>))
    expect(laserHost.textContent).toBe('')
    act(() => laserRoot.unmount())
    laserHost.remove()
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

  it('exposes Particle Quality with the other particle controls, and keeps Motion separate', () => {
    const particleGroup = CANVAS_REACT_CONTROL_GROUPS.find(group => group.title === 'Particles')
    const motionGroup = CANVAS_REACT_CONTROL_GROUPS.find(group => group.title === 'Motion')

    expect(particleGroup?.controls).toEqual(expect.arrayContaining([
      'particleDensity',
      'particleSize',
      'particleColorMode',
      'particleQuality',
    ]))
    expect(particleGroup?.controls).not.toContain('motionAmount')
    expect(motionGroup?.controls).toEqual(['motionAmount', 'turbulence'])
    expect(CANVAS_REACT_CONTROL_GROUPS.some(group => group.title === 'Motion + Particles')).toBe(false)
  })

  it('filters renderer-specific unconsumed controls while preserving supported conditional controls and saved values', () => {
    useReactStore.getState().selectCanvasPreset('canvas-clean-playback')
    useReactStore.getState().setCanvasPresetSettings({ particleQuality: 'low' })

    // Design (CanvasEngineFxPanel): Clean Playback shows Source + Reactivity only.
    // FX now lives in the React tab; Clean Playback does not support Motion or
    // Particle controls at all, so those groups are absent rather than
    // empty/disabled.
    let snapshot = renderSnapshot(<CanvasEngineFxPanel />)
    expect(groupLabelsIn(snapshot.host)).toEqual(expect.arrayContaining(['Source + Reactivity']))
    expect(groupLabelsIn(snapshot.host)).not.toContain('FX')
    expect(groupLabelsIn(snapshot.host)).not.toContain('Motion + Particles')
    const cleanPlaybackControls = controlLabelsIn(snapshot.host)
    expect(cleanPlaybackControls).toEqual(expect.arrayContaining([
      'Dry Source Mix',
      'Visual Intensity',
      'Bass Reactivity',
      'Beat Pulse',
    ]))
    for (const label of [
      'Glow Amount', 'Trail Amount', 'RGB Split', 'Glitch Amount', 'Stutter Rate', 'Luma Threshold',
      'Motion Amount', 'Turbulence',
      'Particle Density', 'Particle Size', 'Particle Color Mode', 'Particle Quality',
    ]) {
      expect(cleanPlaybackControls).not.toContain(label)
    }
    expect(useReactStore.getState().canvasPresetSettings.particleQuality).toBe('low')
    snapshot.unmount()

    // React (CanvasPresetFxControls): Clean Playback's FX controls live here instead.
    snapshot = renderSnapshot(<CanvasPresetFxControls />)
    expect(groupLabelsIn(snapshot.host)).toContain('Preset FX')
    expect(controlLabelsIn(snapshot.host)).toEqual(expect.arrayContaining([
      'Glow Amount',
      'Trail Amount',
      'RGB Split',
      'Glitch Amount',
      'Stutter Rate',
      'Luma Threshold',
    ]))
    expect(controlLabelsIn(snapshot.host)).not.toContain('Motion Amount')
    expect(controlLabelsIn(snapshot.host)).not.toContain('Particle Density')
    snapshot.unmount()

    // React (CanvasPresetMotionControls / CanvasPresetParticleControls): Particle
    // Aura is the only preset that supports Motion and Particles, and they now
    // resolve as independent sections rather than one combined group.
    act(() => useReactStore.getState().selectCanvasPreset('canvas-particle-aura'))
    snapshot = renderSnapshot(<><CanvasPresetMotionControls /><CanvasPresetParticleControls /></>)
    expect(groupLabelsIn(snapshot.host)).not.toContain('Motion + Particles')
    expect(groupLabelsIn(snapshot.host)).toContain('Motion')
    expect(groupLabelsIn(snapshot.host)).toContain('Particles')
    expect(controlLabelsIn(snapshot.host)).toEqual(expect.arrayContaining([
      'Motion Amount',
      'Turbulence',
      'Particle Density',
      'Particle Size',
      'Particle Color Mode',
      'Particle Quality',
    ]))
    snapshot.unmount()

    // Design (CanvasEngineFxPanel) never shows Motion or Particles, even for
    // Particle Aura — those sections are React-tab only.
    snapshot = renderSnapshot(<CanvasEngineFxPanel />)
    expect(groupLabelsIn(snapshot.host)).not.toContain('Motion')
    expect(groupLabelsIn(snapshot.host)).not.toContain('Particles')
    expect(controlLabelsIn(snapshot.host)).not.toContain('Particle Size')
    snapshot.unmount()

    act(() => useReactStore.getState().selectCanvasPreset('canvas-clean-playback'))
    snapshot = renderSnapshot(<><CanvasPresetMotionControls /><CanvasPresetParticleControls /></>)
    expect(groupLabelsIn(snapshot.host)).not.toContain('Motion + Particles')
    expect(groupLabelsIn(snapshot.host)).not.toContain('Motion')
    expect(groupLabelsIn(snapshot.host)).not.toContain('Particles')
    for (const label of ['Motion Amount', 'Turbulence', 'Particle Density', 'Particle Size', 'Particle Color Mode', 'Particle Quality']) {
      expect(controlLabelsIn(snapshot.host)).not.toContain(label)
    }
    snapshot.unmount()
  })

  it('never renders Motion or Particle controls for Clean Playback, in Design or React', () => {
    useReactStore.getState().selectCanvasPreset('canvas-clean-playback')
    act(() => root.render(
      <>
        <CanvasEngineFxPanel />
        <CanvasPresetFxControls />
        <CanvasPresetMotionControls />
        <CanvasPresetParticleControls />
      </>,
    ))

    const groupLabels = [...host.querySelectorAll<HTMLButtonElement>('.drc-header')]
      .map(collapsibleLabelText)
    const controlLabels = [...host.querySelectorAll<HTMLElement>('.rv-ctrl-label')]
      .map(node => node.textContent?.trim())

    expect(groupLabels).not.toContain('Motion + Particles')
    expect(groupLabels).not.toContain('Motion')
    expect(groupLabels).not.toContain('Particles')
    for (const label of ['Motion Amount', 'Turbulence', 'Particle Density', 'Particle Size', 'Particle Color Mode', 'Particle Quality']) {
      expect(controlLabels).not.toContain(label)
    }
  })

  it('shows Motion and Particles as independent React sections for Particle Aura, and clears them on every other preset', () => {
    const presetSequence: CanvasPresetId[] = [
      'canvas-clean-playback',
      'canvas-particle-aura',
      'canvas-fractures',
      'canvas-laser-image-fx',
      'canvas-clean-playback',
    ]

    for (const presetId of presetSequence) {
      act(() => useReactStore.getState().selectCanvasPreset(presetId))
      act(() => root.render(<><CanvasPresetMotionControls /><CanvasPresetParticleControls /></>))

      const groupLabels = [...host.querySelectorAll<HTMLButtonElement>('.drc-header')]
        .map(collapsibleLabelText)
      const controlLabels = [...host.querySelectorAll<HTMLElement>('.rv-ctrl-label')]
        .map(node => node.textContent?.trim())

      if (presetId === 'canvas-particle-aura') {
        expect(groupLabels).toEqual(['Motion', 'Particles'])
        expect(controlLabels).toEqual(expect.arrayContaining([
          'Motion Amount', 'Turbulence', 'Particle Density', 'Particle Size', 'Particle Color Mode', 'Particle Quality',
        ]))
      } else {
        // No stale Motion or Particle controls survive a preset switch away
        // from Particle Aura — the sections are absent entirely, not merely
        // empty or disabled.
        expect(groupLabels).toEqual([])
        expect(controlLabels).toEqual([])
      }
    }
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
    let snapshot = renderSnapshot(<CanvasEngineFxPanel />)

    expect(controlLabelsIn(snapshot.host)).not.toContain('Composition')
    expect(snapshot.host.querySelector('.rv-canvas-orchestration-summary')?.textContent).toContain('Fixed Fractures composition')
    expect(useReactStore.getState().canvasOrchestrationSettings.compositionPreference).toBe('fourPanelGrid')
    snapshot.unmount()

    act(() => useReactStore.getState().setCanvasOrchestrationSettings({ programId: 'canvas-cinematic-bass-editor' }))
    snapshot = renderSnapshot(<CanvasEngineFxPanel />)
    expect(controlLabelsIn(snapshot.host)).toContain('Composition')
    expect(useReactStore.getState().canvasOrchestrationSettings.compositionPreference).toBe('fourPanelGrid')
    snapshot.unmount()
  })

  it('renders Display before composition and the recipe groups, with no mixed CANVAS React Controls group', () => {
    act(() => root.render(<CanvasEngineFxPanel />))
    const labels = [...host.querySelectorAll<HTMLButtonElement>('.drc-header')]
      .map(collapsibleLabelText)
    const sourceIndex = labels.indexOf('CANVAS Source Link')
    const displayIndex = labels.indexOf('Display')
    const compositionIndex = labels.indexOf('Composition')
    const sourceReactivityIndex = labels.indexOf('Source + Reactivity')
    const timingIndex = labels.indexOf('Video Timing')

    expect(sourceIndex).toBeGreaterThanOrEqual(0)
    expect(displayIndex).toBeGreaterThan(sourceIndex)
    expect(compositionIndex).toBeGreaterThan(displayIndex)
    expect(sourceReactivityIndex).toBeGreaterThan(compositionIndex)
    expect(timingIndex).toBeGreaterThan(sourceReactivityIndex)
    expect(labels).not.toContain('CANVAS React Controls')
    expect(labels).not.toContain('Performance Orchestration')
    expect(labels).not.toContain('Performance Automation')
    expect(labels).not.toContain('FX')
    expect(labels).not.toContain('Motion + Particles')
    expect(labels).not.toContain('Motion')
    expect(labels).not.toContain('Particles')

    // Composition-only controls stay in Design; automation controls that used
    // to share the "Performance Orchestration" group with them do not.
    const controlLabels = () => [...host.querySelectorAll<HTMLElement>('.rv-ctrl-label')].map(node => node.textContent?.trim())
    expect(controlLabels()).toContain('Auto Role')

    // "Locks" (Media Lock, Layer, Lock Layer State, Locked Media) starts
    // collapsed — open it to confirm its controls are actually present.
    const locksGroup = [...host.querySelectorAll<HTMLButtonElement>('.drc-header')]
      .find(button => collapsibleLabelText(button) === 'Locks')
    act(() => locksGroup?.click())
    expect(controlLabels()).toContain('Media Lock')
    expect(controlLabels()).not.toContain('Auto Performance')
    expect(controlLabels()).not.toContain('Pool Automation')
    expect(controlLabels()).not.toContain('Performance Show')
    expect(controlLabels()).not.toContain('Layer Complexity')
    expect(controlLabels()).not.toContain('Transition Density')
    expect(controlLabels()).not.toContain('Cut Density')
  })

  it('moves Performance Automation controls to React and keeps them out of Design', () => {
    const snapshot = renderSnapshot(<CanvasPerformanceAutomationControls />)
    const groupLabels = groupLabelsIn(snapshot.host)
    const controlLabels = controlLabelsIn(snapshot.host)

    expect(groupLabels).toContain('Performance Automation')
    expect(controlLabels).toEqual(expect.arrayContaining([
      'Auto Performance', 'Pool Automation', 'Performance Show',
      'Layer Complexity', 'Transition Density', 'Effect Intensity', 'Motion Intensity', 'Cut Density',
    ]))
    // Composition/Locks controls are Design-only and must not be duplicated here.
    expect(controlLabels).not.toContain('Auto Role')
    expect(controlLabels).not.toContain('Media Lock')
    expect(controlLabels).not.toContain('Composition')
    snapshot.unmount()
  })

  it('shows the Fractures-only groups, canonical controls, and help ownership only when selected', () => {
    useReactStore.getState().selectCanvasPreset('canvas-fractures')
    act(() => root.render(<CanvasEngineFxPanel />))

    const labels = [...host.querySelectorAll<HTMLButtonElement>('.drc-header')]
      .map(collapsibleLabelText)
    expect(labels).toEqual(expect.arrayContaining([
      'Fractures Controls',
      'Structure',
      'Motion',
      'Effects',
      'Audio',
    ]))
    expect(labels).not.toContain('CANVAS React Controls')

    // Fractures' own "Motion" subgroup (its dedicated transition/refracture
    // controls) is not the generic Canvas Motion section — the generic
    // Motion and Particles React components render nothing for Fractures,
    // since Fractures declares no generic controls at all.
    const fracturesHost = document.createElement('div')
    document.body.appendChild(fracturesHost)
    const fracturesRoot = createRoot(fracturesHost)
    act(() => fracturesRoot.render(<><CanvasPresetMotionControls /><CanvasPresetParticleControls /></>))
    expect(fracturesHost.textContent).toBe('')
    act(() => fracturesRoot.unmount())
    fracturesHost.remove()

    const effectsGroup = [...host.querySelectorAll<HTMLButtonElement>('.drc-header')]
      .find(button => collapsibleLabelText(button) === 'Effects')
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
    const standardLabels = [...host.querySelectorAll<HTMLButtonElement>('.drc-header')]
      .map(collapsibleLabelText)
    expect(standardLabels).not.toContain('CANVAS React Controls')
    expect(standardLabels).toContain('Source + Reactivity')
    expect(standardLabels).not.toContain('Fractures Controls')
    expect(standardLabels).not.toContain('Motion + Particles')
    expect(standardLabels).not.toContain('Motion')
    expect(standardLabels).not.toContain('Particles')
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
    // FX and Motion + Particles help triggers no longer render in Design at all
    // for Clean Playback: FX moved to the React tab, and Clean Playback does not
    // support Motion + Particles.
    expect(helpIds()).not.toContain('react.canvas.reactControls.fx.glowAmount')
    expect(helpIds()).not.toContain('react.canvas.reactControls.fx.trailAmount')
    expect(helpIds()).not.toContain('react.canvas.reactControls.fx.rgbSplit')
    expect(helpIds()).not.toContain('react.canvas.reactControls.fx.glitchAmount')
    expect(helpIds()).not.toContain('react.canvas.reactControls.fx.stutterRate')
    expect(helpIds()).not.toContain('react.canvas.reactControls.fx.lumaThreshold')
    expect(helpIds()).not.toContain('react.canvas.reactControls.motionAndParticles.particleQuality')

    // React tab (CanvasPresetFxControls): Clean Playback's FX help triggers live here.
    act(() => root.render(<CanvasPresetFxControls />))
    expect(helpIds()).toEqual(expect.arrayContaining([
      'react.canvas.reactControls.fx.glowAmount',
      'react.canvas.reactControls.fx.trailAmount',
      'react.canvas.reactControls.fx.rgbSplit',
      'react.canvas.reactControls.fx.glitchAmount',
      'react.canvas.reactControls.fx.stutterRate',
      'react.canvas.reactControls.fx.lumaThreshold',
    ]))

    // React tab (CanvasPresetMotionControls / CanvasPresetParticleControls):
    // Particle Aura's Motion and Particles help triggers live here, as two
    // independent sections rather than one combined "Motion + Particles" group.
    act(() => useReactStore.getState().selectCanvasPreset('canvas-particle-aura'))
    act(() => root.render(<><CanvasPresetMotionControls /><CanvasPresetParticleControls /></>))
    const groupLabels = [...host.querySelectorAll<HTMLButtonElement>('.drc-header')]
      .map(collapsibleLabelText)
    expect(groupLabels).toEqual(expect.arrayContaining(['Motion', 'Particles']))
    expect(groupLabels).not.toContain('Motion + Particles')

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
