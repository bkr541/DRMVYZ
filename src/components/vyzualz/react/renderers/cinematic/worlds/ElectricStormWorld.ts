import { resolveElectricStormSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type {
  CinematicFrameContext,
  CinematicRendererResetReason,
  CinematicWebGLWorldDefinition,
} from '../../CinematicWorldRenderer'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'
import { ELECTRIC_STORM_FRAGMENT_SOURCE } from './ElectricStormShader'
import {
  ELECTRIC_STORM_MAX_ACTIVE_STRIKES,
  ElectricStormStrikeGenerator,
  type ElectricStormStrikeDescriptor,
} from './ElectricStormStrikeGenerator'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'

import {
  deriveElectricStormColors,
  parseElectricStormHexColor,
  type ElectricStormRgbColor,
} from './ElectricStormColor'

const UNIFORMS = [
  'uStormBackground',
  'uLightningBody',
  'uLightningCore',
  'uLightningGlowColor',
  'uLightningBranchColor',
  'uMasterIntensity',
  'uBranching',
  'uThickness',
  'uGlowAmount',
  'uStrikeLine0',
  'uStrikeMeta0',
  'uStrikeStyle0',
  'uStrikeLine1',
  'uStrikeMeta1',
  'uStrikeStyle1',
  'uStrikeLine2',
  'uStrikeMeta2',
  'uStrikeStyle2',
] as const

function setRgb(program: ShaderProgram, uniform: string, color: ElectricStormRgbColor): void {
  program.setVec3(uniform, color.r, color.g, color.b)
}

function setStrikeUniforms(
  program: ShaderProgram,
  index: number,
  strike: ElectricStormStrikeDescriptor | undefined,
  timeSec: number,
): void {
  const lineUniform = `uStrikeLine${index}`
  const metaUniform = `uStrikeMeta${index}`
  const styleUniform = `uStrikeStyle${index}`
  if (!strike) {
    program.setVec4(lineUniform, 0, 0, 0, 0)
    program.setVec4(metaUniform, 99, 0, 0, 0)
    program.setVec4(styleUniform, 0, 0, 1, 1)
    return
  }
  program.setVec4(lineUniform, strike.start.x, strike.start.y, strike.end.x, strike.end.y)
  program.setVec4(
    metaUniform,
    timeSec - strike.startedAtSec,
    strike.durationSec,
    strike.intensity,
    (strike.seed >>> 0) / 4294967296 * 997,
  )
  program.setVec4(
    styleUniform,
    (strike.branchSeed >>> 0) / 4294967296 * 997,
    strike.branchDetail,
    strike.thicknessMultiplier,
    strike.glowMultiplier,
  )
}

class ElectricStormWorld extends FullscreenCinematicWorld {
  private readonly strikeGenerator = new ElectricStormStrikeGenerator()

  constructor() {
    super('electricStorm', ELECTRIC_STORM_FRAGMENT_SOURCE, UNIFORMS)
  }

  override reset(reason: CinematicRendererResetReason): void {
    super.reset(reason)
    this.strikeGenerator.reset()
  }

  override onContextLost(): void {
    this.strikeGenerator.reset()
    super.onContextLost()
  }

  override dispose(): void {
    this.strikeGenerator.reset()
    super.dispose()
  }

  protected setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void {
    const settings = resolveElectricStormSettings(frame.config.worldSettings)
    const background = parseElectricStormHexColor(settings.backgroundColor, { r: 0, g: 0, b: 0 })
    const derived = deriveElectricStormColors(settings.lightningColor)
    setRgb(program, 'uStormBackground', background)
    setRgb(program, 'uLightningBody', derived.body)
    setRgb(program, 'uLightningCore', derived.core)
    setRgb(program, 'uLightningGlowColor', derived.glow)
    setRgb(program, 'uLightningBranchColor', derived.branch)
    program.setFloat('uMasterIntensity', settings.masterIntensity)
    program.setFloat('uBranching', settings.branching)
    program.setFloat('uThickness', settings.thickness)
    program.setFloat('uGlowAmount', settings.glow)

    const strikes = this.strikeGenerator.update(frame.transportTimeSec, settings.strikeRate)
    for (let index = 0; index < ELECTRIC_STORM_MAX_ACTIVE_STRIKES; index += 1) {
      setStrikeUniforms(program, index, strikes[index], frame.transportTimeSec)
    }
  }
}

const electricStormDirection = defineCinematicWorldDirection({
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
    { id: 'electric-storm-screen', rig: 'locked', sections: ['unknown'], action: 'hold', pose: { position: { z: 1.8 }, fieldOfView: 58 } },
  ],
  dropActions: ['hold'],
  revealActions: ['hold'],
  retreatActions: ['hold'],
})

export const electricStormWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'electricStorm',
  label: 'Electric Storm',
  backend: 'webgl2',
  direction: electricStormDirection,
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked'],
    modulationTargets: [],
    paletteRoles: [],
    supportsGeometryPasses: false,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: false,
  },
  create: () => new ElectricStormWorld(),
}
