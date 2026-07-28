import { SCOPE_PRESETS_BY_ID, resolveScopePresetState, type ScopePreset } from './scopePresets'
import type { ScopeSignalMode, SoundDrawingScopeState } from './scopeTypes'

const EPSILON = 1e-6

export type ScopePresetProvenanceStatus = 'exact' | 'modified' | 'custom' | 'unknownLegacy'

export interface ScopePresetProvenance {
  status: ScopePresetProvenanceStatus
  preset: ScopePreset | null
  label: string
  description: string
}

export interface ScopeAxisGainLinkState {
  linked: boolean
  mixed: boolean
  linkedValue: number | null
  label: 'Linked' | 'Custom X/Y'
}

export interface ScopeStabilityMacroState {
  linked: boolean
  mixed: boolean
  value: number
  label: 'Linked' | 'Custom'
}

export interface ScopeSettledScaleDiagnostics {
  traceSize: number
  trimX: number
  trimY: number
  settledXFactor: number
  settledYFactor: number
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON
}

function comparableScopeState(state: SoundDrawingScopeState): unknown {
  const { version: _version, presetId: _presetId, ...comparable } = state
  return comparable
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return nearlyEqual(a, b)
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((value, index) => deepEqual(value, b[index]))
  }
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
  const aRecord = a as Record<string, unknown>
  const bRecord = b as Record<string, unknown>
  const aKeys = Object.keys(aRecord).sort()
  const bKeys = Object.keys(bRecord).sort()
  if (aKeys.length !== bKeys.length || aKeys.some((key, index) => key !== bKeys[index])) return false
  return aKeys.every(key => deepEqual(aRecord[key], bRecord[key]))
}

/** X conditioner gain is consumed only when the trace plots one audio channel against another. */
export function scopeSignalModeUsesXGain(mode: ScopeSignalMode): boolean {
  return mode === 'stereoXY'
    || mode === 'midSideXY'
    || mode === 'sumDifferenceXY'
    || mode === 'monoDelayXY'
    || mode === 'bandSplitXY'
    || mode === 'proceduralFallback'
}

export function resolveScopeAxisGainLinkState(scope: SoundDrawingScopeState): ScopeAxisGainLinkState {
  const { gainX, gainY } = scope.signalConditioner
  const valuesMatch = nearlyEqual(gainX, gainY)
  const linked = scope.axisGainLinked && valuesMatch
  return {
    linked,
    mixed: !linked,
    linkedValue: linked ? gainY : null,
    label: linked ? 'Linked' : 'Custom X/Y',
  }
}

/** Explicitly relinks both canonical axes. No axis is overwritten until this is called. */
export function relinkScopeAxisGains(
  scope: SoundDrawingScopeState,
  value = (scope.signalConditioner.gainX + scope.signalConditioner.gainY) / 2,
): SoundDrawingScopeState {
  return {
    ...scope,
    axisGainLinked: true,
    signalConditioner: { ...scope.signalConditioner, gainX: value, gainY: value },
  }
}

export function resolveScopeStabilityMacro(scope: SoundDrawingScopeState): ScopeStabilityMacroState {
  const { continuityWeight, periodAssist } = scope.trigger
  const linked = nearlyEqual(continuityWeight, periodAssist)
  return {
    linked,
    mixed: !linked,
    value: linked ? continuityWeight : (continuityWeight + periodAssist) / 2,
    label: linked ? 'Linked' : 'Custom',
  }
}

export function resolveScopePresetProvenance(scope: SoundDrawingScopeState): ScopePresetProvenance {
  if (!scope.presetId) {
    return {
      status: 'custom',
      preset: null,
      label: 'Custom',
      description: 'This scope state has no named preset provenance.',
    }
  }
  const preset = SCOPE_PRESETS_BY_ID.get(scope.presetId) ?? null
  if (!preset) {
    return {
      status: 'unknownLegacy',
      preset: null,
      label: 'Unknown legacy preset',
      description: `The saved preset ID “${scope.presetId}” is preserved, but is not installed in this build.`,
    }
  }
  const exact = deepEqual(comparableScopeState(scope), comparableScopeState(resolveScopePresetState(preset.id)))
  return exact
    ? {
        status: 'exact',
        preset,
        label: preset.name,
        description: preset.description,
      }
    : {
        status: 'modified',
        preset,
        label: `Modified from ${preset.name}`,
        description: `The current values differ from ${preset.name}. Reset restores the exact source preset.`,
      }
}

export function resolveScopeSettledScaleDiagnostics(
  pathScale: number,
  scope: SoundDrawingScopeState,
): ScopeSettledScaleDiagnostics {
  const trimX = scope.signalConditioner.gainX
  const trimY = scope.signalConditioner.gainY
  return {
    traceSize: pathScale,
    trimX,
    trimY,
    settledXFactor: pathScale * trimX,
    settledYFactor: pathScale * trimY,
  }
}
