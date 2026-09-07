import { resolveAfterhoursSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'
import { AFTERHOURS_MAX_BEAMS, generateAfterhoursBeams } from './AfterhoursBeamGeometry'
import { AFTERHOURS_FRAGMENT_SOURCE } from './AfterhoursShader'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'

const UNIFORMS = [
  'uAfterhoursBackground',
  'uAfterhoursPrimary',
  'uAfterhoursAccent',
  'uAfterhoursAtmosphere',
  ...Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => `uAfterhoursBeam${index}`),
  ...Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => `uAfterhoursBeamMeta${index}`),
] as const

interface RgbColor { r: number; g: number; b: number }

function parseHexColor(value: string, fallback: RgbColor): RgbColor {
  const normalized = value.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) / 255,
    g: Number.parseInt(normalized.slice(2, 4), 16) / 255,
    b: Number.parseInt(normalized.slice(4, 6), 16) / 255,
  }
}

function setRgb(program: ShaderProgram, uniform: string, color: RgbColor): void {
  program.setVec3(uniform, color.r, color.g, color.b)
}

class AfterhoursWorld extends FullscreenCinematicWorld {
  constructor() {
    super('afterhours', AFTERHOURS_FRAGMENT_SOURCE, UNIFORMS)
  }

  protected setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void {
    const settings = resolveAfterhoursSettings(frame.config.worldSettings)
    setRgb(program, 'uAfterhoursBackground', parseHexColor(settings.backgroundColor, { r: 0, g: 0, b: 0 }))
    setRgb(program, 'uAfterhoursPrimary', parseHexColor(settings.primaryColor, { r: 116 / 255, g: 245 / 255, b: 1 }))
    setRgb(program, 'uAfterhoursAccent', parseHexColor(settings.accentColor, { r: 1, g: 1, b: 1 }))
    program.setFloat('uAfterhoursAtmosphere', settings.atmosphere)

    // Stage 2: one canonical procedural generator replaces the Stage-1 ad hoc
    // placement. `variation` stays 0 here; Stage 5 will cycle it on musical
    // boundaries. Inactive slots are always explicitly zeroed.
    const beams = generateAfterhoursBeams(settings)
    for (let index = 0; index < AFTERHOURS_MAX_BEAMS; index += 1) {
      const beam = beams[index]
      if (!beam.active) {
        program.setVec4(`uAfterhoursBeam${index}`, 0, 0, 0, 0)
        program.setVec2(`uAfterhoursBeamMeta${index}`, 0, 0)
        continue
      }
      program.setVec4(`uAfterhoursBeam${index}`, beam.origin.x, beam.origin.y, beam.target.x, beam.target.y)
      program.setVec2(`uAfterhoursBeamMeta${index}`, 1, beam.accent ? 1 : 0)
    }
  }
}

const afterhoursDirection = defineCinematicWorldDirection({
  supportedCameraRigs: ['locked'],
  safeCameraRange: {
    minDistance: 1.7,
    maxDistance: 1.9,
    maxLateral: 0,
    minElevation: 0,
    maxElevation: 0,
    minFieldOfView: 58,
    maxFieldOfView: 58,
  },
  shots: [
    { id: 'afterhours-screen', rig: 'locked', sections: ['unknown'], action: 'hold', pose: { position: { z: 1.8 }, fieldOfView: 58 } },
  ],
  dropActions: ['hold'],
  revealActions: ['hold'],
  retreatActions: ['hold'],
})

export const afterhoursWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'afterhours',
  label: 'Afterhours',
  backend: 'webgl2',
  direction: afterhoursDirection,
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked'],
    modulationTargets: [],
    paletteRoles: [],
    supportsGeometryPasses: false,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: false,
    supportsFeedback: false,
  },
  create: () => new AfterhoursWorld(),
}
