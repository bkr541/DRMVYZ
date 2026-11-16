// Sound Drawing XY › WIREFRAME: reactions. A rule says "when this audio-intelligence trigger fires, do this reaction, this hard, every Nth
// time". The user edits the list (React tab › Reactions); the engine watches the music for the triggers and fires the reactions, each of which
// is a short decaying envelope the engine reads (a camera punch, a flash, a shockwave ring, a spin kick...) or a transition request.
//
// Triggers come from everything the shared analysis reports: the drum hits, the beat grid (every beat, every bar, every 4 and 8 bars), the
// musical structure (a phrase, a section change, a drop, a build starting) and the music itself (a chord change, the energy or the bass
// peaking). A live microphone has no beat grid, sections or chords, so those triggers simply never fire there; nothing is made up.

import type { WireTransitionKind } from './XyScopeWireTransitions'

export type WireTrigger = 'kick' | 'snare' | 'hat' | 'beat' | 'downbeat' | 'bar4' | 'bar8' | 'phrase' | 'section' | 'drop' | 'buildStart' | 'chord' | 'energyPeak' | 'bassPeak'
export const WIRE_TRIGGER_OPTIONS: readonly { value: WireTrigger; label: string }[] = Object.freeze([
  { value: 'kick', label: 'Kick' }, { value: 'snare', label: 'Snare' }, { value: 'hat', label: 'Hi-Hat' },
  { value: 'beat', label: 'Beat' }, { value: 'downbeat', label: 'Downbeat (bar)' }, { value: 'bar4', label: 'Every 4 bars' }, { value: 'bar8', label: 'Every 8 bars' },
  { value: 'phrase', label: 'Phrase change' }, { value: 'section', label: 'Section change' }, { value: 'drop', label: 'Drop' }, { value: 'buildStart', label: 'Build starts' },
  { value: 'chord', label: 'Chord change' }, { value: 'energyPeak', label: 'Energy peak' }, { value: 'bassPeak', label: 'Bass peak' },
])

export type WireReaction = 'punch' | 'flash' | 'shockwave' | 'spinKick' | 'colorPulse' | 'echoBurst' | 'starBurst' | 'bgPulse' | WireTransitionKind
export const WIRE_REACTION_OPTIONS: readonly { value: WireReaction; label: string }[] = Object.freeze([
  { value: 'punch', label: 'Camera punch' }, { value: 'flash', label: 'Flash' }, { value: 'shockwave', label: 'Shockwave ring' },
  { value: 'spinKick', label: 'Spin kick' }, { value: 'colorPulse', label: 'Colour pulse' }, { value: 'echoBurst', label: 'Echo burst' },
  { value: 'starBurst', label: 'Star burst' }, { value: 'bgPulse', label: 'Background pulse' },
  { value: 'shatter', label: 'Shatter' }, { value: 'morph', label: 'Morph' }, { value: 'glitch', label: 'Glitch' }, { value: 'zoom', label: 'Zoom through' },
])
const TRANSITION_REACTIONS: ReadonlySet<string> = new Set<WireReaction>(['shatter', 'morph', 'glitch', 'zoom'])
export const isTransitionReaction = (reaction: WireReaction): reaction is WireTransitionKind => TRANSITION_REACTIONS.has(reaction)

export const WIRE_EVERY_OPTIONS: readonly { value: 1 | 2 | 4 | 8; label: string }[] = Object.freeze([
  { value: 1, label: 'Every time' }, { value: 2, label: 'Every 2nd' }, { value: 4, label: 'Every 4th' }, { value: 8, label: 'Every 8th' },
])

export interface WireRule {
  id: string
  enabled: boolean
  trigger: WireTrigger
  reaction: WireReaction
  /** How hard the reaction hits, 0..1.5. */
  amount: number
  /** Fires on every Nth time the trigger happens. */
  every: 1 | 2 | 4 | 8
}
export const MAX_WIRE_RULES = 16

const rule = (id: string, trigger: WireTrigger, reaction: WireReaction, amount: number, every: WireRule['every'] = 1): WireRule => ({ id, enabled: true, trigger, reaction, amount, every })

/** The rules WIREFRAME starts with (and Reset Reactions returns to): a show that moves on every kind of musical event. */
export const DEFAULT_WIRE_RULES: readonly WireRule[] = Object.freeze([
  rule('r-kick-punch', 'kick', 'punch', .5),
  rule('r-snare-flash', 'snare', 'flash', .6),
  rule('r-beat-bg', 'beat', 'bgPulse', .5),
  rule('r-bar-shock', 'downbeat', 'shockwave', .5, 2),
  rule('r-bar4-spin', 'bar4', 'spinKick', .7),
  rule('r-phrase-colour', 'phrase', 'colorPulse', .7),
  rule('r-section-glitch', 'section', 'glitch', .9),
  rule('r-drop-shatter', 'drop', 'shatter', 1),
  rule('r-drop-stars', 'drop', 'starBurst', 1),
  rule('r-drop-shock', 'drop', 'shockwave', 1.2),
  rule('r-drop-flash', 'drop', 'flash', 1),
  rule('r-build-echo', 'buildStart', 'echoBurst', .8),
  rule('r-chord-colour', 'chord', 'colorPulse', .4),
  rule('r-energy-zoom', 'energyPeak', 'zoom', .6, 2),
].map(r => Object.freeze(r)))

const TRIGGERS = new Set<string>(WIRE_TRIGGER_OPTIONS.map(option => option.value))
const REACTIONS = new Set<string>(WIRE_REACTION_OPTIONS.map(option => option.value))

/** Reads stored rules. Anything that is not a list gives the defaults; a list (even an empty one the user made) is kept, cleaned and capped. */
export function normalizeWireRules(value: unknown): WireRule[] {
  if (!Array.isArray(value)) return DEFAULT_WIRE_RULES.map(r => ({ ...r }))
  const out: WireRule[] = []
  const seen = new Set<string>()
  for (const item of value.slice(0, MAX_WIRE_RULES)) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    if (typeof r.trigger !== 'string' || !TRIGGERS.has(r.trigger) || typeof r.reaction !== 'string' || !REACTIONS.has(r.reaction)) continue
    let id = typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 40 ? r.id : `r-${out.length}`
    while (seen.has(id)) id = `${id}-x`
    seen.add(id)
    const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) ? Math.max(0, Math.min(1.5, r.amount)) : .6
    const every = r.every === 2 || r.every === 4 || r.every === 8 ? r.every : 1
    out.push({ id, enabled: typeof r.enabled === 'boolean' ? r.enabled : true, trigger: r.trigger as WireTrigger, reaction: r.reaction as WireReaction, amount, every })
  }
  return out
}

/** The strength of each trigger this frame (0 when it did not happen). Drum hits carry their strength; the rest are 0 or 1. */
export type WireEvents = Record<WireTrigger, number>
export const NO_EVENTS: Readonly<WireEvents> = Object.freeze({ kick: 0, snare: 0, hat: 0, beat: 0, downbeat: 0, bar4: 0, bar8: 0, phrase: 0, section: 0, drop: 0, buildStart: 0, chord: 0, energyPeak: 0, bassPeak: 0 })

export interface WireTransitionRequest { kind: WireTransitionKind; amount: number }

const LABELS = Object.fromEntries([...WIRE_TRIGGER_OPTIONS, ...WIRE_REACTION_OPTIONS].map(option => [option.value, option.label])) as Record<string, string>

/** The state the reactions leave behind: envelopes that decay, rings that expand, and transitions that were asked for. */
export class WireFx {
  punch = 0
  flash = 0
  /** Extra turning, in turns a second, that decays. */
  spin = 0
  /** A hue shift in degrees that decays. */
  hue = 0
  echo = 0
  stars = 0
  background = 0
  rings: { age: number; strength: number }[] = []
  transitions: WireTransitionRequest[] = []
  /** The most recent reaction, for the inspector, and how many have fired. */
  lastFired = '—'
  fired = 0
  private readonly counts = new Map<string, number>()
  private buildArmed = true
  private energyArmed = true
  private bassArmed = true
  private hueSign = 1

  reset(): void {
    this.punch = 0; this.flash = 0; this.spin = 0; this.hue = 0; this.echo = 0; this.stars = 0; this.background = 0
    this.rings = []; this.transitions = []; this.lastFired = '—'; this.fired = 0; this.counts.clear()
    this.buildArmed = true; this.energyArmed = true; this.bassArmed = true; this.hueSign = 1
  }

  /**
   * Turns the music's state into this frame's triggers. `build`, `energy` and `bass` are smoothed levels (0..1): the peaks fire once when
   * the level rises through a threshold and are armed again only after it has fallen back, so they never chatter.
   */
  detect(events: Readonly<Partial<WireEvents>>, build: number, energy: number, bass: number): WireEvents {
    const out: WireEvents = { ...NO_EVENTS, ...events }
    if (this.buildArmed && build >= .3) { out.buildStart = 1; this.buildArmed = false } else if (build < .1) this.buildArmed = true
    if (this.energyArmed && energy >= .82) { out.energyPeak = 1; this.energyArmed = false } else if (energy < .6) this.energyArmed = true
    if (this.bassArmed && bass >= .85) { out.bassPeak = 1; this.bassArmed = false } else if (bass < .5) this.bassArmed = true
    return out
  }

  /** Fires every enabled rule whose trigger happened (and whose turn it is, for "every Nth"). `gain` is Audio Reactivity: zero fires nothing, and below one every reaction hits softer. */
  apply(rules: readonly WireRule[], events: Readonly<WireEvents>, gain = 1): void {
    if (gain <= 0) return
    for (const r of rules) {
      const strength = events[r.trigger]
      if (!r.enabled || strength <= 0 || r.amount <= 0) continue
      const count = (this.counts.get(r.id) ?? 0) + 1
      this.counts.set(r.id, count)
      if ((count - 1) % r.every !== 0) continue
      this.fire(r.reaction, r.amount * Math.min(1, .55 + .45 * strength) * Math.min(1, gain))
      this.lastFired = `${LABELS[r.trigger]} → ${LABELS[r.reaction]}`
      this.fired++
    }
  }

  fire(reaction: WireReaction, amount: number): void {
    const a = Math.max(0, Math.min(1.5, amount))
    switch (reaction) {
      case 'punch': this.punch = Math.max(this.punch, a); break
      case 'flash': this.flash = Math.max(this.flash, a); break
      case 'spinKick': this.spin = Math.min(2, this.spin + a * .9); break
      case 'colorPulse': this.hueSign = -this.hueSign; this.hue = this.hueSign * Math.min(110, a * 70); break
      case 'echoBurst': this.echo = Math.max(this.echo, a); break
      case 'starBurst': this.stars = Math.max(this.stars, a); break
      case 'bgPulse': this.background = Math.max(this.background, a); break
      case 'shockwave': this.rings.push({ age: 0, strength: a }); if (this.rings.length > 3) this.rings.shift(); break
      default: this.transitions.push({ kind: reaction, amount: a })
    }
  }

  step(dt: number): void {
    const decay = (v: number, tau: number) => { const n = v * Math.exp(-dt / tau); return Math.abs(n) < 1e-3 ? 0 : n }
    this.punch = decay(this.punch, .18); this.flash = decay(this.flash, .16); this.spin = decay(this.spin, .7); this.hue = decay(this.hue, 1)
    this.echo = decay(this.echo, .7); this.stars = decay(this.stars, 1.3); this.background = decay(this.background, .28)
    for (const ring of this.rings) ring.age += dt
    this.rings = this.rings.filter(ring => ring.age < RING_LIFE)
    if (this.transitions.length > 4) this.transitions.length = 4
  }
}

/** How long a shockwave ring lives, in seconds. */
export const RING_LIFE = 1.3
