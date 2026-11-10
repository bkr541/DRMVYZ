// Sound Drawing XY: persisted settings, the parameter catalog behind the Design inspector, and the typed
// values the runtime reads. The inspector follows the Cinema 2.0 / Headliner Design standard: every
// user-visible control sits under exactly one of four parent groups (Master Controls, Design, React,
// Palette), with nested groups inside Design. The catalog is the single source of truth for labels, ranges,
// defaults and visibility, so the panel, the store normaliser and the renderer can never disagree.
//
// Pacing follows the Cinema 2.0 choreography contract: Pattern, Pattern Change (a toggle) and Trigger (the
// canonical eleven musical events, imported unchanged), with Transition Length in beats.

import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../../cinema2/presets/Cinema2AfterhoursPreset'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, type Cinema2AfterhoursTriggerId } from '../../cinema2/modules/Cinema2AfterhoursNativeModule'
import { XY_SCOPE_PATTERN_OPTIONS, type XyScopePattern } from './XyScopePatterns'

export const XY_SCOPE_ENGINE_ID = 'xyScope' as const

export type XyScopeParameterGroup = 'master-controls' | 'design' | 'react' | 'palette'
export type XyScopeParameterValue = number | boolean | string
export type XyScopeParameterValues = Readonly<Record<string, XyScopeParameterValue>>

export const XY_SCOPE_GROUP_ORDER: readonly XyScopeParameterGroup[] = Object.freeze(['master-controls', 'design', 'react', 'palette'])

export const XY_SCOPE_GROUP_LABELS: Readonly<Record<XyScopeParameterGroup, string>> = Object.freeze({
  'master-controls': 'Master Controls',
  design: 'Design',
  react: 'React',
  palette: 'Palette',
})

/** Nested groups inside the Design parent, in order. Controls with no subgroup come first. */
export const XY_SCOPE_DESIGN_SUBGROUPS: readonly string[] = Object.freeze(['Pattern', 'Letters', 'Beam'])

export interface XyScopeParameterVisibility {
  /** The controlling parameter's id. */
  parameterId: string
  equals: XyScopeParameterValue
}

interface XyScopeParameterBase {
  id: string
  group: XyScopeParameterGroup
  /** A nested group inside the parent (Design only). */
  subgroup?: string
  label: string
  /** One plain-language sentence: what changes on screen. */
  description: string
  /** Shown only while another parameter holds a value. The hidden value is kept. */
  visibleWhen?: XyScopeParameterVisibility
}

export interface XyScopeSliderParameter extends XyScopeParameterBase {
  kind: 'slider'
  default: number
  min: number
  max: number
  step: number
  /** `percent` shows the stored value times 100; `ms` and `plain` show it as stored. */
  format: 'percent' | 'ms' | 'plain'
}

export interface XyScopeToggleParameter extends XyScopeParameterBase {
  kind: 'toggle'
  default: boolean
}

export interface XyScopeSelectParameter extends XyScopeParameterBase {
  kind: 'select'
  default: string
  options: readonly { value: string; label: string }[]
}

export interface XyScopeColorParameter extends XyScopeParameterBase {
  kind: 'color'
  default: string
}

export type XyScopeParameterDefinition =
  | XyScopeSliderParameter
  | XyScopeToggleParameter
  | XyScopeSelectParameter
  | XyScopeColorParameter

/** Transition Length in beats, as the Cinema 2.0 choreography offers it. */
export const XY_SCOPE_TRANSITION_LENGTHS = Object.freeze([
  { value: '0.5', label: '½ Beat' },
  { value: '1', label: '1 Beat' },
  { value: '2', label: '2 Beats' },
  { value: '4', label: '4 Beats' },
] as const)

export type XyScopeTrigger = Cinema2AfterhoursTriggerId

export function isXyScopeTrigger(value: unknown): value is XyScopeTrigger {
  return typeof value === 'string' && (CINEMA2_AFTERHOURS_TRIGGER_IDS as readonly string[]).includes(value)
}

export const XY_SCOPE_PARAMETERS: readonly XyScopeParameterDefinition[] = Object.freeze([
  // ── Master Controls ─────────────────────────────────────────────────────────
  {
    id: 'intensity', group: 'master-controls', kind: 'slider', label: 'Master Intensity',
    description: 'Overall beam brightness. Zero blanks the beam.',
    default: 1, min: 0, max: 2, step: 0.01, format: 'percent',
  },
  {
    id: 'audioReactivity', group: 'master-controls', kind: 'slider', label: 'Audio Reactivity',
    description: 'Scales every change the music makes. Zero holds the current pattern still while it keeps drawing.',
    default: 1, min: 0, max: 1, step: 0.01, format: 'percent',
  },
  {
    id: 'motionAmount', group: 'master-controls', kind: 'slider', label: 'Motion Amount',
    description: 'How fast the oscillator figures turn. Zero freezes them and makes pattern changes land at once.',
    default: 0.7, min: 0, max: 1, step: 0.01, format: 'percent',
  },
  {
    id: 'bpmSync', group: 'master-controls', kind: 'toggle', label: 'BPM Sync',
    description: 'On: the figures turn in time with the loaded track. Off: they turn at a steady tempo.',
    default: true,
  },
  // ── Design › Pattern ────────────────────────────────────────────────────────
  {
    id: 'pattern', group: 'design', subgroup: 'Pattern', kind: 'select', label: 'Pattern',
    description: 'The form the word is in: the letters themselves, a waveform, or an oscillator figure.',
    default: 'word', options: XY_SCOPE_PATTERN_OPTIONS,
  },
  {
    id: 'patternChange', group: 'design', subgroup: 'Pattern', kind: 'toggle', label: 'Pattern Change',
    description: 'Moves the word to the next pattern on each Trigger, and back to the letters at the end of the cycle.',
    default: true,
  },
  {
    id: 'trigger', group: 'design', subgroup: 'Pattern', kind: 'select', label: 'Trigger',
    description: 'The musical event that moves the word to the next pattern while Pattern Change is on.',
    default: 'bar', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
    visibleWhen: { parameterId: 'patternChange', equals: true },
  },
  {
    id: 'transitionLength', group: 'design', subgroup: 'Pattern', kind: 'select', label: 'Transition Length',
    description: 'How long the letters take to flow into the next pattern.',
    default: '1', options: XY_SCOPE_TRANSITION_LENGTHS,
  },
  // ── Design › Letters ────────────────────────────────────────────────────────
  {
    id: 'size', group: 'design', subgroup: 'Letters', kind: 'slider', label: 'Text Size',
    description: 'How much of the stage the word fills.',
    default: 0.84, min: 0.3, max: 1, step: 0.01, format: 'percent',
  },
  {
    id: 'letterSpacing', group: 'design', subgroup: 'Letters', kind: 'slider', label: 'Letter Spacing',
    description: 'Space between letters as a share of the letter size. Negative tightens, positive opens.',
    default: 0.024, min: -0.05, max: 0.3, step: 0.002, format: 'percent',
  },
  {
    id: 'minPieceSize', group: 'design', subgroup: 'Letters', kind: 'slider', label: 'Ignore Small Pieces',
    description: 'Skips tiny fragments some display fonts are built from, so grunge and stencil fonts draw cleanly.',
    default: 0.07, min: 0, max: 0.3, step: 0.01, format: 'percent',
  },
  // ── Design › Beam ───────────────────────────────────────────────────────────
  {
    id: 'trail', group: 'design', subgroup: 'Beam', kind: 'slider', label: 'Phosphor Trail',
    description: 'How long the glow lingers after the beam has moved on.',
    default: 110, min: 40, max: 300, step: 5, format: 'ms',
  },
  {
    id: 'glow', group: 'design', subgroup: 'Beam', kind: 'slider', label: 'Glow',
    description: 'Brightness of the halo around each line.',
    default: 1, min: 0, max: 2, step: 0.01, format: 'percent',
  },
  // ── React ───────────────────────────────────────────────────────────────────
  {
    id: 'formResponse', group: 'react', kind: 'slider', label: 'Form Response',
    description: 'How strongly the figures follow the music: bass swells them, mids add detail, highs sharpen the edge.',
    default: 1, min: 0, max: 1.5, step: 0.01, format: 'percent',
  },
  {
    id: 'vibration', group: 'react', kind: 'slider', label: 'Line Vibration',
    description: 'How strongly the letter outlines ring after each kick, like a plucked string settling.',
    default: 1, min: 0, max: 1.5, step: 0.01, format: 'percent',
  },
  {
    id: 'dissolveDepth', group: 'react', kind: 'slider', label: 'Snare Fray',
    description: 'How far the letters fray into the live stereo scope when the snare answers. Zero keeps them solid.',
    default: 1, min: 0, max: 1.5, step: 0.01, format: 'percent',
  },
  {
    id: 'answerDelay', group: 'react', kind: 'slider', label: 'Answer Delay',
    description: 'How long each letter waits after its neighbour, in a pattern change or a kick. Longer makes the wave easier to see.',
    default: 45, min: 0, max: 120, step: 1, format: 'ms',
  },
  // ── Palette ─────────────────────────────────────────────────────────────────
  {
    id: 'beamColor', group: 'palette', kind: 'color', label: 'Beam Core',
    description: 'Colour of the bright centre of every line.',
    default: '#96fff0',
  },
  {
    id: 'glowColor', group: 'palette', kind: 'color', label: 'Beam Glow',
    description: 'Colour of the halo and the phosphor trail.',
    default: '#14d9c5',
  },
  {
    id: 'backgroundColor', group: 'palette', kind: 'color', label: 'Background',
    description: 'Colour of the screen behind the beam.',
    default: '#02070a',
  },
] satisfies readonly XyScopeParameterDefinition[])

const DEFINITION_BY_ID: ReadonlyMap<string, XyScopeParameterDefinition> = new Map(XY_SCOPE_PARAMETERS.map(definition => [definition.id, definition]))

export function getXyScopeParameterDefinition(id: string): XyScopeParameterDefinition | undefined {
  return DEFINITION_BY_ID.get(id)
}

// ── Presets ───────────────────────────────────────────────────────────────────

export interface XyScopePreset {
  id: string
  name: string
  description: string
  parameters: Readonly<Record<string, XyScopeParameterValue>>
}

export const XY_SCOPE_PRESETS: readonly XyScopePreset[] = Object.freeze([
  {
    id: 'conversation', name: 'Converse',
    description: 'The word flows through every form on each bar and comes back as letters.',
    parameters: { intensity: 1, audioReactivity: 1, motionAmount: 0.7, bpmSync: true, pattern: 'word', patternChange: true, trigger: 'bar', transitionLength: '1', trail: 110, glow: 1, formResponse: 1, vibration: 1, dissolveDepth: 1, answerDelay: 45 },
  },
  {
    id: 'clean-scope', name: 'Clean Scope',
    description: 'Crisp letters held solid, with a light ring on each kick.',
    parameters: { intensity: 1, audioReactivity: 0.8, motionAmount: 0.5, bpmSync: true, pattern: 'word', patternChange: false, trigger: 'bar', transitionLength: '2', trail: 70, glow: 0.8, formResponse: 0.7, vibration: 0.55, dissolveDepth: 0.35, answerDelay: 30 },
  },
  {
    id: 'storm', name: 'Storm',
    description: 'Fast changes every two beats with long trails and a heavy ring.',
    parameters: { intensity: 1.2, audioReactivity: 1, motionAmount: 1, bpmSync: true, pattern: 'word', patternChange: true, trigger: 'beat2', transitionLength: '0.5', trail: 200, glow: 1.5, formResponse: 1.4, vibration: 1.4, dissolveDepth: 1.5, answerDelay: 70 },
  },
] satisfies readonly XyScopePreset[])

export function getXyScopePreset(id: string | null | undefined): XyScopePreset | undefined {
  return XY_SCOPE_PRESETS.find(preset => preset.id === id)
}

// ── Persisted settings ────────────────────────────────────────────────────────

export const XY_SCOPE_TEXT_MAX_LENGTH = 16
export const XY_SCOPE_DEFAULT_TEXT = 'DRMVYZ'

export interface XyScopeSettings {
  /** The word drawn. Single line, upper-cased on draw. */
  text: string
  /** A font-library asset id, or null for the bundled default (Anton). */
  fontId: string | null
  /** The preset the values started from, or null once a value was edited past it. */
  presetId: string | null
  parameters: XyScopeParameterValues
}

export function getXyScopeDefaultParameters(): Record<string, XyScopeParameterValue> {
  return Object.fromEntries(XY_SCOPE_PARAMETERS.map(definition => [definition.id, definition.default]))
}

export const DEFAULT_XY_SCOPE_SETTINGS: Readonly<XyScopeSettings> = Object.freeze({
  text: XY_SCOPE_DEFAULT_TEXT,
  fontId: null,
  presetId: 'conversation',
  parameters: Object.freeze(getXyScopeDefaultParameters()),
})

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export function normalizeXyScopeParameterValue(definition: XyScopeParameterDefinition, value: unknown): XyScopeParameterValue {
  switch (definition.kind) {
    case 'slider': {
      const number = typeof value === 'number' && Number.isFinite(value) ? value : definition.default
      return Math.min(definition.max, Math.max(definition.min, number))
    }
    case 'toggle':
      return typeof value === 'boolean' ? value : definition.default
    case 'select':
      return typeof value === 'string' && definition.options.some(option => option.value === value) ? value : definition.default
    case 'color':
      return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : definition.default
  }
}

export function normalizeXyScopeText(value: unknown): string {
  if (typeof value !== 'string') return XY_SCOPE_DEFAULT_TEXT
  // One line only; control characters never reach the outline lookup.
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, XY_SCOPE_TEXT_MAX_LENGTH)
}

export function normalizeXyScopeSettings(value: unknown): XyScopeSettings {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const stored = record.parameters && typeof record.parameters === 'object' && !Array.isArray(record.parameters)
    ? record.parameters as Record<string, unknown>
    : {}
  const parameters: Record<string, XyScopeParameterValue> = {}
  for (const definition of XY_SCOPE_PARAMETERS) parameters[definition.id] = normalizeXyScopeParameterValue(definition, stored[definition.id])
  return {
    text: record.text === undefined ? XY_SCOPE_DEFAULT_TEXT : normalizeXyScopeText(record.text),
    fontId: typeof record.fontId === 'string' && record.fontId.length > 0 && record.fontId.length <= 512 ? record.fontId : null,
    presetId: record.presetId === null ? null : (typeof record.presetId === 'string' && getXyScopePreset(record.presetId) ? record.presetId : DEFAULT_XY_SCOPE_SETTINGS.presetId),
    parameters,
  }
}

export function isXyScopeParameterVisible(definition: XyScopeParameterDefinition, values: XyScopeParameterValues): boolean {
  const rule = definition.visibleWhen
  return rule == null || values[rule.parameterId] === rule.equals
}

/** A copy of the settings with a preset's parameters applied and nothing else touched. */
export function applyXyScopePreset(settings: XyScopeSettings, presetId: string): XyScopeSettings {
  const preset = getXyScopePreset(presetId)
  if (!preset) return settings
  return normalizeXyScopeSettings({ ...settings, presetId: preset.id, parameters: { ...settings.parameters, ...preset.parameters } })
}

// ── Typed values for the runtime ──────────────────────────────────────────────

export interface XyScopeResolvedParameters {
  intensity: number
  audioReactivity: number
  motionAmount: number
  bpmSync: boolean
  pattern: XyScopePattern
  patternChange: boolean
  trigger: XyScopeTrigger
  /** Transition Length in beats. */
  transitionBeats: number
  size: number
  letterSpacing: number
  minPieceSize: number
  trailMs: number
  glow: number
  formResponse: number
  vibration: number
  dissolveDepth: number
  answerDelayMs: number
  beamColor: string
  glowColor: string
  backgroundColor: string
}

export function resolveXyScopeParameters(settings: XyScopeSettings): XyScopeResolvedParameters {
  const p = normalizeXyScopeSettings(settings).parameters
  return {
    intensity: p.intensity as number,
    audioReactivity: p.audioReactivity as number,
    motionAmount: p.motionAmount as number,
    bpmSync: p.bpmSync as boolean,
    pattern: p.pattern as XyScopePattern,
    patternChange: p.patternChange as boolean,
    trigger: p.trigger as XyScopeTrigger,
    transitionBeats: Number(p.transitionLength),
    size: p.size as number,
    letterSpacing: p.letterSpacing as number,
    minPieceSize: p.minPieceSize as number,
    trailMs: p.trail as number,
    glow: p.glow as number,
    formResponse: p.formResponse as number,
    vibration: p.vibration as number,
    dissolveDepth: p.dissolveDepth as number,
    answerDelayMs: p.answerDelay as number,
    beamColor: p.beamColor as string,
    glowColor: p.glowColor as string,
    backgroundColor: p.backgroundColor as string,
  }
}
