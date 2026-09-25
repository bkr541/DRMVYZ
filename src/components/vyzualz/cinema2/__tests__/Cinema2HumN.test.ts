/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CINEMA2_HUMN_PRESET_ID,
  CINEMA2_HUMN_PRESET_MANIFEST,
  cinema2NativePresetRegistry,
} from '..'
import { cinema2Ref, type Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HUMN_BONE, CINEMA2_HUMN_BONE_COUNT, CINEMA2_HUMN_BONE_PIVOTS } from '../modules/humn/Cinema2HumNMesh'
import { createHarness, type Harness } from './support/Cinema2HumNHarness'

// Everything below drives the PRODUCTION runtime: Audio Intelligence bridge -> Visual Director -> Choreography -> canonical targets -> native
// HUM:N module -> shader uniforms. Nothing here reads parameter state as a shortcut.

const live: Harness[] = []
function harness(options?: Parameters<typeof createHarness>[0]): Harness {
  const created = createHarness(options)
  live.push(created)
  return created
}
afterEach(() => {
  while (live.length > 0) live.pop()?.dispose()
  vi.restoreAllMocks()
})

const id = (name: string) => `hum-n-${name}` as Cinema2ParameterId
const P = {
  intensity: id('master-intensity'),
  bpmSync: id('bpm-sync'),
  auto: id('auto-performance'),
  motion: id('motion-amount'),
  rate: id('motion-rate'),
  scale: id('figure-scale'),
  fill: id('facet-fill'),
  fillStyle: id('fill-style'),
  flicker: id('flicker-amount'),
  jitter: id('fragment-jitter'),
  autoColor: id('auto-color'),
  primary: id('skin-primary'),
  secondary: id('skin-secondary'),
  accent: id('skin-accent'),
  wireframe: id('wireframe'),
  ink: id('pattern-ink'),
  fragmentation: id('fragmentation'),
  linePresence: id('line-presence'),
  detail: id('mesh-detail'),
} as const

const manifestParameters = new Map((CINEMA2_HUMN_PRESET_MANIFEST.parameters ?? []).map(parameter => [String(parameter.id), parameter]))

/** A quiet, calm track: no continuous audio lift reaches the figure, so the user values show through unchanged. */
const CALM = { energy: 0.1, complexity: 0.5 } as const

function boneMatrix(h: Harness, bone: number): Float32Array {
  return h.matrix('u_bones').slice(bone * 16, bone * 16 + 16)
}

/** Where a bind-pose joint ends up under its bone's current skinning matrix. */
function joint(h: Harness, bone: number): [number, number, number] {
  const m = boneMatrix(h, bone)
  const p = CINEMA2_HUMN_BONE_PIVOTS[bone]!
  return [0, 1, 2].map(r => m[r]! * p[0] + m[4 + r]! * p[1] + m[8 + r]! * p[2] + m[12 + r]!) as [number, number, number]
}

function isRest(h: Harness): boolean {
  const bones = h.matrix('u_bones')
  for (let bone = 0; bone < CINEMA2_HUMN_BONE_COUNT; bone += 1) {
    for (let element = 0; element < 16; element += 1) {
      if (Math.abs(bones[bone * 16 + element]! - (element % 5 === 0 ? 1 : 0)) > 1e-4) return false
    }
  }
  return true
}

/** Plays a drop and parks the harness a moment into its hold. */
function playDrop(h: Harness, dropId: string) {
  h.step({ frames: 3 })
  h.step({ dropMoments: [{ id: dropId, timeSec: 10.12 }], frames: 1 })
  h.step({ frames: 4, dt: 0.05 })
}

function family(h: Harness): 'reach' | 'shock' | 'headGrab' | 'lunge' | 'none' {
  const chest = joint(h, CINEMA2_HUMN_BONE.spine)
  const left = joint(h, CINEMA2_HUMN_BONE.leftHand)
  const right = joint(h, CINEMA2_HUMN_BONE.rightHand)
  if (chest[2] > 0.25) return 'lunge'
  if (chest[2] < -0.04) return 'shock'
  if (left[1] > 0.55 && right[1] > 0.55) return 'headGrab'
  if (left[2] > 0.4) return 'reach'
  return 'none'
}

// ── Manifest contract ───────────────────────────────────────────────────────

describe('HUM:N manifest contract', () => {
  it('is revision 22, a 3D scene with a camera, and compiles when the 3D capabilities are available', () => {
    expect(CINEMA2_HUMN_PRESET_MANIFEST.revision).toBe(22)
    expect(CINEMA2_HUMN_PRESET_MANIFEST.cameras).toHaveLength(1)
    const compiled = cinema2NativePresetRegistry.compile(CINEMA2_HUMN_PRESET_ID, { availableCapabilities: ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world'] })
    expect(compiled.ok, compiled.ok ? '' : compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
  })

  it('has one Master Intensity and none of the retired controls (Master Reactivity, Grid Presence, Gesture Intensity, Color Shift Amount)', () => {
    const labels = [...manifestParameters.values()].map(parameter => parameter.label)
    expect(labels.filter(label => label === 'Master Intensity')).toHaveLength(1)
    for (const retired of ['Master Reactivity', 'Grid Presence', 'Gesture Intensity', 'Color Shift Amount']) expect(labels, retired).not.toContain(retired)
    for (const retired of ['master-reactivity', 'grid-presence', 'gesture-intensity', 'color-shift-amount']) expect(manifestParameters.has(`hum-n-${retired}`), retired).toBe(false)
    expect(manifestParameters.get(P.intensity)).toMatchObject({ type: 'float', min: 0, max: 1, defaultValue: 0.75, designParentGroup: 'master-controls' })
  })

  it('lets Figure Scale go up to a close-up filling the frame', () => {
    expect(manifestParameters.get(P.scale)).toMatchObject({ min: 0.6, max: 2.5, defaultValue: 1 })
  })

  it('puts Auto Color first in the Palette and shows the manual colors only while it is off', () => {
    const auto = manifestParameters.get(P.autoColor)
    expect(auto).toMatchObject({ type: 'boolean', defaultValue: true, designParentGroup: 'palette' })
    const palette = [...manifestParameters.values()].filter(parameter => parameter.designParentGroup === 'palette')
    const order = (parameter: { order?: number }) => parameter.order ?? 0
    expect(Math.min(...palette.map(order))).toBe(order(auto!))
    for (const manual of [P.wireframe, P.primary, P.secondary, P.accent, P.ink]) {
      expect(manifestParameters.get(manual)?.visibleWhen, String(manual)).toEqual([{ kind: 'parameter-equals', parameterId: P.autoColor, value: false }])
    }
    expect(manifestParameters.get(id('background'))?.visibleWhen).toBeUndefined()
  })

  it('ships defaults that react out of the box', () => {
    expect(manifestParameters.get(P.flicker)).toMatchObject({ defaultValue: 0.5 })
    expect(manifestParameters.get(P.jitter)).toMatchObject({ defaultValue: 0.4 })
    expect(manifestParameters.get(P.motion)).toMatchObject({ defaultValue: 0.6 })
    expect(manifestParameters.get(P.auto)).toMatchObject({ defaultValue: true })
    expect(manifestParameters.get(P.bpmSync)).toMatchObject({ defaultValue: true })
  })

  it('does not put a Gesture Intensity or an Auto Performance take-over on any control', () => {
    for (const parameter of manifestParameters.values()) expect(parameter.metadata?.userEditSetParameters, String(parameter.id)).toBeUndefined()
  })

  it('gates the structural pose rules with Auto Performance and never uses the retired Master Reactivity', () => {
    const rules = CINEMA2_HUMN_PRESET_MANIFEST.choreography?.rules ?? []
    for (const ruleId of ['hum-n-drop-gesture', 'hum-n-phrase-look', 'hum-n-section-look']) {
      expect(rules.find(rule => rule.id === ruleId)?.enabledParameter, ruleId).toEqual(cinema2Ref(P.auto))
    }
    expect(JSON.stringify(CINEMA2_HUMN_PRESET_MANIFEST)).not.toContain('master-reactivity')
    for (const rule of rules) expect(rule.id, 'the momentum rule that damped Flicker and Jitter').not.toBe('hum-n-auto-momentum-ceilings')
  })

  it('has no grid anywhere: no grid control, and the shader has none', async () => {
    expect([...manifestParameters.keys()].filter(key => key.includes('grid'))).toEqual([])
    const { Cinema2HumNRenderer } = await import('../modules/humn/Cinema2HumNRenderer')
    expect(Cinema2HumNRenderer.toString()).not.toMatch(/macroGrid/)
  })
})

// ── Rendering path ──────────────────────────────────────────────────────────

describe('HUM:N draws a 3D figure through the production runtime', () => {
  it('draws the mesh with depth every frame with no failed pass, and rests in the bind pose with Motion Amount 0', () => {
    const h = harness({ state: { [P.motion]: 0 } })
    h.step({ ...CALM, frames: 6 })
    expect(h.drawCount()).toBeGreaterThan(0)
    expect(h.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ failedPassCount: 0 })
    expect(h.runtime.getModuleRuntimeSnapshot()).toMatchObject({ failedModuleCount: 0 })
    expect(isRest(h)).toBe(true)
    expect(joint(h, CINEMA2_HUMN_BONE.head)[1]).toBeCloseTo(0.585, 3)
  })

  it('moves the body when Motion Amount is raised, and more for more motion', () => {
    const at = (motion: number) => {
      const h = harness({ state: { [P.motion]: motion, [P.auto]: false } })
      h.step({ ...CALM, frames: 40 })
      const head = joint(h, CINEMA2_HUMN_BONE.head)
      return Math.hypot(head[0], head[1] - 0.585, head[2])
    }
    expect(at(0)).toBeLessThan(1e-5)
    expect(at(0.4)).toBeGreaterThan(0.0002)
    expect(at(1)).toBeGreaterThan(at(0.4))
  })

  it('scales the whole figure about its framing point with Figure Scale, up to 2.5x', () => {
    for (const scale of [0.6, 1, 1.7, 2.5]) {
      const h = harness({ state: { [P.scale]: scale } })
      h.step({ ...CALM, frames: 2 })
      const model = h.matrix('u_model')
      expect(model[0]).toBeCloseTo(scale, 5)
      expect(model[5]).toBeCloseTo(scale, 5)
      expect(model[10]).toBeCloseTo(scale, 5)
    }
  })

  it('never leaves the model matrix, bones or colors non-finite', () => {
    const h = harness({ state: { [P.scale]: 2.5, [P.motion]: 1, [P.flicker]: 1, [P.jitter]: 1 } })
    h.step({ energy: 1, beat: true, downbeat: true, kick: 1, snare: 1, frames: 30 })
    for (const name of ['u_bones', 'u_model', 'u_view', 'u_projection']) for (const value of h.matrix(name)) expect(Number.isFinite(value), name).toBe(true)
  })
})

// ── Facet fill ──────────────────────────────────────────────────────────────

describe('Facet Fill', () => {
  it('fills every triangle at the top of the slider whatever the music does', () => {
    const h = harness({ state: { [P.fill]: 1 } })
    h.step({ energy: 0.9, frames: 20 })
    expect(h.uniform('u_fill')).toBe(1)
    h.step({ energy: 0.05, frames: 20 })
    expect(h.uniform('u_fill')).toBe(1)
  })

  it('shows only the user value on a calm track with Auto Performance off, and none at 0', () => {
    for (const value of [0, 0.35, 0.8]) {
      const h = harness({ state: { [P.fill]: value, [P.auto]: false } })
      h.step({ ...CALM, frames: 30 })
      expect(h.uniform('u_fill')).toBeCloseTo(value, 4)
    }
  })

  it('lets the whole track\'s energy add up to +0.35, scaled by Master Intensity', () => {
    const at = (intensity: number) => {
      const h = harness({ state: { [P.fill]: 0.2, [P.auto]: false, [P.intensity]: intensity } })
      h.step({ energy: 0.5, trackCurve: 1, frames: 60 })
      return h.uniform('u_fill')
    }
    expect(at(0)).toBeCloseTo(0.2, 3)
    expect(at(1)).toBeCloseTo(0.55, 2)
    expect(at(0.5)).toBeCloseTo(0.375, 2)
  })

  it('turns the filled set over as the track plays (so no triangle keeps its color), and re-rolls it on downbeats', () => {
    const h = harness({ state: { [P.fill]: 0.5, [P.auto]: false, [P.flicker]: 1 } })
    h.step({ ...CALM, frames: 3 })
    const early = h.uniform('u_fillShift')
    h.step({ ...CALM, frames: 60 })
    const later = h.uniform('u_fillShift')
    expect(later).toBeGreaterThan(early)
    h.step({ ...CALM, downbeat: true, frames: 1 })
    expect(h.uniform('u_fillShift') - later).toBeGreaterThan(0.15)
  })

  it('routes Fill Style, Fragmentation, Line Presence and Mesh Detail to the renderer', () => {
    const h = harness({ state: { [P.fillStyle]: 'Gradient', [P.fragmentation]: 0.4, [P.linePresence]: 0.6, [P.detail]: 'Sparse', [P.auto]: false } })
    // Loud music leaves Line Presence at the user's value (only quiet passages lower it).
    h.step({ energy: 1, frames: 30 })
    expect(h.int('u_fillStyle')).toBe(1)
    expect(h.uniform('u_fragmentation')).toBeCloseTo(0.4, 4)
    expect(h.uniform('u_linePresence')).toBeCloseTo(0.6, 1)
    expect(h.uniform('u_edgeShare')).toBeLessThan(1)
  })
})

// ── BPM Sync ────────────────────────────────────────────────────────────────

describe('BPM Sync', () => {
  const advance = (bpm: number, options: { sync: boolean; dock?: boolean; rate?: string }) => {
    const h = harness({ state: { [P.bpmSync]: options.sync, [P.motion]: 1, [P.auto]: false, ...(options.rate ? {} : {}) } })
    if (options.rate) h.set(P.rate, options.rate)
    h.transport.bpmSync = options.dock ?? false
    h.step({ ...CALM, bpm, frames: 30 })
    const start = h.uniform('u_gradientScroll')
    h.step({ ...CALM, bpm, frames: 120 })
    return h.uniform('u_gradientScroll') - start
  }

  it('locks the color scroll and the turnover to the track tempo when on, so a faster track runs faster', () => {
    const slow = advance(90, { sync: true })
    const fast = advance(150, { sync: true })
    expect(slow).toBeGreaterThan(0)
    expect(fast / slow).toBeCloseTo(150 / 90, 1)
  })

  it('free-runs at one steady tempo when off, whatever the track tempo', () => {
    expect(advance(90, { sync: false })).toBeCloseTo(advance(150, { sync: false }), 3)
  })

  it('is HUM:N\'s own switch: the Audio Dock Sync neither enables nor blocks it', () => {
    expect(advance(150, { sync: true, dock: false })).toBeCloseTo(advance(150, { sync: true, dock: true }), 4)
    expect(advance(150, { sync: false, dock: true })).toBeCloseTo(advance(150, { sync: false, dock: false }), 4)
  })

  it('makes the body sway differently on and off (locked to the beat grid versus free-running)', () => {
    const pose = (sync: boolean) => {
      const h = harness({ state: { [P.bpmSync]: sync, [P.motion]: 1, [P.auto]: false } })
      h.step({ ...CALM, bpm: 150, frames: 150 })
      return Array.from(h.matrix('u_bones'))
    }
    const on = pose(true)
    const off = pose(false)
    expect(on.some((value, index) => Math.abs(value - off[index]!) > 1e-3)).toBe(true)
  })

  it('Motion Rate multiplies the scroll speed', () => {
    const base = advance(120, { sync: true, rate: '1x' })
    const double = advance(120, { sync: true, rate: '2x' })
    expect(double / base).toBeCloseTo(2, 1)
  })

  it('stands still when the transport is paused', () => {
    const h = harness({ state: { [P.motion]: 1, [P.auto]: false } })
    h.step({ ...CALM, frames: 30 })
    h.pause(true)
    h.step({ ...CALM, frames: 3 })
    const before = h.uniform('u_gradientScroll')
    h.step({ ...CALM, frames: 30 })
    expect(h.uniform('u_gradientScroll')).toBe(before)
  })
})

// ── Flicker and Fragment Jitter ─────────────────────────────────────────────

describe('Flicker Amount and Fragment Jitter react to the rhythm', () => {
  const hit = { ...CALM, beat: true, downbeat: true, kick: 1, snare: 1, frames: 1 } as const

  it('Flicker Amount flashes triangles on the beat, the downbeat and the snare, in proportion to the slider', () => {
    const at = (value: number) => {
      const h = harness({ state: { [P.flicker]: value } })
      h.step({ ...CALM, frames: 5 })
      h.step(hit)
      return { beat: h.uniform('u_flicker'), down: h.uniform('u_flickerDown'), snare: h.uniform('u_snare') }
    }
    const zero = at(0)
    expect(zero.beat).toBe(0)
    expect(zero.down).toBe(0)
    const half = at(0.5)
    const full = at(1)
    expect(full.beat).toBeGreaterThan(0.9)
    expect(full.down).toBeGreaterThan(0.9)
    expect(full.snare).toBeGreaterThan(0.9)
    expect(half.beat).toBeCloseTo(full.beat / 2, 2)
    expect(half.down).toBeCloseTo(full.down / 2, 2)
  })

  it('Fragment Jitter throws triangles off the body on the kick, up to seven centimetres, and settles back', () => {
    const at = (value: number) => {
      const h = harness({ state: { [P.jitter]: value } })
      h.step({ ...CALM, frames: 5 })
      h.step(hit)
      const peak = h.uniform('u_jitter')
      h.step({ ...CALM, dt: 0.1, frames: 12 })
      return { peak, settled: h.uniform('u_jitter') }
    }
    expect(at(0).peak).toBe(0)
    const full = at(1)
    expect(full.peak).toBeCloseTo(0.07, 3)
    expect(at(0.5).peak).toBeCloseTo(0.035, 3)
    expect(full.settled).toBeLessThan(full.peak * 0.1)
  })

  it('does not depend on Master Intensity or Auto Performance, so the sliders always do something', () => {
    const h = harness({ state: { [P.flicker]: 1, [P.jitter]: 1, [P.intensity]: 0, [P.auto]: false } })
    h.step({ ...CALM, frames: 5 })
    h.step(hit)
    expect(h.uniform('u_flicker')).toBeGreaterThan(0.9)
    expect(h.uniform('u_jitter')).toBeGreaterThan(0.06)
  })

  it('picks a different set of triangles for a different event and the same set for the same event identity', () => {
    const seeds = (seed: string) => {
      const h = harness({ seed, state: { [P.flicker]: 1, [P.jitter]: 1 } })
      h.step({ ...CALM, frames: 5 })
      h.step({ ...hit })
      return [h.uniform('u_beatSeed'), h.uniform('u_kickSeed'), h.uniform('u_downSeed')]
    }
    expect(seeds('same')).toEqual(seeds('same'))
    expect(seeds('same')).not.toEqual(seeds('other'))
  })

  it('does nothing without a beat grid (no fabricated timing)', () => {
    const h = harness({ state: { [P.flicker]: 1, [P.jitter]: 1 } })
    h.step({ ...CALM, rhythm: false, frames: 10 })
    expect(h.uniform('u_flicker')).toBe(0)
    expect(h.uniform('u_jitter')).toBe(0)
  })
})

// ── Auto Color ──────────────────────────────────────────────────────────────

describe('Auto Color', () => {
  const settled = (state: Record<string, number | boolean>, frame: Record<string, unknown> = {}) => {
    const h = harness({ state })
    h.step({ ...CALM, frames: 150, ...frame } as never)
    return h
  }

  it('picks the palette from the music: a different key gives different colors', () => {
    const c = settled({}, { key: 'C', mode: 'major' })
    const fSharp = settled({}, { key: 'F#', mode: 'major' })
    expect(c.vec3('u_color0')).not.toEqual(fSharp.vec3('u_color0'))
    for (const channel of [...c.vec3('u_color0'), ...c.vec3('u_color1'), ...c.vec3('u_color2')]) {
      expect(channel).toBeGreaterThanOrEqual(0)
      expect(channel).toBeLessThanOrEqual(1)
    }
  })

  it('uses the manual colors only when Auto Color is off', () => {
    const primary = [0.1, 0.2, 0.3, 1] as never
    const secondary = [0.4, 0.5, 0.6, 1] as never
    const accent = [0.7, 0.8, 0.9, 1] as never
    const wire = [0.9, 0.1, 0.1, 1] as never
    const h = harness({})
    h.set(P.autoColor, false)
    for (const [parameter, value] of [[P.primary, primary], [P.secondary, secondary], [P.accent, accent], [P.wireframe, wire]] as const) h.set(parameter, value)
    h.step({ ...CALM, key: 'C', mode: 'major', frames: 5 })
    expect(h.vec3('u_color0')).toEqual([0.1, 0.2, 0.3])
    expect(h.vec3('u_color1')).toEqual([0.4, 0.5, 0.6])
    expect(h.vec3('u_color2')).toEqual([0.7, 0.8, 0.9])
    expect(h.vec4('u_wireframe')[0]).toBeCloseTo(0.9, 5)
    h.set(P.autoColor, true)
    h.step({ ...CALM, key: 'C', mode: 'major', frames: 5 })
    expect(h.vec3('u_color0')).not.toEqual([0.1, 0.2, 0.3])
  })

  it('keeps the auto wireframe near white so the figure stays crisp', () => {
    const h = settled({}, { key: 'A', mode: 'minor' })
    for (const channel of h.vec4('u_wireframe').slice(0, 3)) expect(channel).toBeGreaterThan(0.85)
  })

  it('steps around the color wheel on a section change', () => {
    const h = harness({})
    h.step({ ...CALM, key: 'C', mode: 'major', sectionType: 'verse', sectionStartSec: 0, sectionEndSec: 30, frames: 60 })
    const before = h.vec3('u_color0')
    h.step({ ...CALM, key: 'C', mode: 'major', sectionType: 'chorus', sectionStartSec: 30, sectionEndSec: 60, frames: 90 })
    expect(h.vec3('u_color0')).not.toEqual(before)
  })
})

// ── Auto Performance ────────────────────────────────────────────────────────

describe('Auto Performance owns every pose', () => {
  const DROP_IDS = Array.from({ length: 40 }, (_, index) => `drop-${index}`)

  it('strikes reach, recoil, head grab and lunge poses on drops, all four reachable and each deterministic', () => {
    const seen = new Set<string>()
    for (const dropId of DROP_IDS) {
      const a = harness({ state: { [P.motion]: 0, [P.intensity]: 1 } })
      const b = harness({ state: { [P.motion]: 0, [P.intensity]: 1 } })
      playDrop(a, dropId)
      playDrop(b, dropId)
      expect(family(a), dropId).toBe(family(b))
      expect(Array.from(a.matrix('u_bones'))).toEqual(Array.from(b.matrix('u_bones')))
      expect(isRest(a), dropId).toBe(false)
      seen.add(family(a))
      a.dispose()
      b.dispose()
    }
    expect([...seen].filter(name => name !== 'none').sort()).toEqual(['headGrab', 'lunge', 'reach', 'shock'])
  })

  it('returns to exactly the rest pose after the gesture releases', () => {
    const h = harness({ state: { [P.motion]: 0, [P.intensity]: 1 } })
    playDrop(h, 'drop-0')
    expect(isRest(h)).toBe(false)
    h.step({ frames: 40, dt: 0.1 })
    expect(isRest(h)).toBe(true)
  })

  it('never poses the figure with Auto Performance off, however many drops, phrases and sections happen', () => {
    for (const dropId of DROP_IDS.slice(0, 8)) {
      const h = harness({ state: { [P.motion]: 0, [P.intensity]: 1, [P.auto]: false } })
      playDrop(h, dropId)
      expect(isRest(h), dropId).toBe(true)
      h.dispose()
    }
    const h = harness({ state: { [P.motion]: 0, [P.intensity]: 1, [P.auto]: false } })
    h.step({ phrases: [{ id: 'p1', timeSec: 10.1 }], sectionType: 'drop', sectionStartSec: 10.2, sectionEndSec: 40, frames: 12 })
    expect(isRest(h)).toBe(true)
  })

  it('scales the gestures with Master Intensity and plays none at 0', () => {
    const reach = (intensity: number) => {
      const h = harness({ state: { [P.motion]: 0, [P.intensity]: intensity } })
      playDrop(h, 'drop-0')
      return Math.hypot(...joint(h, CINEMA2_HUMN_BONE.leftHand).map((value, index) => value - CINEMA2_HUMN_BONE_PIVOTS[CINEMA2_HUMN_BONE.leftHand]![index]!))
    }
    expect(reach(0)).toBeLessThan(1e-5)
    expect(reach(1)).toBeGreaterThan(reach(0.5))
    expect(reach(0.5)).toBeGreaterThan(0)
  })

  it('resets on a seek and starts from the rest pose again', () => {
    const h = harness({ state: { [P.motion]: 0, [P.intensity]: 1 } })
    playDrop(h, 'drop-0')
    expect(isRest(h)).toBe(false)
    h.step({ frames: 1, timeSec: 3 })
    expect(isRest(h)).toBe(true)
  })

  it('does nothing without a tempo or a drop (no fabricated events)', () => {
    const h = harness({ state: { [P.motion]: 0, [P.intensity]: 1 } })
    h.step({ frames: 3 })
    h.step({ dropMoments: [{ id: 'drop-0', timeSec: 10.12 }], rhythm: false, frames: 1 })
    h.step({ frames: 4, dt: 0.05, rhythm: false })
    expect(isRest(h)).toBe(true)
  })
})

// ── Intelligence bounds ─────────────────────────────────────────────────────

describe('music-driven lifts stay inside the user\'s values', () => {
  it('only lowers Line Presence with energy, never below 0.55x and never above the user value', () => {
    const at = (energy: number, intensity: number) => {
      const h = harness({ state: { [P.linePresence]: 0.8, [P.auto]: false, [P.intensity]: intensity } })
      h.step({ energy, frames: 60 })
      return h.uniform('u_linePresence')
    }
    expect(at(0.02, 1)).toBeLessThanOrEqual(0.8 + 1e-6)
    expect(at(0.02, 1)).toBeGreaterThanOrEqual(0.8 * 0.55 - 1e-6)
    expect(at(0.9, 1)).toBeGreaterThanOrEqual(0.8 * 0.55 - 1e-6)
    expect(at(0.9, 0)).toBeCloseTo(0.8, 4)
  })

  it('never writes music into persisted parameters', () => {
    const h = harness({})
    const before = h.snapshot()
    h.step({ energy: 0.9, beat: true, kick: 1, snare: 1, downbeat: true, key: 'D', mode: 'major', frames: 60 })
    expect(h.snapshot()).toBe(before)
  })

  it('has no Math.random anywhere in the figure code', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    for (const file of ['modules/Cinema2HumNNativeModule.ts', 'modules/humn/Cinema2HumNRenderer.ts', 'modules/humn/Cinema2HumNRig.ts', 'modules/humn/Cinema2HumNMesh.ts', 'modules/humn/Cinema2HumNAutoColor.ts']) {
      expect(readFileSync(resolve(process.cwd(), 'src/components/vyzualz/cinema2', file), 'utf8'), file).not.toMatch(/Math\.random/)
    }
  })
})
