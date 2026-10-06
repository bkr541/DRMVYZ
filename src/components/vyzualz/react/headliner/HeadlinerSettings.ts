import {
  HEADLINER_DEFAULT_PRESET_ID,
  isHeadlinerPresetId,
  normalizeHeadlinerParameterOverrides,
  type HeadlinerParameterValue,
  type HeadlinerPresetId,
} from './HeadlinerEffectCatalog'

export type HeadlinerEngineModeId = 'fullscreen'
export const HEADLINER_DEFAULT_CAMERA_SOURCE_ID = 'default-front-camera'
/** Either the default-camera sentinel or the `deviceId` of a camera the user picked. */
export type HeadlinerInputSourceId = string

export interface HeadlinerSettings {
  mode: HeadlinerEngineModeId
  inputSourceId: HeadlinerInputSourceId
  /** The active effect preset, or null for Clean Playback (the plain camera). */
  presetId: HeadlinerPresetId | null
  /** Design-tab values that differ from the preset's defaults, keyed by preset id then parameter id. */
  parameters: Readonly<Record<string, Readonly<Record<string, HeadlinerParameterValue>>>>
}

export const DEFAULT_HEADLINER_SETTINGS: Readonly<HeadlinerSettings> = Object.freeze({
  mode: 'fullscreen',
  inputSourceId: HEADLINER_DEFAULT_CAMERA_SOURCE_ID,
  presetId: HEADLINER_DEFAULT_PRESET_ID,
  parameters: Object.freeze({}),
})

export function normalizeHeadlinerEngineMode(value: unknown): HeadlinerEngineModeId {
  return value === 'fullscreen' ? value : DEFAULT_HEADLINER_SETTINGS.mode
}

export function normalizeHeadlinerInputSource(value: unknown): HeadlinerInputSourceId {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
    ? value
    : DEFAULT_HEADLINER_SETTINGS.inputSourceId
}

export function normalizeHeadlinerSettings(value: unknown): HeadlinerSettings {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  return {
    mode: normalizeHeadlinerEngineMode(record.mode),
    inputSourceId: normalizeHeadlinerInputSource(record.inputSourceId),
    presetId: record.presetId === null || isHeadlinerPresetId(record.presetId) ? record.presetId : DEFAULT_HEADLINER_SETTINGS.presetId,
    parameters: normalizeHeadlinerParameterOverrides(record.parameters),
  }
}
