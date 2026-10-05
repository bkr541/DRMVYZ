export type HeadlinerEngineModeId = 'fullscreen'
export const HEADLINER_DEFAULT_CAMERA_SOURCE_ID = 'default-front-camera'
/** Either the default-camera sentinel or the `deviceId` of a camera the user picked. */
export type HeadlinerInputSourceId = string

export interface HeadlinerSettings {
  mode: HeadlinerEngineModeId
  inputSourceId: HeadlinerInputSourceId
}

export const DEFAULT_HEADLINER_SETTINGS: Readonly<HeadlinerSettings> = Object.freeze({
  mode: 'fullscreen',
  inputSourceId: HEADLINER_DEFAULT_CAMERA_SOURCE_ID,
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
  }
}
