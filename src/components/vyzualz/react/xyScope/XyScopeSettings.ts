// Sound Drawing XY: persisted settings, the parameter catalog behind the Design inspector, and the typed
// values the runtime reads. The inspector follows the Cinema 2.0 / Headliner Design standard: every
// user-visible control sits under exactly one of four parent groups (Master Controls, Design, React,
// Palette). The catalog is the single source of truth for labels, ranges, defaults and visibility, so the
// panel, the store normaliser and the renderer can never disagree.

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

export interface XyScopeParameterVisibility {
  /** The controlling parameter's id. */
  parameterId: string
  equals: XyScopeParameterValue
}

interface XyScopeParameterBase {
  id: string
  group: XyScopeParameterGroup
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

export const XY_SCOPE_PHRASE_LENGTHS = Object.freeze([
  { value: 'bar4', label: 'Every 4 Bars' },
  { value: 'bar8', label: 'Every 8 Bars' },
  { value: 'bar16', label: 'Every 16 Bars' },
] as const)

export type XyScopePhraseLength = typeof XY_SCOPE_PHRASE_LENGTHS[number]['value']

export const XY_SCOPE_PARAMETERS: readonly XyScopeParameterDefinition[] = Object.freeze([
  // ── Master Controls ─────────────────────────────────────────────────────────
  {
    id: 'intensity', group: 'master-controls', kind: 'slider', label: 'Master Intensity',
    description: 'Overall beam brightness. Zero blanks the beam.',
    default: 1, min: 0, max: 2, step: 0.01, format: 'percent',
  },
  {
    id: 'audioReactivity', group: 'master-controls', kind: 'slider', label: 'Audio Reactivity',
    description: 'Scales every change the music makes. Zero holds the text still while it keeps drawing.',
    default: 1, min: 0, max: 1, step: 0.01, format: 'percent',
  },
  // ── Design ──────────────────────────────────────────────────────────────────
  {
    id: 'size', group: 'design', kind: 'slider', label: 'Text Size',
    description: 'How much of the stage the word fills.',
    default: 0.84, min: 0.3, max: 1, step: 0.01, format: 'percent',
  },
  {
    id: 'letterSpacing', group: 'design', kind: 'slider', label: 'Letter Spacing',
    description: 'Space between letters as a share of the letter size. Negative tightens, positive opens.',
    default: 0.024, min: -0.05, max: 0.3, step: 0.002, format: 'percent',
  },
  {
    id: 'trail', group: 'design', kind: 'slider', label: 'Phosphor Trail',
    description: 'How long the glow lingers after the beam has moved on.',
    default: 110, min: 40, max: 300, step: 5, format: 'ms',
  },
  {
    id: 'glow', group: 'design', kind: 'slider', label: 'Glow',
    description: 'Brightness of the halo around each line.',
    default: 1, min: 0, max: 2, step: 0.01, format: 'percent',
  },
  {
    id: 'minPieceSize', group: 'design', kind: 'slider', label: 'Ignore Small Pieces',
    description: 'Skips tiny fragments some display fonts are built from, so grunge and stencil fonts draw cleanly.',
    default: 0.07, min: 0, max: 0.3, step: 0.01, format: 'percent',
  },
  // ── React ───────────────────────────────────────────────────────────────────
  {
    id: 'dissolveDepth', group: 'react', kind: 'slider', label: 'Dissolve Depth',
    description: 'How far letters break apart into the live stereo scope on snare answers and phrase changes. Zero keeps the text solid.',
    default: 1, min: 0, max: 1.5, step: 0.01, format: 'percent',
  },
  {
    id: 'answerDelay', group: 'react', kind: 'slider', label: 'Answer Delay',
    description: 'How long each letter waits before answering its neighbour. Longer makes the call-and-response easier to see.',
    default: 45, min: 0, max: 120, step: 1, format: 'ms',
  },
  {
    id: 'vibration', group: 'react', kind: 'slider', label: 'Line Vibration',
    description: 'How strongly the outlines ring after each kick, like a plucked string settling.',
    default: 1, min: 0, max: 1.5, step: 0.01, format: 'percent',
  },
  {
    id: 'phraseDissolve', group: 'react', kind: 'toggle', label: 'Phrase Dissolve',
    description: 'Dissolves the whole word into the scope at each musical phrase, then re-forms it.',
    default: true,
  },
  {
    id: 'phraseLength', group: 'react', kind: 'select', label: 'Phrase Length',
    description: 'How often the whole word dissolves.',
    default: 'bar4', options: XY_SCOPE_PHRASE_LENGTHS,
    visibleWhen: { parameterId: 'phraseDissolve', equals: true },
  },
  {
    id: 'dropDissolve', group: 'react', kind: 'toggle', label: 'Dissolve On Drops',
    description: 'Dissolves the word when the music drops after a break.',
    default: true,
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
    description: 'Letters answer each other with the track and dissolve at every phrase.',
    parameters: { intensity: 1, audioReactivity: 1, trail: 110, glow: 1, dissolveDepth: 1, answerDelay: 45, vibration: 1, phraseDissolve: true, phraseLength: 'bar4', dropDissolve: true },
  },
  {
    id: 'clean-scope', name: 'Clean Scope',
    description: 'Crisp, mostly solid lines with a light ring on each kick.',
    parameters: { intensity: 1, audioReactivity: 0.8, trail: 70, glow: 0.8, dissolveDepth: 0.35, answerDelay: 30, vibration: 0.55, phraseDissolve: true, phraseLength: 'bar8', dropDissolve: true },
  },
  {
    id: 'storm', name: 'Storm',
    description: 'Deep dissolves, long trails and a heavy ring.',
    parameters: { intensity: 1.2, audioReactivity: 1, trail: 200, glow: 1.5, dissolveDepth: 1.5, answerDelay: 70, vibration: 1.4, phraseDissolve: true, phraseLength: 'bar4', dropDissolve: true },
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
  const cleaned = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, XY_SCOPE_TEXT_MAX_LENGTH)
  return cleaned
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
  size: number
  letterSpacing: number
  trailMs: number
  glow: number
  minPieceSize: number
  dissolveDepth: number
  answerDelayMs: number
  vibration: number
  phraseDissolve: boolean
  phraseLength: XyScopePhraseLength
  dropDissolve: boolean
  beamColor: string
  glowColor: string
  backgroundColor: string
}

export function resolveXyScopeParameters(settings: XyScopeSettings): XyScopeResolvedParameters {
  const p = normalizeXyScopeSettings(settings).parameters
  return {
    intensity: p.intensity as number,
    audioReactivity: p.audioReactivity as number,
    size: p.size as number,
    letterSpacing: p.letterSpacing as number,
    trailMs: p.trail as number,
    glow: p.glow as number,
    minPieceSize: p.minPieceSize as number,
    dissolveDepth: p.dissolveDepth as number,
    answerDelayMs: p.answerDelay as number,
    vibration: p.vibration as number,
    phraseDissolve: p.phraseDissolve as boolean,
    phraseLength: p.phraseLength as XyScopePhraseLength,
    dropDissolve: p.dropDissolve as boolean,
    beamColor: p.beamColor as string,
    glowColor: p.glowColor as string,
    backgroundColor: p.backgroundColor as string,
  }
}
