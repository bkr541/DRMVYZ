export type Cinema2RandomnessMode = 'deterministic' | 'session-organic'
export type Cinema2RandomSeed = string | number

export interface Cinema2RandomNamespace {
  /** Stable creative/runtime owner. Future preset modules should use their module id. */
  moduleId: string
  /** Canonical musical/runtime event identity when the choice is event-derived. */
  eventId?: string
  /** Stable semantic purpose such as probability, variant-selection or geometry. */
  purpose: string
  /** Optional nested stream name that does not perturb sibling streams. */
  substream?: string
}

export interface Cinema2RandomServiceOptions {
  presetId: string
  revision: number
  /** Canonical serialized activation state; transient frame state must not be included. */
  stateKey: string
  mode?: Cinema2RandomnessMode
  seed?: Cinema2RandomSeed
  /** Injectable activation entropy keeps session-organic behavior testable. */
  activationEntropy?: () => Cinema2RandomSeed
}

export interface Cinema2RandomServiceSnapshot {
  mode: Cinema2RandomnessMode
  seed: string
  activationKey: string
}

export interface Cinema2RandomStream {
  readonly namespace: Readonly<Cinema2RandomNamespace>
  next(): number
  probability(probability: number): boolean
  fork(purpose: string, substream?: string): Cinema2RandomStream
}

const UINT32_RANGE = 0x1_0000_0000
let fallbackActivationSequence = 0

/**
 * Engine-owned namespaced randomness. Deterministic choices are derived from
 * immutable activation identity plus namespace/index, so consuming one stream
 * can never perturb a sibling stream.
 */
export class Cinema2RandomService {
  private readonly mode: Cinema2RandomnessMode
  private readonly seed: string
  private readonly activationKey: string

  constructor(options: Readonly<Cinema2RandomServiceOptions>) {
    this.mode = options.mode ?? 'deterministic'
    this.seed = normalizeSeed(options.seed ?? 0)
    const presetIdentity = `${options.presetId}@${finiteRevision(options.revision)}`
    const stateHash = toHex(hashString(options.stateKey))
    const activationEntropy = this.mode === 'session-organic'
      ? normalizeSeed((options.activationEntropy ?? defaultActivationEntropy)())
      : 'deterministic'
    this.activationKey = `${presetIdentity}|state:${stateHash}|seed:${this.seed}|mode:${this.mode}|activation:${activationEntropy}`
  }

  getSnapshot(): Readonly<Cinema2RandomServiceSnapshot> {
    return Object.freeze({ mode: this.mode, seed: this.seed, activationKey: this.activationKey })
  }

  /** Stateless deterministic sample for callers that already own an index. */
  sample(namespace: Readonly<Cinema2RandomNamespace>, index = 0): number {
    validateNamespace(namespace)
    const safeIndex = Number.isSafeInteger(index) && index >= 0 ? index : 0
    const key = `${this.activationKey}|${namespaceKey(namespace)}|index:${safeIndex}`
    return mix32(hashString(key)) / UINT32_RANGE
  }

  /** Deterministic probability gate. 0 and 1 are exact fast paths. */
  probability(namespace: Readonly<Cinema2RandomNamespace>, probability: number, index = 0): boolean {
    const normalized = clampProbability(probability)
    if (normalized <= 0) return false
    if (normalized >= 1) return true
    return this.sample(namespace, index) < normalized
  }

  stream(namespace: Readonly<Cinema2RandomNamespace>): Cinema2RandomStream {
    validateNamespace(namespace)
    const frozenNamespace = Object.freeze({ ...namespace })
    let index = 0
    const service = this
    return Object.freeze({
      namespace: frozenNamespace,
      next(): number {
        const value = service.sample(frozenNamespace, index)
        index += 1
        return value
      },
      probability(probability: number): boolean {
        const value = service.probability(frozenNamespace, probability, index)
        index += 1
        return value
      },
      fork(purpose: string, substream?: string): Cinema2RandomStream {
        return service.stream({
          ...frozenNamespace,
          purpose,
          substream: substream ?? frozenNamespace.substream,
        })
      },
    })
  }

  eventStream(moduleId: string, eventId: string, purpose: string, substream?: string): Cinema2RandomStream {
    return this.stream({ moduleId, eventId, purpose, substream })
  }
}

function defaultActivationEntropy(): string {
  const cryptoObject = globalThis.crypto
  if (cryptoObject?.getRandomValues) {
    const words = new Uint32Array(4)
    cryptoObject.getRandomValues(words)
    return Array.from(words, word => word.toString(16).padStart(8, '0')).join('')
  }
  fallbackActivationSequence += 1
  const now = Date.now().toString(36)
  const highResolution = typeof performance !== 'undefined' && Number.isFinite(performance.now())
    ? Math.round(performance.now() * 1000).toString(36)
    : '0'
  return `${now}:${highResolution}:${fallbackActivationSequence.toString(36)}`
}

function validateNamespace(namespace: Readonly<Cinema2RandomNamespace>): void {
  if (!namespace.moduleId.trim()) throw new Error('Cinema 2.0 random namespaces require a non-empty moduleId.')
  if (!namespace.purpose.trim()) throw new Error('Cinema 2.0 random namespaces require a non-empty purpose.')
  if (namespace.eventId != null && !namespace.eventId.trim()) throw new Error('Cinema 2.0 random eventId must be non-empty when provided.')
  if (namespace.substream != null && !namespace.substream.trim()) throw new Error('Cinema 2.0 random substream must be non-empty when provided.')
}

function namespaceKey(namespace: Readonly<Cinema2RandomNamespace>): string {
  return `module:${escapeKey(namespace.moduleId)}|event:${escapeKey(namespace.eventId ?? '')}|purpose:${escapeKey(namespace.purpose)}|substream:${escapeKey(namespace.substream ?? '')}`
}

function escapeKey(value: string): string {
  return `${value.length}:${value}`
}

function normalizeSeed(seed: Cinema2RandomSeed): string {
  if (typeof seed === 'number') {
    if (!Number.isFinite(seed)) return '0'
    return Number.isInteger(seed) ? String(seed) : seed.toPrecision(17)
  }
  return seed.trim() || '0'
}

function finiteRevision(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/** FNV-1a with Math.imul gives stable uint32 output across JS runtimes. */
function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** Final avalanche keeps nearby namespace strings from producing correlated samples. */
function mix32(value: number): number {
  let mixed = value >>> 0
  mixed ^= mixed >>> 16
  mixed = Math.imul(mixed, 0x7feb352d) >>> 0
  mixed ^= mixed >>> 15
  mixed = Math.imul(mixed, 0x846ca68b) >>> 0
  mixed ^= mixed >>> 16
  return mixed >>> 0
}

function toHex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0')
}
