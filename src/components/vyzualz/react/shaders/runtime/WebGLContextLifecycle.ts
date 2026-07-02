export type WebGLContextLifetime = 'live-reusable' | 'transient-thumbnail'
export type WebGLContextDisposalMode = 'release-resources' | 'terminal-retire'

export const MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS = 1

export interface WebGLContextOwnership {
  lifetime: WebGLContextLifetime
  role: string
  engine: string
  /** DRMVYZ-owned upper bound for simultaneously owned contexts in this role. */
  expectedMaxActive?: number
}

interface ContextRecord {
  id: number
  ownership: WebGLContextOwnership
  claims: Set<number>
}

export interface WebGLContextDiagnosticSnapshot {
  creationCount: number
  acquisitionCount: number
  retirementCount: number
  terminalRetirementCount: number
  duplicateOwnershipCount: number
  activeCount: number
  activeByLifetime: Record<WebGLContextLifetime, number>
  activeByRole: Record<string, number>
  activeByEngine: Record<string, number>
  activeLiveByEngine: Record<string, number>
}

export interface WebGLContextDiagnosticHandle {
  readonly contextId: number
  readonly claimId: number
  readonly ownership: WebGLContextOwnership
  readonly gl: WebGL2RenderingContext
}

export interface DrmvyzThumbnailWebGLContextLease {
  readonly id: number
  readonly family: string
}

interface ActiveThumbnailWebGLContextLease {
  lease: DrmvyzThumbnailWebGLContextLease
  terminalRetire: () => void
}

const diagnosticsEnabled = import.meta.env.DEV
let nextContextId = 1
let nextClaimId = 1
let creationCount = 0
let acquisitionCount = 0
let retirementCount = 0
let terminalRetirementCount = 0
let duplicateOwnershipCount = 0
let recordsByContext = new WeakMap<WebGL2RenderingContext, ContextRecord>()
const activeRecords = new Map<number, ContextRecord>()
const activeClaims = new Map<number, WebGLContextDiagnosticHandle>()
let nextThumbnailLeaseId = 1
let activeThumbnailLease: ActiveThumbnailWebGLContextLease | null = null
let thumbnailWorkTail: Promise<void> = Promise.resolve()

/**
 * Serialize all DRMVYZ-owned thumbnail work that may create or retire WebGL
 * contexts. Engine families can retain a context between jobs, but a family
 * replacement cannot race an in-flight render.
 */
export function serializeDrmvyzThumbnailWebGLWork<T>(work: () => Promise<T>): Promise<T> {
  const run = () => work()
  const task = thumbnailWorkTail.then(run, run)
  thumbnailWorkTail = task.then(() => undefined, () => undefined)
  return task
}

/**
 * Claim the single DRMVYZ thumbnail WebGL slot. Call only from serialized
 * thumbnail work. A previous family is terminally retired before the caller
 * creates its replacement context.
 */
export function claimDrmvyzThumbnailWebGLContext(
  family: string,
  terminalRetire: () => void,
): DrmvyzThumbnailWebGLContextLease {
  const previous = activeThumbnailLease
  activeThumbnailLease = null
  if (previous) previous.terminalRetire()

  const lease: DrmvyzThumbnailWebGLContextLease = {
    id: nextThumbnailLeaseId++,
    family,
  }
  activeThumbnailLease = { lease, terminalRetire }
  return lease
}

export function releaseDrmvyzThumbnailWebGLContext(
  lease: DrmvyzThumbnailWebGLContextLease | null,
): void {
  if (!lease || activeThumbnailLease?.lease.id !== lease.id) return
  activeThumbnailLease = null
}

export function getDrmvyzThumbnailWebGLCoordinatorDiagnosticsForTests(): Readonly<{
  activeLeaseCount: number
  activeFamily: string | null
  contextLimit: number
}> {
  return {
    activeLeaseCount: activeThumbnailLease ? 1 : 0,
    activeFamily: activeThumbnailLease?.lease.family ?? null,
    contextLimit: MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS,
  }
}

export function resetDrmvyzThumbnailWebGLCoordinatorForTests(): void {
  const previous = activeThumbnailLease
  activeThumbnailLease = null
  previous?.terminalRetire()
  nextThumbnailLeaseId = 1
  thumbnailWorkTail = Promise.resolve()
}

export function registerDrmvyzWebGLContext(
  gl: WebGL2RenderingContext,
  ownership: WebGLContextOwnership,
): WebGLContextDiagnosticHandle | null {
  if (!diagnosticsEnabled) return null

  acquisitionCount += 1
  let record = recordsByContext.get(gl)
  if (!record) {
    record = {
      id: nextContextId++,
      ownership: { ...ownership },
      claims: new Set(),
    }
    recordsByContext.set(gl, record)
    activeRecords.set(record.id, record)
    creationCount += 1
  } else {
    duplicateOwnershipCount += 1
    console.warn(
      `[WebGLContextLifecycle] duplicate DRMVYZ ownership for context ${record.id}: ` +
      `${record.ownership.role}/${record.ownership.engine} and ${ownership.role}/${ownership.engine}`,
    )
  }

  const handle: WebGLContextDiagnosticHandle = {
    contextId: record.id,
    claimId: nextClaimId++,
    ownership: { ...ownership },
    gl,
  }
  record.claims.add(handle.claimId)
  activeClaims.set(handle.claimId, handle)
  warnIfOwnedBoundExceeded(ownership)
  return handle
}

export function retireDrmvyzWebGLContext(
  handle: WebGLContextDiagnosticHandle | null,
  mode: WebGLContextDisposalMode,
): void {
  if (!diagnosticsEnabled || !handle) return
  if (!activeClaims.delete(handle.claimId)) return

  const record = activeRecords.get(handle.contextId)
  if (!record) return
  record.claims.delete(handle.claimId)
  if (record.claims.size > 0) return

  activeRecords.delete(record.id)
  recordsByContext.delete(handle.gl)
  retirementCount += 1
  if (mode === 'terminal-retire') terminalRetirementCount += 1
}

export function getDrmvyzWebGLContextDiagnosticsForTests(): WebGLContextDiagnosticSnapshot {
  const activeByLifetime: Record<WebGLContextLifetime, number> = {
    'live-reusable': 0,
    'transient-thumbnail': 0,
  }
  const activeByRole: Record<string, number> = {}
  const activeByEngine: Record<string, number> = {}
  const activeLiveByEngine: Record<string, number> = {}
  for (const record of activeRecords.values()) {
    activeByLifetime[record.ownership.lifetime] += 1
    activeByRole[record.ownership.role] = (activeByRole[record.ownership.role] ?? 0) + 1
    activeByEngine[record.ownership.engine] = (activeByEngine[record.ownership.engine] ?? 0) + 1
    if (record.ownership.lifetime === 'live-reusable') {
      activeLiveByEngine[record.ownership.engine] = (activeLiveByEngine[record.ownership.engine] ?? 0) + 1
    }
  }
  return {
    creationCount,
    acquisitionCount,
    retirementCount,
    terminalRetirementCount,
    duplicateOwnershipCount,
    activeCount: activeRecords.size,
    activeByLifetime,
    activeByRole,
    activeByEngine,
    activeLiveByEngine,
  }
}


export interface DrmvyzWebGLContextOwnershipValidation {
  ok: boolean
  violations: string[]
}

/**
 * Development guardrail for the final React-preview architecture. It validates
 * DRMVYZ ownership, not Chromium's process-wide context accounting.
 */
export function validateDrmvyzWebGLContextOwnershipBounds(
  expectedLiveEngine: 'shader-engine' | 'cinematic-worlds' | null,
): DrmvyzWebGLContextOwnershipValidation {
  const snapshot = getDrmvyzWebGLContextDiagnosticsForTests()
  const violations: string[] = []
  const liveCount = snapshot.activeByLifetime['live-reusable']
  const thumbnailCount = snapshot.activeByLifetime['transient-thumbnail']

  if (liveCount > 1) violations.push(`expected at most 1 live WebGL context, found ${liveCount}`)
  if (thumbnailCount > MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS) {
    violations.push(
      `expected at most ${MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS} thumbnail WebGL context, found ${thumbnailCount}`,
    )
  }

  if (expectedLiveEngine == null) {
    if (liveCount !== 0) violations.push(`expected no live WebGL context, found ${liveCount}`)
  } else {
    const expectedCount = snapshot.activeLiveByEngine[expectedLiveEngine] ?? 0
    if (expectedCount > 1) violations.push(`expected at most 1 live ${expectedLiveEngine} context, found ${expectedCount}`)
    const unexpectedLiveCount = liveCount - expectedCount
    if (unexpectedLiveCount > 0) {
      const engines = Object.entries(snapshot.activeLiveByEngine)
        .filter(([engine, count]) => engine !== expectedLiveEngine && count > 0)
        .map(([engine]) => engine)
      violations.push(
        `inactive live WebGL engine still owns ${unexpectedLiveCount} context${unexpectedLiveCount === 1 ? '' : 's'}` +
        (engines.length > 0 ? `: ${engines.join(', ')}` : ''),
      )
    }
  }

  return { ok: violations.length === 0, violations }
}

export function assertDrmvyzWebGLContextOwnershipBoundsForDevelopment(
  expectedLiveEngine: 'shader-engine' | 'cinematic-worlds' | null,
): void {
  if (!diagnosticsEnabled) return
  const validation = validateDrmvyzWebGLContextOwnershipBounds(expectedLiveEngine)
  if (!validation.ok) {
    console.warn(`[WebGLContextLifecycle] ownership guardrail failed: ${validation.violations.join('; ')}`)
  }
}

export function resetDrmvyzWebGLContextDiagnosticsForTests(): void {
  nextContextId = 1
  nextClaimId = 1
  creationCount = 0
  acquisitionCount = 0
  retirementCount = 0
  terminalRetirementCount = 0
  duplicateOwnershipCount = 0
  recordsByContext = new WeakMap<WebGL2RenderingContext, ContextRecord>()
  activeRecords.clear()
  activeClaims.clear()
}

function warnIfOwnedBoundExceeded(ownership: WebGLContextOwnership): void {
  if (ownership.lifetime === 'transient-thumbnail') {
    let activeThumbnailContexts = 0
    for (const record of activeRecords.values()) {
      if (record.ownership.lifetime === 'transient-thumbnail') activeThumbnailContexts += 1
    }
    if (activeThumbnailContexts > MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS) {
      console.warn(
        '[WebGLContextLifecycle] DRMVYZ thumbnail context bound exceeded: ' +
        `${activeThumbnailContexts} active, expected at most ${MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS}`,
      )
    }
  }

  const max = ownership.expectedMaxActive
  if (max == null) return
  let active = 0
  for (const record of activeRecords.values()) {
    if (record.ownership.role === ownership.role && record.ownership.lifetime === ownership.lifetime) {
      active += 1
    }
  }
  if (active > max) {
    console.warn(
      `[WebGLContextLifecycle] DRMVYZ context bound exceeded for ${ownership.role}: ` +
      `${active} active, expected at most ${max}`,
    )
  }
}
