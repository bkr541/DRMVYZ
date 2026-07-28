import {
  DEFAULT_REACT_PRESET_RENDER_SETTINGS,
  type OscillatorSettings,
  type ReactEngineId,
  type ReactPreset,
  type ReactPresetControlValues,
} from './ReactTypes'

export type ReactPresetProvenanceStatus = 'exact' | 'modified' | 'custom' | 'unknownLegacy'

export interface ReactPresetProvenance {
  status: ReactPresetProvenanceStatus
  preset: ReactPreset | null
  label: string
  description: string
  changedFields: string[]
}

function equalNumber(a: unknown, b: unknown): boolean {
  return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-9
}

function authoredSubsetMatches(expected: unknown, actual: unknown): boolean {
  if (expected === null || typeof expected !== 'object') {
    return typeof expected === 'number' ? equalNumber(expected, actual) : Object.is(expected, actual)
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length !== actual.length) return false
    return expected.every((value, index) => authoredSubsetMatches(value, actual[index]))
  }
  if (actual === null || typeof actual !== 'object') return false
  return Object.entries(expected as Record<string, unknown>).every(([key, value]) =>
    authoredSubsetMatches(value, (actual as Record<string, unknown>)[key]),
  )
}

export function resolveReactPresetProvenance(input: {
  presets: readonly ReactPreset[]
  activePresetId: string | null
  activeEngineId: ReactEngineId
  controls: ReactPresetControlValues
  oscillatorSettings?: OscillatorSettings
  expectedOscillatorSettings?: OscillatorSettings
  engineSpecificModified?: boolean
}): ReactPresetProvenance {
  if (!input.activePresetId) {
    return {
      status: 'custom',
      preset: null,
      label: 'Custom',
      description: 'No source preset provenance is attached to the current look.',
      changedFields: [],
    }
  }
  const preset = input.presets.find(candidate => candidate.id === input.activePresetId) ?? null
  if (!preset) {
    return {
      status: 'unknownLegacy',
      preset: null,
      label: 'Unknown legacy preset',
      description: `Saved provenance “${input.activePresetId}” is retained, but the preset is not installed.`,
      changedFields: [],
    }
  }
  if (preset.engine !== input.activeEngineId) {
    return {
      status: 'modified',
      preset,
      label: `Modified from ${preset.name}`,
      description: 'The source preset belongs to a different engine than the currently resolved workspace.',
      changedFields: ['engine'],
    }
  }

  const expected: ReactPresetControlValues = {
    ...preset.params,
    ...DEFAULT_REACT_PRESET_RENDER_SETTINGS,
    ...(preset.renderSettings ?? {}),
  }
  const changedFields = (Object.keys(expected) as (keyof ReactPresetControlValues)[])
    .filter(key => !equalNumber(expected[key], input.controls[key]))
    .map(String)

  if (
    preset.engine === 'oscilloscope' &&
    input.oscillatorSettings &&
    input.expectedOscillatorSettings &&
    !authoredSubsetMatches(input.expectedOscillatorSettings, input.oscillatorSettings)
  ) {
    changedFields.push('oscillatorSettings')
  } else if (
    preset.engine === 'oscilloscope' &&
    preset.oscillatorSettings &&
    input.oscillatorSettings &&
    !authoredSubsetMatches(preset.oscillatorSettings, input.oscillatorSettings)
  ) {
    changedFields.push('oscillatorSettings')
  }
  if (input.engineSpecificModified) changedFields.push('engineSpecificState')

  if (changedFields.length === 0) {
    return {
      status: 'exact',
      preset,
      label: preset.name,
      description: `Current values exactly match ${preset.name}.`,
      changedFields,
    }
  }
  return {
    status: 'modified',
    preset,
    label: `Modified from ${preset.name}`,
    description: `Source provenance is preserved. ${changedFields.length} preset-owned field${changedFields.length === 1 ? '' : 's'} differ from the installed recipe.`,
    changedFields,
  }
}
