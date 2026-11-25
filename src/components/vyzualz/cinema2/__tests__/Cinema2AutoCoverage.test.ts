import { describe, expect, it } from 'vitest'
import type { Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { computeCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AUTO_COVERAGE_EXEMPT } from '../presets/Cinema2AutoCoverageExemptions'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { readCinema2MoodPolicy } from '../conductor/Cinema2MoodPolicy'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { moodStage, moodTwin } from './support/MoodMigrationHarness'

const userFacing = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.filter(declaration => !declaration.manifest.metadata.tags?.includes('internal'))
const COVERED_GROUPS = new Set(['master-controls', 'design', 'effects'])
const slugOf = (id: unknown) => String(id).replace('drmvyz.cinema2.', '')

describe('Auto Performance covers every numeric control', () => {
  it.each(userFacing.map(declaration => [slugOf(declaration.manifest.id), declaration] as const))('%s: each numeric Master Controls, Design and Effects control is moved by a rule gated by Auto Performance, or is named as an exception', (slug, declaration) => {
    const manifest = declaration.manifest
    const auto = manifest.parameters!.find(parameter => readCinema2MoodPolicy(parameter.metadata) === 'autoPerformance')!
    expect(auto, slug).toBeTruthy()
    const stage = moodStage(manifest)
    const gated = new Set<string>()
    const byAction = new Map(stage.plan.targets.choreographyTargets.map(entry => [String(entry.actionId), entry.target]))
    for (const rule of manifest.choreography?.rules ?? []) {
      if (String(rule.enabledParameter?.$ref ?? '') !== String(auto.id)) continue
      for (const action of rule.actions) { const parameterId = byAction.get(String(action.id))?.parameterId; if (parameterId) gated.add(String(parameterId)) }
    }
    const uncovered = (manifest.parameters ?? [])
      .filter(parameter => (parameter.type === 'float' || parameter.type === 'integer') && COVERED_GROUPS.has(String(parameter.designParentGroup)) && String(parameter.id) !== String(auto.id) && !gated.has(String(parameter.id)))
      .map(parameter => String(parameter.id))
    const exceptions = computeCinema2AutoCoverage(manifest, { exempt: CINEMA2_AUTO_COVERAGE_EXEMPT[slug] }).skipped.map(skip => skip.parameter)
    expect(uncovered.filter(id => !exceptions.includes(id)), `${slug} has controls Auto Performance does not move`).toEqual([])
  })
})

describe('the coverage drives move the controls they cover', () => {
  it.each(userFacing.map(declaration => [slugOf(declaration.manifest.id), declaration] as const))('%s: with Auto Performance on every covered control leaves its authored value somewhere in a peak, a calm passage, a build, a drop or a hit, and nothing moves with it off', (slug, declaration) => {
    const manifest = declaration.manifest
    const auto = manifest.parameters!.find(parameter => readCinema2MoodPolicy(parameter.metadata) === 'autoPerformance')!.id as Cinema2ParameterId
    const byAction = new Map(moodStage(manifest).plan.targets.choreographyTargets.map(entry => [String(entry.actionId), String(entry.target.parameterId)]))
    // The controls this step added drives for (the preset's own authored drives, which can need a particular event, are tested with each preset).
    const generated = new Set((manifest.choreography?.rules ?? []).filter(rule => String(rule.id).includes('-cover-drive-')).flatMap(rule => rule.actions.map(action => byAction.get(String(action.id))!)))
    const twins: ReturnType<typeof moodTwin>[] = []
    const peak = moodTwin(manifest, auto); peak.play(6, { energy: 0.95, tension: 0.6, section: 'drop' }); twins.push(peak)
    const calm = moodTwin(manifest, auto); calm.play(6, { energy: 0.1, section: 'breakdown' }); twins.push(calm)
    const build = moodTwin(manifest, auto); build.play(6, { energy: 0.7, build: 0.9, section: 'build' }); twins.push(build)
    const hits = moodTwin(manifest, auto)
    const valueTargets = peak.on.plan.targets.targets.filter(target => target.channel === 'value' && target.kind !== 'parameter' && target.parameterId != null)
    const moved = new Set<string>()
    const observe = (twin: ReturnType<typeof moodTwin>) => {
      for (const target of valueTargets) {
        if (moved.has(String(target.parameterId))) continue
        if (Math.abs(Number(twin.on.resolver.resolve(target.id).value) - Number(twin.off.resolver.resolve(target.id).value)) > 1e-9) moved.add(String(target.parameterId))
      }
    }
    // Event-driven drives (a kick, a snare, a drop, a downbeat) only show on the frame they land, so each is observed on that frame.
    hits.play(4, { energy: 0.5, section: 'verse' })
    for (const [index, event] of (['kick', 'snare', 'downbeat', 'bar', 'drop', 'impact'] as const).entries()) {
      hits.play(0.5, { energy: 0.6, section: 'verse' })
      hits.once({ energy: 0.6, event, eventId: 100 + index, section: 'verse', ...(event === 'kick' ? { bass: 0.9 } : {}) }); observe(hits)
    }
    for (const twin of twins) observe(twin)
    // A control the user set to zero stays off: its drives multiply (a glow, a trail, a camera lock-off such as Canopy's Camera Motion).
    const lockedOff = (id: string) => peak.on.state.getValue(id as Cinema2ParameterId) === 0 && (manifest.choreography?.rules ?? []).some(rule => String(rule.id).includes('-cover-drive-') && rule.actions.some(action => byAction.get(String(action.id)) === id && action.operation === 'multiply'))
    const stuck = [...generated].filter(id => valueTargets.some(target => String(target.parameterId) === id) && !moved.has(id) && !lockedOff(id))
    expect(stuck, `${slug}: covered controls that never move`).toEqual([])
  })
})

describe('what Auto Performance does not move, and why', () => {
  it('names every numeric control left out: counts, seeds, the controls that set the strength of the choreography, and the module changes still to make', () => {
    const left: Record<string, string[]> = {}
    for (const declaration of userFacing) {
      const slug = slugOf(declaration.manifest.id)
      const skipped = computeCinema2AutoCoverage(declaration.manifest, { exempt: CINEMA2_AUTO_COVERAGE_EXEMPT[slug] }).skipped
      if (skipped.length) left[slug] = skipped.map(skip => `${skip.label} (${skip.reason})`).sort()
      // An exemption must name a control that exists, so a rename cannot leave a stale entry behind.
      for (const id of Object.keys(CINEMA2_AUTO_COVERAGE_EXEMPT[slug] ?? {})) expect(skipped.some(skip => skip.parameter === id && skip.reason === 'exempt'), `${slug}: ${id}`).toBe(true)
    }
    expect(left).toEqual({
      afterhours: ['Laser Count (structural)'],
      'atl-hoe': ['City Atmosphere (exempt)', 'Flicker (authority)'],
      blockshift: ['Block Size (exempt)', 'Depth (exempt)', 'Rotation Range (exempt)', 'Spread (exempt)'],
      canopy: ['Column Spacing (exempt)', 'Columns (structural)', 'Length Variation (exempt)', 'Rod Length (exempt)', 'Row Spacing (exempt)', 'Rows (structural)'],
      'ancient-machine': ['Music Reactivity (authority)'],
      cathedral: ['Music Reactivity (authority)'],
      constellation: ['Element Count (structural)', 'Music Reactivity (authority)'],
      colossus: ['Model Pitch (exempt)', 'Model Roll (exempt)', 'Model Scale (exempt)', 'Model X (exempt)', 'Model Y (exempt)', 'Model Yaw (exempt)', 'Model Z (exempt)', 'Music Reactivity (exempt)'],
      depth: ['Random Seed (structural)'],
      'event-horizon': ['Music Reactivity (authority)'],
      'go-to': ['Master Intensity (authority)'],
      ifrit: ['Blade Count (structural)', 'Fragments Per Edge (structural)', 'Frame Count (structural)', 'Satellite Count (structural)'],
      'neon-forest': ['Fog Density (exempt)', 'Light Strength (exempt)'],
      'open-decks': ['Camera Distance (exempt)', 'Camera Elevation (exempt)', 'Camera Heading (exempt)'],
      orbital: ['Camera Motion (authority)', 'Glyph Scale (exempt)', 'Line Spacing (exempt)', 'Tracking (exempt)'],
      psylo: ['Fog Density (exempt)', 'Light Strength (exempt)'],
      overdrive: ['Reactivity (authority)'],
      reactor: ['Reactivity (authority)'],
      'say-it': ['Camera Motion (authority)', 'Glyph Scale (exempt)', 'Line Spacing (exempt)', 'Random Seed (structural)', 'Tracking (exempt)'],
      sixfold: ['Music Reactivity (authority)'],
      starters: ['Music Reactivity (authority)'],
      submerge: ['Camera Motion (authority)', 'Glyph Scale (exempt)', 'Line Spacing (exempt)', 'Tracking (exempt)'],
    })
  })

  it('moves the camera controls by their own rules: amounts and speeds multiply (a still camera stays still), the framing adds a little', () => {
    const manifest = userFacing.find(declaration => slugOf(declaration.manifest.id) === 'neon-forest')!.manifest
    const auto = manifest.parameters!.find(parameter => readCinema2MoodPolicy(parameter.metadata) === 'autoPerformance')!.id as Cinema2ParameterId
    const twin = moodTwin(manifest, auto); twin.play(6, { energy: 0.95, tension: 0.6, section: 'drop' })
    const read = (property: string) => {
      const target = twin.on.plan.targets.targets.find(candidate => candidate.kind === 'camera' && candidate.property === property)!
      return [Number(twin.on.resolver.resolve(target.id).value), Number(twin.off.resolver.resolve(target.id).value)] as const
    }
    for (const property of ['control.orbitRadius', 'control.orbitElevationDegrees', 'control.orbitAzimuthDegrees', 'control.motionSpeed', 'fovDegrees']) {
      const [on, off] = read(property)
      expect(on, property).not.toBeCloseTo(off, 6)
    }
    // A camera whose motion the user turned off stays still: the amount is scaled, never added to.
    const still = moodTwin(manifest, auto); still.on.state.setPersistentValue('neon-forest-camera-speed' as Cinema2ParameterId, 0); still.play(6, { energy: 0.95, section: 'drop' })
    const speed = still.on.plan.targets.targets.find(candidate => candidate.kind === 'camera' && candidate.property === 'control.motionSpeed')!
    expect(Number(still.on.resolver.resolve(speed.id).value)).toBe(0)
  })
})

describe('the coverage drives keep every control inside its own range', () => {
  it.each(userFacing.map(declaration => [slugOf(declaration.manifest.id), declaration] as const))('%s: at the strongest peak and the calmest passage, no control leaves its range because of the coverage drives', (slug, declaration) => {
    const manifest = declaration.manifest
    const auto = manifest.parameters!.find(parameter => readCinema2MoodPolicy(parameter.metadata) === 'autoPerformance')!.id as Cinema2ParameterId
    // The preset as authored, without the coverage drives: anything out of range there is not this step's doing.
    const authored = { ...manifest, choreography: { ...manifest.choreography, rules: (manifest.choreography?.rules ?? []).filter(rule => !String(rule.id).includes('-cover-drive-')) } } as typeof manifest
    const out: string[] = []
    for (const [name, options] of [['peak', { energy: 0.98, tension: 0.9, section: 'drop' }], ['calm', { energy: 0.02, section: 'breakdown' }]] as const) {
      const full = moodTwin(manifest, auto), base = moodTwin(authored, auto)
      for (const twin of [full, base]) { twin.play(5, options); if (name === 'peak') twin.once({ energy: 0.98, event: 'drop', eventId: 5, section: 'drop' }) }
      const definitions = new Map(full.on.plan.parameters.definitions.map(definition => [String(definition.id), definition]))
      for (const target of full.on.plan.targets.targets) {
        if (target.channel !== 'value' || target.kind === 'parameter' || target.parameterId == null) continue
        const definition = definitions.get(String(target.parameterId))
        if (!definition || typeof definition.min !== 'number' || typeof definition.max !== 'number') continue
        const slack = (definition.max - definition.min) * 1e-6
        const outside = (value: number) => Number.isFinite(value) && (value < definition.min! - slack || value > definition.max! + slack)
        const baseValue = base.on.plan.targets.targets.find(candidate => candidate.id === target.id)
        const wasOut = baseValue ? outside(Number(base.on.resolver.resolve(target.id).value)) : false
        const value = Number(full.on.resolver.resolve(target.id).value)
        if (outside(value) && !wasOut) out.push(`${name} ${definition.label}: ${value.toFixed(3)} not in [${definition.min}, ${definition.max}]`)
      }
    }
    expect(out, slug).toEqual([])
  })
})

describe('the camera really follows the camera drives', () => {
  it('moves the orbit camera of a preset with Auto Performance on, and leaves it where it was authored with Auto Performance off', () => {
    const manifest = userFacing.find(declaration => slugOf(declaration.manifest.id) === 'neon-forest')!.manifest
    const auto = manifest.parameters!.find(parameter => readCinema2MoodPolicy(parameter.metadata) === 'autoPerformance')!.id as Cinema2ParameterId
    const twin = moodTwin(manifest, auto)
    for (const stage of [twin.on, twin.off]) stage.state.setPersistentValue('neon-forest-camera-mode' as Cinema2ParameterId, 'orbit')
    const cameras = [twin.on, twin.off].map(stage => new Cinema2CameraRuntime(stage.plan, stage.state, stage.resolver, new Cinema2SpatialRuntime(stage.plan.scene, stage.plan.targets.targets, stage.resolver)))
    const settle = (seconds: number, options: Parameters<typeof twin.play>[1]) => { for (let i = 0; i < seconds * 30; i++) { twin.play(1 / 30, options); for (const camera of cameras) camera.update(twin.frame()) } }
    settle(8, { energy: 0.95, tension: 0.6, section: 'drop' })
    const [onPeak, offPeak] = cameras.map(camera => camera.getFrame())
    const gap = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)
    expect(gap(onPeak!.position, offPeak!.position)).toBeGreaterThan(0.05)
    // The same camera in a calm passage is not where it was at the peak: the drives follow the mood.
    settle(8, { energy: 0.05, section: 'breakdown' })
    const [onCalm] = cameras.map(camera => camera.getFrame())
    expect(gap(onCalm!.position, onPeak!.position)).toBeGreaterThan(0.05)
  })
})
