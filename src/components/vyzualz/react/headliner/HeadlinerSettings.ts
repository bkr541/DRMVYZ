export type HeadlinerEngineModeId = 'fullscreen'
export type HeadlinerInputSourceId = 'default-front-camera'

export interface HeadlinerSettings {
  mode: HeadlinerEngineModeId
  inputSourceId: HeadlinerInputSourceId
}

export const DEFAULT_HEADLINER_SETTINGS: Readonly<HeadlinerSettings> = Object.freeze({
  mode: 'fullscreen',
  inputSourceId: 'default-front-camera',
})

export function normalizeHeadlinerEngineMode(value: unknown): HeadlinerEngineModeId {
  return value === 'fullscreen' ? value : DEFAULT_HEADLINER_SETTINGS.mode
}

export function normalizeHeadlinerInputSource(value: unknown): HeadlinerInputSourceId {
  return value === 'default-front-camera' ? value : DEFAULT_HEADLINER_SETTINGS.inputSourceId
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
