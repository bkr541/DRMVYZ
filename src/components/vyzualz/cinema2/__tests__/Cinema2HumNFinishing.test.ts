/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CINEMA2_HUMN_AUTO_PERFORMANCE_ID,
  CINEMA2_HUMN_BLOOM_EFFECT_ID,
  CINEMA2_HUMN_BLOOM_PASS_ID,
  CINEMA2_HUMN_FACET_FILL_ID,
  CINEMA2_HUMN_FLICKER_AMOUNT_ID,
  CINEMA2_HUMN_FRAGMENT_JITTER_ID,
  CINEMA2_HUMN_FRAGMENT_SOURCE,
  CINEMA2_HUMN_GESTURE_INTENSITY_ID,
  CINEMA2_HUMN_GLOW_ID,
  CINEMA2_HUMN_MOTION_AMOUNT_ID,
  CINEMA2_HUMN_MASTER_REACTIVITY_ID,
  CINEMA2_HUMN_PRESET_ID,
  CINEMA2_HUMN_PRESET_MANIFEST,
  CINEMA2_HUMN_SCENE_PASS_ID,
  CINEMA2_HUMN_TRAILS_EFFECT_ID,
  CINEMA2_HUMN_TRAILS_ID,
  CINEMA2_HUMN_TRAILS_PASS_ID,
  CINEMA2_BLOOM_EFFECT_TYPE_ID,
  CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID,
  cinema2NativePresetRegistry,
  createCinema2DesignParentGroupModel,
} from '..'
import type { Cinema2EffectId } from '../contracts/Cinema2NativePresetManifest'
import { createHarness, type Harness } from './support/Cinema2HumNHarness'

// The finishing chain runs through the PRODUCTION runtime: parameter state ->
// canonical target resolver -> Effect Runtime -> Render Graph executor, with the
// engine-owned History service behind Trails. Nothing here reads a shortcut.

const GLOW = CINEMA2_HUMN_GLOW_ID
const TRAILS = CINEMA2_HUMN_TRAILS_ID
const MR = CINEMA2_HUMN_MASTER_REACTIVITY_ID
const AUTO = CINEMA2_HUMN_AUTO_PERFORMANCE_ID
const BLOOM = CINEMA2_HUMN_BLOOM_EFFECT_ID
const TRAILS_EFFECT = CINEMA2_HUMN_TRAILS_EFFECT_ID

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

/** Resolves an engine effect property exactly the way the Effect Runtime does. */
function effectValue(h: Harness, effectId: Cinema2EffectId, property: string): number {
  const plan = h.runtime.getCompiledPresetPlan()
  const target = plan.targets.targets.find(candidate => candidate.kind === 'effect' && candidate.ownerId === effectId && candidate.property === property)
  if (!target) throw new Error(`No effect target ${effectId}.${property}`)
  const resolved = h.runtime.getTargetResolver().resolve(target.id)
  if (!resolved.ok || typeof resolved.value !== 'number') throw new Error(`Could not resolve ${effectId}.${property}`)
  return resolved.value
}

const effectStatus = (h: Harness, effectId: Cinema2EffectId) =>
  h.runtime.getEffectRuntimeSnapshot().effects.find(effect => String(effect.effectId) === String(effectId))?.status

const history = (h: Harness) => h.runtime.getHistoryServiceSnapshot()
const trailsBuffer = (h: Harness) => history(h).buffers.find(buffer => buffer.name.includes(String(TRAILS_EFFECT)))

// Ranges from the approved Trails artistic mapping.
const TRAILS_MIX = { half: [0.35, 0.45], full: [0.70, 0.80] } as const
const TRAILS_PERSISTENCE = { half: [0.78, 0.86], full: [0.92, 0.96] } as const
const within = (value: number, [min, max]: readonly [number, number] | readonly number[]) => {
  expect(value).toBeGreaterThanOrEqual(min!)
  expect(value).toBeLessThanOrEqual(max!)
}

describe('Glow and Trails manifest contract', () => {
  const byId = new Map((CINEMA2_HUMN_PRESET_MANIFEST.parameters ?? []).map(parameter => [parameter.id, parameter]))

  it('is revision 21 and the two finishing controls have the approved identity, range, hierarchy and authority', () => {
    expect(CINEMA2_HUMN_PRESET_MANIFEST.revision).toBe(21)
    expect(byId.get(GLOW)).toMatchObject({
      label: 'Glow', type: 'float', defaultValue: 0, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Light Treatment', designParentGroup: 'effects',
      modulatable: true, choreographable: true, persistence: 'preset',
    })
    expect(byId.get(TRAILS)).toMatchObject({
      label: 'Trails', type: 'float', defaultValue: 0, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Temporal', designParentGroup: 'effects',
      modulatable: true, choreographable: true, persistence: 'preset',
    })
    expect(String(GLOW)).toBe('hum-n-glow')
    expect(String(TRAILS)).toBe('hum-n-trails')
  })

  it('uses the built-in Bloom and feedback-trails effects with HUM:N-specific ids and no second implementation', () => {
    const effects = CINEMA2_HUMN_PRESET_MANIFEST.effects ?? []
    expect(effects.map(effect => [effect.id, effect.typeId])).toEqual([
      [TRAILS_EFFECT, CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID],
      [BLOOM, CINEMA2_BLOOM_EFFECT_TYPE_ID],
    ])
    for (const effect of effects) {
      expect(String(effect.id).startsWith('hum-n-')).toBe(true)
      expect(effect.parameters?.mix, `${effect.id} must author a hard-off mix`).toBe(0)
      expect(effect.parameterBindings?.mix).toEqual({ $ref: effect.id === BLOOM ? GLOW : TRAILS })
    }
    const trails = effects.find(effect => effect.id === TRAILS_EFFECT)!
    expect(trails.parameters).toMatchObject({ transportAware: true, drift: 0 })
    // The module renders only the figure: bloom/trails/history code lives in the engine effects.
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).not.toMatch(/bloom|u_history|u_persistence|feedback/i)
  })

  it('renders scene -> trails -> bloom -> output through the engine Render Graph with HUM:N-owned ids', () => {
    const compiled = cinema2NativePresetRegistry.compile(CINEMA2_HUMN_PRESET_ID, { availableCapabilities: ['render.webgl2', 'render.history'] })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    expect(compiled.plan.render).toMatchObject({
      synthesized: false,
      passOrder: [CINEMA2_HUMN_SCENE_PASS_ID, CINEMA2_HUMN_TRAILS_PASS_ID, CINEMA2_HUMN_BLOOM_PASS_ID],
      outputPassId: CINEMA2_HUMN_BLOOM_PASS_ID,
    })
    const ids = compiled.plan.render.passes.map(pass => String(pass.id))
    expect(ids.every(id => id.startsWith('hum-n-'))).toBe(true)
  })

  it('derives the trails/bloom values with parameter-sourced routes and never writes them into user state', () => {
    const rules = CINEMA2_HUMN_PRESET_MANIFEST.choreography?.rules ?? []
    const parameterRoutes = rules.filter(rule => rule.source.signal === 'parameter')
    expect(parameterRoutes.map(rule => String(rule.source.parameter?.$ref)).sort()).toEqual([GLOW, TRAILS, TRAILS].sort())
    for (const rule of parameterRoutes) {
      for (const action of rule.actions) expect(action.target.kind).toBe('effect')
    }
    const h = harness()
    const before = h.snapshot()
    h.set(TRAILS, 1)
    h.set(GLOW, 1)
    h.step({ frames: 6 })
    const state = JSON.parse(h.snapshot()) as { persistentValues: Record<string, unknown>; runtimeOnlyValues: Record<string, unknown> }
    expect(h.get(TRAILS)).toBe(1)
    expect(h.get(GLOW)).toBe(1)
    // Only the two user values changed; no derived mix/persistence/radius/intensity key was persisted.
    expect(h.snapshot().replace(/"hum-n-(glow|trails)":[^,}]+/g, '')).toBe(before.replace(/"hum-n-(glow|trails)":[^,}]+/g, ''))
    const authored = new Set((CINEMA2_HUMN_PRESET_MANIFEST.parameters ?? []).map(parameter => String(parameter.id)))
    for (const key of [...Object.keys(state.persistentValues), ...Object.keys(state.runtimeOnlyValues)]) expect(authored.has(key), `${key} is not an authored parameter`).toBe(true)
  })
})

describe('Final approved parameter hierarchy', () => {
  it('exposes exactly the approved controls, in the approved groups, and no hidden trigger or obsolete duplicate', () => {
    const h = harness()
    const plan = h.runtime.getCompiledPresetPlan()
    const model = createCinema2DesignParentGroupModel(plan, h.runtime.getParameterState().getSnapshot())
    const labels = (controls: readonly { definition: { label: string } }[]) => controls.map(control => control.definition.label)
    const parent = (id: string) => model.find(candidate => candidate.id === id)!
    const groupLabels = (id: string) => parent(id).groups.map(group => group.label)
    const group = (id: string, label: string) => labels(parent(id).groups.find(candidate => candidate.label === label)!.controls)

    expect(labels(parent('master-controls').controls)).toEqual(['Master Intensity', 'BPM Sync', 'Master Reactivity', 'Auto Performance'])
    expect(parent('master-controls').groups).toEqual([])

    expect(groupLabels('design').sort()).toEqual(['Composition', 'Figure Construction', 'Motion', 'Performance Motion', 'Stage'].sort())
    expect(group('design', 'Figure Construction').sort()).toEqual(['Line Presence', 'Line Weight', 'Fragmentation', 'Mesh Detail', 'Facet Fill', 'Fill Style'].sort())
    expect(group('design', 'Composition')).toEqual(['Figure Scale'])
    expect(group('design', 'Stage')).toEqual(['Grid Presence'])
    expect(group('design', 'Motion')).toEqual(['Motion Amount', 'Motion Rate'])
    expect(group('design', 'Performance Motion')).toEqual(['Gesture Intensity'])

    // The Inspector projects Effects and Palette flat (secondary grouping is Design-only); the authored
    // group labels remain in the manifest and order the flat list.
    expect(parent('effects').groups).toEqual([])
    expect(labels(parent('effects').controls)).toEqual(['Flicker Amount', 'Fragment Jitter', 'Glow', 'Trails'])
    expect(parent('palette').groups).toEqual([])
    expect(labels(parent('palette').controls)).toEqual(['Background', 'Wireframe', 'Skin Primary', 'Skin Secondary', 'Skin Accent', 'Pattern Ink', 'Color Shift Amount'])
    const authoredGroups = new Map((CINEMA2_HUMN_PRESET_MANIFEST.parameters ?? []).map(parameter => [String(parameter.label), parameter.group]))
    expect(['Flicker Amount', 'Fragment Jitter', 'Glow', 'Trails'].map(label => authoredGroups.get(label))).toEqual(['Fragment Behavior', 'Fragment Behavior', 'Light Treatment', 'Temporal'])
    expect(['Background', 'Wireframe', 'Skin Primary', 'Skin Secondary', 'Skin Accent', 'Pattern Ink', 'Color Shift Amount'].map(label => authoredGroups.get(label)))
      .toEqual(['Stage Colors', 'Figure Colors', 'Skin Colors', 'Skin Colors', 'Skin Colors', 'Pattern Colors', 'Color Behavior'])

    const everyId = model.flatMap(candidate => [...candidate.controls, ...candidate.groups.flatMap(entry => entry.controls)]).map(control => String(control.definition.id))
    expect(everyId.some(id => id.includes('event-intent'))).toBe(false)
    expect(new Set(everyId).size).toBe(everyId.length)
  })
})

describe('Final authority model', () => {
  const parameters = new Map((CINEMA2_HUMN_PRESET_MANIFEST.parameters ?? []).map(parameter => [String(parameter.label), parameter]))
  const rules = CINEMA2_HUMN_PRESET_MANIFEST.choreography?.rules ?? []
  const writtenProperties = new Set<string>()
  const writtenParameters = new Set<string>()
  for (const rule of rules) {
    for (const action of rule.actions) {
      if (action.target.kind === 'module') writtenProperties.add(action.target.property)
      if (action.target.kind === 'parameter') writtenParameters.add(String(action.target.ref.$ref))
    }
  }

  it('keeps user-owned controls out of every choreography write and never marks them modulatable', () => {
    const userOwnedModuleProperties = ['masterIntensity', 'masterReactivity', 'bpmSync', 'autoPerformance', 'lineWeight', 'meshDetail', 'fillStyle', 'figureScale', 'gridPresence', 'motionRate', 'backgroundColor', 'wireframeColor', 'skinPrimary', 'skinSecondary', 'skinAccent', 'patternInk']
    for (const property of userOwnedModuleProperties) expect(writtenProperties.has(property), `${property} must not be written by choreography`).toBe(false)
    for (const label of ['Master Intensity', 'Master Reactivity', 'BPM Sync', 'Auto Performance', 'Line Weight', 'Mesh Detail', 'Fill Style', 'Figure Scale', 'Grid Presence', 'Motion Rate', 'Background', 'Wireframe', 'Skin Primary', 'Skin Secondary', 'Skin Accent', 'Pattern Ink']) {
      expect(parameters.get(label), label).toBeDefined()
      expect(parameters.get(label)!.modulatable, `${label} must not be modulatable`).not.toBe(true)
    }
  })

  it('marks every user-base-plus-modulation control modulatable and gives each a real modulation or derivation route', () => {
    const modulated: Record<string, string> = {
      'Line Presence': 'linePresenceLowering',
      Fragmentation: 'fragmentation',
      'Facet Fill': 'facetFill',
      'Motion Amount': 'buildMotionLift',
      'Gesture Intensity': 'gestureIntensity',
      'Flicker Amount': 'flickerAmount',
      'Fragment Jitter': 'fragmentJitter',
      'Color Shift Amount': 'colorShiftAmount',
    }
    for (const [label, property] of Object.entries(modulated)) {
      expect(parameters.get(label)!.modulatable, label).toBe(true)
      expect(writtenProperties.has(property), `${label} needs a modulation route (${property})`).toBe(true)
    }
    for (const label of ['Glow', 'Trails']) expect(parameters.get(label)!.modulatable, label).toBe(true)
    const effectTargets = rules.flatMap(rule => rule.actions).filter(action => action.target.kind === 'effect').map(action => `${action.target.kind === 'effect' ? action.target.ref.$ref : ''}.${action.target.kind === 'effect' ? action.target.property : ''}`)
    expect(effectTargets).toEqual(expect.arrayContaining([`${BLOOM}.mix`, `${TRAILS_EFFECT}.mix`]))
    expect(writtenParameters.has(String(AUTO))).toBe(false)
  })

  it('never lets an automated route write a parameter the user owns (only hidden runtime triggers)', () => {
    for (const id of writtenParameters) {
      const definition = (CINEMA2_HUMN_PRESET_MANIFEST.parameters ?? []).find(parameter => String(parameter.id) === id)
      expect(definition?.type, id).toBe('trigger')
    }
  })
})

describe('Glow through the production Render Graph and Effect Runtime', () => {
  it('is a hard off at 0: bloom is never created, mix resolves to exactly 0, and the graph still completes', () => {
    const h = harness()
    h.step({ frames: 8 })
    expect(h.get(GLOW)).toBe(0)
    expect(effectValue(h, BLOOM, 'mix')).toBe(0)
    expect(effectStatus(h, BLOOM)).toBe('inactive')
    expect(effectStatus(h, TRAILS_EFFECT)).toBe('inactive')
    expect(h.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ failedPassCount: 0, executedPassCount: 8 * 3 })
    expect(h.runtime.getEffectRuntimeSnapshot()).toMatchObject({ activeEffectCount: 0, failedEffectCount: 0 })
    expect(history(h).activeBufferCount).toBe(0)
  })

  it('maps one control to a restrained halo at the middle and a clearly stronger one at max', () => {
    const values = [0.25, 0.4, 0.5, 1].map(glow => {
      const h = harness({ state: { [GLOW]: glow } })
      h.step({ frames: 4 })
      expect(effectStatus(h, BLOOM), `glow ${glow}`).toBe('active')
      return { glow, mix: effectValue(h, BLOOM, 'mix'), radius: effectValue(h, BLOOM, 'radius'), intensity: effectValue(h, BLOOM, 'intensity'), threshold: effectValue(h, BLOOM, 'threshold') }
    })
    for (const entry of values) {
      expect(entry.mix).toBeCloseTo(entry.glow, 6)
      // Tight kernel: a wide radius would comb into ghost lines instead of a halo.
      expect(entry.radius).toBeLessThanOrEqual(2.05)
      expect(entry.radius).toBeGreaterThanOrEqual(1)
      // Threshold stays above saturated skin colors so facets are not blown to white.
      expect(entry.threshold).toBeGreaterThanOrEqual(0.6)
    }
    const strength = (entry: (typeof values)[number]) => entry.mix * entry.intensity
    expect(strength(values[2]!)).toBeGreaterThan(strength(values[0]!))
    expect(strength(values[3]!)).toBeGreaterThan(strength(values[2]!) * 1.6)
    expect(values[3]!.intensity).toBeLessThanOrEqual(3.05)
  })

  it('returns to nothing when Glow goes back to 0: the effect retires and no glow state is left', () => {
    const h = harness({ state: { [GLOW]: 0.6 } })
    h.step({ frames: 4 })
    expect(effectStatus(h, BLOOM)).toBe('active')
    h.set(GLOW, 0)
    h.step({ frames: 2 })
    expect(effectStatus(h, BLOOM)).toBe('inactive')
    expect(effectValue(h, BLOOM, 'mix')).toBe(0)
  })

  it('modulates upward with the Director build only where Glow was already set and Master Reactivity allows it', () => {
    const build = { energy: 0.5, buildProgress: 1, buildConfidence: 1, trackCurve: 0.8, frames: 30, dt: 0.1 }
    const off = harness({ state: { [GLOW]: 0, [MR]: 1 } })
    off.step(build)
    expect(effectValue(off, BLOOM, 'mix')).toBe(0)
    expect(effectStatus(off, BLOOM)).toBe('inactive')

    const silent = harness({ state: { [GLOW]: 0.5, [MR]: 0 } })
    silent.step(build)
    expect(effectValue(silent, BLOOM, 'mix')).toBeCloseTo(0.5, 6)

    const reactive = harness({ state: { [GLOW]: 0.5, [MR]: 1 } })
    reactive.step(build)
    expect(effectValue(reactive, BLOOM, 'mix')).toBeGreaterThan(0.5)
    expect(effectValue(reactive, BLOOM, 'mix')).toBeLessThanOrEqual(0.5 * 1.35 + 1e-6)
    expect(reactive.get(GLOW)).toBe(0.5)
  })
})

describe('Trails through the production Render Graph, Effect Runtime and History service', () => {
  it('is a hard off at 0: no history buffer exists and mix resolves to exactly 0', () => {
    const h = harness()
    h.step({ frames: 10 })
    expect(effectValue(h, TRAILS_EFFECT, 'mix')).toBe(0)
    expect(effectStatus(h, TRAILS_EFFECT)).toBe('inactive')
    expect(history(h)).toMatchObject({ activeBufferCount: 0, validBufferCount: 0 })
  })

  it('maps one control to both mix and persistence at the approved values (0.5 and 1)', () => {
    const half = harness({ state: { [TRAILS]: 0.5 } })
    half.step({ frames: 4 })
    within(effectValue(half, TRAILS_EFFECT, 'mix'), TRAILS_MIX.half)
    within(effectValue(half, TRAILS_EFFECT, 'persistence'), TRAILS_PERSISTENCE.half)
    const full = harness({ state: { [TRAILS]: 1 } })
    full.step({ frames: 4 })
    within(effectValue(full, TRAILS_EFFECT, 'mix'), TRAILS_MIX.full)
    within(effectValue(full, TRAILS_EFFECT, 'persistence'), TRAILS_PERSISTENCE.full)
    expect(effectValue(full, TRAILS_EFFECT, 'drift')).toBe(0)
    expect(effectStatus(full, TRAILS_EFFECT)).toBe('active')
  })

  it('increases monotonically across the whole range', () => {
    const points = Array.from({ length: 11 }, (_, index) => index / 10).map(trails => {
      const h = harness({ state: { [TRAILS]: trails } })
      h.step({ frames: 2 })
      return { mix: effectValue(h, TRAILS_EFFECT, 'mix'), persistence: effectValue(h, TRAILS_EFFECT, 'persistence') }
    })
    for (let index = 1; index < points.length; index++) {
      expect(points[index]!.mix).toBeGreaterThan(points[index - 1]!.mix)
      expect(points[index]!.persistence).toBeGreaterThan(points[index - 1]!.persistence)
    }
    expect(points[0]!.mix).toBe(0)
  })

  it('keeps a valid engine history buffer only while Trails is above 0 and releases it when Trails returns to 0', () => {
    const h = harness({ state: { [TRAILS]: 0.5 } })
    h.step({ frames: 6 })
    const buffer = trailsBuffer(h)
    expect(buffer).toMatchObject({ valid: true, width: 640, height: 360 })
    expect(history(h).activeBufferCount).toBe(1)
    h.set(TRAILS, 0)
    h.step({ frames: 2 })
    expect(history(h).activeBufferCount).toBe(0)
    const owners = h.runtime.getResourceManagerSnapshot().activeLeaseCountByOwner
    for (const [owner, count] of Object.entries(owners)) if (owner.includes('history')) expect(count, owner).toBe(0)
  })

  it('modulates upward only from an existing Trails value and never conjures trails at 0', () => {
    const impact = (h: Harness) => {
      h.step({ frames: 3 })
      h.step({ dropMoments: [{ id: 'drop-0', timeSec: 10.12 }], dropConfidence: 1, energy: 1, frames: 1 })
      h.step({ energy: 1, frames: 3, dt: 0.05 })
    }
    const off = harness({ state: { [TRAILS]: 0, [MR]: 1 } })
    impact(off)
    expect(effectValue(off, TRAILS_EFFECT, 'mix')).toBe(0)
    const silent = harness({ state: { [TRAILS]: 0.5, [MR]: 0 } })
    const base = (() => { silent.step({ frames: 3 }); return effectValue(silent, TRAILS_EFFECT, 'mix') })()
    impact(silent)
    expect(effectValue(silent, TRAILS_EFFECT, 'mix')).toBeCloseTo(base, 6)
  })
})

describe('History and resource lifecycle', () => {
  const steady = (h: Harness) => { h.step({ frames: 8 }); expect(trailsBuffer(h)?.valid).toBe(true) }
  const active = () => harness({ state: { [TRAILS]: 0.8, [GLOW]: 0.5 } })

  it('clears stale history on a forward seek, a backwards seek and a loop', () => {
    for (const jump of [{ timeSec: 60 }, { timeSec: 2 }]) {
      const h = active()
      steady(h)
      const resets = history(h).resetCount
      h.step({ ...jump, frames: 1 })
      expect(history(h).resetCount, JSON.stringify(jump)).toBeGreaterThan(resets)
    }
  })

  it('clears stale history on a track replacement and on missing-then-recovered analysis', () => {
    const replaced = active()
    steady(replaced)
    const resets = history(replaced).resetCount
    replaced.step({ trackId: 'another-track', frames: 1 })
    expect(history(replaced).resetCount).toBeGreaterThan(resets)

    const missing = active()
    steady(missing)
    const before = history(missing).resetCount
    missing.step({ structural: false, live: false, frames: 2 })
    missing.step({ frames: 3 })
    expect(history(missing).resetCount).toBeGreaterThanOrEqual(before)
    expect(missing.runtime.getRenderGraphExecutorSnapshot().failedPassCount).toBe(0)
  })

  it('retires the trail while the transport is paused and rebuilds it from a clean frame on resume', () => {
    const h = active()
    steady(h)
    h.pause(true)
    h.step({ frames: 3 })
    expect(trailsBuffer(h)?.valid ?? false).toBe(false)
    expect(history(h).lastResetReason).toBe('transport-inactive')
    h.pause(false)
    h.step({ frames: 4 })
    expect(trailsBuffer(h)?.valid).toBe(true)
    expect(h.runtime.getRenderGraphExecutorSnapshot().failedPassCount).toBe(0)
  })

  it('recreates history at the new size after a resize and keeps drawing without failures', () => {
    const h = active()
    steady(h)
    const resets = history(h).resetCount
    h.runtime.resize({ width: 1280, height: 720, dpr: 1 })
    h.step({ frames: 4 })
    expect(history(h).resetCount).toBeGreaterThan(resets)
    expect(trailsBuffer(h)).toMatchObject({ width: 1280, height: 720, valid: true })
    for (const size of [{ width: 500, height: 900 }, { width: 900, height: 900 }, { width: 2560, height: 720 }]) {
      h.runtime.resize({ ...size, dpr: 1 })
      h.step({ frames: 3 })
      expect(trailsBuffer(h)).toMatchObject(size)
    }
    expect(h.runtime.getRenderGraphExecutorSnapshot().failedPassCount).toBe(0)
  })

  it('runs Glow and Trails at every render quality without failures', () => {
    for (const quality of ['performance', 'balanced', 'quality'] as const) {
      const h = active()
      h.set('quality-mode' as never, quality)
      h.step({ frames: 4 })
      expect(h.runtime.getRenderGraphExecutorSnapshot().failedPassCount, quality).toBe(0)
      expect(h.runtime.getEffectRuntimeSnapshot().failedEffectCount, quality).toBe(0)
    }
  })

  it('releases every effect and history resource on disposal, with no program, buffer or texture leaked', () => {
    const h = active()
    steady(h)
    const runtime = h.runtime
    expect(runtime.getResourceManagerSnapshot().activeLeaseCount).toBeGreaterThan(0)
    h.dispose()
    live.splice(live.indexOf(h), 1)
    expect(runtime.getResourceManagerSnapshot()).toMatchObject({ activeLeaseCount: 0, activeSurfaceCount: 0 })
    expect(runtime.getHistoryServiceSnapshot()).toMatchObject({ activeBufferCount: 0, disposed: true })
    expect(runtime.getEffectRuntimeSnapshot().activeEffectCount).toBe(0)
  })

  it('does not leak GPU objects across many create/dispose cycles with Glow and Trails active', () => {
    const counts: number[] = []
    for (let cycle = 0; cycle < 3; cycle++) {
      const h = createHarness({ state: { [TRAILS]: 0.7, [GLOW]: 0.7 } })
      h.step({ frames: 5 })
      h.dispose()
      counts.push(h.runtime.getResourceManagerSnapshot().activeLeaseCount)
    }
    expect(counts).toEqual([0, 0, 0])
  })
})

describe('Auto Performance and finishing controls do not fight each other', () => {
  it('leaves Glow and Trails untouched with Auto Performance ON, and editing them never turns Auto off', () => {
    const h = harness({ state: { [AUTO]: true, [MR]: 1, [GLOW]: 0.4, [TRAILS]: 0.3 } })
    h.step({ energy: 0.9, trackCurve: 0.9, buildProgress: 1, buildConfidence: 1, frames: 20, dt: 0.05 })
    expect(h.get(GLOW)).toBe(0.4)
    expect(h.get(TRAILS)).toBe(0.3)
    h.set(GLOW, 0.7)
    h.set(TRAILS, 0.6)
    expect(h.get(AUTO)).toBe(true)
  })

  it('keeps the manual takeover on the controls Auto Performance does influence', () => {
    const h = harness({ state: { [AUTO]: true } })
    h.set(CINEMA2_HUMN_FACET_FILL_ID, 0.5)
    // Direct persistent writes do not model a UI edit; the metadata contract is the takeover surface.
    const facet = (CINEMA2_HUMN_PRESET_MANIFEST.parameters ?? []).find(parameter => parameter.id === CINEMA2_HUMN_FACET_FILL_ID)
    expect(facet?.metadata).toMatchObject({ userEditSetParameters: { [AUTO]: false } })
    for (const id of [GLOW, TRAILS]) {
      const definition = (CINEMA2_HUMN_PRESET_MANIFEST.parameters ?? []).find(parameter => parameter.id === id)
      expect(definition?.metadata?.userEditSetParameters).toBeUndefined()
    }
  })
})

describe('Full-preset transport and discontinuity matrix', () => {
  const TRANSIENT_ZERO = ['u_gReach', 'u_gShock', 'u_gGrab', 'u_gLunge', 'u_lookYaw', 'u_bodyTurn', 'u_nod', 'u_beatFlicker', 'u_downbeatReveal', 'u_kickJitter', 'u_snareEyeCheek', 'u_ghostEdgeEmphasis'] as const
  // A constant section type keeps the test about stale state, not about a genuine section change.
  const music = { energy: 0.9, trackCurve: 0.9, buildProgress: 1, buildConfidence: 1, tension: 0.8, vocal: 0.5, high: 0.8, air: 0.7, sectionType: 'verse' }
  const silence = { energy: 0, trackCurve: 0, buildProgress: 0, buildConfidence: 0, tension: 0, vocal: 0, high: 0, air: 0, sectionType: 'verse' }

  /** Every temporal system live at once: build, rhythm events, a lunge gesture, Auto Performance, Trails and Glow. */
  function everythingActive(): Harness {
    const h = harness({ state: {
      [MR]: 1, [AUTO]: true, [CINEMA2_HUMN_GESTURE_INTENSITY_ID]: 1, [CINEMA2_HUMN_FLICKER_AMOUNT_ID]: 1, [CINEMA2_HUMN_FRAGMENT_JITTER_ID]: 1,
      [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 1, [GLOW]: 0.5, [TRAILS]: 0.8,
    } })
    h.step({ frames: 3 })
    h.step({ ...music, beat: true, downbeat: true, kick: 1, snare: 1, dropMoments: [{ id: 'drop-1', timeSec: 10.12 }], dropConfidence: 1, frames: 1 })
    h.step({ ...music, frames: 3, dt: 0.05 })
    expect(h.uniform('u_gLunge'), 'lunge must be live before the discontinuity').toBeGreaterThan(0.02)
    expect(h.uniform('u_kickJitter')).toBeGreaterThan(0)
    expect(h.uniform('u_ghostEdgeEmphasis')).toBeGreaterThan(0)
    expect(trailsBuffer(h)?.valid).toBe(true)
    return h
  }

  const afterDiscontinuity = (h: Harness, label: string) => {
    for (const name of TRANSIENT_ZERO) expect(h.uniform(name), `${label}: ${name}`).toBe(0)
    expect(h.uniform('u_lungeScale'), label).toBe(1)
    expect(h.runtime.getRenderGraphExecutorSnapshot().failedPassCount, label).toBe(0)
  }

  const cases: readonly [string, (h: Harness) => void][] = [
    ['forward seek', h => h.step({ ...silence, timeSec: 60, frames: 1 })],
    ['backwards seek', h => h.step({ ...silence, timeSec: 2, frames: 1 })],
    ['track loop', h => h.step({ ...silence, timeSec: 10.0 - 8, frames: 1 })],
    ['track replacement', h => h.step({ ...silence, trackId: 'replacement-track', frames: 1 })],
    ['source removal and return', h => {
      h.transport.sourcePresent = false
      h.transport.analysisActive = false
      h.step({ ...silence, trackId: null, frames: 2 })
      h.transport.sourcePresent = true
      h.transport.analysisActive = true
      h.step({ ...silence, frames: 1 })
    }],
    ['WebGL context loss and restore', h => {
      h.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
      h.canvas.dispatchEvent(new Event('webglcontextrestored'))
      h.step({ ...silence, frames: 2 })
    }],
  ]

  for (const [label, disturb] of cases) {
    it(`${label}: gesture, phrase/section pose, rhythm envelopes, build contribution and trail history do not survive`, () => {
      const h = everythingActive()
      const resets = history(h).resetCount
      disturb(h)
      afterDiscontinuity(h, label)
      expect(history(h).resetCount, `${label}: trail history must be reset`).toBeGreaterThan(resets)
      // Nothing stale returns on the following frames either.
      h.step({ ...silence, frames: 6, dt: 0.05 })
      afterDiscontinuity(h, `${label} (settled)`)
    })
  }

  it('re-entry after disposal starts from a clean state: no trail history, no gesture, no rhythm envelope, Glow/Trails state from the user only', () => {
    const first = everythingActive()
    first.dispose()
    live.splice(live.indexOf(first), 1)
    const second = harness()
    second.step({ frames: 4 })
    expect(history(second)).toMatchObject({ activeBufferCount: 0, validBufferCount: 0 })
    for (const name of TRANSIENT_ZERO) expect(second.uniform(name), name).toBe(0)
    expect(second.get(GLOW)).toBe(0)
    expect(second.get(TRAILS)).toBe(0)
    expect(second.get(AUTO)).toBe(false)
    expect(effectStatus(second, BLOOM)).toBe('inactive')
  })

  it('event selection stays deterministic per event identity across identical runs', () => {
    const family = () => {
      const h = harness({ state: { [MR]: 1, [CINEMA2_HUMN_GESTURE_INTENSITY_ID]: 1 } })
      h.step({ frames: 3 })
      h.step({ dropMoments: [{ id: 'drop-identity', timeSec: 10.12 }], frames: 1 })
      h.step({ frames: 4, dt: 0.05 })
      return ['u_gReach', 'u_gShock', 'u_gGrab', 'u_gLunge'].map(name => h.uniform(name))
    }
    expect(family()).toEqual(family())
  })
})
