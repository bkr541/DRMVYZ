import {
  DEFAULT_SCOPE_BEAM,
  DEFAULT_SCOPE_CRT,
  DEFAULT_SCOPE_PHOSPHOR,
  DEFAULT_SCOPE_SIGNAL_CONDITIONER,
  DEFAULT_SCOPE_TIMEBASE,
  DEFAULT_SCOPE_TRIGGER,
  DEFAULT_SOUND_DRAWING_SCOPE_STATE,
  type SoundDrawingScopeState,
} from './scopeTypes'

// ── scopePresets ──────────────────────────────────────────────────────────────
//
// Factory presets for the professional scope.
//
// The product argument for these is simple: a signal core with correct triggering
// and a phosphor pipeline is worth nothing to a user who has to assemble a good
// look from twenty controls first. Each preset is a complete recipe — signal,
// timebase, trigger, beam, phosphor, CRT — so a polished result is one click away
// and the advanced panels stay optional.
//
// Presets are grouped by intent, and the grouping is meaningful rather than
// decorative. A measurement preset must not apply treatment that would
// misrepresent the signal it is measuring, so those keep bass width response,
// corner dwell, and curvature at or near zero. Creative presets are free to.

export type ScopePresetGroup = 'measurement' | 'analog' | 'signature'

export interface ScopePreset {
  id: string
  name: string
  description: string
  group: ScopePresetGroup
  /**
   * Partial state layered over the defaults.
   *
   * Deliberately partial: a preset states what it changes, so a field added in a
   * later version reaches every preset through the defaults rather than needing
   * all of them edited.
   */
  state: ScopePresetPatch
}

export interface ScopePresetPatch {
  signalMode?: SoundDrawingScopeState['signalMode']
  signalConditioner?: Partial<SoundDrawingScopeState['signalConditioner']>
  trigger?: Partial<SoundDrawingScopeState['trigger']>
  timebase?: Partial<SoundDrawingScopeState['timebase']>
  beam?: Partial<SoundDrawingScopeState['beam']>
  phosphor?: Partial<SoundDrawingScopeState['phosphor']>
  crt?: Partial<SoundDrawingScopeState['crt']>
  monoDelayMs?: number
}

export const SCOPE_PRESETS: readonly ScopePreset[] = [
  // ── Measurement ─────────────────────────────────────────────────────────────
  {
    id: 'scope-laboratory-green',
    name: 'Laboratory Green',
    description: 'Steady green bench trace with a scope grid. Reads like test equipment.',
    group: 'measurement',
    state: {
      signalMode: 'left',
      trigger: { mode: 'auto', source: 'mid', slope: 'rising', continuityWeight: 0.7, periodAssist: 0.7 },
      timebase: { mode: 'auto', visibleCycles: 3 },
      // Constant width and no corner emphasis: a measurement trace must not
      // change thickness with the music, or the reading changes with it.
      beam: { coreWidthPx: 1.4, haloScale: 4, bassWidthResponse: 0, cornerDwell: 0.1, velocityBrightness: 0.35 },
      phosphor: { persistenceSeconds: 0.12, tightBloom: 0.8, mediumBloom: 0.25, wideBloom: 0.1, whiteHot: 0.3 },
      crt: { enabled: true, phosphorModel: 'green', graticuleStyle: 'scope', curvature: 0, scanlineStrength: 0.1 },
    },
  },
  {
    id: 'scope-amber-bench',
    name: 'Amber Bench',
    description: 'Warm amber tube with a longer trail. Easy on the eyes for long sessions.',
    group: 'measurement',
    state: {
      signalMode: 'left',
      trigger: { mode: 'auto', continuityWeight: 0.7 },
      timebase: { mode: 'auto', visibleCycles: 4 },
      beam: { coreWidthPx: 1.6, haloScale: 5, bassWidthResponse: 0, cornerDwell: 0.15 },
      phosphor: { persistenceSeconds: 0.4, tightBloom: 0.9, mediumBloom: 0.4, wideBloom: 0.2, whiteHot: 0.35 },
      crt: { enabled: true, phosphorModel: 'amber', graticuleStyle: 'scope', curvature: 0.08 },
    },
  },
  {
    id: 'scope-stereo-phase',
    name: 'Stereo Phase',
    description: 'True stereo X/Y with vectorscope rings. Shows width, correlation, and anti-phase.',
    group: 'measurement',
    state: {
      signalMode: 'stereoXY',
      trigger: { mode: 'freeRun' },
      timebase: { mode: 'auto', visibleCycles: 2 },
      beam: { coreWidthPx: 1.4, haloScale: 5, bassWidthResponse: 0, cornerDwell: 0.2 },
      phosphor: { persistenceSeconds: 0.5, tightBloom: 1, mediumBloom: 0.5, wideBloom: 0.3, whiteHot: 0.45 },
      crt: { enabled: true, phosphorModel: 'green', graticuleStyle: 'vectorscope', curvature: 0 },
    },
  },
  {
    id: 'scope-mid-side',
    name: 'Mid / Side',
    description: 'Mid against side. A vertical figure means wide, a horizontal one means centred.',
    group: 'measurement',
    state: {
      signalMode: 'midSideXY',
      trigger: { mode: 'freeRun' },
      beam: { coreWidthPx: 1.4, bassWidthResponse: 0, cornerDwell: 0.2 },
      phosphor: { persistenceSeconds: 0.6, whiteHot: 0.4 },
      crt: { enabled: true, phosphorModel: 'blue', graticuleStyle: 'vectorscope', curvature: 0 },
    },
  },
  {
    id: 'scope-mono-compatibility',
    name: 'Mono Compatibility',
    description: 'Sum against difference. A flat horizontal trace means the mix survives mono.',
    group: 'measurement',
    state: {
      signalMode: 'sumDifferenceXY',
      trigger: { mode: 'freeRun' },
      beam: { coreWidthPx: 1.4, bassWidthResponse: 0, cornerDwell: 0.15 },
      phosphor: { persistenceSeconds: 0.7, whiteHot: 0.35 },
      crt: { enabled: true, phosphorModel: 'white', graticuleStyle: 'vectorscope', curvature: 0 },
    },
  },
  {
    id: 'scope-dual-channel',
    name: 'Dual Channel',
    description: 'Left and right stacked, each on its own baseline.',
    group: 'measurement',
    state: {
      signalMode: 'dualWaveform',
      trigger: { mode: 'auto', source: 'left', continuityWeight: 0.75, periodAssist: 0.75 },
      timebase: { mode: 'auto', visibleCycles: 3 },
      beam: { coreWidthPx: 1.3, haloScale: 4, bassWidthResponse: 0, cornerDwell: 0.1 },
      phosphor: { persistenceSeconds: 0.15, tightBloom: 0.85, mediumBloom: 0.3, wideBloom: 0.1, whiteHot: 0.3 },
      crt: { enabled: true, phosphorModel: 'green', graticuleStyle: 'minimal', curvature: 0 },
    },
  },
  {
    id: 'scope-slow-bass',
    name: 'Slow Bass Trigger',
    description: 'Long window locked to the low end. Built for watching sub movement.',
    group: 'measurement',
    state: {
      signalMode: 'mono',
      // A low-passed trigger source and a generous holdoff: bass periods are
      // long, and without holdoff the display locks to harmonics instead.
      trigger: { mode: 'auto', source: 'mid', holdoffSeconds: 0.02, continuityWeight: 0.85, periodAssist: 0.9 },
      timebase: { mode: 'cycles', visibleCycles: 2 },
      beam: { coreWidthPx: 2, haloScale: 6, bassWidthResponse: 0.2 },
      phosphor: { persistenceSeconds: 0.5, mediumBloom: 0.5, wideBloom: 0.35 },
      crt: { enabled: true, phosphorModel: 'amber', graticuleStyle: 'minimal' },
    },
  },

  // ── Analog character ────────────────────────────────────────────────────────
  {
    id: 'scope-neon-persistence',
    name: 'Neon Persistence',
    description: 'Long-decay phosphor with heavy bloom. Figures hang in the air.',
    group: 'analog',
    state: {
      signalMode: 'stereoXY',
      trigger: { mode: 'freeRun' },
      beam: { coreWidthPx: 1.8, haloScale: 8, bassWidthResponse: 0.6, cornerDwell: 0.6 },
      // whiteHot deliberately mid-range: for a preset whose whole appeal is neon,
      // pushing the core to white throws away the colour it is named for.
      phosphor: { persistenceSeconds: 1.6, tightBloom: 1, mediumBloom: 0.85, wideBloom: 0.75, whiteHot: 0.5, backgroundLift: 0.16 },
      crt: { enabled: true, phosphorModel: 'rgb', curvature: 0.15, vignette: 0.4, scanlineStrength: 0.12 },
    },
  },
  {
    id: 'scope-burned-phosphor',
    name: 'Burned Phosphor',
    description: 'Overdriven green tube with a thick core and a wide, soft halo.',
    group: 'analog',
    state: {
      signalMode: 'monoDelayXY',
      trigger: { mode: 'freeRun' },
      beam: { coreWidthPx: 2.6, haloScale: 10, bassWidthResponse: 0.8, cornerDwell: 0.7 },
      phosphor: { persistenceSeconds: 1.1, tightBloom: 1, mediumBloom: 0.9, wideBloom: 0.85, whiteHot: 0.9, backgroundLift: 0.2 },
      crt: { enabled: true, phosphorModel: 'green', curvature: 0.22, vignette: 0.5, scanlineStrength: 0.28, grain: 0.12, edgeDefocus: 0.45 },
      monoDelayMs: 3.5,
    },
  },
  {
    id: 'scope-ghost-trace',
    name: 'Ghost Trace',
    description: 'Thin, dim, very long persistence. The figure is mostly its own history.',
    group: 'analog',
    state: {
      signalMode: 'stereoXY',
      trigger: { mode: 'freeRun' },
      beam: { coreWidthPx: 0.9, haloScale: 5, bassWidthResponse: 0.3, cornerDwell: 0.5 },
      phosphor: { persistenceSeconds: 2.8, tightBloom: 0.6, mediumBloom: 0.5, wideBloom: 0.5, whiteHot: 0.4, backgroundLift: 0.08 },
      crt: { enabled: true, phosphorModel: 'blue', curvature: 0.18, vignette: 0.55, edgeDefocus: 0.5 },
    },
  },
  {
    id: 'scope-clean-white',
    name: 'Clean White Trace',
    description: 'Neutral white, minimal treatment. A crisp readable line with no tube character.',
    group: 'analog',
    state: {
      signalMode: 'left',
      trigger: { mode: 'auto', continuityWeight: 0.7, periodAssist: 0.7 },
      timebase: { mode: 'auto', visibleCycles: 3 },
      beam: { coreWidthPx: 1.5, haloScale: 4, bassWidthResponse: 0.2, cornerDwell: 0.3 },
      phosphor: { persistenceSeconds: 0.2, tightBloom: 0.9, mediumBloom: 0.35, wideBloom: 0.15, whiteHot: 0.5 },
      crt: { enabled: false },
    },
  },

  // ── Signature ───────────────────────────────────────────────────────────────
  {
    id: 'scope-cyan-emerald-core',
    name: 'Cyan / Emerald Core',
    description: 'Tight cyan core with emerald spill and white-hot crossings.',
    group: 'signature',
    state: {
      signalMode: 'stereoXY',
      trigger: { mode: 'freeRun' },
      beam: { coreWidthPx: 1.5, haloScale: 7, bassWidthResponse: 0.5, cornerDwell: 0.55 },
      phosphor: { persistenceSeconds: 0.9, tightBloom: 1, mediumBloom: 0.7, wideBloom: 0.55, whiteHot: 0.85, backgroundLift: 0.14 },
      crt: { enabled: true, phosphorModel: 'rgb', curvature: 0.1, vignette: 0.35, scanlineStrength: 0.1 },
    },
  },
  {
    id: 'scope-heavy-drop-vector',
    name: 'Heavy Drop Vector',
    description: 'Wide, bass-driven beam with short persistence. Hits hard and clears fast.',
    group: 'signature',
    state: {
      signalMode: 'stereoXY',
      trigger: { mode: 'freeRun' },
      // Cycle-locked rather than beat-relative. A musical window says nothing
      // about the signal's frequency, and an eighth note holds tens of cycles of
      // anything mid-range, which collapses the figure.
      timebase: { mode: 'cycles', visibleCycles: 2 },
      beam: { coreWidthPx: 2.2, haloScale: 9, bassWidthResponse: 1, cornerDwell: 0.5 },
      phosphor: { persistenceSeconds: 0.22, tightBloom: 1, mediumBloom: 0.8, wideBloom: 0.7, whiteHot: 0.95, backgroundLift: 0.1 },
      crt: { enabled: true, phosphorModel: 'rgb', curvature: 0.12, vignette: 0.45 },
    },
  },
  {
    id: 'scope-phase-knot',
    name: 'Phase Knot',
    description: 'Mono delay portrait tuned to fold into knots. Expressive, not a measurement.',
    group: 'signature',
    state: {
      signalMode: 'monoDelayXY',
      trigger: { mode: 'freeRun' },
      beam: { coreWidthPx: 1.4, haloScale: 7, bassWidthResponse: 0.45, cornerDwell: 0.65 },
      phosphor: { persistenceSeconds: 1.2, tightBloom: 1, mediumBloom: 0.75, wideBloom: 0.6, whiteHot: 0.8 },
      crt: { enabled: true, phosphorModel: 'rgb', curvature: 0.14, vignette: 0.4 },
      monoDelayMs: 6,
    },
  },
  {
    id: 'scope-scanner-phosphor',
    name: 'Scanner Phosphor',
    description: 'Corner dwell pushed high, so the beam glows where it turns. Galvo-like.',
    group: 'signature',
    state: {
      signalMode: 'stereoXY',
      trigger: { mode: 'freeRun' },
      beam: { coreWidthPx: 1.3, haloScale: 6, bassWidthResponse: 0.35, cornerDwell: 1, velocityBrightness: 1 },
      phosphor: { persistenceSeconds: 0.75, tightBloom: 1, mediumBloom: 0.65, wideBloom: 0.5, whiteHot: 0.75 },
      crt: { enabled: true, phosphorModel: 'green', curvature: 0.1, vignette: 0.38 },
    },
  },
]

export const SCOPE_PRESETS_BY_ID: ReadonlyMap<string, ScopePreset> = new Map(
  SCOPE_PRESETS.map(preset => [preset.id, preset]),
)

/**
 * Applies a preset over a base state.
 *
 * Layers rather than replaces, at the level of each settings block: a preset
 * that says nothing about triggering leaves the user's trigger settings intact.
 * `presetId` is recorded so the UI can show which preset is active and detect
 * when it has been modified.
 */
export function applyScopePreset(
  base: SoundDrawingScopeState,
  presetId: string,
): SoundDrawingScopeState {
  const preset = SCOPE_PRESETS_BY_ID.get(presetId)
  if (!preset) return base
  const patch = preset.state

  return {
    ...base,
    presetId,
    signalMode: patch.signalMode ?? base.signalMode,
    monoDelayMs: patch.monoDelayMs ?? base.monoDelayMs,
    signalConditioner: { ...base.signalConditioner, ...patch.signalConditioner },
    trigger: { ...base.trigger, ...patch.trigger },
    timebase: { ...base.timebase, ...patch.timebase },
    beam: { ...base.beam, ...patch.beam },
    phosphor: { ...base.phosphor, ...patch.phosphor },
    crt: { ...base.crt, ...patch.crt },
  }
}

/** Resolves a preset to a complete state, starting from the defaults. */
export function resolveScopePresetState(presetId: string): SoundDrawingScopeState {
  return applyScopePreset(
    {
      ...DEFAULT_SOUND_DRAWING_SCOPE_STATE,
      signalConditioner: { ...DEFAULT_SCOPE_SIGNAL_CONDITIONER },
      trigger: { ...DEFAULT_SCOPE_TRIGGER },
      timebase: { ...DEFAULT_SCOPE_TIMEBASE },
      beam: { ...DEFAULT_SCOPE_BEAM },
      phosphor: { ...DEFAULT_SCOPE_PHOSPHOR },
      crt: { ...DEFAULT_SCOPE_CRT },
    },
    presetId,
  )
}

/**
 * True when a measurement preset would apply treatment that misrepresents the
 * signal.
 *
 * A measurement display must not change thickness with the music or bend the
 * geometry it is reading, so these are asserted rather than left to review.
 */
export function violatesMeasurementDiscipline(preset: ScopePreset): boolean {
  if (preset.group !== 'measurement') return false
  const beam = preset.state.beam ?? {}
  const crt = preset.state.crt ?? {}
  return (beam.bassWidthResponse ?? 0) > 0.25 || (crt.curvature ?? 0) > 0.1
}
