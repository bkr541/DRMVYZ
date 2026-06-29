import { resolveLiquidMembraneSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { LIQUID_MEMBRANE_FRAGMENT_SOURCE } from './CinematicWorldPackBShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'

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
    program.setFloat('uStretch', settings.stretch)
    program.setFloat('uRippleDensity', settings.rippleDensity)
    program.setFloat('uRippleSpeed', settings.rippleSpeed)
    program.setFloat('uTearAmount', settings.tearAmount)
    program.setFloat('uRefractionStrength', settings.refractionStrength)
    program.setFloat('uSurfaceDetail', settings.surfaceDetail)
    program.setFloat('uEdgeSoftness', settings.edgeSoftness)
    program.setFloat('uOpeningBias', settings.openingBias)
    program.setFloat('uMidSurfaceMotion', settings.midSurfaceMotion)
  }
}

export const liquidMembraneWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'liquidMembrane',
  label: 'Liquid Membrane',
  backend: 'webgl2',
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'],
    modulationTargets: ['distortion', 'refraction', 'glow', 'portalPulse', 'atmosphere'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: true,
  },
  create: () => new LiquidMembraneWorld(),
}
