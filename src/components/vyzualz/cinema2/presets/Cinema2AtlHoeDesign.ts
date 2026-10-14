import {
  cinema2Ref,
  cinema2StableId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyActionManifest,
  type Cinema2ChoreographyConditionManifest,
  type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographyRuleManifest,
  type Cinema2ChoreographySourceManifest,
  type Cinema2Color,
  type Cinema2EffectId,
  type Cinema2ModuleId,
  type Cinema2ParameterId,
  type Cinema2ParameterManifest,
  type Cinema2ParameterRef,
} from '../contracts/Cinema2NativePresetManifest'
import atlHoeParts from './atlHoeParts.json'
import atlHoeBolts from './atlHoeBolts.json'
import {
  CINEMA2_ATL_HOE_PATTERN_IDS,
  CINEMA2_ATL_HOE_PATTERN_LABELS,
  type Cinema2AtlHoePatternId,
} from '../modules/atlHoe/Cinema2AtlHoePatternEngine'
import { CINEMA2_ATL_HOE_TRIGGER_IDS } from '../modules/atlHoe/Cinema2AtlHoePatternController'

// ── ATL HOE Design tab: controls, palette bindings and audio-reactive choreography ─────────────────────────────────────────────
// See docs/cinema2-atl-hoe-design-tab-plan.md. The lit things are groups of model parts (atlHoeParts.json); every reaction is a
// choreography rule that adds to, or multiplies, those parts' emissive intensity, the way Electric Storm drives its own module.

const parameterId = (value: string) => cinema2StableId<Cinema2ParameterId>(value)
// Stable ids are lowercase kebab-case; part names (signFace00, lampOrbA) are camel case.
const slug = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
const ruleId = (value: string) => cinema2StableId<Cinema2ChoreographyRuleId>(slug(value))
const actionId = (value: string) => cinema2StableId<Cinema2ChoreographyActionId>(slug(value))
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])

export const CINEMA2_ATL_HOE_PARAMETER_IDS = Object.freeze({
  masterIntensity: parameterId('atl-hoe-master-intensity'),
  autoPerformance: parameterId('atl-hoe-auto-performance'),
  bpmSync: parameterId('atl-hoe-bpm-sync'),
  cameraMovement: parameterId('atl-hoe-camera-movement'),
  musicReactivity: parameterId('atl-hoe-music-reactivity'),
  kickReaction: parameterId('atl-hoe-kick-reaction'),
  transientReaction: parameterId('atl-hoe-transient-reaction'),
  dropReaction: parameterId('atl-hoe-drop-reaction'),
  signPattern: parameterId('atl-hoe-sign-pattern'),
  patternChange: parameterId('atl-hoe-pattern-change'),
  trigger: parameterId('atl-hoe-trigger'),
  flicker: parameterId('atl-hoe-flicker'),
  cityAtmosphere: parameterId('atl-hoe-city-atmosphere'),
  signColor: parameterId('atl-hoe-sign-color'),
  signBaseColor: parameterId('atl-hoe-sign-base-color'),
  letterColor: parameterId('atl-hoe-letter-color'),
  architectureColor: parameterId('atl-hoe-architecture-color'),
})
const P = CINEMA2_ATL_HOE_PARAMETER_IDS

export const CINEMA2_ATL_HOE_SIGN_PATTERNS = CINEMA2_ATL_HOE_PATTERN_IDS
export type Cinema2AtlHoeSignPattern = Cinema2AtlHoePatternId
const TRIGGER_LABELS = Object.freeze({
  beat: 'Beat', kick: 'Kick', snare: 'Snare', downbeat: 'Downbeat', beat2: 'Every 2 Beats', bar: 'Every 4 Beats / Bar',
  bar4: 'Every 4 Bars', bar8: 'Every 8 Bars', phrase: 'Phrase', section: 'Section', drop: 'Drop',
})
const srgbEncode = (linear: number) => (linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055)
const BOLT_PARTS: readonly string[] = Object.freeze([...atlHoeParts.bolts, ...atlHoeParts.boltTops])
/** Brightness the lit sky parts rest at, and each bolt's rest colour (the sky colour behind it, so an idle bolt cannot be seen). */
export const CINEMA2_ATL_HOE_SKY_PART_PARAMETERS: Readonly<Record<string, Cinema2Color | number>> = Object.freeze({
  ...Object.fromEntries([...atlHoeParts.skySurfaces, ...atlHoeParts.skyBands, ...BOLT_PARTS].map(part => [`${part}.emissiveIntensity`, 1])),
  // The generator writes linear emissive values (as stored in the GLB); colour parameters are read as sRGB, so they are encoded here.
  ...Object.fromEntries(BOLT_PARTS.map(part => [`${part}.emissive`, Object.freeze([...(atlHoeBolts as Record<string, number[]>)[part].map(srgbEncode), 1]) as Cinema2Color])),
})

// ── Architecture Color: the visible control drives the windows directly and overrides nine hidden groups, each starting at its authored colour ────────────────────
interface ArchitectureGroup { readonly key: string; readonly label: string; readonly authored: Cinema2Color; readonly parts: readonly string[] }
const ARCHITECTURE_GROUPS: readonly ArchitectureGroup[] = Object.freeze([
  { key: 'lamps', label: 'Street Lights', authored: color(1, 0.4, 0.06), parts: [...atlHoeParts.lampOrbs, 'roadGlow'] },
  { key: 'halos', label: 'Street Light Halos', authored: color(1, 0.45, 0.1), parts: atlHoeParts.lampHalos },
  { key: 'crown', label: 'Bank of America Crown', authored: color(1, 0.62, 0.16), parts: ['spireBoa'] },
  { key: 'piers', label: 'Bank of America Piers', authored: color(1, 0.45, 0.12), parts: ['bofaGlow'] },
  { key: 'cyan', label: 'Westin Windows', authored: color(0.1, 0.9, 0.85), parts: ['cyanWindows'] },
  { key: 'truist', label: 'Truist Windows', authored: color(0.15, 0.9, 0.9), parts: ['truistWindows'] },
  { key: 'glass', label: 'Westin Glass', authored: color(0.22, 0.33, 0.46), parts: ['glassWindows'] },
  { key: 'cool', label: 'Rims and Edges', authored: color(0.6, 0.9, 1), parts: ['spireWestinRim', 'spireTruistEdge'] },
  { key: 'warm', label: 'Masts and Caps', authored: color(1, 0.92, 0.72), parts: ['spireBoaTip', 'spireWestinMast', 'spireTruistCap'] },
])
const architectureGroupId = (key: string) => parameterId(`atl-hoe-architecture-${slug(key)}`)

const baseParameter = {
  section: 'Design',
  exposure: 'primary' as const,
  modulatable: false,
  choreographable: false,
  automatable: false,
  persistence: 'preset' as const,
  reset: 'authored-default' as const,
}
const hiddenParameter = { ...baseParameter, exposure: 'hidden' as const, designParentGroup: 'palette' as const, group: 'Hidden', order: 900 }

export const CINEMA2_ATL_HOE_DESIGN_PARAMETERS: readonly Cinema2ParameterManifest[] = Object.freeze([
  Object.freeze({
    ...baseParameter, id: P.autoPerformance, label: 'Auto Performance',
    description: 'Lets the music direct the six full-scene programs: restrained city states for quiet and vocal passages, rising architecture through builds, high-energy route and marquee programs, and Storm Takeover only on a qualified drop.',
    type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, order: 1,
  }),
  Object.freeze({
    ...baseParameter, id: P.masterIntensity, label: 'Master Intensity',
    description: 'The brightness of everything that lights up (the sign, the windows, the street lights and the spires) and, with it, how hard the music pushes them. 1 is the authored look; 0 is nearly dark.',
    type: 'float' as const, defaultValue: 1, min: 0, max: 1.5, step: 0.01, designParentGroup: 'master-controls' as const, order: 2,
  }),
  Object.freeze({
    ...baseParameter, id: P.bpmSync, label: 'BPM Sync',
    description: 'On: the lighting patterns (the Marquee chase, the Cascade wave, the stepping street lights, the spire blinks, Flicker and the Thunderstorm strikes) and the camera\'s sway all lock to the loaded track\'s BPM and beat grid. Off: they run at a steady 120 BPM. Kick, transient and drop hits always follow the music itself.',
    type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, order: 3,
  }),
  Object.freeze({
    ...baseParameter, id: P.cameraMovement, label: 'Camera Movement',
    description: 'How much the camera sways with the music: a slow drift, a side-to-side weave and a lens breath. At 0 the camera holds the authored frame.',
    type: 'float' as const, defaultValue: 0, min: 0, max: 1, step: 0.01, designParentGroup: 'master-controls' as const, order: 4,
  }),
  Object.freeze({
    ...baseParameter, id: P.musicReactivity, label: 'Music Reactivity',
    description: 'How strongly the whole scene follows the music\'s energy, builds and impacts: the windows swell with the track, the sign breathes with the bass, the spires lift through a build and the scene brightens on an impact.',
    type: 'float' as const, defaultValue: 0.8, min: 0, max: 1, step: 0.01, designParentGroup: 'master-controls' as const, group: 'Music', order: 4,
  }),
  Object.freeze({
    ...baseParameter, id: P.kickReaction, label: 'Kick Reactivity',
    description: 'How strongly the sign and the street lights hit on every kick drum.',
    type: 'float' as const, defaultValue: 0.72, min: 0, max: 1, step: 0.01, designParentGroup: 'master-controls' as const, group: 'Music', order: 5,
  }),
  Object.freeze({
    ...baseParameter, id: P.transientReaction, label: 'Transient Reaction',
    description: 'How strongly the windows sparkle (or, in Neon Fault, drop out) on every sharp transient such as a snare or a hat.',
    type: 'float' as const, defaultValue: 0.58, min: 0, max: 1, step: 0.01, designParentGroup: 'master-controls' as const, group: 'Music', order: 6,
  }),
  Object.freeze({
    ...baseParameter, id: P.dropReaction, label: 'Drop Reaction',
    description: 'How hard the whole city blazes when a drop arrives.',
    type: 'float' as const, defaultValue: 0.92, min: 0, max: 1, step: 0.01, designParentGroup: 'master-controls' as const, group: 'Music', order: 7,
  }),
  Object.freeze({
    ...baseParameter, id: P.signPattern, label: 'Pattern',
    description: 'Selects one of six authored full-scene lighting programs. Each program assigns different spatial paths and musical responsibilities to the sign, road, streetlights, skyline, crowns, foliage and sky.',
    type: 'enum' as const, defaultValue: 'city-pulse',
    options: Object.freeze(CINEMA2_ATL_HOE_SIGN_PATTERNS.map(value => Object.freeze({ value, label: CINEMA2_ATL_HOE_PATTERN_LABELS[value] }))),
    metadata: Object.freeze({ userEditSetParameters: Object.freeze({ [P.autoPerformance]: false }) }),
    designParentGroup: 'design' as const, group: 'Lighting', order: 1,
  }),
  Object.freeze({
    ...baseParameter, id: P.patternChange, label: 'Pattern Change',
    description: 'Advances through all six programs in a deterministic shuffled cycle when the selected Trigger occurs. Enabling it turns Auto Performance off.',
    type: 'boolean' as const, defaultValue: false,
    metadata: Object.freeze({ userEditSetParameters: Object.freeze({ [P.autoPerformance]: false }) }),
    designParentGroup: 'design' as const, group: 'Lighting', order: 2,
  }),
  Object.freeze({
    ...baseParameter, id: P.trigger, label: 'Trigger',
    description: 'Chooses the musical event that advances the program while Pattern Change is enabled.',
    type: 'enum' as const, defaultValue: 'bar4',
    options: Object.freeze(CINEMA2_ATL_HOE_TRIGGER_IDS.map(value => Object.freeze({ value, label: TRIGGER_LABELS[value] }))),
    visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: P.patternChange, value: true })]),
    designParentGroup: 'design' as const, group: 'Lighting', order: 3,
  }),
  Object.freeze({
    ...baseParameter, id: P.flicker, label: 'Flicker',
    description: 'How much the WAFFLE HOUSE sign cells cut out and stutter on every beat, each in its own rhythm, like a tired neon sign. At 0 the sign is steady.',
    type: 'float' as const, defaultValue: 0, min: 0, max: 1, step: 0.01, designParentGroup: 'effects' as const, group: 'Sign', order: 1,
  }),
  Object.freeze({
    ...baseParameter, id: P.cityAtmosphere, label: 'City Atmosphere',
    description: 'The haze in front of the sign, between the sign and the city, and through the skyscrapers. 0 is a crisp night; 1 is a heavy, glowing haze. The middle is the authored look.',
    type: 'float' as const, defaultValue: 0.5, min: 0, max: 1, step: 0.01, designParentGroup: 'effects' as const, group: 'Atmosphere', order: 2,
  }),
  Object.freeze({
    ...baseParameter, id: P.signColor, label: 'Sign Color',
    description: 'The color of the WAFFLE HOUSE sign\'s lit faces.',
    type: 'color' as const, defaultValue: color(1, 0.65, 0.01), designParentGroup: 'palette' as const, group: 'Sign', order: 1,
    metadata: Object.freeze({ mirrorParameters: Object.freeze([P.signBaseColor]) }),
  }),
  Object.freeze({
    ...hiddenParameter, id: P.signBaseColor, label: 'Sign Face Base Color', type: 'color' as const, defaultValue: color(1, 0.6084, 0),
  }),
  Object.freeze({
    ...baseParameter, id: P.letterColor, label: 'Letter Color',
    description: 'The color of the letters on the sign.',
    type: 'color' as const, defaultValue: color(0.004, 0.004, 0.004), designParentGroup: 'palette' as const, group: 'Sign', order: 2,
  }),
  Object.freeze({
    ...baseParameter, id: P.architectureColor, label: 'Architecture Color',
    description: 'The color of the lit architecture: the windows, the street lights, the crowns and the spires. Until you pick a color the authored mix stays (amber windows, cyan on the Westin and Truist, gold crowns). The red aircraft beacons never change.',
    type: 'color' as const, defaultValue: color(1, 0.6, 0.12), designParentGroup: 'palette' as const, group: 'Architecture', order: 3,
    metadata: Object.freeze({ mirrorParameters: Object.freeze(ARCHITECTURE_GROUPS.map(group => architectureGroupId(group.key))) }),
  }),
  ...ARCHITECTURE_GROUPS.map(group => Object.freeze({
    ...hiddenParameter, id: architectureGroupId(group.key), label: `Architecture: ${group.label}`, type: 'color' as const, defaultValue: group.authored,
  })),
])

/** Module parameter bindings for the palette: sign faces, letters and every architecture part's emissive colour. */
export function atlHoeModuleBindings(): Readonly<Record<string, Cinema2ParameterRef>> {
  const bindings: Record<string, Cinema2ParameterRef> = {}
  bindings.atlHoePattern = cinema2Ref(P.signPattern)
  bindings.atlHoeAutoPerformance = cinema2Ref(P.autoPerformance)
  bindings.atlHoePatternChange = cinema2Ref(P.patternChange)
  bindings.atlHoeTrigger = cinema2Ref(P.trigger)
  bindings.atlHoeBpmSync = cinema2Ref(P.bpmSync)
  bindings.atlHoeMasterIntensity = cinema2Ref(P.masterIntensity)
  bindings.atlHoeMusicReactivity = cinema2Ref(P.musicReactivity)
  bindings.atlHoeKickReaction = cinema2Ref(P.kickReaction)
  bindings.atlHoeTransientReaction = cinema2Ref(P.transientReaction)
  bindings.atlHoeDropReaction = cinema2Ref(P.dropReaction)
  for (const part of atlHoeParts.signFaces) {
    bindings[`${part}.emissive`] = cinema2Ref(P.signColor)
    bindings[`${part}.color`] = cinema2Ref(P.signBaseColor)
  }
  bindings['signLetters.color'] = cinema2Ref(P.letterColor)
  for (const part of atlHoeParts.windows) bindings[`${part}.emissive`] = cinema2Ref(P.architectureColor)
  for (const group of ARCHITECTURE_GROUPS) for (const part of group.parts) bindings[`${part}.emissive`] = cinema2Ref(architectureGroupId(group.key))
  return Object.freeze(bindings)
}

// ── Choreography ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const SIGN = atlHoeParts.signFaces
const WINDOWS = [...atlHoeParts.windows, ...atlHoeParts.windowsCool]
const LAMPS = [...atlHoeParts.lampOrbs, ...atlHoeParts.lampHalos]
const SPIRES = atlHoeParts.spires
const MASTER_PARTS = [...SIGN, ...WINDOWS, ...LAMPS, ...SPIRES, 'roadGlow', 'bofaGlow']

type Source = Cinema2ChoreographySourceManifest
const KICK: Source = { signal: 'kick', capability: 'music.rhythm-events' }
const TRANSIENT: Source = { signal: 'transient', capability: 'music.rhythm-events' }
const BEAT: Source = { signal: 'beat', capability: 'music.beat' }
const DROP: Source = { signal: 'drop', capability: 'music.drop' }

interface Envelope {
  readonly attack?: number
  readonly hold: number
  readonly release: number
  readonly delayBeats?: number
  readonly probability?: number
  readonly gate?: Cinema2ChoreographyActionManifest['gate']
}

/**
 * Builds the rule set for a Design-tab control. `moduleId` is the three-scene module that carries the lit parts and `atmosphereEffectId`
 * the volumetric haze. Brightness works on the parts' base emissive intensity: reactions add to it first, then the multipliers (Master
 * Intensity, a pattern's rest level, Flicker and the fault dips) scale the sum.
 */
export function atlHoeChoreographyRules(
  moduleId: Cinema2ModuleId,
  atmosphereEffectId: Cinema2EffectId,
  bloomEffectId: Cinema2EffectId,
): readonly Cinema2ChoreographyRuleManifest[] {
  const intensity = (part: string) => ({ kind: 'module' as const, ref: cinema2Ref(moduleId), property: `${part}.emissiveIntensity` })
  const rules: Cinema2ChoreographyRuleManifest[] = []

  /** An envelope that adds `peak` to (or multiplies by `peak`) every part named, optionally staggered per part. */
  const hit = (
    id: string, parts: readonly string[], peak: number, shape: Envelope, composition: 'add' | 'multiply' = 'add',
    stagger?: (index: number) => number,
  ): Cinema2ChoreographyActionManifest[] => parts.map((part, index) => ({
    id: actionId(`${id}-${part}`),
    target: intensity(part),
    operation: 'envelope' as const,
    composition,
    value: peak,
    envelope: { attack: shape.attack ?? 0, hold: shape.hold, release: shape.release, unit: 'beats' as const },
    retrigger: 'restart' as const,
    ...(stagger || shape.delayBeats != null ? { delayBeats: (shape.delayBeats ?? 0) + (stagger ? stagger(index) : 0) } : {}),
    ...(shape.probability != null ? { probability: shape.probability } : {}),
    ...(shape.gate ? { gate: shape.gate } : {}),
  }))
  const rule = (
    id: string, priority: number, source: Source, actions: Cinema2ChoreographyActionManifest[],
    options: { strength?: Cinema2ParameterRef; conditions?: readonly Cinema2ChoreographyConditionManifest[] } = {},
  ) => {
    rules.push({
      id: ruleId(id),
      priority,
      source,
      actions,
      ...(options.strength ? { strengthParameter: options.strength } : {}),
      ...(options.conditions ? { conditions: options.conditions } : {}),
    })
  }
  const music = cinema2Ref(P.musicReactivity)
  const kick = cinema2Ref(P.kickReaction)
  const transient = cinema2Ref(P.transientReaction)
  const drop = cinema2Ref(P.dropReaction)

  // Master Intensity: a multiplier that is exactly 1 at the authored default (so a missing rule can never dim the scene), falls to 8% at 0
  // and rises to 1.46 at 1.5. The source is the slider minus its default; `multiply` interpolates from 1 toward 1.92 by that amount.
  rule('atl-hoe-master', 5, { signal: 'parameter', parameter: cinema2Ref(P.masterIntensity), offset: -1 },
    MASTER_PARTS.map(part => ({ id: actionId(`atl-hoe-master-${part}`), target: intensity(part), operation: 'multiply' as const, value: 1.92 })))

  // Continuous music (Music Reactivity): the windows swell with the track's energy, the spires lift through a build, an impact brightens the night.
  rule('atl-hoe-energy', 20, { signal: 'continuous', capability: 'audio.features', path: 'audio.features.overallEnergy', smoothingMs: 120 },
    WINDOWS.map(part => ({ id: actionId(`atl-hoe-energy-${part}`), target: intensity(part), operation: 'add' as const, value: 0.5 })), { strength: music })
  rule('atl-hoe-build', 21, { signal: 'continuous', capability: 'visual-director.significance', path: 'director.build', smoothingMs: 120 },
    SPIRES.map(part => ({ id: actionId(`atl-hoe-build-${part}`), target: intensity(part), operation: 'add' as const, value: 0.8 })), { strength: music })
  rule('atl-hoe-impact', 22, { signal: 'continuous', capability: 'visual-director.significance', path: 'director.impact', smoothingMs: 45 }, [
    { id: actionId('atl-hoe-impact-exposure'), target: { kind: 'environment' as const, property: 'exposure' }, operation: 'add' as const, value: 0.08 },
  ], { strength: music })
  // Bright sources now reshape the air as well as their own emissive surface. These restrained multipliers preserve HDR hue and sign detail.
  rule('atl-hoe-environment-energy', 23, { signal: 'continuous', capability: 'audio.features', path: 'audio.features.overallEnergy', smoothingMs: 140 }, [
    { id: actionId('atl-hoe-energy-beams'), target: { kind: 'effect' as const, ref: cinema2Ref(atmosphereEffectId), property: 'beamIntensity' }, operation: 'multiply' as const, value: 1.65 },
    { id: actionId('atl-hoe-energy-mist'), target: { kind: 'effect' as const, ref: cinema2Ref(atmosphereEffectId), property: 'mistAmount' }, operation: 'multiply' as const, value: 1.3 },
    { id: actionId('atl-hoe-energy-bloom'), target: { kind: 'effect' as const, ref: cinema2Ref(bloomEffectId), property: 'intensity' }, operation: 'multiply' as const, value: 1.22 },
  ], { strength: music })
  // Drop arc: immediate source hit, short hold, then a longer city/haze afterglow while exposure returns quickly.
  rule('atl-hoe-drop-environment', 46, DROP, [
    { id: actionId('atl-hoe-drop-beam'), target: { kind: 'effect' as const, ref: cinema2Ref(atmosphereEffectId), property: 'beamIntensity' }, operation: 'envelope' as const, composition: 'add' as const, value: 0.18, envelope: { attack: 0, hold: 0.35, release: 3.6, unit: 'beats' as const }, retrigger: 'restart' as const },
    { id: actionId('atl-hoe-drop-mist'), target: { kind: 'effect' as const, ref: cinema2Ref(atmosphereEffectId), property: 'mistAmount' }, operation: 'envelope' as const, composition: 'add' as const, value: 0.055, envelope: { attack: 0, hold: 0.5, release: 3.8, unit: 'beats' as const }, retrigger: 'restart' as const },
    { id: actionId('atl-hoe-drop-haze'), target: { kind: 'effect' as const, ref: cinema2Ref(atmosphereEffectId), property: 'ambientHaze' }, operation: 'envelope' as const, composition: 'add' as const, value: 0.01, envelope: { attack: 0, hold: 0.5, release: 4.2, unit: 'beats' as const }, retrigger: 'restart' as const },
    { id: actionId('atl-hoe-drop-bloom'), target: { kind: 'effect' as const, ref: cinema2Ref(bloomEffectId), property: 'intensity' }, operation: 'envelope' as const, composition: 'add' as const, value: 0.28, envelope: { attack: 0, hold: 0.3, release: 2.6, unit: 'beats' as const }, retrigger: 'restart' as const },
    { id: actionId('atl-hoe-drop-exposure'), target: { kind: 'environment' as const, property: 'exposure' }, operation: 'envelope' as const, composition: 'add' as const, value: 0.045, envelope: { attack: 0, hold: 0.12, release: 1.1, unit: 'beats' as const }, retrigger: 'restart' as const },
  ], { strength: drop })
  // Flicker: on every beat each sign cell stutters through its own step pattern; the slider is how deep the drop-outs go.
  const FLICKER_PATTERNS = ['x.x..xx.', '..xx.x..', 'xx..x...', '.x.xx..x', 'x...xx.x', '..x.x.xx']
  rule('atl-hoe-flicker', 28, BEAT, SIGN.flatMap((part, index) => hit('atl-hoe-flicker', [part], 0.1, { hold: 1, release: 0, gate: { stepsPerBeat: 8, pattern: FLICKER_PATTERNS[index % FLICKER_PATTERNS.length], duty: 0.6 } }, 'multiply')),
    { strength: cinema2Ref(P.flicker) })

  // City Atmosphere: a multiplier on the haze, exactly 1 at the middle of the slider (the authored look), 0.1 at 0 and 1.9 at 1.
  rule('atl-hoe-atmosphere', 8, { signal: 'parameter', parameter: cinema2Ref(P.cityAtmosphere), offset: -0.5 }, [
    { id: actionId('atl-hoe-atmosphere-mist'), target: { kind: 'effect' as const, ref: cinema2Ref(atmosphereEffectId), property: 'mistAmount' }, operation: 'multiply' as const, value: 2.8 },
    { id: actionId('atl-hoe-atmosphere-density'), target: { kind: 'effect' as const, ref: cinema2Ref(atmosphereEffectId), property: 'density' }, operation: 'multiply' as const, value: 2.8 },
    { id: actionId('atl-hoe-atmosphere-fog'), target: { kind: 'environment' as const, property: 'fog.density' }, operation: 'multiply' as const, value: 2.8 },
  ])

  return Object.freeze(rules)
}
