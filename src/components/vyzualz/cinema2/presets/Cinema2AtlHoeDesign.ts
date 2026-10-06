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
  bpmSync: parameterId('atl-hoe-bpm-sync'),
  cameraMovement: parameterId('atl-hoe-camera-movement'),
  musicReactivity: parameterId('atl-hoe-music-reactivity'),
  kickReaction: parameterId('atl-hoe-kick-reaction'),
  transientReaction: parameterId('atl-hoe-transient-reaction'),
  dropReaction: parameterId('atl-hoe-drop-reaction'),
  signPattern: parameterId('atl-hoe-sign-pattern'),
  flicker: parameterId('atl-hoe-flicker'),
  cityAtmosphere: parameterId('atl-hoe-city-atmosphere'),
  skyPatternEnabled: parameterId('atl-hoe-sky-pattern-enabled'),
  skyPattern: parameterId('atl-hoe-sky-pattern'),
  signColor: parameterId('atl-hoe-sign-color'),
  signBaseColor: parameterId('atl-hoe-sign-base-color'),
  letterColor: parameterId('atl-hoe-letter-color'),
  architectureColor: parameterId('atl-hoe-architecture-color'),
})
const P = CINEMA2_ATL_HOE_PARAMETER_IDS

export const CINEMA2_ATL_HOE_SIGN_PATTERNS = Object.freeze(['pulse', 'marquee', 'cascade', 'neonFault'] as const)
export type Cinema2AtlHoeSignPattern = typeof CINEMA2_ATL_HOE_SIGN_PATTERNS[number]
export const CINEMA2_ATL_HOE_SKY_PATTERNS = Object.freeze(['stars', 'thunderstorm'] as const)
export type Cinema2AtlHoeSkyPattern = typeof CINEMA2_ATL_HOE_SKY_PATTERNS[number]
const SKY_PATTERN_LABELS: Readonly<Record<Cinema2AtlHoeSkyPattern, string>> = Object.freeze({ stars: 'Stars', thunderstorm: 'Thunderstorm' })
const srgbEncode = (linear: number) => (linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055)
const BOLT_PARTS: readonly string[] = Object.freeze([...atlHoeParts.bolts, ...atlHoeParts.boltTops])
/** Brightness the lit sky parts rest at, and each bolt's rest colour (the sky colour behind it, so an idle bolt cannot be seen). */
export const CINEMA2_ATL_HOE_SKY_PART_PARAMETERS: Readonly<Record<string, Cinema2Color | number>> = Object.freeze({
  ...Object.fromEntries([...atlHoeParts.skySurfaces, ...atlHoeParts.skyBands, ...BOLT_PARTS].map(part => [`${part}.emissiveIntensity`, 1])),
  // The generator writes linear emissive values (as stored in the GLB); colour parameters are read as sRGB, so they are encoded here.
  ...Object.fromEntries(BOLT_PARTS.map(part => [`${part}.emissive`, Object.freeze([...(atlHoeBolts as Record<string, number[]>)[part].map(srgbEncode), 1]) as Cinema2Color])),
})
const PATTERN_LABELS: Readonly<Record<Cinema2AtlHoeSignPattern, string>> = Object.freeze({
  pulse: 'Pulse', marquee: 'Marquee', cascade: 'Cascade', neonFault: 'Neon Fault',
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
    ...baseParameter, id: P.masterIntensity, label: 'Master Intensity',
    description: 'The brightness of everything that lights up (the sign, the windows, the street lights and the spires) and, with it, how hard the music pushes them. 1 is the authored look; 0 is nearly dark.',
    type: 'float' as const, defaultValue: 1, min: 0, max: 1.5, step: 0.01, designParentGroup: 'master-controls' as const, order: 1,
  }),
  Object.freeze({
    ...baseParameter, id: P.bpmSync, label: 'BPM Sync',
    description: 'On: the lighting patterns (the Marquee chase, the Cascade wave, the stepping street lights, the spire blinks, Flicker and the Thunderstorm strikes) and the camera\'s sway all lock to the loaded track\'s BPM and beat grid. Off: they run at a steady 120 BPM. Kick, transient and drop hits always follow the music itself.',
    type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, order: 2,
  }),
  Object.freeze({
    ...baseParameter, id: P.cameraMovement, label: 'Camera Movement',
    description: 'How much the camera sways with the music: a slow drift, a side-to-side weave and a lens breath. At 0 the camera holds the authored frame.',
    type: 'float' as const, defaultValue: 0, min: 0, max: 1, step: 0.01, designParentGroup: 'master-controls' as const, order: 3,
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
    ...baseParameter, id: P.signPattern, label: 'Sign Pattern',
    description: 'How the sign, the skyscraper windows, the street lights and the spires move together. Pulse: everything breathes with the kick and the bass. Marquee: the sign cells chase one after another, with the street lights stepping across. Cascade: a wave of light crosses the scene from left to right on every phrase. Neon Fault: a failing-neon feel, with cells and windows dropping out and stuttering back.',
    type: 'enum' as const, defaultValue: 'pulse',
    options: Object.freeze(CINEMA2_ATL_HOE_SIGN_PATTERNS.map(value => Object.freeze({ value, label: PATTERN_LABELS[value] }))),
    designParentGroup: 'design' as const, group: 'Lighting', order: 1,
  }),
  Object.freeze({
    ...baseParameter, id: P.skyPatternEnabled, label: 'Sky Pattern',
    description: 'Turns on a sky that reacts to the music. Off keeps the calm gradient sky with its fixed stars.',
    type: 'boolean' as const, defaultValue: false, designParentGroup: 'design' as const, group: 'Lighting', order: 2,
  }),
  Object.freeze({
    ...baseParameter, id: P.skyPattern, label: 'Sky Pattern Type',
    description: 'Stars: the stars twinkle on transients, swell with the kick and the track\'s energy and flare on a drop. Thunderstorm: a darker, hazier sky where a lightning strike hits on every bar (one of twelve defined bolts in turn), a thunder flash lights the night with it, and a drop brings four at once.',
    type: 'enum' as const, defaultValue: 'stars',
    options: Object.freeze(CINEMA2_ATL_HOE_SKY_PATTERNS.map(value => Object.freeze({ value, label: SKY_PATTERN_LABELS[value] }))),
    visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: P.skyPatternEnabled, value: true })]),
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
const DOWNBEAT: Source = { signal: 'downbeat', capability: 'music.downbeat' }
const BAR: Source = { signal: 'bar', capability: 'music.bar' }
const PHRASE: Source = { signal: 'phrase', capability: 'music.phrase' }
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
export function atlHoeChoreographyRules(moduleId: Cinema2ModuleId, atmosphereEffectId: Cinema2EffectId): readonly Cinema2ChoreographyRuleManifest[] {
  const intensity = (part: string) => ({ kind: 'module' as const, ref: cinema2Ref(moduleId), property: `${part}.emissiveIntensity` })
  const rules: Cinema2ChoreographyRuleManifest[] = []
  const whenSky = (sky: Cinema2AtlHoeSkyPattern) => [
    { kind: 'parameter-equals' as const, parameterId: P.skyPatternEnabled, value: true },
    { kind: 'parameter-equals' as const, parameterId: P.skyPattern, value: sky },
  ]
  const whenPattern = (pattern: Cinema2AtlHoeSignPattern) => [{ kind: 'parameter-equals' as const, parameterId: P.signPattern, value: pattern }]

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
    options: { strength?: Cinema2ParameterRef; pattern?: Cinema2AtlHoeSignPattern; sky?: Cinema2AtlHoeSkyPattern; conditions?: readonly Cinema2ChoreographyConditionManifest[] } = {},
  ) => {
    rules.push({
      id: ruleId(id),
      priority,
      source,
      actions,
      ...(options.strength ? { strengthParameter: options.strength } : {}),
      ...(options.pattern ? { enabledWhen: whenPattern(options.pattern) } : {}),
      ...(options.sky ? { enabledWhen: whenSky(options.sky) } : {}),
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

  // Pattern rest levels: how bright each group sits between hits (a constant multiplier while that pattern is chosen). Pulse is 1: the authored look.
  const rest: Readonly<Record<Exclude<Cinema2AtlHoeSignPattern, 'pulse'>, readonly [number, number, number, number]>> = Object.freeze({
    marquee: [0.45, 0.8, 0.7, 0.8], cascade: [0.6, 0.7, 0.6, 0.7], neonFault: [0.85, 0.75, 0.7, 0.6],
  })
  for (const pattern of ['marquee', 'cascade', 'neonFault'] as const) {
    const [signRest, windowRest, lampRest, spireRest] = rest[pattern]
    const groups: ReadonlyArray<readonly [readonly string[], number]> = [[SIGN, signRest], [WINDOWS, windowRest], [LAMPS, lampRest], [SPIRES, spireRest]]
    rule(`atl-hoe-rest-${pattern}`, 6, { signal: 'parameter', parameter: cinema2Ref(P.masterIntensity), scale: 0, offset: 1 },
      groups.flatMap(([parts, level]) => parts.map(part => ({ id: actionId(`atl-hoe-rest-${pattern}-${part}`), target: intensity(part), operation: 'multiply' as const, value: level }))),
      { pattern })
  }

  // Continuous music (Music Reactivity): the windows swell with the track's energy, the spires lift through a build, an impact brightens the night.
  rule('atl-hoe-energy', 20, { signal: 'continuous', capability: 'audio.features', path: 'audio.features.overallEnergy', smoothingMs: 120 },
    WINDOWS.map(part => ({ id: actionId(`atl-hoe-energy-${part}`), target: intensity(part), operation: 'add' as const, value: 0.5 })), { strength: music })
  rule('atl-hoe-build', 21, { signal: 'continuous', capability: 'visual-director.significance', path: 'director.build', smoothingMs: 120 },
    SPIRES.map(part => ({ id: actionId(`atl-hoe-build-${part}`), target: intensity(part), operation: 'add' as const, value: 0.8 })), { strength: music })
  rule('atl-hoe-impact', 22, { signal: 'continuous', capability: 'visual-director.significance', path: 'director.impact', smoothingMs: 45 }, [
    { id: actionId('atl-hoe-impact-exposure'), target: { kind: 'environment' as const, property: 'exposure' }, operation: 'add' as const, value: 0.08 },
  ], { strength: music })
  rule('atl-hoe-bass', 23, { signal: 'continuous', capability: 'audio.bands', path: 'audio.bands.bass', smoothingMs: 50 },
    SIGN.map(part => ({ id: actionId(`atl-hoe-bass-${part}`), target: intensity(part), operation: 'add' as const, value: 0.45 })), { strength: music, pattern: 'pulse' })

  // Drop: the whole city blazes, whatever the pattern.
  rule('atl-hoe-drop', 40, DROP, hit('atl-hoe-drop', MASTER_PARTS, 1.4, { hold: 0.4, release: 1.6 }), { strength: drop })

  // ── Pulse: everything breathes with the music ──
  rule('atl-hoe-pulse-kick', 30, KICK, [...hit('atl-hoe-pulse-kick', SIGN, 0.9, { hold: 0.05, release: 0.45 }), ...hit('atl-hoe-pulse-kick-lamps', LAMPS, 0.7, { hold: 0.05, release: 0.45 })], { strength: kick, pattern: 'pulse' })
  rule('atl-hoe-pulse-downbeat', 31, DOWNBEAT, hit('atl-hoe-pulse-downbeat', SPIRES, 1.1, { hold: 0.05, release: 0.7 }), { strength: kick, pattern: 'pulse' })
  rule('atl-hoe-pulse-transient', 32, TRANSIENT, hit('atl-hoe-pulse-transient', WINDOWS, 0.8, { hold: 0.05, release: 0.3, probability: 0.45 }), { strength: transient, pattern: 'pulse' })

  // ── Marquee: the cells chase one after another ──
  rule('atl-hoe-marquee-chase', 30, BAR, hit('atl-hoe-marquee-chase', SIGN, 1.3, { hold: 0.12, release: 0.9 }, 'add', index => (index * 4) / SIGN.length), { strength: music, pattern: 'marquee' })
  for (const [index] of atlHoeParts.lampOrbs.entries()) {
    rule(`atl-hoe-marquee-lamps-${index}`, 31, BEAT, hit(`atl-hoe-marquee-lamps-${index}`, [atlHoeParts.lampOrbs[index], atlHoeParts.lampHalos[index]], 1.1, { hold: 0.1, release: 0.6 }),
      { strength: kick, pattern: 'marquee', conditions: [{ kind: 'beat-interval', every: 4, phase: index, unit: 'beat' }] })
  }
  rule('atl-hoe-marquee-transient', 32, TRANSIENT, hit('atl-hoe-marquee-transient', WINDOWS, 0.8, { hold: 0.05, release: 0.3, probability: 0.5 }), { strength: transient, pattern: 'marquee' })
  rule('atl-hoe-marquee-downbeat', 33, DOWNBEAT, hit('atl-hoe-marquee-downbeat', SPIRES, 1.1, { hold: 0.05, release: 0.7 }), { strength: kick, pattern: 'marquee' })

  // ── Cascade: a wave crosses the scene on every phrase ──
  rule('atl-hoe-cascade-wave', 30, PHRASE, [
    ...hit('atl-hoe-cascade-sign', SIGN, 1.2, { hold: 0.25, release: 1.3 }, 'add', index => index * 0.45),
    ...hit('atl-hoe-cascade-windows', WINDOWS, 1.0, { hold: 0.25, release: 1.3, delayBeats: 5 }, 'add', index => index * 0.6),
    ...hit('atl-hoe-cascade-lamps', LAMPS, 1.0, { hold: 0.25, release: 1.3, delayBeats: 11 }, 'add', index => (index % atlHoeParts.lampOrbs.length) * 0.4),
    ...hit('atl-hoe-cascade-spires', SPIRES, 1.4, { hold: 0.25, release: 1.3, delayBeats: 13.5 }),
  ], { strength: music, pattern: 'cascade' })
  rule('atl-hoe-cascade-kick', 31, KICK, hit('atl-hoe-cascade-kick', SIGN, 0.35, { hold: 0.05, release: 0.4 }), { strength: kick, pattern: 'cascade' })
  rule('atl-hoe-cascade-transient', 32, TRANSIENT, hit('atl-hoe-cascade-transient', WINDOWS, 0.5, { hold: 0.05, release: 0.3, probability: 0.3 }), { strength: transient, pattern: 'cascade' })

  // ── Neon Fault: a failing neon sign ──
  rule('atl-hoe-fault-transient', 30, TRANSIENT, [
    ...hit('atl-hoe-fault-sign', SIGN, 0.08, { hold: 0.1, release: 0.25, probability: 0.3 }, 'multiply'),
    ...hit('atl-hoe-fault-windows', WINDOWS, 0.1, { hold: 0.1, release: 0.25, probability: 0.3 }, 'multiply'),
    ...hit('atl-hoe-fault-lamps', LAMPS, 0.1, { hold: 0.1, release: 0.25, probability: 0.3 }, 'multiply'),
  ], { strength: transient, pattern: 'neonFault' })
  rule('atl-hoe-fault-kick', 31, KICK, hit('atl-hoe-fault-kick', SIGN, 1.2, { hold: 0.03, release: 0.3 }), { strength: kick, pattern: 'neonFault' })
  for (const [index, part] of SPIRES.entries()) {
    rule(`atl-hoe-fault-spire-${index}`, 32, BEAT, hit(`atl-hoe-fault-spire-${index}`, [part], 0.1, { hold: 1.2, release: 0.8 }, 'multiply'),
      { strength: music, pattern: 'neonFault', conditions: [{ kind: 'beat-interval', every: 8, phase: (index * 3) % 8, unit: 'beat' }] })
  }

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

  // ── Sky Pattern: Stars ──
  const STARS = atlHoeParts.stars
  const constant = { signal: 'parameter' as const, parameter: cinema2Ref(P.masterIntensity), scale: 0, offset: 1 }
  rule('atl-hoe-stars-rest', 6, constant, STARS.map(part => ({ id: actionId(`atl-hoe-stars-rest-${part}`), target: intensity(part), operation: 'multiply' as const, value: 1.6 })), { sky: 'stars' })
  rule('atl-hoe-stars-energy', 20, { signal: 'continuous', capability: 'audio.features', path: 'audio.features.overallEnergy', smoothingMs: 150 },
    STARS.map(part => ({ id: actionId(`atl-hoe-stars-energy-${part}`), target: intensity(part), operation: 'add' as const, value: 1 })), { strength: music, sky: 'stars' })
  rule('atl-hoe-stars-kick', 30, KICK, hit('atl-hoe-stars-kick', STARS, 1.2, { hold: 0.05, release: 0.5 }), { strength: kick, sky: 'stars' })
  rule('atl-hoe-stars-transient', 31, TRANSIENT, hit('atl-hoe-stars-transient', STARS, 2.5, { hold: 0.05, release: 0.35, probability: 0.5 }), { strength: transient, sky: 'stars' })
  rule('atl-hoe-stars-drop', 40, DROP, hit('atl-hoe-stars-drop', STARS, 4, { hold: 0.4, release: 1.5 }), { strength: drop, sky: 'stars' })

  // ── Sky Pattern: Thunderstorm ──
  // The calm sky darkens (the bolts darken with it, so an idle bolt stays invisible), the stars go out and the haze thickens.
  const STORM_SKY = [...atlHoeParts.skySurfaces, ...atlHoeParts.skyBands, ...BOLT_PARTS]
  rule('atl-hoe-storm-dark', 6, constant, [
    ...STORM_SKY.map(part => ({ id: actionId(`atl-hoe-storm-dark-${part}`), target: intensity(part), operation: 'multiply' as const, value: 0.28 })),
    ...STARS.map(part => ({ id: actionId(`atl-hoe-storm-stars-${part}`), target: intensity(part), operation: 'multiply' as const, value: 0.06 })),
    { id: actionId('atl-hoe-storm-mist'), target: { kind: 'effect' as const, ref: cinema2Ref(atmosphereEffectId), property: 'mistAmount' }, operation: 'multiply' as const, value: 1.8 },
    { id: actionId('atl-hoe-storm-density'), target: { kind: 'effect' as const, ref: cinema2Ref(atmosphereEffectId), property: 'density' }, operation: 'multiply' as const, value: 1.8 },
  ], { sky: 'thunderstorm' })
  // A strike on the first beat of every bar, one of the twelve bolts in turn, then a weaker second flash; the thunder flash brightens the night with it.
  const boltIntensity = (part: string) => ({ kind: 'module' as const, ref: cinema2Ref(moduleId), property: `${part}.emissiveIntensity` })
  const boltColor = (part: string) => ({ kind: 'module' as const, ref: cinema2Ref(moduleId), property: `${part}.emissive` })
  const strike = (id: string, boltIndex: number, peak: number, delayBeats: number): Cinema2ChoreographyActionManifest[] => {
    const shape = { attack: 0, hold: 0.04, release: 0.28, unit: 'beats' as const }
    return [atlHoeParts.bolts[boltIndex], atlHoeParts.boltTops[boltIndex]].flatMap(part => [
      { id: actionId(`${id}-${part}-colour`), target: boltColor(part), operation: 'envelope' as const, composition: 'add' as const, value: [0.9 * peak, 0.95 * peak, peak, 0], envelope: shape, retrigger: 'restart' as const, delayBeats },
      { id: actionId(`${id}-${part}-light`), target: boltIntensity(part), operation: 'envelope' as const, composition: 'add' as const, value: 13 * peak, envelope: shape, retrigger: 'restart' as const, delayBeats },
    ])
  }
  const thunder = (id: string, exposure: number, delayBeats: number): Cinema2ChoreographyActionManifest => ({
    id: actionId(id), target: { kind: 'environment' as const, property: 'exposure' }, operation: 'envelope' as const, composition: 'add' as const, value: exposure,
    envelope: { attack: 0, hold: 0.03, release: 0.5, unit: 'beats' as const }, retrigger: 'restart' as const, delayBeats,
  })
  atlHoeParts.bolts.forEach((_part, index) => {
    rule(`atl-hoe-storm-strike-${index}`, 30, BEAT, [
      ...strike(`atl-hoe-storm-strike-${index}-a`, index, 1, 0),
      ...strike(`atl-hoe-storm-strike-${index}-b`, index, 0.55, 0.4),
      thunder(`atl-hoe-storm-thunder-${index}-a`, 0.12, 0),
      thunder(`atl-hoe-storm-thunder-${index}-b`, 0.06, 0.4),
    ], { strength: kick, sky: 'thunderstorm', conditions: [{ kind: 'beat-interval', every: 48, phase: index * 4, unit: 'beat' }] })
  })
  // A drop: four hero bolts at once, a second wave right behind, and a big thunder flash.
  rule('atl-hoe-storm-drop', 41, DROP, [
    ...[0, 3, 6, 9].flatMap(index => strike(`atl-hoe-storm-drop-${index}`, index, 1, 0)),
    ...[1, 4, 7, 10].flatMap(index => strike(`atl-hoe-storm-drop-${index}`, index, 0.8, 0.5)),
    thunder('atl-hoe-storm-drop-thunder-a', 0.3, 0),
    thunder('atl-hoe-storm-drop-thunder-b', 0.15, 0.5),
  ], { strength: drop, sky: 'thunderstorm' })

  return Object.freeze(rules)
}
