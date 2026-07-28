import { describe, expect, it } from 'vitest'
import { createDefaultLaserDmxBeamMatrixSettings } from '../../ReactTypes'
import type { CompiledLaserDmxBeamMatrixResult } from '../LaserDmxBeamMatrixCompiler'
import {
  applyLaserDmxPreviewToCompiledResult,
  resolveLaserDmxOutputHierarchy,
} from './LaserDmxResolvedOutput'

function compiledFixture(): CompiledLaserDmxBeamMatrixResult {
  const settings = createDefaultLaserDmxBeamMatrixSettings()
  return {
    output: {
      masterDimmer: 0.8,
      blackout: false,
      backgroundFade: 0.2,
      beamPersistence: 0.6,
      globalBeamWidth: 1,
      globalGlow: 0.6,
      globalStrobeRate: 0,
      safetyClamp: 0.5,
    },
    fog: { ...settings.fog },
    beams: [{
      beamId: 'beam-1',
      groupId: null,
      origin: { x: 0, y: 0, z: 0 },
      target: { x: 100, y: 100, z: 0, offscreen: false },
      visibleOrigin: { x: 0, y: 0, z: 0 },
      visibleTarget: { x: 100, y: 100, z: 0 },
      rgba: { r: 255, g: 255, b: 255, a: 1 },
      colorCss: 'rgba(255,255,255,1)',
      intensity: 0.4,
      beamWidth: 1,
      divergence: 0,
      focus: 1,
      glow: 0.3,
      strobeVisible: true,
      flickerMultiplier: 1,
      geometry: 'line',
      visualRole: 'primary',
      motionMode: 'static',
      travelProgress: 1,
      sequenceGate: 1,
      headIntensity: 0,
    }],
  }
}

describe('LaserDMX resolved output hierarchy', () => {
  it('preserves the legacy Canvas2D product while making it backend-neutral', () => {
    const beamMatrix = createDefaultLaserDmxBeamMatrixSettings()
    beamMatrix.output.masterDimmer = 0.8
    beamMatrix.output.safetyClamp = 0.5
    beamMatrix.output.globalGlow = 0.6

    const resolved = resolveLaserDmxOutputHierarchy({
      authoredOutput: { ...compiledFixture().output, ...beamMatrix.output },
      previewOutputTrim: 0.75,
      previewGlowTrim: 0.5,
    })

    expect(resolved.resolvedPreviewIntensity).toBeCloseTo(0.8 * 0.5 * 0.75)
    expect(resolved.resolvedHardwareIntensity).toBeCloseTo(0.8 * 0.5)
    expect(resolved.resolvedPreviewGlow).toBeCloseTo(0.6 * 0.5)
    expect(resolved.resolvedHardwareGlow).toBeCloseTo(0.6)
  })

  it('resolves compiled Canvas2D beams before backend dispatch', () => {
    const beamMatrix = createDefaultLaserDmxBeamMatrixSettings()
    beamMatrix.output.masterDimmer = 0.8
    beamMatrix.output.safetyClamp = 0.5
    beamMatrix.output.globalGlow = 0.6
    const hierarchy = resolveLaserDmxOutputHierarchy({
      authoredOutput: { ...compiledFixture().output, ...beamMatrix.output },
      previewOutputTrim: 0.25,
      previewGlowTrim: 0.5,
    })
    const authored = compiledFixture()
    const preview = applyLaserDmxPreviewToCompiledResult(authored, hierarchy)

    expect(preview.beams[0]?.intensity).toBeCloseTo(0.1)
    expect(preview.beams[0]?.glow).toBeCloseTo(0.15)
    expect(preview.output.globalGlow).toBeCloseTo(0.3)
    expect(authored.beams[0]?.intensity).toBe(0.4)
    expect(authored.beams[0]?.glow).toBe(0.3)
  })

  it('does not leak preview trims into production hardware values', () => {
    const beamMatrix = createDefaultLaserDmxBeamMatrixSettings()
    beamMatrix.output.masterDimmer = 0.9
    beamMatrix.output.safetyClamp = 0.7
    const lowPreview = resolveLaserDmxOutputHierarchy({ authoredOutput: { ...compiledFixture().output, ...beamMatrix.output }, previewOutputTrim: 0.1, previewGlowTrim: 0.2 })
    const highPreview = resolveLaserDmxOutputHierarchy({ authoredOutput: { ...compiledFixture().output, ...beamMatrix.output }, previewOutputTrim: 1, previewGlowTrim: 1 })

    expect(lowPreview.resolvedHardwareIntensity).toBe(highPreview.resolvedHardwareIntensity)
    expect(lowPreview.resolvedHardwareGlow).toBe(highPreview.resolvedHardwareGlow)
    expect(lowPreview.resolvedPreviewIntensity).not.toBe(highPreview.resolvedPreviewIntensity)
  })

  it('migrates equivalent legacy tuples to the same visible product without multiplying values', () => {
    const beamMatrixA = createDefaultLaserDmxBeamMatrixSettings()
    beamMatrixA.output.masterDimmer = 0.5
    beamMatrixA.output.safetyClamp = 1
    const beamMatrixB = createDefaultLaserDmxBeamMatrixSettings()
    beamMatrixB.output.masterDimmer = 1
    beamMatrixB.output.safetyClamp = 0.5

    const a = resolveLaserDmxOutputHierarchy({ authoredOutput: { ...compiledFixture().output, ...beamMatrixA.output }, previewOutputTrim: 0.8, previewGlowTrim: 1 })
    const b = resolveLaserDmxOutputHierarchy({ authoredOutput: { ...compiledFixture().output, ...beamMatrixB.output }, previewOutputTrim: 0.8, previewGlowTrim: 1 })
    expect(a.resolvedPreviewIntensity).toBeCloseTo(b.resolvedPreviewIntensity)
    expect(a.resolvedHardwareIntensity).toBeCloseTo(b.resolvedHardwareIntensity)
  })

  it('keeps blackout as final authority for preview and hardware intensity', () => {
    const beamMatrix = createDefaultLaserDmxBeamMatrixSettings()
    beamMatrix.output.blackout = true
    const resolved = resolveLaserDmxOutputHierarchy({ authoredOutput: { ...compiledFixture().output, ...beamMatrix.output }, previewOutputTrim: 1, previewGlowTrim: 1 })
    expect(resolved.resolvedPreviewIntensity).toBe(0)
    expect(resolved.resolvedHardwareIntensity).toBe(0)
    expect(resolved.resolvedPreviewGlow).toBe(0)
    expect(resolved.resolvedHardwareGlow).toBe(0)
  })
})
