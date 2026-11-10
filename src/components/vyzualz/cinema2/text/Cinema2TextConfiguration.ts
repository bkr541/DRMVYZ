import type { Cinema2JsonValue, Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import type { Cinema2Runtime } from '../runtime/Cinema2Runtime'
import { sanitizeCinema2SayItText } from '../modules/sayIt/Cinema2SayItTextLayout'
import alphabet from '../modules/nightshift/Cinema2NightshiftSignAlphabet.generated.json'

const EXTRUDED_TEXT_NAMES = { 'say-it': 'SAY IT', submerge: 'SUBMERGE', orbital: 'ORBITAL' } as const

export const CINEMA2_TEXT_FIELDS = {
  'drmvyz.cinema2.orbital': ['orbital-line-mode', 'orbital-text', 'orbital-line-2-text', 'orbital-alignment', 'orbital-tracking', 'orbital-line-spacing', 'orbital-glyph-scale', 'orbital-material-style', 'orbital-roughness', 'orbital-letter-depth', 'orbital-led-outline', 'orbital-background', 'orbital-chrome', 'orbital-outline-color', 'orbital-gyroscope-size', 'orbital-planet', 'orbital-debris'],
  'drmvyz.cinema2.submerge': ['submerge-line-mode', 'submerge-text', 'submerge-line-2-text', 'submerge-alignment', 'submerge-tracking', 'submerge-line-spacing', 'submerge-glyph-scale', 'submerge-material-style', 'submerge-roughness', 'submerge-letter-depth', 'submerge-led-outline', 'submerge-background', 'submerge-chrome', 'submerge-outline-color', 'submerge-architecture', 'submerge-caustics', 'submerge-haze', 'submerge-particles', 'submerge-bubbles'],
  'drmvyz.cinema2.say-it': ['say-it-line-mode', 'say-it-text', 'say-it-line-2-text', 'say-it-alignment', 'say-it-tracking', 'say-it-line-spacing', 'say-it-glyph-scale', 'say-it-material-style', 'say-it-led-outline', 'say-it-background', 'say-it-chrome', 'say-it-outline-color'],
  'drmvyz.cinema2.marquee': ['marquee-front-text', 'marquee-left-text', 'marquee-right-text', 'marquee-sign-illumination', 'marquee-marquee-color'],
  'drmvyz.cinema2.nightshift': ['nightshift-enable-signs', 'nightshift-sign-text', 'nightshift-sign-text-left', 'nightshift-sign-text-front', 'nightshift-sign-text-right', 'nightshift-sign-size', 'nightshift-sign-color'],
} as const
export type Cinema2TextPresetId = keyof typeof CINEMA2_TEXT_FIELDS
export type TextParameters = Record<string, Cinema2JsonValue>
export interface Cinema2SavedText {
  id: string
  presetId: Cinema2TextPresetId
  name: string
  schemaVersion: 1
  parameters: TextParameters
  createdAt: string
}
export interface Cinema2TextPool { id: string; presetId: Cinema2TextPresetId; name: string; createdAt: string }
export interface Cinema2TextMembership { poolId: string; recordId: string; presetId: Cinema2TextPresetId }
export interface Cinema2TextLibraryData { records: Cinema2SavedText[]; pools: Cinema2TextPool[]; memberships: Cinema2TextMembership[] }
export const emptyTextLibrary = (): Cinema2TextLibraryData => ({ records: [], pools: [], memberships: [] })
export function isCinema2TextPreset(id: string | null | undefined): id is Cinema2TextPresetId {
  return id != null && Object.hasOwn(CINEMA2_TEXT_FIELDS, id)
}
export function createTextDraft(presetId: Cinema2TextPresetId, capture?: Cinema2ParameterState): Cinema2ParameterState {
  const compiled = cinema2NativePresetRegistry.compile(presetId as Parameters<typeof cinema2NativePresetRegistry.compile>[0])
  if (!compiled.ok) throw new Error('This text preset is unavailable.')
  const draft = new Cinema2ParameterState(compiled.plan.parameters)
  if (capture) draft.setPersistentValues(textParameters(presetId, capture))
  else for (const id of CINEMA2_TEXT_FIELDS[presetId]) {
    if (draft.getDefinition(id as Cinema2ParameterId)?.type === 'string') draft.setPersistentValue(id as Cinema2ParameterId, '')
  }
  return draft
}
export function textParameters(presetId: Cinema2TextPresetId, state: Cinema2ParameterState): TextParameters {
  return Object.fromEntries(CINEMA2_TEXT_FIELDS[presetId].map(id => [id, state.getValue(id as Cinema2ParameterId)!]))
}
export function validateTextParameters(presetId: Cinema2TextPresetId, input: unknown): TextParameters {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid text scene.')
  const parameters = input as TextParameters
  const fields: readonly string[] = CINEMA2_TEXT_FIELDS[presetId]
  if (Object.keys(parameters).length !== fields.length || Object.keys(parameters).some(id => !fields.includes(id))) throw new Error('The text scene fields do not match this preset.')
  const draft = createTextDraft(presetId)
  const result = draft.setPersistentValues(parameters)
  if (!result.ok) throw new Error(result.diagnostics[0]?.message ?? 'Invalid text settings.')
  return textParameters(presetId, draft)
}
function extrudedTextPrefix(presetId: Cinema2TextPresetId): keyof typeof EXTRUDED_TEXT_NAMES | null {
  const slug = presetId.slice('drmvyz.cinema2.'.length) as keyof typeof EXTRUDED_TEXT_NAMES
  return Object.hasOwn(EXTRUDED_TEXT_NAMES, slug) ? slug : null
}
export function textLines(presetId: Cinema2TextPresetId, parameters: TextParameters, includeInactive = false): string[] {
  const prefix = extrudedTextPrefix(presetId)
  const ids = prefix ? [`${prefix}-text`, ...(includeInactive || parameters[`${prefix}-line-mode`] === 'two' ? [`${prefix}-line-2-text`] : [])]
    : presetId.endsWith('marquee') ? ['marquee-front-text', 'marquee-left-text', 'marquee-right-text']
      : ['nightshift-sign-text', 'nightshift-sign-text-left', 'nightshift-sign-text-front', 'nightshift-sign-text-right']
  return ids.map(id => typeof parameters[id] === 'string' ? parameters[id] as string : '')
}
export function textContentError(presetId: Cinema2TextPresetId, parameters: TextParameters): string | null {
  const lines = textLines(presetId, parameters)
  if (!lines.some(line => line.trim())) return 'Enter at least one text message.'
  const prefix = extrudedTextPrefix(presetId)
  if (prefix) {
    const result = sanitizeCinema2SayItText({ line1: lines[0], line2: lines[1] }, parameters[`${prefix}-line-mode`] === 'one' ? 1 : 2)
    if (result.truncated) return 'Use up to 12 characters per line and 20 characters total.'
    if (result.replacementCount) return `${EXTRUDED_TEXT_NAMES[prefix]} supports English letters, numbers and Basic Latin punctuation.`
  } else {
    const limit = presetId.endsWith('marquee') ? 48 : 64
    if (lines.some(line => Array.from(line).length > limit)) return `Use up to ${limit} characters per sign.`
    if (presetId.endsWith('nightshift') && lines.some(line => Array.from(line).some(char => !Object.hasOwn(alphabet, char)))) return 'NIGHTSHIFT supports Latin letters, numbers and its bundled punctuation and symbols.'
  }
  return null
}
export function applySavedText(runtime: Cinema2Runtime, record: Cinema2SavedText): void {
  if (runtime.getCompiledPresetPlan().presetId !== record.presetId) throw new Error('Select the matching Cinema 2.0 preset first.')
  const values = validateTextParameters(record.presetId, record.parameters)
  const result = runtime.getParameterState().setPersistentValues(values)
  if (!result.ok) throw new Error(result.diagnostics[0]?.message ?? 'Text could not be activated.')
}
