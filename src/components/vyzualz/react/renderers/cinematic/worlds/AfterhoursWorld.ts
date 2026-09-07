import { resolveAfterhoursSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'
import { AFTERHOURS_MAX_BEAMS, generateAfterhoursBeams } from './AfterhoursBeamGeometry'
import {
  AFTERHOURS_DEFAULT_BACKGROUND,
  type AfterhoursRgb,
  parseAfterhoursHexColor,
  resolveAfterhoursPalette,
} from './AfterhoursColor'
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

function setRgb(program: ShaderProgram, uniform: string, color: AfterhoursRgb): void {
  program.setVec3(uniform, color.r, color.g, color.b)
}

class AfterhoursWorld extends FullscreenCinematicWorld {
  constructor() {
    super('afterhours', AFTERHOURS_FRAGMENT_SOURCE, UNIFORMS)
  }

  protected setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void {
    const settings = resolveAfterhoursSettings(frame.config.worldSettings)

    // Background stays independent of Color Mode. The laser palette is resolved
    // per-frame: Manual uses the persisted hues, Auto derives an active pair
    // from the stable Cinema preset palette without touching the saved fields.
    setRgb(program, 'uAfterhoursBackground', parseAfterhoursHexColor(settings.backgroundColor, AFTERHOURS_DEFAULT_BACKGROUND))
    const presetPalette = frame.preset?.palette
    const palette = resolveAfterhoursPalette(
      { colorMode: settings.colorMode, primaryColor: settings.primaryColor, accentColor: settings.accentColor },
      settings.colorMode === 'auto' && presetPalette
        ? { primary: presetPalette.primary, accent: presetPalette.accent, secondary: presetPalette.secondary }
        : null,
    )
    setRgb(program, 'uAfterhoursPrimary', palette.primary)
    setRgb(program, 'uAfterhoursAccent', palette.accent)
    program.setFloat('uAfterhoursAtmosphere', Math.max(0, Math.min(1, Number.isFinite(settings.atmosphere) ? settings.atmosphere : 0)))

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
