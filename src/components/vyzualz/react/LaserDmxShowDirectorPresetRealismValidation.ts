import type { ReactSectionType } from './ReactTypes'
import {
  LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY,
  normalizeLaserDmxShowDirectorPerformanceProgram,
  type LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  type LaserDmxShowDirectorPerformanceProgram,
  type LaserDmxShowDirectorPerformanceScene,
} from './LaserDmxShowDirectorPerformanceProgram'
import {
  validateLaserShowProgrammingDocument,
  type LaserCueOwnedParameter,
  type LaserEffectMacro,
  type LaserPerformanceCue,
  type LaserShowProgrammingDocument,
} from './LaserDmxShowDirectorProgramming'

export type LaserDmxPresetRealismSeverity = 'warning' | 'error'

export type LaserDmxPresetRealismCode =
  | 'programming-missing'
  | 'continuous-rotation-without-maximum'
  | 'target-orbit-without-maximum'
  | 'render-time-pattern-phase'
  | 'continuous-on-limit-exceeded'
  | 'missing-section-blackout'
  | 'simultaneous-laser-limit-too-high'
  | 'simultaneous-animation-limit-too-high'
  | 'simultaneous-laser-activity-exceeded'
  | 'simultaneous-animation-activity-exceeded'
  | 'excessive-full-rig-fraction'
  | 'parameter-ownership-conflict'
  | 'linked-pattern-fixture-motion'
  | 'blanked-fixture-render-output'
  | 'excessive-rotation-speed'
  | 'excessive-scanner-speed'
  | 'permanent-full-brightness'
  | 'missing-fixture-group-alternation'
  | 'missing-section-development'
  | 'renderer-dependent-choreography'
  | 'stable-hold-missing'
  | 'end-state-not-blackout'
  | 'structural-programming-error'

export interface LaserDmxPresetRealismIssue {
  severity: LaserDmxPresetRealismSeverity
  code: LaserDmxPresetRealismCode
  message: string
  programId: string
  sourceId?: string
  sectionKey?: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey
}

export interface LaserDmxBuiltInPresetAuditResult {
  programId: string
  programName: string
  compiled: boolean
  migrated: boolean
  cueCount: number
  macroCount: number
  sectionKeys: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey[]
  issues: LaserDmxPresetRealismIssue[]
}

export interface LaserDmxBuiltInPresetAuditReport {
  auditedPresetCount: number
  passedPresetCount: number
  failedPresetCount: number
  results: LaserDmxBuiltInPresetAuditResult[]
}

const MAX_REALISTIC_SCANNER_RATE_PPS = 35_000
const MAX_REALISTIC_ROTATION_DEG_PER_BEAT = 360
const MAX_DEFAULT_ACTIVE_LASERS = 8
const MAX_DEFAULT_ANIMATED_PATTERNS = 2
const MAX_FULL_RIG_SECTION_FRACTION = 0.125
const MAJOR_SECTION_KEYS = new Set<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey>([
  'intro', 'verse', 'build', 'preDrop', 'drop1', 'breakdown', 'drop2', 'outro',
])

function issue(
  severity: LaserDmxPresetRealismSeverity,
  code: LaserDmxPresetRealismCode,
  message: string,
  programId: string,
  sourceId?: string,
  sectionKey?: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
): LaserDmxPresetRealismIssue {
  return { severity, code, message, programId, sourceId, sectionKey }
}

function sectionKey(scene: LaserDmxShowDirectorPerformanceScene): LaserDmxShowDirectorPerformanceEnergyEnvelopeKey {
  if (scene.energyEnvelopeKey) return scene.energyEnvelopeKey
  const type = scene.section.types[0]
  if (type === 'intro' || type === 'verse' || type === 'build' || type === 'preDrop' || type === 'breakdown' || type === 'outro') return type
  if (type === 'drop') {
    const occurrence = scene.section.dropOccurrence ?? scene.section.occurrence
    return occurrence?.occurrences?.includes(2) || (occurrence?.minOccurrence ?? 0) >= 2 ? 'drop2' : 'drop1'
  }
  return type === 'bridge' ? 'breakdown' : 'verse'
}

function cueSectionKey(cue: LaserPerformanceCue, scenes: Map<string, LaserDmxShowDirectorPerformanceScene>): LaserDmxShowDirectorPerformanceEnergyEnvelopeKey | null {
  for (const sceneId of cue.sceneIds ?? []) {
    const scene = scenes.get(sceneId)
    if (scene) return sectionKey(scene)
  }
  const type = cue.sectionTypes?.[0]
  if (type === 'intro' || type === 'verse' || type === 'build' || type === 'preDrop' || type === 'breakdown' || type === 'outro') return type
  return type === 'drop' ? 'drop1' : type === 'bridge' ? 'breakdown' : null
}

function cueRunBeats(cue: LaserPerformanceCue): number {
  const lifecycle = cue.lifecycle
  if (!lifecycle) return Number.POSITIVE_INFINITY
  return Math.min(
    lifecycle.maximumRunBeats,
    lifecycle.attackBeats + lifecycle.movementBeats + lifecycle.holdBeats + lifecycle.releaseBeats,
  )
}

function cueHasBlackout(cue: LaserPerformanceCue): boolean {
  return Boolean(
    cue.blackout
    || cue.shutterClosed
    || cue.command?.kind === 'blackout'
    || cue.lifecycle?.blackoutAfterCompletion
    || (cue.lifecycle?.blackoutBeats ?? 0) > 0,
  )
}

function cueIsAnimated(cue: LaserPerformanceCue, macro: LaserEffectMacro | undefined): boolean {
  const command = cue.command ?? macro?.defaultCommand
  if (command && command.kind !== 'staticHold' && command.kind !== 'blackout' && command.kind !== 'accentFlash') return true
  return [...(macro?.automation ?? []), ...cue.automation].some(lane => lane.curve !== 'hold' && lane.from !== lane.to)
}

function activeWindow(cue: LaserPerformanceCue): { start: number; end: number } {
  const start = cue.startOffsetBeats
  const duration = Number.isFinite(cueRunBeats(cue)) ? cueRunBeats(cue) : 64
  return { start, end: start + Math.max(0, duration) }
}

function overlaps(left: LaserPerformanceCue, right: LaserPerformanceCue): boolean {
  const a = activeWindow(left)
  const b = activeWindow(right)
  return a.start < b.end - 1e-7 && b.start < a.end - 1e-7
}

function ownershipIntersection(left: LaserPerformanceCue, right: LaserPerformanceCue): LaserCueOwnedParameter[] {
  const a = new Set(left.ownership?.parameters ?? [])
  return (right.ownership?.parameters ?? []).filter(parameter => a.has(parameter))
}

function targetSignature(cue: LaserPerformanceCue): string {
  return [...(cue.fixtureGroupAssignmentIds ?? [])].sort().join('|')
}

function macroSignature(macro: LaserEffectMacro | undefined): string {
  if (!macro) return 'missing'
  return `${macro.family}:${macro.pattern.scannerPatternType}:${macro.pattern.raySlotCount}:${macro.optics.mode}`
}

function isFullRigCue(cue: LaserPerformanceCue): boolean {
  return (cue.fixtureGroupAssignmentIds ?? []).some(id => /laser-all$/.test(id))
}

function hasRendererReference(value: unknown): boolean {
  return /(?:webgl|canvas2d|renderer[-_ ]local|requestanimationframe|performance\.now|render[-_ ]time)/i.test(JSON.stringify(value))
}

function assignmentTargetsLaser(assignment: LaserEffectMacro['fixtureGroupAssignments'][number]): boolean {
  const address = assignment.address
  return address.fixtureKinds?.includes('laser') === true
    || [...(address.fixtureSemanticKeys ?? []), ...(address.groupSemanticKeys ?? []), ...(address.bankRoles ?? [])]
      .some(key => /laser|scanner/i.test(key))
    || /laser|scanner/i.test(assignment.id)
}

function estimatedLaserTargetCount(assignment: LaserEffectMacro['fixtureGroupAssignments'][number]): number {
  if (!assignmentTargetsLaser(assignment)) return 0
  if (assignment.address.fixtureIds?.length) return new Set(assignment.address.fixtureIds).size
  if (assignment.address.fixtureSemanticKeys?.length) return new Set(assignment.address.fixtureSemanticKeys).size
  return 1
}

function activeAtBeat(cue: LaserPerformanceCue, beat: number): boolean {
  const window = activeWindow(cue)
  return beat >= window.start - 1e-7 && beat < window.end - 1e-7
}

export function validateLaserDmxShowDirectorPresetRealism(
  program: LaserDmxShowDirectorPerformanceProgram,
): LaserDmxPresetRealismIssue[] {
  const document = program.laserProgramming
  if (!document) return [issue('error', 'programming-missing', 'Preset has no finite Show Director programming document.', program.id)]

  const issues: LaserDmxPresetRealismIssue[] = []
  const structural = validateLaserShowProgrammingDocument(document)
  for (const item of structural.filter(candidate => candidate.severity === 'error')) {
    issues.push(issue('error', 'structural-programming-error', item.message, program.id, item.sourceId))
  }

  if (document.constraints.maximumSimultaneouslyActiveLaserFixtures > MAX_DEFAULT_ACTIVE_LASERS) {
    issues.push(issue('warning', 'simultaneous-laser-limit-too-high', `Preset permits ${document.constraints.maximumSimultaneouslyActiveLaserFixtures} simultaneous lasers; built-ins should cap the active rig at ${MAX_DEFAULT_ACTIVE_LASERS}.`, program.id, document.id))
  }
  if (document.constraints.maximumSimultaneouslyAnimatedPatterns > MAX_DEFAULT_ANIMATED_PATTERNS) {
    issues.push(issue('warning', 'simultaneous-animation-limit-too-high', `Preset permits ${document.constraints.maximumSimultaneouslyAnimatedPatterns} simultaneous animated patterns; built-ins should cap this at ${MAX_DEFAULT_ANIMATED_PATTERNS}.`, program.id, document.id))
  }

  const macroById = new Map(document.macros.map(macro => [macro.id, macro]))
  const programHasLaserFixtures = program.scenes.some(scene => scene.address?.fixtureKinds?.includes('laser'))
    || Object.values(program.bankRoles ?? {}).some(address => address.fixtureKinds?.includes('laser'))
    || (program.diagnostics?.expectedFixtureSemanticKeys ?? []).some(key => /laser|scanner/i.test(key))
  const scenes = new Map(program.scenes.map(scene => [scene.id, scene]))
  const cues = document.cueStacks.flatMap(stack => stack.cues)
  const cuesBySection = new Map<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, LaserPerformanceCue[]>()

  for (const macro of document.macros) {
    if (macro.scan.scanRatePps > MAX_REALISTIC_SCANNER_RATE_PPS) {
      issues.push(issue('warning', 'excessive-scanner-speed', `${macro.name} requests ${Math.round(macro.scan.scanRatePps)} points per second, above the built-in realism ceiling of ${MAX_REALISTIC_SCANNER_RATE_PPS}.`, program.id, macro.id))
    }
    if (macro.envelope.intensityFloor >= 0.95 || (macro.envelope.intensityCeiling >= 0.98 && macro.duration.kind === 'section')) {
      issues.push(issue('warning', 'permanent-full-brightness', `${macro.name} is authored as effectively permanent full-brightness output.`, program.id, macro.id))
    }
    if (macro.automation.some(lane => lane.parameter === 'phase' && lane.curve !== 'hold') && hasRendererReference(macro)) {
      issues.push(issue('error', 'render-time-pattern-phase', `${macro.name} drives pattern phase from renderer time instead of finite cue progress.`, program.id, macro.id))
    }
  }

  for (const cue of cues) {
    const macro = macroById.get(cue.macroId)
    const key = cueSectionKey(cue, scenes)
    if (key) {
      const list = cuesBySection.get(key) ?? []
      list.push(cue)
      cuesBySection.set(key, list)
    }
    const lifecycle = cue.lifecycle
    const command = cue.command ?? macro?.defaultCommand
    const movingRotation = command?.kind === 'circleRotation' || command?.kind === 'tunnelRotation' || Boolean(command?.rotation)
    if (movingRotation && (!lifecycle || !Number.isFinite(lifecycle.maximumRunBeats) || lifecycle.maximumRunBeats <= 0)) {
      issues.push(issue('error', 'continuous-rotation-without-maximum', `${cue.name} rotates without a finite maximum run duration.`, program.id, cue.id, key ?? undefined))
    }
    if (command?.rotation) {
      const turns = Math.abs(command.rotation.turnCount ?? ((command.rotation.endAngleDeg ?? command.rotation.startAngleDeg) - command.rotation.startAngleDeg) / 360)
      const speed = turns * 360 / Math.max(0.001, command.rotation.durationBeats)
      if (speed > MAX_REALISTIC_ROTATION_DEG_PER_BEAT) {
        issues.push(issue('warning', 'excessive-rotation-speed', `${cue.name} rotates at ${Math.round(speed)}° per beat, above the built-in realism ceiling.`, program.id, cue.id, key ?? undefined))
      }
      if (command.loopMode !== 'none' && (!command.maximumLoopBeats || !command.repeatCount)) {
        issues.push(issue('error', 'continuous-rotation-without-maximum', `${cue.name} uses rotating loop behavior without both repeat count and maximum loop duration.`, program.id, cue.id, key ?? undefined))
      }
    }
    const runBeats = cueRunBeats(cue)
    if (!cue.blackout && runBeats > document.constraints.maximumContinuousOnBeats + 1e-7) {
      issues.push(issue('warning', 'continuous-on-limit-exceeded', `${cue.name} remains active for ${runBeats.toFixed(2)} beats, above the preset continuous-on limit.`, program.id, cue.id, key ?? undefined))
    }
    const orbitLanes = [...(macro?.automation ?? []), ...cue.automation].filter(lane => (lane.parameter === 'centerX' || lane.parameter === 'centerY') && (lane.curve === 'sine' || lane.curve === 'triangle'))
    if (orbitLanes.length >= 2 && (!lifecycle || !Number.isFinite(lifecycle.maximumRunBeats))) {
      issues.push(issue('error', 'target-orbit-without-maximum', `${cue.name} contains target orbit automation without a finite maximum duration.`, program.id, cue.id, key ?? undefined))
    }
    if (cue.shutterClosed && !cue.blackout && command?.kind !== 'blackout') {
      issues.push(issue('error', 'blanked-fixture-render-output', `${cue.name} closes the shutter while retaining a render-producing command.`, program.id, cue.id, key ?? undefined))
    }
    if (command?.rotation?.target === 'fixturePan' || command?.rotation?.target === 'fixtureTilt') {
      const ownsPatternMotion = cue.ownership?.parameters.some(parameter => parameter === 'patternPhase' || parameter === 'patternScale' || parameter === 'patternPosition')
      if (ownsPatternMotion) issues.push(issue('warning', 'linked-pattern-fixture-motion', `${cue.name} links fixture movement and scanner-frame movement in one rotation command.`, program.id, cue.id, key ?? undefined))
    }
    if (hasRendererReference(cue)) {
      issues.push(issue('error', 'renderer-dependent-choreography', `${cue.name} contains renderer-local choreography data.`, program.id, cue.id, key ?? undefined))
    }
  }

  for (const [key, sectionCues] of cuesBySection) {
    if (!MAJOR_SECTION_KEYS.has(key)) continue
    if (!sectionCues.some(cueHasBlackout)) {
      issues.push(issue('warning', 'missing-section-blackout', `${key} contains no authored blackout or shutter-off interval.`, program.id, undefined, key))
    }
    const sceneIds = Array.from(new Set(sectionCues.flatMap(cue => cue.sceneIds ?? [])))
    const fullRigFractions = programHasLaserFixtures ? sceneIds.map(sceneId => {
      const sceneCues = sectionCues.filter(cue => cue.sceneIds?.includes(sceneId))
      const fullRigActiveBeats = sceneCues.filter(isFullRigCue).reduce((total, cue) => total + Math.min(4, cueRunBeats(cue)), 0)
      const sectionCycleBeats = Math.max(16, ...sceneCues.map(cue => cue.repeatEveryBeats ?? 64))
      return fullRigActiveBeats / sectionCycleBeats
    }) : []
    const fullRigFraction = Math.max(0, ...fullRigFractions)
    if (fullRigFraction > MAX_FULL_RIG_SECTION_FRACTION + 1e-7) {
      issues.push(issue('warning', 'excessive-full-rig-fraction', `${key} uses the full laser rig for ${(fullRigFraction * 100).toFixed(1)}% of its authored cycle.`, program.id, undefined, key))
    }
  }

  for (const [key, sectionCues] of cuesBySection) {
    const sampleBeats = new Set<number>()
    let laserActivityReported = false
    let animationActivityReported = false
    for (const cue of sectionCues) {
      const window = activeWindow(cue)
      sampleBeats.add(window.start)
      sampleBeats.add(Math.max(window.start, window.end - 1e-5))
    }
    for (const beat of sampleBeats) {
      const active = sectionCues.filter(cue => !cue.blackout && !cue.shutterClosed && activeAtBeat(cue, beat))
      const targetedAssignments = new Map<string, LaserEffectMacro['fixtureGroupAssignments'][number]>()
      for (const cue of active) {
        const macro = macroById.get(cue.macroId)
        if (!macro) continue
        const selected = new Set(cue.fixtureGroupAssignmentIds ?? macro.fixtureGroupAssignments.map(assignment => assignment.id))
        for (const assignment of macro.fixtureGroupAssignments) {
          if (selected.has(assignment.id) && assignmentTargetsLaser(assignment)) targetedAssignments.set(assignment.id, assignment)
        }
      }
      const estimatedLaserFixtures = Array.from(targetedAssignments.values()).reduce(
        (total, assignment) => total + estimatedLaserTargetCount(assignment),
        0,
      )
      if (!laserActivityReported && estimatedLaserFixtures > document.constraints.maximumSimultaneouslyActiveLaserFixtures) {
        issues.push(issue('warning', 'simultaneous-laser-activity-exceeded', `${key} targets at least ${estimatedLaserFixtures} laser fixtures or groups at beat ${beat.toFixed(2)}, above the configured limit of ${document.constraints.maximumSimultaneouslyActiveLaserFixtures}.`, program.id, undefined, key))
        laserActivityReported = true
      }
      const animatedPatternCount = active.filter(cue => cueIsAnimated(cue, macroById.get(cue.macroId))).length
      if (!animationActivityReported && animatedPatternCount > document.constraints.maximumSimultaneouslyAnimatedPatterns) {
        issues.push(issue('warning', 'simultaneous-animation-activity-exceeded', `${key} runs ${animatedPatternCount} animated patterns at beat ${beat.toFixed(2)}, above the configured limit of ${document.constraints.maximumSimultaneouslyAnimatedPatterns}.`, program.id, undefined, key))
        animationActivityReported = true
      }
      if (laserActivityReported && animationActivityReported) break
    }
  }

  for (const [key, sectionCues] of cuesBySection) {
    const sorted = [...sectionCues].sort((a, b) => a.startOffsetBeats - b.startOffsetBeats || b.priority - a.priority)
    for (let index = 0; index < sorted.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < sorted.length; otherIndex += 1) {
        const left = sorted[index]
        const right = sorted[otherIndex]
        if (!overlaps(left, right)) continue
        if (left.blackout || right.blackout || left.ownership?.blackoutOverride || right.ownership?.blackoutOverride) continue
        const conflicting = ownershipIntersection(left, right)
        if (conflicting.length) {
          issues.push(issue('error', 'parameter-ownership-conflict', `${left.name} and ${right.name} overlap while owning ${conflicting.join(', ')}.`, program.id, `${left.id}|${right.id}`, key))
        }
      }
    }
  }

  const nonBlackoutCues = cues.filter(cue => !cue.blackout && !cue.shutterClosed)
  if (!nonBlackoutCues.some(cue => {
    const macro = macroById.get(cue.macroId)
    return (cue.command?.kind ?? macro?.defaultCommand?.kind) === 'staticHold' && (cue.lifecycle?.holdBeats ?? 0) >= 0.5
  })) {
    issues.push(issue('warning', 'stable-hold-missing', 'Preset contains no stable pattern held for at least half a beat.', program.id, document.id))
  }

  const assignmentSignatures = new Set(nonBlackoutCues.map(targetSignature).filter(Boolean))
  if (assignmentSignatures.size < 2) {
    issues.push(issue('warning', 'missing-fixture-group-alternation', 'Preset does not alternate or recruit distinct fixture groups.', program.id, document.id))
  }

  const sectionSignatures = new Map<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, string>()
  for (const [key, sectionCues] of cuesBySection) {
    sectionSignatures.set(key, Array.from(new Set(sectionCues.map(cue => macroSignature(macroById.get(cue.macroId))))).sort().join('|'))
  }
  if (sectionSignatures.size >= 2 && new Set(sectionSignatures.values()).size < 2) {
    issues.push(issue('warning', 'missing-section-development', 'Preset repeats the same macro vocabulary across all supported sections.', program.id, document.id))
  }
  if (sectionSignatures.has('drop1') && sectionSignatures.get('drop1') === sectionSignatures.get('drop2')) {
    issues.push(issue('warning', 'missing-section-development', 'Second drop duplicates the first-drop vocabulary instead of developing it.', program.id, document.id, 'drop2'))
  }

  const outroCues = cuesBySection.get('outro') ?? []
  if (outroCues.length) {
    const latest = [...outroCues].sort((a, b) => b.startOffsetBeats - a.startOffsetBeats || b.priority - a.priority)[0]
    if (!latest || !cueHasBlackout(latest) || (!latest.shutterClosed && latest.command?.shutdown !== 'blackout')) {
      issues.push(issue('error', 'end-state-not-blackout', 'Outro does not terminate in an explicit shutter-closed blackout.', program.id, latest?.id, 'outro'))
    }
  }

  return issues
}

export function auditLaserDmxShowDirectorBuiltInPresets(): LaserDmxBuiltInPresetAuditReport {
  const results = Object.values(LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY).map(entry => {
    const normalized = entry.program ? normalizeLaserDmxShowDirectorPerformanceProgram(entry.program) : null
    const program = normalized ?? entry.program
    const issues = program
      ? validateLaserDmxShowDirectorPresetRealism(program)
      : [issue('error', 'programming-missing', 'Registry entry has no loadable performance program.', entry.id)]
    const document = program?.laserProgramming
    const structuralIssues = document ? validateLaserShowProgrammingDocument(document) : []
    return {
      programId: entry.id,
      programName: program?.name ?? entry.name,
      compiled: Boolean(document && structuralIssues.every(item => item.severity !== 'error')),
      migrated: Boolean(normalized),
      cueCount: document?.cueStacks.reduce((total, stack) => total + stack.cues.length, 0) ?? 0,
      macroCount: document?.macros.length ?? 0,
      sectionKeys: program ? Array.from(new Set(program.scenes.map(sectionKey))) : [],
      issues,
    } satisfies LaserDmxBuiltInPresetAuditResult
  })
  const passedPresetCount = results.filter(result => result.compiled && result.issues.length === 0).length
  return {
    auditedPresetCount: results.length,
    passedPresetCount,
    failedPresetCount: results.length - passedPresetCount,
    results,
  }
}

export function createLaserDmxRendererParityFingerprint(document: LaserShowProgrammingDocument): string {
  return JSON.stringify({
    activeCueStackId: document.activeCueStackId,
    macros: document.macros.map(macro => ({
      id: macro.id,
      family: macro.family,
      pattern: macro.pattern,
      transform: macro.transform,
      scan: macro.scan,
      optics: macro.optics,
      automation: macro.automation,
    })),
    cues: document.cueStacks.flatMap(stack => stack.cues).map(cue => ({
      id: cue.id,
      macroId: cue.macroId,
      sceneIds: cue.sceneIds,
      startOffsetBeats: cue.startOffsetBeats,
      repeatEveryBeats: cue.repeatEveryBeats,
      lifecycle: cue.lifecycle,
      command: cue.command,
      ownership: cue.ownership,
      blackout: cue.blackout,
      shutterClosed: cue.shutterClosed,
      fixtureGroupAssignmentIds: cue.fixtureGroupAssignmentIds,
    })),
  })
}

export function sectionTypeLabel(types: readonly ReactSectionType[]): string {
  return types.join(', ') || 'unscoped'
}
