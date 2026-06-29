import { resolveLiquidMembraneSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { LIQUID_MEMBRANE_FRAGMENT_SOURCE } from './CinematicWorldPackBShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'
import { applyCinematicModulation } from '../CinematicAudioModulation'

const UNIFORMS = [
  'uMembraneScale',
  'uViscosity',
  'uStretch',
  'uRippleDensity',
  'uRippleSpeed',
  'uTearAmount',
  'uRefractionStrength',
  'uSurfaceDetail',
  'uEdgeSoftness',
  'uOpeningBias',
  'uMidSurfaceMotion',
] as const

class LiquidMembraneWorld extends FullscreenCinematicWorld {
  constructor() {
    super('liquidMembrane', LIQUID_MEMBRANE_FRAGMENT_SOURCE, UNIFORMS)
  }

  protected setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void {
    const settings = resolveLiquidMembraneSettings(frame.config.worldSettings)
    program.setFloat('uMembraneScale', settings.membraneScale)
    program.setFloat('uViscosity', settings.viscosity)
    program.setFloat('uStretch', applyCinematicModulation(settings.stretch, frame.modulation, 'portalAperture', 0.75, 0, 2))
    program.setFloat('uRippleDensity', applyCinematicModulation(settings.rippleDensity, frame.modulation, 'distortion', 2.2, 0.5, 12))
    program.setFloat('uRippleSpeed', applyCinematicModulation(settings.rippleSpeed, frame.modulation, 'distortion', 1.1, 0, 4))
    program.setFloat('uTearAmount', applyCinematicModulation(settings.tearAmount, frame.modulation, 'impact', 0.55, 0, 1))
    program.setFloat('uRefractionStrength', applyCinematicModulation(settings.refractionStrength, frame.modulation, 'refraction', 0.85, 0, 2))
    program.setFloat('uSurfaceDetail', settings.surfaceDetail)
    program.setFloat('uEdgeSoftness', settings.edgeSoftness)
    program.setFloat('uOpeningBias', applyCinematicModulation(settings.openingBias, frame.modulation, 'portalAperture', 0.5, 0, 1))
    program.setFloat('uMidSurfaceMotion', settings.midSurfaceMotion)
  }
}

const liquidMembraneDirection = defineCinematicWorldDirection({
  supportedCameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'],
  safeCameraRange: { minDistance: 0.75, maxDistance: 4.0, maxLateral: 0.9, minElevation: -0.7, maxElevation: 0.9 },
  shots: [
    { id: 'membrane-wide', rig: 'locked', sections: ['intro', 'breakdown', 'outro'], action: 'establish', pose: { position: { z: 3.1 }, fieldOfView: 68 } },
    { id: 'membrane-orbit', rig: 'orbit', sections: ['verse', 'build', 'bridge'], action: 'orbit' },
    { id: 'membrane-focus', rig: 'locked', sections: ['preDrop'], action: 'focus', pose: { position: { z: 1.0 }, fieldOfView: 42 } },
    { id: 'membrane-tear', rig: 'handheld', sections: ['drop'], action: 'open', minimumDurationSec: 4 },
    { id: 'membrane-fallback', rig: 'locked', sections: ['unknown'], action: 'hold' },
  ],
  dropActions: ['open', 'impact', 'reveal'],
  revealActions: ['open', 'reveal'],
  retreatActions: ['retreat', 'close'],
})

export const liquidMembraneWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'liquidMembrane',
  label: 'Liquid Membrane',
  backend: 'webgl2',
  direction: liquidMembraneDirection,
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'],
    modulationTargets: ['portalAperture', 'distortion', 'refraction', 'environmentBrightness', 'feedback', 'bloom', 'chromaticAberration', 'impact'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: true,
  },
  create: () => new LiquidMembraneWorld(),
}
