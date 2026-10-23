import { describe, expect, it } from 'vitest'
import { Cinema2BlockshiftRotation } from '../modules/blockshift/Cinema2BlockshiftRotation'
import { buildCinema2BlockshiftLayout, cinema2BlockshiftHalfExtents } from '../modules/blockshift/Cinema2BlockshiftLayout'
import { CINEMA2_BLOCKSHIFT_PATTERN_IDS } from '../modules/blockshift/Cinema2BlockshiftDomain'
import { CINEMA2_BLOCKSHIFT_PRESET_MANIFEST as manifest, CINEMA2_BLOCKSHIFT_PARAMETER_IDS as ids } from '../presets/Cinema2BlockshiftPreset'
import { CINEMA2_THRESHOLD_PRESET_MANIFEST } from '../presets/Cinema2ThresholdPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'

const input = { reset: false, enabled: true, active: true, deltaBeats: 0.25, motionAmount: 1, motionRate: 1 }
function safe(pose: ReturnType<typeof buildCinema2BlockshiftLayout>) {
  for (const block of pose) {
    expect(Math.hypot(...block.position) + Math.sqrt(3) * block.size / 2).toBeLessThanOrEqual(600)
    expect(Math.hypot(...block.position) - Math.sqrt(3) * block.size / 2).toBeGreaterThanOrEqual(2.5 - 1e-8)
    for (const other of pose.slice(0, block.index)) expect(block.position.some((n, a) => Math.abs(n - other.position[a]!) >= cinema2BlockshiftHalfExtents(block)[a]! + cinema2BlockshiftHalfExtents(other)[a]! + 1.5 - 1e-8)).toBe(true)
  }
}

describe('BLOCKSHIFT size, LED atmosphere and varied cube rotation', () => {
  it('grows foreground cubes on screen instead of globally pushing them away, and doubles the size ceiling', () => {
    expect(manifest.parameters!.find(p => p.id === ids.blockSize)?.max).toBe(6)
    const oldMax = buildCinema2BlockshiftLayout({ blockSize: 3, spread: 1 })[0]!, maximum = buildCinema2BlockshiftLayout({ blockSize: 6, spread: 1 })[0]!
    expect(maximum.size).toBe(oldMax.size * 2)
    expect(maximum.size / Math.hypot(...maximum.position)).toBeGreaterThan(oldMax.size / Math.hypot(...oldMax.position) * 1.25)
  })

  it('keeps clearance and the observer volume safe through new size/spread/depth extrema and full rotations in every pattern', () => {
    const rotation = new Cinema2BlockshiftRotation()
    for (let frame = 0; frame < 4; frame++) {
      for (let i = 0; i < 80; i++) rotation.update(input)
      for (const pattern of CINEMA2_BLOCKSHIFT_PATTERN_IDS) for (const size of [1.05, 3, 6]) for (const spread of [0.5, 3]) for (const depth of [0, 1]) {
        safe(rotation.apply(buildCinema2BlockshiftLayout({ pattern, blockSize: size, spread, depth, phase: frame / 4, rotationRange: 45 })))
      }
    }
  })

  it('rotates all fifteen cubes around varied axes/directions, freezes pause/master zero/OFF, resumes and resets without saved writes', () => {
    const rotation = new Cinema2BlockshiftRotation(), base = buildCinema2BlockshiftLayout()
    expect(rotation.apply(base)).toBe(base)
    for (let i = 0; i < 40; i++) rotation.update(input)
    const moved = rotation.apply(base)
    expect(moved.map(b => b.id)).toEqual(base.map(b => b.id))
    expect(new Set(moved.map((b, i) => JSON.stringify(b.rotation.map((n, a) => n - base[i]!.rotation[a]!)))).size).toBe(15)
    expect(moved.every((b, i) => b.rotation.some((n, a) => n !== base[i]!.rotation[a]))).toBe(true)
    expect(moved.some(b => b.rotation[0] > 0) && moved.some(b => b.rotation[0] < 0)).toBe(true)
    for (const change of [{ enabled: false }, { active: false }, { motionAmount: 0 }]) { rotation.update({ ...input, ...change }); expect(rotation.apply(base)).toEqual(moved) }
    rotation.update(input); expect(rotation.apply(base)).not.toEqual(moved)
    rotation.update({ ...input, reset: true, deltaBeats: 0 }); expect(rotation.apply(base)).toBe(base)
  })

  it('turns even the slowest cube through a quarter turn within eight seconds at default motion, while Motion Rate still scales speed', () => {
    const normal = new Cinema2BlockshiftRotation(), faster = new Cinema2BlockshiftRotation(), base = buildCinema2BlockshiftLayout()
    // Eight seconds at 120 BPM, with the authored 55% Motion Amount.
    for (let i = 0; i < 64; i++) {
      normal.update({ ...input, motionAmount: 0.55 })
      faster.update({ ...input, motionAmount: 0.55, motionRate: 2 })
    }
    const turn = normal.apply(base)[0]!.rotation[0] - base[0]!.rotation[0]
    expect(turn).toBeGreaterThan(Math.PI / 2)
    expect(faster.apply(base)[0]!.rotation[0] - base[0]!.rotation[0]).toBeCloseTo(turn * 2)
  })

  it('exposes Rotate Cubes in Motion and reuses Threshold depth-aware smoke/shafts, with explicit atmosphere and master-off authority', () => {
    expect(compileCinema2NativePreset(manifest).ok).toBe(true)
    expect(cinema2NativeEffectRegistry.validateEffects(manifest.effects!).ok).toBe(true)
    expect(manifest.parameters!.find(p => p.id === ids.rotateCubes)).toMatchObject({ type: 'boolean', defaultValue: false, designParentGroup: 'design', group: 'Motion' })
    const atmosphere = manifest.effects!.find(e => e.typeId === 'volumetric-atmosphere')!, reference = CINEMA2_THRESHOLD_PRESET_MANIFEST.effects!.find(e => e.typeId === atmosphere.typeId)!
    expect(atmosphere.parameters!.smokeTexture).toBe(reference.parameters!.smokeTexture)
    expect(atmosphere.parameters!.shafts).toBeGreaterThan(0)
    expect(atmosphere.parameterBindings).toEqual({ enabled: { $ref: ids.atmosphere }, mix: { $ref: ids.masterIntensity } })
    expect(manifest.render!.passes.find(p => p.id === 'blockshift-atmosphere-pass')!.inputs!.map(i => i.attachment)).toEqual(['color', 'depth'])
  })
})
