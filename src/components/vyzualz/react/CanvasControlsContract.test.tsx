/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../stores/reactStore'
import { useContextualHelpStore } from '../../../features/contextualHelp/contextualHelpStore'
import { useBrandKitStore } from '../../../features/personalization/brandKitStore'
import type { BrandKit } from '../../../features/personalization/BrandKitTypes'
import { CANVAS_REACT_CONTROL_GROUPS, CanvasEngineFxPanel, CanvasEngineSurface, CanvasPerformanceAutomationControls, CanvasPresetFxControls, CanvasPresetMotionControls, CanvasPresetParticleControls, FracturesReactControls, LaserImageFxReactControls, resolveCanvasPresetControlGroups } from './ReactCanvasEngineShell'
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

// React tracks a controlled <input>'s last-known value via an internal
// value tracker set through the native property setter. Assigning
// `input.value = x` directly bypasses that tracker in this environment, so a
// dispatched 'input' event is silently ignored — the DOM shows the new value
// but onChange never fires. Using the native setter keeps the tracker in
// sync, which is what actually makes the dispatched event register.
function setControlledInputValue(input: HTMLInputElement, value: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  nativeSetter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
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

  it('exposes the production Laser Image FX control contract split across Design and React', () => {
    useReactStore.getState().selectCanvasPreset('canvas-laser-image-fx')

    // Design: static source geometry/construction only. Perspective renders
    // because the default image effect (3D Spin) is one of the four that
    // actually consume it.
    const designSnapshot = renderSnapshot(<CanvasEngineFxPanel />)
    expect(groupLabelsIn(designSnapshot.host)).toContain('Laser Image FX Controls')
    expect(groupLabelsIn(designSnapshot.host)).not.toContain('Fractures Controls')
    const designControls = controlLabelsIn(designSnapshot.host)
    expect(designControls).toEqual(expect.arrayContaining([
      'Image Effect', 'Warp Amount', 'Perspective', 'Dry Source Mix',
    ]))
    for (const label of ['Color Effect', 'Intensity', 'Speed', 'Color Amount', 'Bloom', 'BPM Sync', 'Laserize']) {
      expect(designControls).not.toContain(label)
    }
    designSnapshot.unmount()

    // React: animation and FX. Color Amount is absent because the default
    // Color Effect (Source / Original) does not consume it.
    const reactSnapshot = renderSnapshot(<LaserImageFxReactControls />)
    expect(groupLabelsIn(reactSnapshot.host)).toEqual(expect.arrayContaining(['Animation', 'Laser FX']))
    const reactControls = controlLabelsIn(reactSnapshot.host)
    expect(reactControls).toEqual(expect.arrayContaining([
      'Intensity', 'Speed', 'BPM Sync', 'Color Effect', 'Bloom', 'Laserize',
    ]))
    expect(reactControls).not.toContain('Color Amount')
    for (const label of ['Image Effect', 'Warp Amount', 'Perspective', 'Dry Source Mix']) {
      expect(reactControls).not.toContain(label)
    }
    reactSnapshot.unmount()

    // Laser Image FX has its own animation controls (Speed, Warp Amount,
    // Perspective, BPM Sync, …) and must not inherit the generic Motion or
    // Particle Aura controls just because they exist in shared Canvas state.
    const genericSnapshot = renderSnapshot(<><CanvasPresetMotionControls /><CanvasPresetParticleControls /></>)
    expect(genericSnapshot.host.textContent).toBe('')
    genericSnapshot.unmount()
  })

  it('hides Color Amount when Color Effect is Source / Original', () => {
    // Verified against the renderer: uColorEffect === 0 returns the source
    // color untouched, so Color Amount cannot affect the output.
    useReactStore.getState().selectCanvasPreset('canvas-laser-image-fx')
    useReactStore.getState().setCanvasPresetSettings({ laserColorEffect: 'source' })
    const snapshot = renderSnapshot(<LaserImageFxReactControls />)
    expect(controlLabelsIn(snapshot.host)).not.toContain('Color Amount')
    snapshot.unmount()
  })

  it('shows Color Amount when Color Effect actually consumes it', () => {
    useReactStore.getState().selectCanvasPreset('canvas-laser-image-fx')
    useReactStore.getState().setCanvasPresetSettings({ laserColorEffect: 'beatSaturateA' })
    const snapshot = renderSnapshot(<LaserImageFxReactControls />)
    expect(controlLabelsIn(snapshot.host)).toContain('Color Amount')
    snapshot.unmount()
  })

  it('hides Perspective for image effects with no Z displacement', () => {
    // Verified against the renderer's vertex shader: only uImageEffect 1-4
    // (Cube A, Flip B, 3D Spin, Twist B) ever assign a non-zero p.z, which is
    // the only thing Perspective scales. Vignette leaves p.z at 0.
    useReactStore.getState().selectCanvasPreset('canvas-laser-image-fx')
    useReactStore.getState().setCanvasPresetSettings({ laserImageEffect: 'vignette' })
    const snapshot = renderSnapshot(<CanvasEngineFxPanel />)
    expect(controlLabelsIn(snapshot.host)).not.toContain('Perspective')
    snapshot.unmount()
  })

  it('shows Perspective for image effects that assign a Z displacement', () => {
    useReactStore.getState().selectCanvasPreset('canvas-laser-image-fx')
    useReactStore.getState().setCanvasPresetSettings({ laserImageEffect: 'spin3d' })
    const snapshot = renderSnapshot(<CanvasEngineFxPanel />)
    expect(controlLabelsIn(snapshot.host)).toContain('Perspective')
    snapshot.unmount()
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
    const displayIndex = labels.indexOf('Display')
    const autoRoleIndex = labels.indexOf('Auto Role')
    const sourceReactivityIndex = labels.indexOf('Source + Reactivity')
    const timingIndex = labels.indexOf('Video Timing')

    expect(displayIndex).toBe(0)
    // Auto Role is the sole toggle-headed group covering what used to be a
    // separate plain "Composition" group -- the pooled-source summary,
    // Composition template picker, Locks, and Reset Authored State all live
    // directly in its body now; "Composition" is not its own group.
    expect(labels).not.toContain('Composition')
    expect(autoRoleIndex).toBeGreaterThan(displayIndex)
    expect(sourceReactivityIndex).toBeGreaterThan(autoRoleIndex)
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
    // Auto Select is automation and moved to React; the purely informational
    // "CANVAS Source Link" group was removed from Design entirely rather than
    // kept as a static note with no controls.
    expect(labels).not.toContain('CANVAS Source Link')
    expect(controlLabels()).not.toContain('Auto Select')
  })

  it('moves Performance Automation controls to React and keeps them out of Design', () => {
    const snapshot = renderSnapshot(<CanvasPerformanceAutomationControls />)
    const groupLabels = groupLabelsIn(snapshot.host)
    const controlLabels = controlLabelsIn(snapshot.host)

    expect(groupLabels).toContain('Performance Automation')
    expect(controlLabels).toEqual(expect.arrayContaining([
      'Auto Select', 'Auto Performance', 'Pool Automation', 'Performance Show',
      'Layer Complexity', 'Transition Density', 'Effect Intensity', 'Motion Intensity', 'Cut Density',
    ]))
    // Composition/Locks controls are Design-only and must not be duplicated here.
    expect(controlLabels).not.toContain('Auto Role')
    expect(controlLabels).not.toContain('Media Lock')
    expect(controlLabels).not.toContain('Composition')
    snapshot.unmount()
  })

  it('shows the Fractures-only groups split across Design and React, with help ownership only when selected', () => {
    useReactStore.getState().selectCanvasPreset('canvas-fractures')

    // Design: static structure only.
    const designSnapshot = renderSnapshot(<CanvasEngineFxPanel />)
    const designLabels = groupLabelsIn(designSnapshot.host)
    expect(designLabels).toEqual(expect.arrayContaining(['Fractures Controls', 'Structure']))
    expect(designLabels).not.toContain('CANVAS React Controls')
    expect(designLabels).not.toContain('Motion / Evolution')
    expect(designLabels).not.toContain('Fractures FX')
    expect(designLabels).not.toContain('Audio Reactivity')

    const designHelpIds = helpIdsIn(designSnapshot.host)
    expect(designHelpIds).toEqual(expect.arrayContaining([
      'react.canvas.fractures.structure.intensity',
      'react.canvas.fractures.structure.mode',
      'react.canvas.fractures.structure.anchorMode',
    ]))
    expect(designHelpIds).not.toContain('react.canvas.fractures.motion.transition')
    expect(designHelpIds).not.toContain('react.canvas.fractures.effects.glow')

    // Scoped to designSnapshot.host rather than the global document: with
    // multiple fresh roots mounted at once (Design + React snapshots),
    // React's per-root useId() disambiguation can still collide, and
    // document.getElementById would silently grab the wrong root's input.
    const intensityLabel = [...designSnapshot.host.querySelectorAll<HTMLLabelElement>('label')]
      .find(label => label.textContent === 'Fracture Intensity')
    const intensityInput = intensityLabel?.closest('.rv-ctrl-row')?.querySelector<HTMLInputElement>('input') ?? null
    expect(intensityInput).not.toBeNull()
    act(() => {
      if (!intensityInput) return
      setControlledInputValue(intensityInput, '0.73')
    })
    expect(useReactStore.getState().canvasPresetSettings.fractureIntensity).toBe(0.73)
    designSnapshot.unmount()

    // React: motion/evolution, Fractures FX, and audio reactivity — not the
    // static structure controls, and not the generic Canvas Motion/Particles
    // sections (Fractures declares no generic controls at all).
    const reactSnapshot = renderSnapshot(<FracturesReactControls />)
    const reactLabels = groupLabelsIn(reactSnapshot.host)
    expect(reactLabels).toEqual(expect.arrayContaining(['Fractures Controls', 'Motion / Evolution', 'Fractures FX', 'Audio Reactivity']))
    expect(reactLabels).not.toContain('Structure')

    const effectsGroup = [...reactSnapshot.host.querySelectorAll<HTMLButtonElement>('.drc-header')]
      .find(button => collapsibleLabelText(button) === 'Fractures FX')
    act(() => effectsGroup?.click())

    const reactHelpIds = helpIdsIn(reactSnapshot.host)
    expect(reactHelpIds).toEqual(expect.arrayContaining([
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
    expect(reactHelpIds).not.toContain('react.canvas.fractures.structure.intensity')
    expect(reactHelpIds).not.toContain('react.canvas.fractures.structure.mode')

    const cleanRoleLabel = [...reactSnapshot.host.querySelectorAll<HTMLLabelElement>('label')]
      .find(label => label.textContent === 'Clean Role')
    const cleanRoleInput = cleanRoleLabel?.closest('.rv-ctrl-row')?.querySelector<HTMLInputElement>('input') ?? null
    expect(cleanRoleInput).not.toBeNull()
    act(() => {
      if (!cleanRoleInput) return
      setControlledInputValue(cleanRoleInput, '0.61')
    })
    expect(useReactStore.getState().canvasPresetSettings.fractureEffectRoleWeights.clean).toBe(0.61)
    reactSnapshot.unmount()

    // Generic Motion/Particles render nothing for Fractures.
    const genericSnapshot = renderSnapshot(<><CanvasPresetMotionControls /><CanvasPresetParticleControls /></>)
    expect(genericSnapshot.host.textContent).toBe('')
    genericSnapshot.unmount()
  })

  it('removes stale Fractures Design and React sections after switching away to Clean Playback', () => {
    useReactStore.getState().selectCanvasPreset('canvas-fractures')
    act(() => useReactStore.getState().selectCanvasPreset('canvas-clean-playback'))
    const standardSnapshot = renderSnapshot(<><CanvasEngineFxPanel /><FracturesReactControls /></>)
    const standardLabels = groupLabelsIn(standardSnapshot.host)
    expect(standardLabels).not.toContain('CANVAS React Controls')
    expect(standardLabels).toContain('Source + Reactivity')
    expect(standardLabels).not.toContain('Fractures Controls')
    expect(standardLabels).not.toContain('Motion + Particles')
    expect(standardLabels).not.toContain('Motion')
    expect(standardLabels).not.toContain('Particles')
    standardSnapshot.unmount()
  })

  it('hides Fractures manual color controls when Color Source is not Manual Override', () => {
    useReactStore.getState().selectCanvasPreset('canvas-fractures')
    useReactStore.getState().setCanvasPresetSettings({ fractureColorSourceMode: 'imageSampled' })
    const snapshot = renderSnapshot(<FracturesReactControls />)
    const effectsGroup = [...snapshot.host.querySelectorAll<HTMLButtonElement>('.drc-header')]
      .find(button => collapsibleLabelText(button) === 'Fractures FX')
    act(() => effectsGroup?.click())
    expect(controlLabelsIn(snapshot.host)).not.toContain('Manual Primary Color')
    expect(controlLabelsIn(snapshot.host)).not.toContain('Manual Supporting Color')
    snapshot.unmount()
  })

  it('shows Fractures manual color controls when Color Source is Manual Override', () => {
    useReactStore.getState().selectCanvasPreset('canvas-fractures')
    useReactStore.getState().setCanvasPresetSettings({ fractureColorSourceMode: 'manualOverride' })
    const snapshot = renderSnapshot(<FracturesReactControls />)
    const effectsGroup = [...snapshot.host.querySelectorAll<HTMLButtonElement>('.drc-header')]
      .find(button => collapsibleLabelText(button) === 'Fractures FX')
    act(() => effectsGroup?.click())
    expect(controlLabelsIn(snapshot.host)).toContain('Manual Primary Color')
    expect(controlLabelsIn(snapshot.host)).toContain('Manual Supporting Color')
    snapshot.unmount()
  })

  it('wires Fractures manual commands into persisted canonical state', () => {
    // Refracture / Shuffle Layout / Freeze Layout / Return to Anchor are all
    // Motion / Evolution controls now, in the React tab.
    useReactStore.getState().selectCanvasPreset('canvas-fractures')
    act(() => root.render(<FracturesReactControls />))

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
    const designSnapshot = renderSnapshot(<CanvasEngineFxPanel />)
    const designHelpIds = helpIdsIn(designSnapshot.host)

    expect(designHelpIds).toEqual(expect.arrayContaining([
      'react.canvas.sourceAndDisplay.display.fitMode',
      'react.canvas.sourceAndDisplay.display.scale',
      'react.canvas.sourceAndDisplay.display.positionX',
      'react.canvas.sourceAndDisplay.display.positionY',
      'react.canvas.sourceAndDisplay.display.rotation',
      'react.canvas.sourceAndDisplay.display.outputOpacity',
      'react.canvas.performanceOrchestration.autoRole',
      'react.canvas.performanceOrchestration.composition',
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
    // support Motion + Particles. Auto Performance / Pool Automation / Performance
    // Show / the automation sliders moved to React's Performance Automation.
    expect(designHelpIds).not.toContain('react.canvas.reactControls.fx.glowAmount')
    expect(designHelpIds).not.toContain('react.canvas.reactControls.fx.trailAmount')
    expect(designHelpIds).not.toContain('react.canvas.reactControls.fx.rgbSplit')
    expect(designHelpIds).not.toContain('react.canvas.reactControls.fx.glitchAmount')
    expect(designHelpIds).not.toContain('react.canvas.reactControls.fx.stutterRate')
    expect(designHelpIds).not.toContain('react.canvas.reactControls.fx.lumaThreshold')
    expect(designHelpIds).not.toContain('react.canvas.reactControls.motionAndParticles.particleQuality')
    expect(designHelpIds).not.toContain('react.canvas.performanceOrchestration.autoPerformance')
    expect(designHelpIds).not.toContain('react.canvas.performanceOrchestration.performanceShow')
    expect(designHelpIds).not.toContain('react.canvas.performanceOrchestration.layerComplexity')
    expect(designHelpIds).not.toContain('react.canvas.performanceOrchestration.cutDensity')
    // Auto Select is automation (automatic preset/media selection) and moved
    // to React's Performance Automation group.
    expect(designHelpIds).not.toContain('react.canvas.sourceAndDisplay.sourceLink.autoSelect')
    expect(controlLabelsIn(designSnapshot.host)).not.toContain('Auto Select')
    designSnapshot.unmount()

    // React tab (CanvasPresetFxControls): Clean Playback's FX help triggers live here.
    const fxSnapshot = renderSnapshot(<CanvasPresetFxControls />)
    expect(helpIdsIn(fxSnapshot.host)).toEqual(expect.arrayContaining([
      'react.canvas.reactControls.fx.glowAmount',
      'react.canvas.reactControls.fx.trailAmount',
      'react.canvas.reactControls.fx.rgbSplit',
      'react.canvas.reactControls.fx.glitchAmount',
      'react.canvas.reactControls.fx.stutterRate',
      'react.canvas.reactControls.fx.lumaThreshold',
    ]))
    fxSnapshot.unmount()

    // React tab (CanvasPerformanceAutomationControls): the automation half of
    // the former "Performance Orchestration" group lives here now, alongside
    // Auto Select (automatic preset/media selection is automation too).
    const automationSnapshot = renderSnapshot(<CanvasPerformanceAutomationControls />)
    expect(helpIdsIn(automationSnapshot.host)).toEqual(expect.arrayContaining([
      'react.canvas.sourceAndDisplay.sourceLink.autoSelect',
      'react.canvas.performanceOrchestration.autoPerformance',
      'react.canvas.performanceOrchestration.performanceShow',
      'react.canvas.performanceOrchestration.layerComplexity',
      'react.canvas.performanceOrchestration.transitionDensity',
      'react.canvas.performanceOrchestration.effectIntensity',
      'react.canvas.performanceOrchestration.motionIntensity',
      'react.canvas.performanceOrchestration.cutDensity',
    ]))
    expect(controlLabelsIn(automationSnapshot.host)).toContain('Auto Select')
    expect(helpIdsIn(automationSnapshot.host)).not.toContain('react.canvas.performanceOrchestration.autoRole')
    expect(helpIdsIn(automationSnapshot.host)).not.toContain('react.canvas.performanceOrchestration.composition')
    automationSnapshot.unmount()
  })

  it('disables Performance Show and the tuning sliders while Auto Performance is off', () => {
    // Verified against CanvasPerformanceEngine.ts: resolveCanvasPerformanceFrame
    // is the only consumer of programId/complexity/transitionDensity/
    // effectIntensity/motionIntensity/cutDensity, and it only runs when
    // Auto Performance is active — so these controls are inert (not hidden,
    // matching Pool Trigger/Pool Transition's existing disabled treatment)
    // until Auto Performance is turned on.
    useReactStore.getState().setCanvasOrchestrationSettings({ enabled: false, renderMode: 'single' })
    const offSnapshot = renderSnapshot(<CanvasPerformanceAutomationControls />)
    const findInput = (label: string) => [...offSnapshot.host.querySelectorAll<HTMLElement>('.rv-ctrl-label')]
      .find(node => node.textContent?.trim() === label)
      ?.closest('.rv-ctrl-row')
      ?.querySelector<HTMLButtonElement | HTMLInputElement>('input, button[role="combobox"]') ?? null
    for (const label of ['Performance Show', 'Layer Complexity', 'Transition Density', 'Effect Intensity', 'Motion Intensity', 'Cut Density']) {
      const input = findInput(label)
      expect(input, `${label} should exist`).not.toBeNull()
      expect((input as HTMLInputElement | HTMLButtonElement)?.disabled, `${label} should be disabled`).toBe(true)
    }
    offSnapshot.unmount()
  })

  it('enables Performance Show and the tuning sliders while Auto Performance is on', () => {
    useReactStore.getState().setCanvasOrchestrationSettings({ enabled: true, renderMode: 'performance' })
    const onSnapshot = renderSnapshot(<CanvasPerformanceAutomationControls />)
    const findInput = (label: string) => [...onSnapshot.host.querySelectorAll<HTMLElement>('.rv-ctrl-label')]
      .find(node => node.textContent?.trim() === label)
      ?.closest('.rv-ctrl-row')
      ?.querySelector<HTMLButtonElement | HTMLInputElement>('input, button[role="combobox"]') ?? null
    for (const label of ['Performance Show', 'Layer Complexity', 'Transition Density', 'Effect Intensity', 'Motion Intensity', 'Cut Density']) {
      const input = findInput(label)
      expect(input, `${label} should exist`).not.toBeNull()
      expect((input as HTMLInputElement | HTMLButtonElement)?.disabled, `${label} should be enabled`).toBe(false)
    }
    onSnapshot.unmount()
  })

  it('keeps Pool Trigger/Pool Transition disabled until Pool Automation is enabled', () => {
    useReactStore.getState().setCanvasOrchestrationSettings({ poolAutomationEnabled: false })
    const snapshot = renderSnapshot(<CanvasPerformanceAutomationControls />)
    const trigger = snapshot.host.querySelector<HTMLButtonElement>('button[role="combobox"][aria-label="Pool Trigger"]')
    const transition = snapshot.host.querySelector<HTMLButtonElement>('button[role="combobox"][aria-label="Pool Transition"]')
    expect(trigger?.disabled).toBe(true)
    expect(transition?.disabled).toBe(true)
    snapshot.unmount()
  })

  it('places Particle Aura Motion/Particles info triggers as independent sections', () => {
    // React tab (CanvasPresetMotionControls / CanvasPresetParticleControls):
    // Particle Aura's Motion and Particles help triggers live here, as two
    // independent sections rather than one combined "Motion + Particles" group.
    useReactStore.getState().selectCanvasPreset('canvas-particle-aura')
    const snapshot = renderSnapshot(<><CanvasPresetMotionControls /><CanvasPresetParticleControls /></>)
    const groupLabels = groupLabelsIn(snapshot.host)
    expect(groupLabels).toEqual(expect.arrayContaining(['Motion', 'Particles']))
    expect(groupLabels).not.toContain('Motion + Particles')

    expect(helpIdsIn(snapshot.host)).toEqual(expect.arrayContaining([
      'react.canvas.reactControls.motionAndParticles.motionAmount',
      'react.canvas.reactControls.motionAndParticles.turbulence',
      'react.canvas.reactControls.motionAndParticles.particleDensity',
      'react.canvas.reactControls.motionAndParticles.particleSize',
      'react.canvas.reactControls.motionAndParticles.particleColorMode',
      'react.canvas.reactControls.motionAndParticles.particleQuality',
    ]))
    snapshot.unmount()
  })

  describe('Phase 2: scope-aware Engine Display controls', () => {
    function findSliderInput(container: HTMLElement, label: string): HTMLInputElement | null {
      return [...container.querySelectorAll<HTMLElement>('.rv-ctrl-label')]
        .find(node => node.textContent?.trim() === label)
        ?.closest('.rv-ctrl-row')
        ?.querySelector<HTMLInputElement>('input[type="range"]') ?? null
    }

    // SliderRow's own always-visible live readout (not the help-popover
    // "current value" badge, which only renders once its popover is open).
    function currentValueText(container: HTMLElement, label: string): string | undefined {
      return [...container.querySelectorAll<HTMLElement>('.rv-ctrl-label')]
        .find(node => node.textContent?.trim() === label)
        ?.closest('.rv-ctrl-row')
        ?.querySelector<HTMLElement>('.rv-ctrl-val')?.textContent ?? undefined
    }

    it('Canvas scope: Display sliders write to the global canvasEngineSettings baseline and create no layer overrides', () => {
      const a = useReactStore.getState().addCanvasAuthoredLayer('scope-media-a')
      const b = useReactStore.getState().addCanvasAuthoredLayer('scope-media-b')
      if (!a.ok || !b.ok) throw new Error('Expected two CANVAS layers')
      // Adding a layer auto-follows Engine scope onto it (Phase 1); explicitly
      // return to Canvas scope for this test's precondition.
      useReactStore.getState().setCanvasControlScope({ kind: 'canvas' })
      expect(useReactStore.getState().canvasControlScope).toEqual({ kind: 'canvas' })

      const snapshot = renderSnapshot(<CanvasEngineFxPanel />)
      const scaleInput = findSliderInput(snapshot.host, 'Scale')
      if (!scaleInput) throw new Error('Expected Scale slider')
      act(() => setControlledInputValue(scaleInput, '1.75'))

      expect(useReactStore.getState().canvasEngineSettings.scale).toBe(1.75)
      expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.every(layer => !layer.engineOverrides)).toBe(true)
      snapshot.unmount()
    })

    it('Layer scope: Display sliders write only to the scoped layer\'s engineOverrides, leaving the Canvas baseline and sibling layers untouched', () => {
      const a = useReactStore.getState().addCanvasAuthoredLayer('scope-media-a')
      const b = useReactStore.getState().addCanvasAuthoredLayer('scope-media-b')
      if (!a.ok || !b.ok) throw new Error('Expected two CANVAS layers')
      const originalCanvasScale = useReactStore.getState().canvasEngineSettings.scale
      useReactStore.getState().setCanvasControlScope({ kind: 'layer', layerId: b.layer.id })

      const snapshot = renderSnapshot(<CanvasEngineFxPanel />)
      const scaleInput = findSliderInput(snapshot.host, 'Scale')
      if (!scaleInput) throw new Error('Expected Scale slider')
      act(() => setControlledInputValue(scaleInput, '0.6'))

      const layers = useReactStore.getState().canvasOrchestrationSettings.authoredLayers
      expect(layers.find(layer => layer.id === b.layer.id)?.engineOverrides).toEqual({ scale: 0.6 })
      expect(layers.find(layer => layer.id === a.layer.id)?.engineOverrides).toBeUndefined()
      expect(useReactStore.getState().canvasEngineSettings.scale).toBe(originalCanvasScale)
      snapshot.unmount()
    })

    it('Layer scope: displays the Canvas baseline for un-overridden fields and the override for changed ones (inheritance)', () => {
      useReactStore.getState().setCanvasEngineSettings({ rotation: 25 })
      const a = useReactStore.getState().addCanvasAuthoredLayer('scope-media-a')
      const b = useReactStore.getState().addCanvasAuthoredLayer('scope-media-b')
      if (!a.ok || !b.ok) throw new Error('Expected two CANVAS layers')
      useReactStore.getState().updateCanvasLayerEngineOverrides(b.layer.id, { scale: 0.6 })
      useReactStore.getState().setCanvasControlScope({ kind: 'layer', layerId: b.layer.id })

      const snapshot = renderSnapshot(<CanvasEngineFxPanel />)
      // Scale is the layer's own override...
      expect(currentValueText(snapshot.host, 'Scale')).toBe('0.60')
      // ...Rotation was never overridden on this layer, so it still shows
      // the Canvas baseline value inherited from canvasEngineSettings.
      expect(currentValueText(snapshot.host, 'Rotation')).toBe('25')
      snapshot.unmount()
    })

    it('Layer scope resolves back to plain Canvas-baseline inheritance once the layer\'s overrides are reset', () => {
      const a = useReactStore.getState().addCanvasAuthoredLayer('scope-media-a')
      const b = useReactStore.getState().addCanvasAuthoredLayer('scope-media-b')
      if (!a.ok || !b.ok) throw new Error('Expected two CANVAS layers')
      useReactStore.getState().updateCanvasLayerEngineOverrides(b.layer.id, { scale: 0.6 })
      useReactStore.getState().setCanvasControlScope({ kind: 'layer', layerId: b.layer.id })

      let snapshot = renderSnapshot(<CanvasEngineFxPanel />)
      expect(currentValueText(snapshot.host, 'Scale')).toBe('0.60')
      snapshot.unmount()

      useReactStore.getState().resetCanvasLayerEngineOverrides(b.layer.id)
      snapshot = renderSnapshot(<CanvasEngineFxPanel />)
      expect(currentValueText(snapshot.host, 'Scale')).toBe('1.00')
      snapshot.unmount()
    })

    it('hides Canvas-only groups (Auto Role, Source + Reactivity) while Layer scope is active, and restores them for Canvas scope', () => {
      const a = useReactStore.getState().addCanvasAuthoredLayer('scope-media-a')
      const b = useReactStore.getState().addCanvasAuthoredLayer('scope-media-b')
      if (!a.ok || !b.ok) throw new Error('Expected two CANVAS layers')
      useReactStore.getState().setCanvasControlScope({ kind: 'canvas' })

      const canvasSnapshot = renderSnapshot(<CanvasEngineFxPanel />)
      const canvasGroupLabels = groupLabelsIn(canvasSnapshot.host)
      expect(canvasGroupLabels).toContain('Auto Role')
      canvasSnapshot.unmount()

      useReactStore.getState().setCanvasControlScope({ kind: 'layer', layerId: b.layer.id })
      const layerSnapshot = renderSnapshot(<CanvasEngineFxPanel />)
      const layerGroupLabels = groupLabelsIn(layerSnapshot.host)
      expect(layerGroupLabels).not.toContain('Auto Role')
      // Display itself (the layer-scoped controls) stays.
      expect(layerGroupLabels).toContain('Display')
      layerSnapshot.unmount()
    })
  })
})
