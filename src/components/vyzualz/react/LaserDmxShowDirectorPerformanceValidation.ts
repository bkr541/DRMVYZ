import type { SharedPerformanceProgramValidationIssue } from '../../../features/performanceCore'
import {
  LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY,
  normalizeLaserDmxShowDirectorPerformanceProgram,
  type LaserDmxShowDirectorPerformanceAddress,
  type LaserDmxShowDirectorPerformanceMutationPayload,
  type LaserDmxShowDirectorPerformanceProgram,
  type LaserDmxShowDirectorPerformanceScene,
} from './LaserDmxShowDirectorPerformanceProgram'

const FIXTURE_MODULATION_TARGETS = new Set([
  'brightness', 'rotation', 'beamAngle', 'fanSpread', 'beamSpread', 'focus', 'beamWidth', 'travelSpeed',
])
const GLOBAL_MODULATION_TARGETS = new Set([
  'blackout', 'dimmer', 'haze', 'backgroundFade', 'beamPersistence', 'globalBeamWidth', 'globalGlow', 'globalStrobeRate',
])

interface PayloadEntry {
  path: string
  payload: LaserDmxShowDirectorPerformanceMutationPayload & { id?: string; durationBeats?: number }
}

function issue(
  severity: SharedPerformanceProgramValidationIssue['severity'],
  code: string,
  message: string,
  programId: string,
  sceneId?: string,
  actionPath?: string,
): SharedPerformanceProgramValidationIssue {
  return { severity, code, message, programId, sceneId, actionPath }
}

function scenePayloads(scene: LaserDmxShowDirectorPerformanceScene): PayloadEntry[] {
  const entries: PayloadEntry[] = [{ path: 'scene', payload: scene }]
  const groups: Array<[string, readonly (LaserDmxShowDirectorPerformanceMutationPayload & { id?: string; durationBeats?: number })[] | undefined]> = [
    ['variations', scene.variations],
    ['beatMutations', scene.beatMutations],
    ['kickMutations', scene.kickMutations],
    ['snareMutations', scene.snareMutations],
    ['hatMutations', scene.hatMutations],
    ['transientMutations', scene.transientMutations],
    ['barMutations', scene.barMutations],
    ['barProgression', scene.barProgression],
    ['fourBarVariations', scene.fourBarVariations],
    ['eightBarRecruitment', scene.eightBarRecruitment],
    ['sixteenBarEvolution', scene.sixteenBarEvolution],
    ['sectionEntryMutations', scene.sectionEntryMutations],
    ['sectionBodyMutations', scene.sectionBodyMutations],
    ['sectionExitMutations', scene.sectionExitMutations],
  ]
  for (const [group, payloads] of groups) {
    payloads?.forEach((payload, index) => entries.push({ path: `${group}[${index}]`, payload }))
  }
  return entries
}

function validateAddress(
  address: LaserDmxShowDirectorPerformanceAddress | undefined,
  program: LaserDmxShowDirectorPerformanceProgram,
  sceneId: string,
  path: string,
): SharedPerformanceProgramValidationIssue[] {
  if (!address?.bankRoles?.length) return []
  return address.bankRoles
    .filter(role => !program.bankRoles?.[role])
    .map(role => issue('error', 'unknown-fixture-bank-role', `Address references unknown fixture bank role “${role}”.`, program.id, sceneId, path))
}

function validatePayload(
  entry: PayloadEntry,
  program: LaserDmxShowDirectorPerformanceProgram,
  sceneId: string,
): SharedPerformanceProgramValidationIssue[] {
  const { payload, path } = entry
  const issues = validateAddress(payload.address, program, sceneId, path)
  if (payload.durationBeats != null && (!Number.isFinite(payload.durationBeats) || payload.durationBeats < 0 || payload.durationBeats > 64)) {
    issues.push(issue('error', 'unbounded-envelope-duration', `${path}.durationBeats must be finite and between 0 and 64 beats.`, program.id, sceneId, path))
  }
  for (const [index, modulation] of (payload.modulations ?? []).entries()) {
    const modulationPath = `${path}.modulations[${index}]`
    const target = modulation.target.replace(/^fixture\./, '')
    const supported = modulation.target.startsWith('global.')
      ? GLOBAL_MODULATION_TARGETS.has(modulation.target.slice('global.'.length))
      : FIXTURE_MODULATION_TARGETS.has(target)
    if (!supported) issues.push(issue('error', 'unsupported-target', `Unsupported LaserDMX modulation target “${modulation.target}”.`, program.id, sceneId, modulationPath))
    if (!Number.isFinite(modulation.amount)) issues.push(issue('error', 'invalid-modulation-range', `${modulationPath}.amount must be finite.`, program.id, sceneId, modulationPath))
    if (modulation.min != null && modulation.max != null && modulation.min > modulation.max) issues.push(issue('error', 'invalid-modulation-range', `${modulationPath} minimum exceeds maximum.`, program.id, sceneId, modulationPath))
    if (modulation.minConfidence != null && (!Number.isFinite(modulation.minConfidence) || modulation.minConfidence < 0 || modulation.minConfidence > 1)) {
      issues.push(issue('error', 'invalid-confidence-requirement', `${modulationPath}.minConfidence must be between 0 and 1.`, program.id, sceneId, modulationPath))
    }
  }
  const fixtureActionIds = new Set<string>()
  for (const [index, action] of (payload.fixtureActions ?? []).entries()) {
    const actionPath = `${path}.fixtureActions[${index}]`
    if (fixtureActionIds.has(action.id)) issues.push(issue('warning', 'overlapping-incompatible-actions', `Duplicate fixture action ID “${action.id}” in one mutation payload.`, program.id, sceneId, actionPath))
    fixtureActionIds.add(action.id)
    if ('durationMs' in action && action.durationMs != null && (!Number.isFinite(action.durationMs) || action.durationMs < 0 || action.durationMs > 60_000)) {
      issues.push(issue('error', 'unbounded-envelope-duration', `${actionPath}.durationMs must be finite and no greater than 60000 ms.`, program.id, sceneId, actionPath))
    }
  }
  return issues
}

function validateScene(
  scene: LaserDmxShowDirectorPerformanceScene,
  program: LaserDmxShowDirectorPerformanceProgram,
): SharedPerformanceProgramValidationIssue[] {
  const issues: SharedPerformanceProgramValidationIssue[] = []
  if (!scene.section.types.length) issues.push(issue('error', 'missing-section-match', 'LaserDMX scene must match at least one section type.', program.id, scene.id))
  const startBar = scene.barMatch?.startBar
  const endBar = scene.barMatch?.endBar
  if (startBar != null && (!Number.isInteger(startBar) || startBar < 0)) issues.push(issue('error', 'invalid-bar-range', 'barMatch.startBar must be a non-negative integer.', program.id, scene.id))
  if (endBar != null && (!Number.isInteger(endBar) || endBar < 0)) issues.push(issue('error', 'invalid-bar-range', 'barMatch.endBar must be a non-negative integer.', program.id, scene.id))
  if (startBar != null && endBar != null && startBar > endBar) issues.push(issue('error', 'invalid-bar-range', 'barMatch start exceeds end.', program.id, scene.id))
  if (scene.section.minConfidence != null && (!Number.isFinite(scene.section.minConfidence) || scene.section.minConfidence < 0 || scene.section.minConfidence > 1)) {
    issues.push(issue('error', 'invalid-min-confidence', 'Section minimum confidence must be between 0 and 1.', program.id, scene.id))
  }
  for (const [label, transition] of [['transitionIn', scene.transitionIn], ['transitionOut', scene.transitionOut]] as const) {
    if (!transition) continue
    if (transition.durationBars != null && (!Number.isFinite(transition.durationBars) || transition.durationBars < 0 || transition.durationBars > 16)) {
      issues.push(issue('error', 'impossible-transition-reference', `${label}.durationBars must be finite and between 0 and 16.`, program.id, scene.id, label))
    }
    if (transition.durationMs != null && (!Number.isFinite(transition.durationMs) || transition.durationMs < 0 || transition.durationMs > 60_000)) {
      issues.push(issue('error', 'impossible-transition-reference', `${label}.durationMs must be finite and no greater than 60000 ms.`, program.id, scene.id, label))
    }
  }
  for (const [index, blackout] of (scene.blackoutWindows ?? []).entries()) {
    if (!Number.isFinite(blackout.durationBeats) || blackout.durationBeats < 0 || blackout.durationBeats > 16) {
      issues.push(issue('error', 'unbounded-blackout-duration', `blackoutWindows[${index}] must be finite and no greater than 16 beats.`, program.id, scene.id, `blackoutWindows[${index}]`))
    }
  }
  for (const entry of scenePayloads(scene)) issues.push(...validatePayload(entry, program, scene.id))
  return issues
}

export function validateLaserDmxShowDirectorPerformancePrograms(): SharedPerformanceProgramValidationIssue[] {
  const issues: SharedPerformanceProgramValidationIssue[] = []
  const ids = new Set<string>()
  for (const entry of Object.values(LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY)) {
    if (ids.has(entry.id)) issues.push(issue('error', 'duplicate-program-id', `Duplicate LaserDMX program ID “${entry.id}”.`, entry.id))
    ids.add(entry.id)
    if (entry.status === 'available' && !entry.program) {
      issues.push(issue('error', 'missing-program-definition', 'Available LaserDMX registry entry has no program definition.', entry.id))
      continue
    }
    if (!entry.program) continue
    const program = entry.program
    if (!normalizeLaserDmxShowDirectorPerformanceProgram(program)) issues.push(issue('error', 'invalid-program-definition', 'LaserDMX program cannot be normalized safely.', entry.id))
    if (program.id !== entry.id) issues.push(issue('error', 'registry-program-id-mismatch', `Registry ID “${entry.id}” does not match program ID “${program.id}”.`, entry.id))
    const sceneIds = new Set<string>()
    for (const scene of program.scenes) {
      if (sceneIds.has(scene.id)) issues.push(issue('error', 'duplicate-scene-id', `Duplicate LaserDMX scene ID “${scene.id}”.`, program.id, scene.id))
      sceneIds.add(scene.id)
      issues.push(...validateScene(scene, program))
    }
    for (const [role, address] of Object.entries(program.bankRoles ?? {})) {
      issues.push(...validateAddress(address, program, 'program-bank-roles', `bankRoles.${role}`))
    }
    for (const [key, bank] of Object.entries(program.fixtureBanks ?? {})) {
      issues.push(...validateAddress(bank.address, program, 'program-fixture-banks', `fixtureBanks.${key}`))
    }
    for (const fallbackType of program.fallbackOrder ?? []) {
      if (!program.scenes.some(scene => scene.section.types.includes(fallbackType))) {
        issues.push(issue('warning', 'unreachable-fallback-type', `Fallback section type “${fallbackType}” has no matching LaserDMX scene.`, program.id))
      }
    }
  }
  return issues
}
