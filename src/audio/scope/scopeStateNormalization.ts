import {
  DEFAULT_SCOPE_CRT,
  DEFAULT_SCOPE_SIGNAL_CONDITIONER,
  DEFAULT_SCOPE_TIMEBASE,
  DEFAULT_SCOPE_TRIGGER,
  DEFAULT_SOUND_DRAWING_SCOPE_STATE,
  type ScopeBeatDivision,
  type ScopeSignalConditionerSettings,
  type ScopeSignalMode,
  type ScopeTimebaseMode,
  type ScopeTimebaseSettings,
  type ScopeTriggerMode,
  type ScopeTriggerSettings,
  type ScopeTriggerSlope,
  type ScopeTriggerSource,
  SOUND_DRAWING_SCOPE_STATE_VERSION,
  type ScopeCrtSettings,
  type ScopeGraticuleStyle,
  type ScopePhosphorModel,
  type SoundDrawingScopeState,
} from './scopeTypes'

const SIGNAL_MODES = new Set<ScopeSignalMode>([
  'left',
  'right',
  'dualWaveform',
  'stereoXY',
  'midSideXY',
  'sumDifferenceXY',
  'mono',
  'monoDelayXY',
  'bandSplitXY',
  'proceduralFallback',
])

const TRIGGER_MODES = new Set<ScopeTriggerMode>(['auto', 'normal', 'freeRun', 'single'])
const TRIGGER_SLOPES = new Set<ScopeTriggerSlope>(['rising', 'falling', 'either'])
const TRIGGER_SOURCES = new Set<ScopeTriggerSource>(['left', 'right', 'mid', 'side', 'sum', 'difference'])
const PHOSPHOR_MODELS = new Set<ScopePhosphorModel>(['green', 'amber', 'blue', 'white', 'rgb', 'custom'])
const GRATICULE_STYLES = new Set<ScopeGraticuleStyle>(['none', 'minimal', 'scope', 'vectorscope'])
const TIMEBASE_MODES = new Set<ScopeTimebaseMode>(['seconds', 'cycles', 'beatRelative', 'auto'])
const BEAT_DIVISIONS = new Set<ScopeBeatDivision>(['1/16', '1/8', '1/4', '1/2', '1beat', '2beats', '1bar'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.max(min, Math.min(max, parsed))
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Normalizes a persisted signal mode.
 *
 * Projects saved before the professional core existed used a `lissajous` mode
 * that plotted one buffer half against the other — a delayed mono portrait, not
 * stereo. It migrates to `monoDelayXY`, which renders identically. Silently
 * promoting it to `stereoXY` would change how every existing project looks.
 */
export function normalizeScopeSignalMode(value: unknown): ScopeSignalMode {
  if (value === 'lissajous') return 'monoDelayXY'
  return typeof value === 'string' && SIGNAL_MODES.has(value as ScopeSignalMode)
    ? (value as ScopeSignalMode)
    : DEFAULT_SOUND_DRAWING_SCOPE_STATE.signalMode
}

export function normalizeScopeSignalConditioner(value: unknown): ScopeSignalConditionerSettings {
  const source = isRecord(value) ? value : {}
  const defaults = DEFAULT_SCOPE_SIGNAL_CONDITIONER
  return {
    coupling: source.coupling === 'ac' ? 'ac' : 'dc',
    dcBlockHz: num(source.dcBlockHz, defaults.dcBlockHz, 0.5, 500),
    gainX: num(source.gainX, defaults.gainX, 0.01, 16),
    gainY: num(source.gainY, defaults.gainY, 0.01, 16),
    offsetX: num(source.offsetX, defaults.offsetX, -2, 2),
    offsetY: num(source.offsetY, defaults.offsetY, -2, 2),
    invertX: bool(source.invertX, defaults.invertX),
    invertY: bool(source.invertY, defaults.invertY),
    swapAxes: bool(source.swapAxes, defaults.swapAxes),
  }
}

export function normalizeScopeTrigger(value: unknown): ScopeTriggerSettings {
  const source = isRecord(value) ? value : {}
  const defaults = DEFAULT_SCOPE_TRIGGER
  return {
    mode:
      typeof source.mode === 'string' && TRIGGER_MODES.has(source.mode as ScopeTriggerMode)
        ? (source.mode as ScopeTriggerMode)
        : defaults.mode,
    source:
      typeof source.source === 'string' && TRIGGER_SOURCES.has(source.source as ScopeTriggerSource)
        ? (source.source as ScopeTriggerSource)
        : defaults.source,
    slope:
      typeof source.slope === 'string' && TRIGGER_SLOPES.has(source.slope as ScopeTriggerSlope)
        ? (source.slope as ScopeTriggerSlope)
        : defaults.slope,
    level: num(source.level, defaults.level, -1, 1),
    hysteresis: num(source.hysteresis, defaults.hysteresis, 0, 0.5),
    holdoffSeconds: num(source.holdoffSeconds, defaults.holdoffSeconds, 0, 0.5),
    searchWindowSeconds: num(source.searchWindowSeconds, defaults.searchWindowSeconds, 0.001, 0.5),
    preTriggerRatio: num(source.preTriggerRatio, defaults.preTriggerRatio, 0, 1),
    continuityWeight: num(source.continuityWeight, defaults.continuityWeight, 0, 1),
    periodAssist: num(source.periodAssist, defaults.periodAssist, 0, 1),
    autoFallbackSeconds: num(source.autoFallbackSeconds, defaults.autoFallbackSeconds, 0.05, 5),
  }
}

export function normalizeScopeTimebase(value: unknown): ScopeTimebaseSettings {
  const source = isRecord(value) ? value : {}
  const defaults = DEFAULT_SCOPE_TIMEBASE
  const autoMinimum = num(source.autoMinimumSeconds, defaults.autoMinimumSeconds, 0.0005, 2)
  const autoMaximum = num(source.autoMaximumSeconds, defaults.autoMaximumSeconds, 0.0005, 2)
  return {
    mode:
      typeof source.mode === 'string' && TIMEBASE_MODES.has(source.mode as ScopeTimebaseMode)
        ? (source.mode as ScopeTimebaseMode)
        : defaults.mode,
    secondsPerDisplay: num(source.secondsPerDisplay, defaults.secondsPerDisplay, 0.0005, 2),
    horizontalPosition: num(source.horizontalPosition, defaults.horizontalPosition, -1, 1),
    visibleCycles: num(source.visibleCycles, defaults.visibleCycles, 0.25, 64),
    beatDivision:
      typeof source.beatDivision === 'string' && BEAT_DIVISIONS.has(source.beatDivision as ScopeBeatDivision)
        ? (source.beatDivision as ScopeBeatDivision)
        : defaults.beatDivision,
    // Keep the auto range ordered regardless of how it was persisted; an
    // inverted range would clamp every window to a single value.
    autoMinimumSeconds: Math.min(autoMinimum, autoMaximum),
    autoMaximumSeconds: Math.max(autoMinimum, autoMaximum),
    smoothing: num(source.smoothing, defaults.smoothing, 0, 0.99),
  }
}

/** Hex colours only; anything else falls back rather than reaching a shader. */
function hexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback
}

export function normalizeScopeCrt(value: unknown): ScopeCrtSettings {
  const source = isRecord(value) ? value : {}
  const defaults = DEFAULT_SCOPE_CRT
  return {
    enabled: bool(source.enabled, defaults.enabled),
    phosphorModel:
      typeof source.phosphorModel === 'string' && PHOSPHOR_MODELS.has(source.phosphorModel as ScopePhosphorModel)
        ? (source.phosphorModel as ScopePhosphorModel)
        : defaults.phosphorModel,
    customPhosphorColor: hexColor(source.customPhosphorColor, defaults.customPhosphorColor),
    scanlineStrength: num(source.scanlineStrength, defaults.scanlineStrength, 0, 1),
    scanlineDensity: num(source.scanlineDensity, defaults.scanlineDensity, 40, 2000),
    curvature: num(source.curvature, defaults.curvature, 0, 1),
    vignette: num(source.vignette, defaults.vignette, 0, 1),
    edgeDefocus: num(source.edgeDefocus, defaults.edgeDefocus, 0, 1),
    grain: num(source.grain, defaults.grain, 0, 1),
    graticuleStyle:
      typeof source.graticuleStyle === 'string' && GRATICULE_STYLES.has(source.graticuleStyle as ScopeGraticuleStyle)
        ? (source.graticuleStyle as ScopeGraticuleStyle)
        : defaults.graticuleStyle,
    graticuleBrightness: num(source.graticuleBrightness, defaults.graticuleBrightness, 0, 1),
  }
}

/**
 * Normalizes persisted professional-scope state.
 *
 * Runs unconditionally on load rather than behind a version gate, matching the
 * existing oscillator-settings convention, so projects saved before this state
 * existed pick up defaults without a dedicated migration step.
 */
export function normalizeSoundDrawingScopeState(value: unknown): SoundDrawingScopeState {
  const source = isRecord(value) ? value : {}
  return {
    version: SOUND_DRAWING_SCOPE_STATE_VERSION,
    // A v1 project has no `crt` key, so it receives the defaults — which are
    // disabled. Migrating forward must never switch on a look the user never
    // chose.
    crt: normalizeScopeCrt(source.crt),
    enabled: bool(source.enabled, DEFAULT_SOUND_DRAWING_SCOPE_STATE.enabled),
    signalMode: normalizeScopeSignalMode(source.signalMode),
    signalConditioner: normalizeScopeSignalConditioner(source.signalConditioner),
    trigger: normalizeScopeTrigger(source.trigger),
    timebase: normalizeScopeTimebase(source.timebase),
    monoDelayMs: num(source.monoDelayMs, DEFAULT_SOUND_DRAWING_SCOPE_STATE.monoDelayMs, 0.01, 100),
    presetId: typeof source.presetId === 'string' ? source.presetId : null,
  }
}
