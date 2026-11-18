import {
  cinema2Ref,
  cinema2StableId,
  type Cinema2ChoreographyRuleManifest,
  type Cinema2CameraId,
  type Cinema2LightId,
  type Cinema2ModuleId,
  type Cinema2EffectId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2ParameterManifest,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2MoodPath } from '../conductor/Cinema2MoodConductor'
import { readCinema2MoodPolicy } from '../conductor/Cinema2MoodPolicy'
import { withCinema2MoodDrives, type Cinema2MoodDrive } from './Cinema2MoodConductorAuthoring'

/**
 * Full Auto Performance coverage.
 *
 * Rule: with Auto Performance on, every numeric control in Master Controls, Design and Effects takes part in the choreography and the mood. A control
 * is covered when a rule gated by the preset's Auto Performance toggle, reading a continuous source (the mood or the build, not a one-off hit), moves the property it is bound to (that is also what makes
 * the Inspector show the live value beside the saved one). This helper finds the controls a preset's authored drives did not reach and gives each
 * one a continuous drive from the shared Mood Conductor, so nothing is left for the user to move by hand while the music owns the show.
 *
 *   - It only adds. A control the preset already drives keeps its own drives exactly as authored.
 *   - It never rewrites a saved value: like every other drive, it adds a transient contribution the target runtime clamps.
 *   - Each control gets a musical role from its name (a speed follows how active the passage is, a glow flares on a peak and a drop, a size swells
 *     with the energy, and so on). The amount is a fraction of the control's own range, so a wide control and a narrow one move by the same proportion.
 *   - A control already near the top of its range is pushed down instead, and one near the bottom is pushed up, so the drive is never clamped away.
 *   - A control that cannot be moved continuously (a count, a random seed) is listed in `CINEMA2_AUTO_COVERAGE_STRUCTURAL` and is skipped with a reason.
 *     A control with no module or effect property bound to it (the camera and light rig controls are read by the engine directly) is reported as
 *     `unbound` so the test can name it rather than silently skipping it.
 */
export interface Cinema2AutoCoverageSkip {
  readonly parameter: string
  readonly label: string
  readonly reason: 'structural' | 'authority' | 'unbound' | 'exempt'
  readonly note?: string
}

export interface Cinema2AutoCoverage {
  readonly drives: readonly Cinema2MoodDrive[]
  readonly covered: readonly string[]
  readonly skipped: readonly Cinema2AutoCoverageSkip[]
}

export interface Cinema2AutoCoverageOptions {
  /** Controls to leave out, by parameter id, with the reason they cannot be moved by the music. Kept short; the test prints them. */
  readonly exempt?: Readonly<Record<string, string>>
}

const COVERED_PARENT_GROUPS: ReadonlySet<string> = new Set(['master-controls', 'design', 'effects'])

/** Names of controls that are structure, not a continuous quantity: changing them live would rebuild the scene or reshuffle it. */
const STRUCTURAL_LABEL = /\b(seed|count|rows|columns|segments|subdivisions?|fragments per edge|levels)\b|^(rows|columns)$/i

interface Role {
  readonly id: string
  readonly test: RegExp
  /** [source, fraction of the control's range added at full source]. */
  readonly drives: readonly (readonly [Cinema2MoodPath, number])[]
}

/** Ordered: the first role whose pattern matches the control's name wins. */
const ROLES: readonly Role[] = [
  { id: 'finish', test: /finish|vignette|grain|letterbox/i, drives: [['mood.activity', -0.12], ['mood.shock', -0.2]] },
  { id: 'light', test: /bloom|glow|glare|flare|flash|emission|shaft|haze|fog|mist|atmosphere|reflection|iridesc|clearcoat|shine|spark|ember|beam|laser|\bled\b|light|chromatic|split|static|scanline/i, drives: [['mood.peak', 0.1], ['mood.shock', 0.2], ['mood.calm', -0.05]] },
  { id: 'speed', test: /speed|rate\b|tempo|velocity|travel|drift|flow|fall|sequence|spin|float|sway|buoyancy|decay/i, drives: [['mood.activity', 0.18], ['mood.calm', -0.1]] },
  { id: 'reactivity', test: /reactiv|respon|influence|reaction|sensitiv|gain/i, drives: [['mood.activity', 0.12], ['mood.calm', -0.08]] },
  { id: 'surface', test: /roughness|clarity|opacity|contrast|saturation|presence|weight|crisp|detail|sharp/i, drives: [['mood.activity', -0.1], ['mood.shock', 0.1]] },
  { id: 'camera', test: /camera|orbit|field of view|pan|zoom/i, drives: [['mood.activity', 0.12], ['mood.calm', -0.08]] },
  { id: 'swell', test: /size|scale|radius|width|spread|spacing|density|depth|amount|length|height|expansion|fragment|shatter|offset|aperture|opening|reveal|progress|tilt|range|jitter|variation|intensity|strength|rotation|angle|heading|elevation|position|core|disk|debris|buoyancy|lock|reconstruction|case|ball|grass|clarity|legacy|planet|sign|portrait|composition/i, drives: [['mood.activity', 0.12], ['mood.calm', -0.08], ['mood.shock', 0.12]] },
]
const FALLBACK: Role = { id: 'general', test: /./, drives: [['mood.activity', 0.1], ['mood.calm', -0.06], ['mood.shock', 0.08]] }

export function cinema2AutoCoverageRole(label: string): Readonly<{ id: string; drives: Role['drives'] }> {
  return ROLES.find(role => role.test.test(label)) ?? FALLBACK
}

type BoundKind = 'module' | 'effect' | 'light' | 'environment' | 'camera'
/** The camera controls the camera runtime lets a drive move (control name on the camera -> target property). */
const CAMERA_CONTROL_TARGETS: readonly (readonly [string, string])[] = [
  ['fovDegrees', 'fovDegrees'], ['motionAmount', 'control.motionAmount'], ['motionSpeed', 'control.motionSpeed'], ['orbitMotionSpeed', 'control.orbitMotionSpeed'],
  ['orbitRadius', 'control.orbitRadius'], ['orbitAzimuthDegrees', 'control.orbitAzimuthDegrees'], ['orbitElevationDegrees', 'control.orbitElevationDegrees'],
]

/**
 * How each camera control moves. The amounts and speeds multiply (so a user who set camera motion to zero keeps a still camera); the framing controls
 * add a small fraction of their range: the camera pushes in a little on energy and eases back in a calm passage, and the heading drifts.
 */
const CAMERA_ROLES: Readonly<Record<string, { readonly operation: 'add' | 'multiply'; readonly drives: readonly (readonly [Cinema2MoodPath, number])[] }>> = {
  fovDegrees: { operation: 'add', drives: [['mood.activity', -0.06], ['mood.shock', -0.12], ['mood.calm', 0.05]] },
  'control.motionAmount': { operation: 'multiply', drives: [['mood.activity', 1.35], ['mood.calm', 0.7]] },
  'control.motionSpeed': { operation: 'multiply', drives: [['mood.activity', 1.3], ['mood.calm', 0.75]] },
  'control.orbitMotionSpeed': { operation: 'multiply', drives: [['mood.activity', 1.3], ['mood.calm', 0.75]] },
  'control.orbitRadius': { operation: 'add', drives: [['mood.activity', -0.08], ['mood.shock', -0.06], ['mood.calm', 0.06]] },
  'control.orbitAzimuthDegrees': { operation: 'add', drives: [['mood.activity', 0.03], ['mood.calm', -0.02]] },
  'control.orbitElevationDegrees': { operation: 'add', drives: [['mood.activity', 0.05], ['mood.calm', -0.04]] },
}

const keyOf = (kind: BoundKind, owner: string, property: string) => `${kind}\u0000${owner}\u0000${property}`

function findAutoPerformance(manifest: Readonly<Cinema2NativePresetManifest>): Readonly<Cinema2ParameterManifest> | undefined {
  const parameters = manifest.parameters ?? []
  return parameters.find(parameter => readCinema2MoodPolicy(parameter.metadata) === 'autoPerformance')
    ?? parameters.find(parameter => /auto.?performance/i.test(`${parameter.id} ${parameter.label}`) && parameter.type === 'boolean')
}

/** The module and effect properties a preset's Auto Performance already moves. */
function drivenKeys(manifest: Readonly<Cinema2NativePresetManifest>, autoId: string): { keys: Set<string>; strength: Set<string> } {
  const keys = new Set<string>()
  const strength = new Set<string>()
  const groups = new Map((manifest.lighting?.groups ?? []).map(group => [String(group.id), group.lights.map(light => String(light.$ref))]))
  for (const rule of manifest.choreography?.rules ?? [] as readonly Cinema2ChoreographyRuleManifest[]) {
    if (rule.strengthParameter) strength.add(String(rule.strengthParameter.$ref))
    if (String(rule.enabledParameter?.$ref ?? '') !== autoId) continue
    // A drive that only fires on an event (a kick, a downbeat, a drop) moves a control for an instant; it does not keep the control in the music, so it does not count.
    if ((rule.source as { signal?: string }).signal !== 'continuous') continue
    for (const action of rule.actions) {
      const target = action.target as { kind?: string; ref?: { $ref?: string }; property?: string }
      if (target.kind === 'environment' && target.property) keys.add(keyOf('environment', 'root', target.property))
      else if (target.kind === 'light-group' && target.ref?.$ref && target.property) for (const light of groups.get(target.ref.$ref) ?? []) keys.add(keyOf('light', light, target.property))
      else if ((target.kind === 'module' || target.kind === 'effect' || target.kind === 'light' || target.kind === 'camera') && target.ref?.$ref && target.property) keys.add(keyOf(target.kind, target.ref.$ref, target.property))
    }
  }
  return { keys, strength }
}

export function computeCinema2AutoCoverage(manifest: Readonly<Cinema2NativePresetManifest>, options: Readonly<Cinema2AutoCoverageOptions> = {}): Readonly<Cinema2AutoCoverage> {
  const auto = findAutoPerformance(manifest)
  if (!auto) return Object.freeze({ drives: Object.freeze([]), covered: Object.freeze([]), skipped: Object.freeze([]) })
  const { keys, strength } = drivenKeys(manifest, String(auto.id))
  const bindings = new Map<string, readonly [BoundKind, string, string]>()
  const bind = (ref: { $ref: string } | undefined, kind: BoundKind, owner: string, property: string) => { if (ref) bindings.set(String(ref.$ref), [kind, owner, property]) }
  for (const module of manifest.modules ?? []) for (const [property, ref] of Object.entries(module.parameterBindings ?? {})) bind(ref, 'module', String(module.id), property)
  for (const effect of manifest.effects ?? []) for (const [property, ref] of Object.entries(effect.parameterBindings ?? {})) if (property !== 'enabled') bind(ref, 'effect', String(effect.id), property)
  for (const light of manifest.lighting?.lights ?? []) bind(light.controls?.intensity, 'light', String(light.id), 'intensity')
  const environment = manifest.environment?.controls
  bind(environment?.exposure, 'environment', 'root', 'exposure')
  bind(environment?.fogDensity, 'environment', 'root', 'fog.density')
  for (const camera of manifest.cameras ?? []) for (const [control, property] of CAMERA_CONTROL_TARGETS) bind((camera.controls as Record<string, { $ref: string } | undefined> | undefined)?.[control], 'camera', String(camera.id), property)

  const drives: Cinema2MoodDrive[] = []
  const covered: string[] = []
  const skipped: Cinema2AutoCoverageSkip[] = []
  for (const parameter of manifest.parameters ?? []) {
    const id = String(parameter.id)
    if (id === String(auto.id)) continue
    if (parameter.type !== 'float' && parameter.type !== 'integer') continue
    if (!COVERED_PARENT_GROUPS.has(String(parameter.designParentGroup ?? ''))) continue
    const exempt = options.exempt?.[id]
    if (exempt) { skipped.push({ parameter: id, label: parameter.label ?? id, reason: 'exempt', note: exempt }); continue }
    const label = parameter.label ?? id
    if (STRUCTURAL_LABEL.test(label)) { skipped.push({ parameter: id, label, reason: 'structural' }); continue }
    const bound = bindings.get(id)
    // A control no module, effect, light or camera property is bound to, which only sets how strongly the choreography acts (it is the strength of a rule),
    // is the authority over the music's drives, not something they move.
    if (!bound) { skipped.push({ parameter: id, label, reason: strength.has(id) ? 'authority' : 'unbound' }); continue }
    if (keys.has(keyOf(bound[0], bound[1], bound[2]))) { covered.push(id); continue }
    const min = parameter.min ?? 0
    const max = parameter.max ?? 1
    const range = max - min
    if (!(range > 0)) { skipped.push({ parameter: id, label, reason: 'structural', note: 'no range' }); continue }
    const base = typeof parameter.defaultValue === 'number' ? parameter.defaultValue : min + range / 2
    const headUp = max - base
    const headDown = base - min
    const cameraRole = bound[0] === 'camera' ? CAMERA_ROLES[bound[2]] : undefined
    const role = cameraRole ?? cinema2AutoCoverageRole(label)
    const operation = cameraRole?.operation ?? 'add'
    // The role's first drive is the control's main movement: if it points toward a limit the authored value is already against, reverse the control.
    const main = role.drives[0]![1]
    const flip = operation === 'add' && (main > 0 ? headUp < range * 0.2 && headDown > headUp : headDown < range * 0.2 && headUp > headDown)
    const target = ((): Cinema2MoodDrive['target'] => {
      const [kind, owner, property] = bound
      if (kind === 'module') return { kind, ref: cinema2Ref(cinema2StableId<Cinema2ModuleId>(owner)), property }
      if (kind === 'effect') return { kind, ref: cinema2Ref(cinema2StableId<Cinema2EffectId>(owner)), property }
      if (kind === 'light') return { kind, ref: cinema2Ref(cinema2StableId<Cinema2LightId>(owner)), property }
      if (kind === 'camera') return { kind, ref: cinema2Ref(cinema2StableId<Cinema2CameraId>(owner)), property }
      return { kind: 'environment', property }
    })()
    if (operation === 'multiply') {
      for (const [source, factor] of role.drives) drives.push({ id: `cover-${id}-${source.replace('mood.', '')}`, target, source, operation, value: factor })
    } else {
      // Every drive is kept inside the headroom the authored value has on its own side, so even all of them at once cannot leave the control's range.
      const signed = role.drives.map(([source, fraction]) => [source, (flip ? -fraction : fraction) * range] as const)
      const up = signed.filter(([, value]) => value > 0).reduce((sum, [, value]) => sum + value, 0)
      const down = signed.filter(([, value]) => value < 0).reduce((sum, [, value]) => sum - value, 0)
      const upScale = up > 0 ? Math.min(1, headUp / up) : 1
      const downScale = down > 0 ? Math.min(1, headDown / down) : 1
      // A control whose minimum is zero is "off" at zero (a glow, a trail, a static layer): its drives multiply, so zero stays zero and the music
      // never switches on what the user turned off. Everything else adds. Both are the same movement at the authored value.
      const scaled = min === 0
      // At an authored zero the multiplier is worked out as if the control sat mid-range, so the control is still scaled by the music the moment the user raises it.
      const reference = base > 0 ? base : range / 2
      if (scaled) {
        // The factors are weighted geometrically so that all of the rising sources at full strength multiply the authored value by exactly the headroom it has.
        const rise = Math.min(up * upScale, (max - reference) * 0.95), fall = Math.min(down * downScale, (reference - min) * 0.95)
        for (const [source, raw] of signed) {
          const weight = raw > 0 ? raw / up : -raw / down
          const total = raw > 0 ? 1 + rise / reference : 1 - fall / reference
          const factor = Number((total ** weight).toFixed(6))
          if (factor !== 1 && Number.isFinite(factor)) drives.push({ id: `cover-${id}-${source.replace('mood.', '')}`, target, source, operation: 'multiply', value: factor })
        }
      } else {
        for (const [source, raw] of signed) {
          const amount = raw * (raw > 0 ? upScale : downScale)
          if (amount !== 0) drives.push({ id: `cover-${id}-${source.replace('mood.', '')}`, target, source, operation, value: Number(amount.toFixed(6)) })
        }
      }
    }
    covered.push(id)
  }
  return Object.freeze({ drives: Object.freeze(drives), covered: Object.freeze(covered), skipped: Object.freeze(skipped) })
}

/**
 * Adds the coverage drives to the manifest as gated rules (see Cinema2MoodConductorAuthoring). Everything authored is carried over unchanged,
 * including the revision, so saved settings keep loading. A preset with no Auto Performance toggle is returned as it is.
 */
export function withCinema2AutoCoverage(manifest: Readonly<Cinema2NativePresetManifest>, options: Readonly<Cinema2AutoCoverageOptions> = {}): Readonly<Cinema2NativePresetManifest> {
  const auto = findAutoPerformance(manifest)
  if (!auto) return manifest
  const coverage = computeCinema2AutoCoverage(manifest, options)
  if (coverage.drives.length === 0) return manifest
  const strengthId = [...drivenKeys(manifest, String(auto.id)).strength][0]
  const spec = {
    idPrefix: `${String(manifest.id).replace(/^.*\./, '')}-cover`,
    idInfix: 'drive',
    enabledParameter: auto.id as Cinema2ParameterId,
    ...(strengthId ? { strengthParameter: strengthId as Cinema2ParameterId } : {}),
    drives: coverage.drives,
  }
  return withCinema2MoodDrives(manifest, spec)
}
