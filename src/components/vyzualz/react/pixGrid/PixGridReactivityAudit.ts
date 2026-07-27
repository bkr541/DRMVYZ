import type { ReactPreset, ReactSectionType } from '../ReactTypes'
import { PixGridReactionRuntime, createSilentPixGridAudioFrame } from './PixGridAudioRouting'
import { composePixGridLogicalFrame } from './PixGridCompositor'
import { applyPixGridRuntimeControls } from './PixGridRuntimeControls'
import type { PixGridAudioFrame, PixGridReactionSource, PixGridState } from './PixGridTypes'
import { validatePixGridPreset, type PixGridValidationReport } from './PixGridValidationAudit'

export type PixGridAuditScenarioId =
  | 'silence' | 'kick' | 'snare' | 'bassSustain' | 'highEnergy' | 'build' | 'preDrop'
  | 'drop' | 'breakdown' | 'phraseBoundary' | 'secondDrop' | 'outro'

export interface PixGridAuditScenario {
  id: PixGridAuditScenarioId
  sectionType: ReactSectionType
  audioTime: number
  sourceValues: Partial<Record<PixGridReactionSource, number>>
  eventIdentities?: Partial<Record<string, string>>
  sectionOccurrence?: number
  dropOccurrence?: number
  phraseEntry?: boolean
}

export interface PixGridReactivityAuditCheck {
  id: string
  passed: boolean
  detail: string
}

export interface PixGridReactivityAuditReport {
  presetId: string
  passed: boolean
  validation: PixGridValidationReport
  checks: readonly PixGridReactivityAuditCheck[]
  pixelHashes: Readonly<Record<PixGridAuditScenarioId, string>>
}

export const PIX_GRID_REACTIVITY_AUDIT_SCENARIOS: readonly PixGridAuditScenario[] = Object.freeze([
  { id: 'silence', sectionType: 'verse', audioTime: 8, sourceValues: {} },
  { id: 'kick', sectionType: 'verse', audioTime: 12, sourceValues: { kick: 1, beat: 1, transient: 0.85, bass: 0.45 } },
  { id: 'snare', sectionType: 'verse', audioTime: 14, sourceValues: { snare: 1, beat: 1, transient: 0.75, high: 0.55 } },
  { id: 'bassSustain', sectionType: 'verse', audioTime: 18, sourceValues: { sub: 0.9, bass: 1, lowMid: 0.72, bassStemActivity: 0.9, energy: 0.62 } },
  { id: 'highEnergy', sectionType: 'verse', audioTime: 22, sourceValues: { energy: 1, trackRelativeEnergy: 1, volume: 0.92, spectralFlux: 0.8 } },
  { id: 'build', sectionType: 'build', audioTime: 28, sourceValues: { buildProgress: 0.9, energy: 0.82, tension: 0.88, phraseProgress: 0.82 }, sectionOccurrence: 1 },
  { id: 'preDrop', sectionType: 'preDrop', audioTime: 31, sourceValues: { energy: 0.25, tension: 1, phraseProgress: 0.96 }, sectionOccurrence: 1 },
  { id: 'drop', sectionType: 'drop', audioTime: 32.1, sourceValues: { dropImpact: 1, kick: 1, beat: 1, bass: 1, energy: 1, transient: 1 }, sectionOccurrence: 1, dropOccurrence: 1 },
  { id: 'breakdown', sectionType: 'breakdown', audioTime: 68, sourceValues: { energy: 0.28, vocalActivity: 0.5, melodyActivity: 0.45 }, sectionOccurrence: 1 },
  { id: 'phraseBoundary', sectionType: 'breakdown', audioTime: 72, sourceValues: { phraseEntry: 1, beat: 1, energy: 0.4 }, phraseEntry: true, sectionOccurrence: 1 },
  { id: 'secondDrop', sectionType: 'drop', audioTime: 80.1, sourceValues: { dropImpact: 1, kick: 1, snare: 0.8, beat: 1, bass: 1, energy: 1, transient: 1 }, sectionOccurrence: 2, dropOccurrence: 2 },
  { id: 'outro', sectionType: 'outro', audioTime: 120, sourceValues: { energy: 0.18, volume: 0.22, phraseProgress: 0.9 }, sectionOccurrence: 1 },
])

function frameForScenario(
  scenario: PixGridAuditScenario,
  controls: { bassReactivity: number; motion: number } = { bassReactivity: 1, motion: 1 },
): PixGridAudioFrame {
  const sourceValues = { ...scenario.sourceValues }
  const capabilities = Object.fromEntries(Object.keys(sourceValues).map(source => [source, true]))
  const confidence = Object.fromEntries(Object.keys(sourceValues).map(source => [source, 1]))
  return applyPixGridRuntimeControls(createSilentPixGridAudioFrame({
    audioTime: scenario.audioTime,
    isPlaying: true,
    deltaTimeSec: 1 / 60,
    sectionType: scenario.sectionType,
    sectionPhase: scenario.id === 'drop' || scenario.id === 'secondDrop' ? 'entry' : 'body',
    sectionOccurrence: scenario.sectionOccurrence ?? 1,
    dropOccurrence: scenario.dropOccurrence ?? 0,
    phraseEntry: scenario.phraseEntry ?? false,
    phraseSegment: scenario.phraseEntry ? 'entry' : 'middle',
    beatIndex: Math.round(scenario.audioTime * 2),
    barIndex: Math.floor(scenario.audioTime / 2),
    phraseIndex: Math.floor(scenario.audioTime / 8),
    sourceValues,
    capabilities,
    confidence,
    eventIdentities: Object.fromEntries(Object.entries(sourceValues).filter(([, value]) => (value ?? 0) > 0).map(([source]) => [source, `${scenario.id}:${source}`])),
    trackIdentity: 'pix-grid-reactivity-audit',
  }), controls)
}

function hashPixels(pixels: Uint8Array): string {
  let hash = 2166136261
  for (let index = 0; index < pixels.length; index += 1) {
    hash ^= pixels[index]!
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function differingBytes(a: Uint8Array, b: Uint8Array): number {
  const length = Math.min(a.length, b.length)
  let count = Math.abs(a.length - b.length)
  for (let index = 0; index < length; index += 1) if (a[index] !== b[index]) count += 1
  return count
}

function renderScenario(
  preset: ReactPreset,
  state: PixGridState,
  scenario: PixGridAuditScenario,
  controls: { bassReactivity: number; motion: number } = { bassReactivity: 1, motion: 1 },
): Uint8Array {
  const runtime = new PixGridReactionRuntime()
  const triggerFrame = frameForScenario(scenario, controls)
  composePixGridLogicalFrame(preset, state, triggerFrame, undefined, null, runtime)
  const settleFrame = {
    ...triggerFrame,
    audioTime: triggerFrame.audioTime + 0.06,
    deltaTimeSec: 0.06,
    sourceValues: Object.fromEntries(Object.entries(triggerFrame.sourceValues ?? {}).map(([source, value]) => [source, ['kick', 'snare', 'hat', 'beat', 'downbeat', 'transient', 'dropImpact', 'phraseEntry'].includes(source) ? 0 : value])),
    kickHit: false,
    snareHit: false,
    hatHit: false,
    beatHit: false,
    transientHit: false,
    dropImpactHit: false,
    phraseEntry: false,
  }
  return composePixGridLogicalFrame(preset, state, settleFrame, undefined, null, runtime).pixels.slice()
}

export function auditPixGridPresetRenderedReactivity(
  preset: ReactPreset,
  state: PixGridState,
): PixGridReactivityAuditReport {
  const rendered = new Map<PixGridAuditScenarioId, Uint8Array>()
  const pixelHashes = {} as Record<PixGridAuditScenarioId, string>
  for (const scenario of PIX_GRID_REACTIVITY_AUDIT_SCENARIOS) {
    const pixels = renderScenario(preset, state, scenario)
    rendered.set(scenario.id, pixels)
    pixelHashes[scenario.id] = hashPixels(pixels)
  }
  const silence = rendered.get('silence')!
  const kick = rendered.get('kick')!
  const snare = rendered.get('snare')!
  const bass0 = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'bassSustain')!, { bassReactivity: 0, motion: 1 })
  const bass05 = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'bassSustain')!, { bassReactivity: 0.5, motion: 1 })
  const bass1 = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'bassSustain')!, { bassReactivity: 1, motion: 1 })
  const motion0 = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS[0]!, { bassReactivity: 1, motion: 0 })
  const motion1 = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS[0]!, { bassReactivity: 1, motion: 1 })
  const deterministicA = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'secondDrop')!)
  const deterministicB = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'secondDrop')!)
  const validation = validatePixGridPreset(preset, state)
  const checks: PixGridReactivityAuditCheck[] = [
    { id: 'compiles-and-validates', passed: validation.valid, detail: validation.summary },
    { id: 'active-differs-from-silence', passed: [...rendered.entries()].some(([id, pixels]) => id !== 'silence' && differingBytes(silence, pixels) > 0), detail: 'At least one standardized music scenario must change rendered pixels.' },
    { id: 'kick-differs-from-snare', passed: differingBytes(kick, snare) > 0, detail: 'Kick and snare scenarios must not resolve to the same rendered frame.' },
    { id: 'bass-reactivity-control', passed: differingBytes(bass0, bass05) > 0 && differingBytes(bass05, bass1) > 0, detail: 'Bass Reactivity 0, 0.5, and 1 must materially change bass-driven output.' },
    { id: 'motion-control', passed: differingBytes(motion0, motion1) > 0, detail: 'Motion 0 and 1 must change autonomous animation output.' },
    { id: 'drop-differs-from-breakdown', passed: differingBytes(rendered.get('drop')!, rendered.get('breakdown')!) > 0, detail: 'Drop and breakdown must resolve distinct pixels.' },
    { id: 'first-drop-differs-from-second', passed: differingBytes(rendered.get('drop')!, rendered.get('secondDrop')!) > 0, detail: 'First and second drop must develop differently.' },
    { id: 'deterministic-repeat', passed: differingBytes(deterministicA, deterministicB) === 0, detail: 'Repeated evaluation at identical position and controls must match.' },
  ]
  return { presetId: preset.id, passed: validation.valid && checks.every(check => check.passed), validation, checks, pixelHashes }
}
