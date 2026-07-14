import type {
  ReactTrackSection,
  ReactTrackSectionAuthority,
  ReactTrackSectionProvenance,
} from '../../components/vyzualz/react/ReactTypes'

const EPSILON = 1e-6

const AUTHORITY_PRIORITY: Record<ReactTrackSectionAuthority, number> = {
  locked_user: 600,
  user_created: 500,
  manual_replacement: 400,
  imported: 300,
  automatic: 200,
  fallback: 100,
}

export interface AuthoritativeTimelineInput {
  analyzedSections?: readonly ReactTrackSection[]
  manualSections?: readonly ReactTrackSection[]
  importedSections?: readonly ReactTrackSection[]
  suppressedIds?: readonly string[]
  durationSec: number
}

interface Candidate {
  section: ReactTrackSection
  authority: ReactTrackSectionAuthority
  originalStart: number
  originalEnd: number
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function authorityFor(section: ReactTrackSection): ReactTrackSectionAuthority {
  if (section.provenance?.authority) return section.provenance.authority
  if (section.source === 'fallback') return 'fallback'
  if (section.source === 'imported') return 'imported'
  if (section.locked) return 'locked_user'
  if (section.source === 'user-created' || section.source === 'manual') return 'user_created'
  if (section.source === 'user-edited-auto') return 'manual_replacement'
  return 'automatic'
}

function sourceForAuthority(authority: ReactTrackSectionAuthority): ReactTrackSection['source'] {
  switch (authority) {
    case 'locked_user': return 'manual'
    case 'user_created': return 'user-created'
    case 'manual_replacement': return 'user-edited-auto'
    case 'imported': return 'imported'
    case 'fallback': return 'fallback'
    default: return 'auto'
  }
}

function candidateFrom(section: ReactTrackSection, durationSec: number): Candidate | null {
  const originalStart = finite(section.startSec)
  const originalEnd = finite(section.endSec)
  const startSec = clamp(originalStart, 0, durationSec)
  const endSec = clamp(originalEnd, 0, durationSec)
  if (endSec - startSec <= EPSILON) return null
  const authority = authorityFor(section)
  const provenance: ReactTrackSectionProvenance = {
    authority,
    originalId: section.provenance?.originalId ?? section.id,
    analysisSource: section.provenance?.analysisSource,
  }
  return {
    authority,
    originalStart: startSec,
    originalEnd: endSec,
    section: {
      ...section,
      id: String(section.id),
      startSec,
      endSec,
      intensity: clamp(finite(section.intensity, 0.5), 0, 1),
      source: section.source ?? sourceForAuthority(authority),
      provenance,
    },
  }
}

function compareCandidates(a: Candidate, b: Candidate): number {
  const priority = AUTHORITY_PRIORITY[b.authority] - AUTHORITY_PRIORITY[a.authority]
  if (priority !== 0) return priority
  if (a.originalStart !== b.originalStart) return a.originalStart - b.originalStart
  if (a.originalEnd !== b.originalEnd) return b.originalEnd - a.originalEnd
  const confidenceA = a.section.analysisConfidence ?? a.section.confidence ?? 0
  const confidenceB = b.section.analysisConfidence ?? b.section.confidence ?? 0
  if (confidenceA !== confidenceB) return confidenceB - confidenceA
  return a.section.id.localeCompare(b.section.id)
}

function stableBoundary(value: number): string {
  return String(Math.round(value * 1000))
}

function fragmentId(candidate: Candidate, startSec: number, endSec: number): string {
  if (Math.abs(startSec - candidate.originalStart) <= EPSILON && Math.abs(endSec - candidate.originalEnd) <= EPSILON) {
    return candidate.section.id
  }
  const originalId = candidate.section.provenance?.originalId ?? candidate.section.id
  return `${originalId}~${stableBoundary(startSec)}-${stableBoundary(endSec)}`
}

function fallbackSection(startSec: number, endSec: number): ReactTrackSection {
  const id = `timeline-fallback~${stableBoundary(startSec)}-${stableBoundary(endSec)}`
  return {
    id,
    label: 'Unclassified',
    type: 'unknown',
    startSec,
    endSec,
    intensity: 0.5,
    source: 'fallback',
    confidence: 0,
    boundaryConfidence: 0,
    labelConfidence: 0,
    gridConfidence: 0,
    analysisConfidence: 0,
    provenance: { authority: 'fallback', originalId: id, analysisSource: 'inferred' },
  }
}

/**
 * Resolve all section sources into one deterministic, gap-free authority timeline.
 * This function is pure and does not depend on React or the live audio engine.
 */
export function resolveAuthoritativeTimeline(input: AuthoritativeTimelineInput): ReactTrackSection[] {
  const sourceSections = [
    ...(input.analyzedSections ?? []),
    ...(input.importedSections ?? []),
    ...(input.manualSections ?? []),
  ]
  const inferredDuration = sourceSections.reduce((max, section) => Math.max(max, finite(section.endSec)), 0)
  const requestedDuration = finite(input.durationSec, inferredDuration)
  const durationSec = requestedDuration > 0 ? requestedDuration : inferredDuration
  if (durationSec <= EPSILON) return []

  const suppressed = new Set(input.suppressedIds ?? [])
  const replacementIds = new Set(
    (input.manualSections ?? [])
      .filter(section => authorityFor(section) === 'manual_replacement' || section.source === 'user-edited-auto')
      .map(section => section.provenance?.originalId ?? section.id),
  )

  const candidates = sourceSections
    .filter(section => {
      const authority = authorityFor(section)
      const originalId = section.provenance?.originalId ?? section.id
      if ((authority === 'automatic' || authority === 'manual_replacement') && suppressed.has(originalId)) return false
      if (authority === 'automatic' && replacementIds.has(originalId)) return false
      return true
    })
    .map(section => candidateFrom(section, durationSec))
    .filter((candidate): candidate is Candidate => candidate !== null)

  const boundaries = Array.from(new Set([
    0,
    durationSec,
    ...candidates.flatMap(candidate => [candidate.section.startSec, candidate.section.endSec]),
  ])).sort((a, b) => a - b)

  const atoms: Array<{ candidate: Candidate | null; startSec: number; endSec: number }> = []
  for (let index = 0; index < boundaries.length - 1; index++) {
    const startSec = boundaries[index]
    const endSec = boundaries[index + 1]
    if (endSec <= startSec) continue
    const winner = candidates
      .filter(candidate => candidate.section.startSec <= startSec + EPSILON && candidate.section.endSec >= endSec - EPSILON)
      .sort(compareCandidates)[0] ?? null
    atoms.push({ candidate: winner, startSec, endSec })
  }

  const runs: typeof atoms = []
  for (const atom of atoms) {
    const previous = runs[runs.length - 1]
    const sameWinner = previous
      && previous.candidate?.section.id === atom.candidate?.section.id
      && previous.candidate?.authority === atom.candidate?.authority
      && Math.abs(previous.endSec - atom.startSec) <= EPSILON
    if (sameWinner) previous.endSec = atom.endSec
    else runs.push({ ...atom })
  }

  const splitCounts = new Map<string, number>()
  const usedIds = new Set<string>()
  return runs.map(run => {
    if (!run.candidate) {
      const fallback = fallbackSection(run.startSec, run.endSec)
      usedIds.add(fallback.id)
      return fallback
    }
    const candidate = run.candidate
    const originalId = candidate.section.provenance?.originalId ?? candidate.section.id
    const splitIndex = splitCounts.get(originalId) ?? 0
    splitCounts.set(originalId, splitIndex + 1)
    const preferredId = fragmentId(candidate, run.startSec, run.endSec)
    const id = usedIds.has(preferredId)
      ? `${preferredId}~${candidate.authority}-${splitIndex}`
      : preferredId
    usedIds.add(id)
    return {
      ...candidate.section,
      id,
      startSec: run.startSec,
      endSec: run.endSec,
      locked: candidate.authority === 'locked_user' ? true : candidate.section.locked,
      provenance: {
        ...candidate.section.provenance!,
        splitIndex,
      },
    }
  })
}

export function resolveSectionAtTime(
  sections: readonly ReactTrackSection[],
  timeSec: number,
): ReactTrackSection | null {
  if (sections.length === 0 || !Number.isFinite(timeSec)) return null
  let lo = 0
  let hi = sections.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const section = sections[mid]
    const isFinal = mid === sections.length - 1
    if (timeSec < section.startSec) hi = mid - 1
    else if (timeSec > section.endSec || (!isFinal && timeSec >= section.endSec)) lo = mid + 1
    else return section
  }
  return null
}

export function sectionAuthorityId(section: ReactTrackSection): ReactTrackSectionAuthority {
  return authorityFor(section)
}

export function timelineRevision(sections: readonly ReactTrackSection[]): string {
  let hash = 0x811c9dc5
  const text = sections.map(section => [
    section.id,
    section.type,
    section.startSec.toFixed(6),
    section.endSec.toFixed(6),
    section.provenance?.authority ?? authorityFor(section),
    section.source ?? '',
  ].join('|')).join('||')
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `timeline-${(hash >>> 0).toString(16).padStart(8, '0')}`
}
