import { describe, expect, it } from 'vitest'
import { normalizeLaserDmxShowDirectorSettings } from '../../ReactTypes'
import {
  resolveLaserDmxAtmosphereRendererPath,
  resolveLaserDmxAuthoringOverlayVisibility,
  resolveLaserDmxPresentationVisibility,
  resolveLaserDmxRendererBackend,
} from './LaserDmxRendererBackend'

describe('LaserDMX renderer backend selection', () => {
  it('keeps compatibility mode on Canvas2D and safely falls back when WebGL2 is unavailable or lost', () => {
    expect(resolveLaserDmxRendererBackend('canvas2d', { webgl2: true })).toBe('canvas2d')
    expect(resolveLaserDmxRendererBackend('webgl', { webgl2: false })).toBe('canvas2d')
    expect(resolveLaserDmxRendererBackend('auto', { webgl2: true, contextLost: true })).toBe('canvas2d')
    expect(resolveLaserDmxRendererBackend('auto', { webgl2: true })).toBe('webgl')
    expect(resolveLaserDmxRendererBackend('webgl', { webgl2: true, runtimeFailed: true })).toBe('canvas2d')
  })

  it('keeps flat fog on Canvas2D fallback and selects volumetric atmosphere only for WebGL', () => {
    expect(resolveLaserDmxAtmosphereRendererPath('canvas2d')).toBe('canvas2dFogFallback')
    expect(resolveLaserDmxAtmosphereRendererPath('webgl')).toBe('webglVolumetric')
  })

  it('normalizes legacy projects to safe Edit and Canvas2D defaults', () => {
    const settings = normalizeLaserDmxShowDirectorSettings({
      gridSize: { columns: 15, rows: 10 },
      showGrid: true,
    })
    expect(settings.presentationMode).toBe('edit')
    expect(settings.rendererMode).toBe('canvas2d')
    expect(settings.webglQuality).toBe('high')
    expect(settings.webglAtmosphereQuality).toBe('auto')
    expect(settings.webglRenderScale).toBe(1)
  })
})

describe('LaserDMX presentation visibility', () => {
  it('keeps complete authoring visibility in Edit', () => {
    expect(resolveLaserDmxPresentationVisibility('edit')).toMatchObject({
      mountStageEditor: true,
      showAllFixtures: true,
      showGrid: true,
      showAxes: true,
      showBeamHandles: true,
      showSelection: true,
    })
  })

  it('reduces Hybrid to selected editing affordances only', () => {
    expect(resolveLaserDmxPresentationVisibility('hybrid')).toEqual({
      mountStageEditor: true,
      showAllFixtures: false,
      showSelectedFixtures: true,
      showGrid: false,
      showAxes: false,
      showBeamHandles: true,
      showSelection: true,
      showDiagnosticOverlays: false,
    })
  })

  it.each(['live', 'capture'] as const)('%s mounts no authoring overlay', mode => {
    expect(resolveLaserDmxPresentationVisibility(mode)).toMatchObject({
      mountStageEditor: false,
      showAllFixtures: false,
      showSelectedFixtures: false,
      showGrid: false,
      showAxes: false,
      showBeamHandles: false,
      showSelection: false,
      showDiagnosticOverlays: false,
    })
  })

  it.each(['live', 'capture'] as const)('%s cannot expose the manual Beam Matrix editor underneath Show Director', mode => {
    expect(resolveLaserDmxAuthoringOverlayVisibility({
      showDirectorModeActive: true,
      beamMatrixEditorRequested: true,
      presentationMode: mode,
    })).toEqual({
      showDirectorStageEditor: false,
      showBeamMatrixEditor: false,
    })
  })

  it('keeps the manual Beam Matrix editor available outside Show Director mode', () => {
    expect(resolveLaserDmxAuthoringOverlayVisibility({
      showDirectorModeActive: false,
      beamMatrixEditorRequested: true,
      presentationMode: 'capture',
    })).toEqual({
      showDirectorStageEditor: false,
      showBeamMatrixEditor: true,
    })
  })
})

// Final production-hardening decisions remain explicit so diagnostics can
// explain why Canvas2D is active without leaking shader internals.
describe('LaserDMX renderer fallback decisions', () => {
  it('prioritizes repeated context loss and preserves a user-readable reason', async () => {
    const { resolveLaserDmxRendererBackendDecision } = await import('./LaserDmxRendererBackend')
    const decision = resolveLaserDmxRendererBackendDecision('auto', {
      webgl2: true,
      contextLost: true,
      repeatedContextLoss: true,
    })
    expect(decision.backend).toBe('canvas2d')
    expect(decision.fallbackCode).toBe('repeated-context-loss')
    expect(decision.fallbackReason).toContain('repeatedly')
  })

  it('reports resource-allocation fallback distinctly from WebGL absence', async () => {
    const { classifyLaserDmxWebGLFailure, resolveLaserDmxRendererBackendDecision } = await import('./LaserDmxRendererBackend')
    const failureCode = classifyLaserDmxWebGLFailure('Unable to allocate LaserDMX atmosphere target')
    expect(failureCode).toBe('gpu-resource-allocation-failed')
    expect(resolveLaserDmxRendererBackendDecision('webgl', {
      webgl2: true,
      runtimeFailed: true,
      failureCode,
    }).fallbackCode).toBe('gpu-resource-allocation-failed')
  })
})
