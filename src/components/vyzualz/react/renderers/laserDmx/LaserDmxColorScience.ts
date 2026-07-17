import type { LaserDmxShowDirectorFixtureKind } from '../../ReactTypes'
import type { LaserDmxSceneColor } from './LaserDmxSceneFrame'

export interface LaserColorChannels {
  red: number
  green: number
  blue: number
  white?: number
}

export interface LaserDmxFixtureCalibrationProfile {
  id: string
  nominalWavelengthNm: { red: number; green: number; blue: number; white?: number }
  relativeOpticalPower: LaserColorChannels
  channelBalance: LaserColorChannels
  minimumModulationThreshold: number
  maximumOutput: number
  cameraResponse: LaserColorChannels
}

export const LASER_DMX_FIXTURE_CALIBRATIONS: Readonly<Record<string, LaserDmxFixtureCalibrationProfile>> = Object.freeze({
  balancedRgb: {
    id: 'balancedRgb',
    nominalWavelengthNm: { red: 638, green: 520, blue: 450 },
    relativeOpticalPower: { red: 0.92, green: 1, blue: 0.86 },
    channelBalance: { red: 1, green: 0.9, blue: 1 },
    minimumModulationThreshold: 0.012,
    maximumOutput: 1.35,
    cameraResponse: { red: 0.92, green: 1, blue: 0.82 },
  },
  highPowerGreen: {
    id: 'highPowerGreen',
    nominalWavelengthNm: { red: 638, green: 520, blue: 450 },
    relativeOpticalPower: { red: 0.72, green: 1.18, blue: 0.68 },
    channelBalance: { red: 1, green: 0.82, blue: 1 },
    minimumModulationThreshold: 0.018,
    maximumOutput: 1.5,
    cameraResponse: { red: 0.9, green: 1.08, blue: 0.78 },
  },
  rgbwCamera: {
    id: 'rgbwCamera',
    nominalWavelengthNm: { red: 638, green: 520, blue: 450, white: 545 },
    relativeOpticalPower: { red: 0.86, green: 0.94, blue: 0.82, white: 0.72 },
    channelBalance: { red: 1, green: 0.94, blue: 1, white: 0.82 },
    minimumModulationThreshold: 0.01,
    maximumOutput: 1.45,
    cameraResponse: { red: 0.94, green: 1, blue: 0.84, white: 1 },
  },
})

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

export function srgbChannelToLinear(value: number): number {
  const encoded = clamp(value)
  return encoded <= 0.04045
    ? encoded / 12.92
    : Math.pow((encoded + 0.055) / 1.055, 2.4)
}

export function linearChannelToSrgb(value: number): number {
  const linear = Math.max(0, Number.isFinite(value) ? value : 0)
  return linear <= 0.0031308
    ? linear * 12.92
    : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055
}

export function parseLaserDmxSrgbHex(value: string, fallback = '#4ac7db'): LaserDmxSceneColor {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim()) ?? /^#?([0-9a-f]{6})$/i.exec(fallback)
  const hex = match?.[1] ?? '4ac7db'
  return {
    r: srgbChannelToLinear(parseInt(hex.slice(0, 2), 16) / 255),
    g: srgbChannelToLinear(parseInt(hex.slice(2, 4), 16) / 255),
    b: srgbChannelToLinear(parseInt(hex.slice(4, 6), 16) / 255),
    a: 1,
  }
}

export function resolveLaserDmxFixtureCalibration(kind: LaserDmxShowDirectorFixtureKind): LaserDmxFixtureCalibrationProfile {
  if (kind === 'laser') return LASER_DMX_FIXTURE_CALIBRATIONS.balancedRgb
  if (kind === 'movingHead' || kind === 'parWash' || kind === 'blinder') return LASER_DMX_FIXTURE_CALIBRATIONS.rgbwCamera
  return LASER_DMX_FIXTURE_CALIBRATIONS.balancedRgb
}

export function calibrateLaserDmxChannels(
  channels: LaserColorChannels,
  profile: LaserDmxFixtureCalibrationProfile,
): LaserDmxSceneColor {
  const white = srgbChannelToLinear(clamp((channels.white ?? 0) / 255))
  const convert = (value: number, key: keyof LaserColorChannels): number => {
    const encoded = clamp(value / 255)
    const linear = srgbChannelToLinear(encoded)
    const optical = profile.relativeOpticalPower[key] ?? 1
    const balance = profile.channelBalance[key] ?? 1
    const camera = profile.cameraResponse[key] ?? 1
    const whiteEnergy = white
      * (profile.relativeOpticalPower.white ?? 1)
      * (profile.channelBalance.white ?? 1)
      * (profile.cameraResponse.white ?? 1)
    const energy = linear * optical * balance * camera + whiteEnergy
    if (energy < profile.minimumModulationThreshold) return 0
    return clamp(energy, 0, profile.maximumOutput)
  }
  return {
    r: convert(channels.red, 'red'),
    g: convert(channels.green, 'green'),
    b: convert(channels.blue, 'blue'),
    a: 1,
  }
}

export function mixLaserDmxLinearColors(colors: readonly LaserDmxSceneColor[]): LaserDmxSceneColor {
  if (colors.length === 0) return { r: 0, g: 0, b: 0, a: 0 }
  return colors.reduce<LaserDmxSceneColor>((sum, color) => ({
    r: sum.r + Math.max(0, color.r),
    g: sum.g + Math.max(0, color.g),
    b: sum.b + Math.max(0, color.b),
    a: Math.max(sum.a, color.a),
  }), { r: 0, g: 0, b: 0, a: 0 })
}

export function resolveLaserDmxHighlightWhitening(energy: number, coreEnergy: number): number {
  const opticalEnergy = Math.max(0, energy) * (0.58 + clamp(coreEnergy) * 0.42)
  const threshold = 0.82
  const shoulder = Math.max(0, opticalEnergy - threshold)
  return clamp(shoulder / (0.65 + shoulder), 0, 0.82)
}

export function applyLaserDmxBoundedHighlightWhitening(
  color: LaserDmxSceneColor,
  mix: number,
): LaserDmxSceneColor {
  const bounded = clamp(mix, 0, 0.82)
  const peak = Math.max(color.r, color.g, color.b, 1e-6)
  const paleTarget = Math.min(1.5, peak * 1.08 + 0.08)
  return {
    r: color.r + (paleTarget - color.r) * bounded,
    g: color.g + (paleTarget - color.g) * bounded,
    b: color.b + (paleTarget - color.b) * bounded,
    a: color.a,
  }
}

export function wavelengthScatterResponse(color: LaserDmxSceneColor): number {
  const total = Math.max(1e-6, color.r + color.g + color.b)
  const red = color.r / total
  const green = color.g / total
  const blue = color.b / total
  return clamp(red * 0.72 + green * 0.92 + blue * 1.08, 0.6, 1.1)
}
