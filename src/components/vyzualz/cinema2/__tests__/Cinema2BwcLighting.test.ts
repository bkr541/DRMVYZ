import { describe, expect, it } from 'vitest'
import {
  BWC_CEILING_TUBE_COUNT,
  BWC_CEILING_TUBE_FIRST,
  BWC_CEILING_TUBE_PITCH,
  BWC_LIGHT_LEVEL_MAX,
  BWC_LIT_MATERIAL,
  BWC_PIPE_COUNT,
  BWC_PIPE_ENDS,
  BWC_PIPE_HUB,
  BWC_WALL_BAY_COUNT,
  BWC_WALL_BAY_FIRST,
  BWC_WALL_BAY_PITCH,
  NEUTRAL_BWC_LIGHT_COLORS,
  bwcCeilingTubeIndex,
  bwcLightLevels,
  bwcLightingGlsl,
  bwcMaterialLiteral,
  bwcPipeMaterial,
  bwcWallBayIndex,
  clampBwcLightLevel,
  neutralBwcLighting,
} from '../modules/bwc/Cinema2BwcLighting'

describe('BWC lit elements', () => {
  it('starts every element at its authored level, so an unchoreographed scene looks as authored', () => {
    const lighting = neutralBwcLighting()
    expect([lighting.reactorCore, lighting.reactorRing, lighting.hood]).toEqual([1, 1, 1])
    expect(lighting.pipes).toEqual([1, 1, 1, 1, 1])
    expect(lighting.wallLeft).toHaveLength(BWC_WALL_BAY_COUNT)
    expect(lighting.wallRight).toHaveLength(BWC_WALL_BAY_COUNT)
    expect(lighting.ceiling).toHaveLength(BWC_CEILING_TUBE_COUNT)
    expect([...lighting.wallLeft, ...lighting.wallRight, ...lighting.ceiling].every(level => level === 1)).toBe(true)
    expect(lighting.ringChase[1]).toBe(0)
    expect(lighting.pipeFlow[1]).toBe(0)
  })

  it('clamps levels, and reads missing or broken ones as unlit', () => {
    expect(clampBwcLightLevel(-1)).toBe(0)
    expect(clampBwcLightLevel(7)).toBe(BWC_LIGHT_LEVEL_MAX)
    expect(clampBwcLightLevel(Number.NaN)).toBe(0)
    expect(clampBwcLightLevel(Number.POSITIVE_INFINITY)).toBe(0)
    expect(Array.from(bwcLightLevels([0.5, 3], 4))).toEqual([0.5, BWC_LIGHT_LEVEL_MAX, 0, 0])
    expect(bwcLightLevels([1, 1, 1, 1, 1, 1], 3)).toHaveLength(3)
  })

  it('maps a wall panel to its bay: bay k is centred on z = 3.10 k, and the ends clamp', () => {
    for (let k = BWC_WALL_BAY_FIRST; k < BWC_WALL_BAY_FIRST + BWC_WALL_BAY_COUNT; k += 1) {
      const index = k - BWC_WALL_BAY_FIRST
      expect(bwcWallBayIndex(k * BWC_WALL_BAY_PITCH)).toBe(index)
      expect(bwcWallBayIndex(k * BWC_WALL_BAY_PITCH + 0.22)).toBe(index) // the panel is 0.44 m long
      expect(bwcWallBayIndex(k * BWC_WALL_BAY_PITCH - 0.22)).toBe(index)
    }
    expect(bwcWallBayIndex(-40)).toBe(0)
    expect(bwcWallBayIndex(40)).toBe(BWC_WALL_BAY_COUNT - 1)
  })

  it('maps a ceiling tube to its bay: tube j sits at z = 3.70 j - 0.64, and the ends clamp', () => {
    for (let j = BWC_CEILING_TUBE_FIRST; j < BWC_CEILING_TUBE_FIRST + BWC_CEILING_TUBE_COUNT; j += 1) {
      const index = j - BWC_CEILING_TUBE_FIRST
      const z = j * BWC_CEILING_TUBE_PITCH - 0.64
      expect(bwcCeilingTubeIndex(z)).toBe(index)
      expect(bwcCeilingTubeIndex(z + 0.075)).toBe(index)
      expect(bwcCeilingTubeIndex(z - 0.075)).toBe(index)
    }
    expect(bwcCeilingTubeIndex(-40)).toBe(0)
    expect(bwcCeilingTubeIndex(40)).toBe(BWC_CEILING_TUBE_COUNT - 1)
  })

  it('gives every lit family its own material id, in the bands the shader classifies by', () => {
    const pipes = Array.from({ length: BWC_PIPE_COUNT }, (_, i) => bwcPipeMaterial(i))
    expect(pipes).toEqual([6.1, 6.2, 6.3, 6.4, 6.5])
    const energy = [BWC_LIT_MATERIAL.reactorRing, BWC_LIT_MATERIAL.hoodFrame, ...pipes]
    const white = [BWC_LIT_MATERIAL.wallPanel, BWC_LIT_MATERIAL.ceilingTube]
    // Energy-coloured lights lie in [5.95, 6.95), white ones in [6.95, 7.95); brass (8) and the cans (5) are neither.
    expect(energy.every(material => material > 5.95 && material < 6.95)).toBe(true)
    expect(white.every(material => material > 6.95 && material < 7.95)).toBe(true)
    expect(new Set([...energy, ...white]).size).toBe(energy.length + white.length)
    // The ring is told apart from the hood and the pipes by the shader's 6.02 and 6.07 cut-offs; the wall from the ceiling by 7.25.
    expect(BWC_LIT_MATERIAL.reactorRing).toBeLessThan(6.02)
    expect(BWC_LIT_MATERIAL.hoodFrame).toBeGreaterThan(6.02)
    expect(BWC_LIT_MATERIAL.hoodFrame).toBeLessThan(6.07)
    expect(BWC_LIT_MATERIAL.pipeFirst).toBeGreaterThan(6.07)
    expect(BWC_LIT_MATERIAL.wallPanel).toBeLessThan(7.25)
    expect(BWC_LIT_MATERIAL.ceilingTube).toBeGreaterThan(7.25)
    expect(bwcMaterialLiteral(6.05)).toBe('6.05')
    expect(bwcMaterialLiteral(7)).toBe('7.00')
  })

  it('hands the shader the same layout: sizes, pitches and the pipe geometry', () => {
    const glsl = bwcLightingGlsl()
    expect(glsl).toContain(`uniform float u_pipeLevels[${BWC_PIPE_COUNT}];`)
    expect(glsl).toContain(`uniform float u_wallLevels[${BWC_WALL_BAY_COUNT * 2}];`)
    expect(glsl).toContain(`uniform float u_ceilingLevels[${BWC_CEILING_TUBE_COUNT}];`)
    expect(glsl).toContain('const float WALL_BAY_PITCH = 3.1;')
    expect(glsl).toContain('const float CEILING_TUBE_PITCH = 3.7;')
    expect(glsl).toContain(`const vec3 PIPE_HUB = vec3(${BWC_PIPE_HUB[0]}, ${BWC_PIPE_HUB[1]}, ${BWC_PIPE_HUB[2]});`)
    expect(glsl).toContain(`vec3(${BWC_PIPE_ENDS[4]![0]}, ${BWC_PIPE_ENDS[4]![1]}, ${BWC_PIPE_ENDS[4]![2]})`)
    expect(glsl).toContain(`- (${BWC_WALL_BAY_FIRST}.0)`)
    expect(glsl).toContain(`- (${BWC_CEILING_TUBE_FIRST}.0)`)
  })

  it('has a green reactor and pipes and white-blue lights by default', () => {
    const { reactor, pipes, wall, ceiling } = NEUTRAL_BWC_LIGHT_COLORS
    expect(reactor[1]).toBeGreaterThan(reactor[0])
    expect(pipes[1]).toBeGreaterThan(pipes[2])
    expect(wall[2]).toBeGreaterThan(wall[0])
    expect(ceiling[2]).toBeGreaterThan(ceiling[0])
  })
})
