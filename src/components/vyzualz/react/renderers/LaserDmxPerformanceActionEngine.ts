import type { LaserDmxSettings } from '../ReactTypes'
import {
  getReactPerformanceAction,
  type LaserDmxPerformanceActionId,
  type ReactPerformanceActionEvent,
} from '../ReactPerformanceActions'
import {
  DEFAULT_PRODUCTION_GROUP_MOVEMENT,
  type ProductionCompoundCue,
  type ProductionCueAction,
  type ProductionFixtureKind,
  type ProductionGroupMovementGenerator,
} from '../LaserDmxProductionRig'

export interface LaserDmxPerformanceActionDiagnostic {
  actionId: string
  severity: 'info' | 'warning'
  code: 'missingFixtureFamily' | 'missingGroup' | 'missingLook' | 'actionQueued'
  message: string
}

export interface LaserDmxPerformanceActionResult {
  settings: LaserDmxSettings
  diagnostics: LaserDmxPerformanceActionDiagnostic[]
}

const GROUP_BY_KIND: Partial<Record<ProductionFixtureKind, string>> = {
  laserProjector: 'group:lasers',
  strobe: 'group:strobes',
  blinder: 'group:blinders',
  fogger: 'group:fog',
  cryoJet: 'group:cryo',
}

function hasFixtureKind(settings: LaserDmxSettings, kind: ProductionFixtureKind): boolean {
  return settings.fixtures.some(fixture => fixture.enabled && fixture.fixtureKind === kind)
}

function resolveGroup(settings: LaserDmxSettings, preferredId: string, kind: ProductionFixtureKind): string | null {
  const groups = settings.productionGroups ?? []
  if (groups.some(group => group.id === preferredId && group.fixtureIds.length > 0)) return preferredId
  const fixtureIds = new Set(settings.fixtures.filter(fixture => fixture.enabled && fixture.fixtureKind === kind).map(fixture => fixture.id))
  return groups.find(group => group.fixtureIds.some(id => fixtureIds.has(id)))?.id ?? null
}

function actionFor(
  action: LaserDmxPerformanceActionId,
  groupId: string,
  sequence: number,
): ProductionCueAction {
  const base = { id: `performance:${action}:${sequence}`, execution: 'simultaneous' as const }
  switch (action) {
    case 'blackout': return { ...base, type: 'blackout' }
    case 'reveal': return { ...base, type: 'reveal' }
    case 'whiteHit': return { ...base, type: 'pulse', groupId, intensity: 1, durationMs: 320 }
    case 'blinderHit': return { ...base, type: 'blinderHit', groupId, intensity: 1, durationMs: 440 }
    case 'laserStarburst': return { ...base, type: 'runMovementEffect', groupId, durationMs: 760, movement: { ...DEFAULT_PRODUCTION_GROUP_MOVEMENT, enabled: true, generator: 'centerOutSpread', speed: 1, amplitude: 1, spreadDeg: 92, durationBeats: 2, quantize: 'beat', symmetry: 'centerMirror' } }
    case 'fanOpen': return { ...base, type: 'fanOpen', groupId, movement: { generator: 'fanOpen', speed: 0.76, amplitude: 0.9, quantize: 'beat' } }
    case 'fanClose': return { ...base, type: 'fanClose', groupId, movement: { generator: 'fanClose', speed: 0.58, amplitude: 0.74, quantize: 'beat' } }
    case 'movementVariation': {
      const generators: ProductionGroupMovementGenerator[] = ['crossfire', 'panWave', 'figureEight', 'alternatingBanks', 'ceilingCanopy']
      return { ...base, type: 'runMovementEffect', groupId, movement: { ...DEFAULT_PRODUCTION_GROUP_MOVEMENT, enabled: true, generator: generators[sequence % generators.length], speed: 0.68, amplitude: 0.82, quantize: 'phrase', durationBeats: 16 } }
    }
    case 'strobeBurst': return { ...base, type: 'strobeBurst', groupId, pattern: 'tripleHit', rateHz: 12, intensity: 1, durationMs: 380 }
    case 'fogBurst': return { ...base, type: 'fogBurst', groupId, intensity: 0.9, durationMs: 1600 }
    case 'cryoBurst': return { ...base, type: 'cryoBurst', groupId, intensity: 1, durationMs: 720 }
    case 'nextLook':
    case 'previousLook':
      return { ...base, type: 'reveal' }
  }
}

function requiredKinds(action: LaserDmxPerformanceActionId): ProductionFixtureKind[] {
  if (action === 'whiteHit') return ['blinder', 'strobe']
  if (action === 'blinderHit') return ['blinder']
  if (action === 'strobeBurst') return ['strobe']
  if (action === 'fogBurst') return ['fogger']
  if (action === 'cryoBurst') return ['cryoJet']
  if (action === 'laserStarburst' || action === 'fanOpen' || action === 'fanClose' || action === 'movementVariation') return ['laserProjector']
  return []
}

function cycleLook(settings: LaserDmxSettings, direction: 1 | -1): LaserDmxSettings | null {
  const looks = settings.productionLooks ?? []
  if (looks.length === 0) return null
  const currentIndex = Math.max(0, looks.findIndex(look => look.id === settings.activeProductionLookId))
  const nextIndex = (currentIndex + direction + looks.length) % looks.length
  return { ...settings, activeProductionLookId: looks[nextIndex].id }
}

export function applyLaserDmxPerformanceActions(
  settings: LaserDmxSettings,
  events: readonly ReactPerformanceActionEvent[],
): LaserDmxPerformanceActionResult {
  let next = settings
  const diagnostics: LaserDmxPerformanceActionDiagnostic[] = []

  for (const event of [...events].sort((a, b) => a.sequence - b.sequence)) {
    const definition = getReactPerformanceAction(event.actionId)
    const action = definition?.productionAction
    if (!action || event.target.engineId !== 'laserDmx') continue

    if (action === 'nextLook' || action === 'previousLook') {
      const cycled = cycleLook(next, action === 'nextLook' ? 1 : -1)
      if (!cycled) diagnostics.push({ actionId: event.actionId, severity: 'warning', code: 'missingLook', message: 'No authored production looks are available to cycle.' })
      else next = cycled
      continue
    }

    const compatibleKinds = requiredKinds(action)
    const kind = compatibleKinds.find(candidate => hasFixtureKind(next, candidate)) ?? null
    if (compatibleKinds.length > 0 && !kind) {
      diagnostics.push({ actionId: event.actionId, severity: 'warning', code: 'missingFixtureFamily', message: `${definition.label} could not execute because the rig has no enabled ${compatibleKinds.join(' or ')} fixtures.` })
      continue
    }

    const preferredGroupId = action === 'whiteHit' ? 'group:impacts' : kind ? GROUP_BY_KIND[kind] : 'group:impacts'
    const groupId = kind && preferredGroupId ? resolveGroup(next, preferredGroupId, kind) : preferredGroupId
    if (!groupId && kind) {
      diagnostics.push({ actionId: event.actionId, severity: 'warning', code: 'missingGroup', message: `${definition.label} found compatible fixtures but no production group targeting them.` })
      continue
    }

    const cueId = `performance:${event.actionId}:${event.sequence}`
    const cue: ProductionCompoundCue = {
      schemaVersion: 1,
      id: cueId,
      label: definition.label,
      description: definition.description,
      enabled: true,
      timing: { mode: 'manual' },
      quantize: 'beat',
      priority: 100,
      retriggerPolicy: 'restart',
      cancellationBehavior: 'complete',
      fixtureGroupIds: groupId ? [groupId] : [],
      manualOnly: true,
      actions: [actionFor(action, groupId ?? 'group:impacts', event.sequence)],
      source: 'preset',
    }
    next = {
      ...next,
      productionCues: [...(next.productionCues ?? []).filter(existing => !existing.id.startsWith('performance:')), cue],
      runtime: {
        ...(next.runtime ?? {}),
        showDirectorManualRequest: { cueId, sequence: event.sequence },
      },
    }
    diagnostics.push({ actionId: event.actionId, severity: 'info', code: 'actionQueued', message: `${definition.label} was queued through the generalized Show Director action path.` })
  }

  if (diagnostics.length > 0) {
    next = { ...next, runtime: { ...(next.runtime ?? {}), productionActionDiagnostics: diagnostics } }
  }
  return { settings: next, diagnostics }
}
