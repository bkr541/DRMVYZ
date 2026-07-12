import { BoundedLruCache } from './boundedLru'

export type MediaSigningPriority = 'visible' | 'near' | 'prefetch'

export interface SignedMediaAsset {
  url: string
  path: string
  bucket: string
  userId: string
  issuedAt: number
  expiresAt: number
}

export interface MediaSigningRequest {
  userId: string
  bucket: string
  path: string
  priority: MediaSigningPriority
  scopeId: string
  force?: boolean
}

export interface MediaSigningCoordinatorOptions {
  maxConcurrency?: number
  maxCacheEntries?: number
  expiresInSeconds?: number
  refreshSkewMs?: number
  now?: () => number
  signer: (bucket: string, path: string, expiresInSeconds: number) => Promise<{ url: string | null; error: string | null }>
}

interface QueueEntry {
  key: string
  request: MediaSigningRequest
  priority: number
  sequence: number
  version: number
  resolve: (asset: SignedMediaAsset) => void
  reject: (error: Error) => void
  promise: Promise<SignedMediaAsset>
  state: 'queued' | 'active'
}

const PRIORITY: Record<MediaSigningPriority, number> = { visible: 0, near: 1, prefetch: 2 }

function abortError(message: string): Error {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

export class MediaSigningCoordinator {
  private readonly maxConcurrency: number
  private readonly expiresInSeconds: number
  private readonly refreshSkewMs: number
  private readonly now: () => number
  private readonly signer: MediaSigningCoordinatorOptions['signer']
  private readonly cache: BoundedLruCache<string, SignedMediaAsset>
  private readonly pending = new Map<string, QueueEntry>()
  private readonly keyVersions = new Map<string, number>()
  private readonly activeScopes = new Map<string, string>()
  private queue: QueueEntry[] = []
  private activeCount = 0
  private sequence = 0

  constructor(options: MediaSigningCoordinatorOptions) {
    this.maxConcurrency = Math.max(1, Math.floor(options.maxConcurrency ?? 4))
    this.expiresInSeconds = Math.max(60, Math.floor(options.expiresInSeconds ?? 3600))
    this.refreshSkewMs = Math.max(0, options.refreshSkewMs ?? 60_000)
    this.now = options.now ?? Date.now
    this.signer = options.signer
    this.cache = new BoundedLruCache({ maxEntries: options.maxCacheEntries ?? 256 })
  }

  get active(): number { return this.activeCount }
  get queued(): number { return this.queue.length }
  get cacheSize(): number { return this.cache.size }

  activateScope(scopeId: string, userId: string): void {
    this.activeScopes.set(scopeId, userId)
  }

  abandonScope(scopeId: string): void {
    this.activeScopes.delete(scopeId)
    // A queued entry only records the scope that first created it — a later
    // request for the same key joins the same promise without updating that
    // scope. Mirror run()'s guard for active entries so abandoning the
    // originating scope doesn't reject a still-joined, still-active scope.
    const abandoned = this.queue.filter(entry =>
      entry.request.scopeId === scopeId && !this.hasActiveScopeForUser(entry.request.userId),
    )
    this.queue = this.queue.filter(entry => !abandoned.includes(entry))
    for (const entry of abandoned) {
      this.pending.delete(entry.key)
      entry.reject(abortError('Obsolete media signing work was abandoned.'))
    }
  }

  request(request: MediaSigningRequest): Promise<SignedMediaAsset> {
    const normalized = { ...request, path: request.path.trim() }
    if (!normalized.userId || !normalized.path || !normalized.scopeId) {
      return Promise.reject(new Error('Media signing requires a user, scope, and storage path.'))
    }
    this.activateScope(normalized.scopeId, normalized.userId)
    const key = this.cacheKey(normalized.userId, normalized.bucket, normalized.path)
    if (!normalized.force) {
      const cached = this.cache.get(key)
      if (cached && cached.expiresAt - this.now() > this.refreshSkewMs) return Promise.resolve(cached)
    }
    // A forced refresh bypasses only the reusable cache. It still joins an
    // in-flight request for the same account/bucket/path so simultaneous media
    // errors cannot stampede storage signing.
    const existing = this.pending.get(key)
    if (existing) {
      const nextPriority = PRIORITY[normalized.priority]
      if (existing.state === 'queued' && nextPriority < existing.priority) {
        existing.priority = nextPriority
        existing.request.priority = normalized.priority
        this.sortQueue()
      }
      return existing.promise
    }

    const version = (this.keyVersions.get(key) ?? 0) + 1
    this.keyVersions.set(key, version)
    let resolve!: (asset: SignedMediaAsset) => void
    let reject!: (error: Error) => void
    const promise = new Promise<SignedMediaAsset>((res, rej) => { resolve = res; reject = rej })
    const entry: QueueEntry = {
      key,
      request: normalized,
      priority: PRIORITY[normalized.priority],
      sequence: this.sequence++,
      version,
      resolve,
      reject,
      promise,
      state: 'queued',
    }
    this.pending.set(key, entry)
    this.queue.push(entry)
    this.sortQueue()
    this.pump()
    return promise
  }

  peek(userId: string, bucket: string, path: string): SignedMediaAsset | undefined {
    const asset = this.cache.get(this.cacheKey(userId, bucket, path))
    if (!asset || asset.expiresAt - this.now() <= this.refreshSkewMs) return undefined
    return asset
  }

  purgePaths(userId: string, bucket: string, paths: string[]): void {
    const pathSet = new Set(paths)
    for (const path of pathSet) {
      const key = this.cacheKey(userId, bucket, path)
      this.keyVersions.set(key, (this.keyVersions.get(key) ?? 0) + 1)
    }
    this.cache.deleteWhere(asset => asset.userId === userId && asset.bucket === bucket && pathSet.has(asset.path))
    const cancelled = this.queue.filter(entry => entry.request.userId === userId && entry.request.bucket === bucket && pathSet.has(entry.request.path))
    this.queue = this.queue.filter(entry => !cancelled.includes(entry))
    for (const entry of cancelled) {
      this.pending.delete(entry.key)
      entry.reject(abortError('Media signing was cancelled because the asset was purged.'))
    }
  }

  clearUser(userId: string): void {
    this.cache.deleteWhere(asset => asset.userId === userId)
    const scopes = Array.from(this.activeScopes.entries()).filter(([, scopedUser]) => scopedUser === userId).map(([scope]) => scope)
    scopes.forEach(scope => this.abandonScope(scope))
  }

  clear(): void {
    this.cache.clear()
    for (const entry of this.queue) entry.reject(abortError('Media signing coordinator was cleared.'))
    this.queue = []
    this.pending.clear()
    this.activeScopes.clear()
    this.keyVersions.clear()
  }

  private cacheKey(userId: string, bucket: string, path: string): string {
    return `${userId}\u0000${bucket}\u0000${path}`
  }

  private hasActiveScopeForUser(userId: string): boolean {
    for (const scopedUserId of this.activeScopes.values()) {
      if (scopedUserId === userId) return true
    }
    return false
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence)
  }

  private pump(): void {
    while (this.activeCount < this.maxConcurrency && this.queue.length > 0) {
      const entry = this.queue.shift()!
      if (this.activeScopes.get(entry.request.scopeId) !== entry.request.userId) {
        this.pending.delete(entry.key)
        entry.reject(abortError('Obsolete media signing work was abandoned.'))
        continue
      }
      entry.state = 'active'
      this.activeCount += 1
      void this.run(entry)
    }
  }

  private async run(entry: QueueEntry): Promise<void> {
    try {
      const result = await this.signer(entry.request.bucket, entry.request.path, this.expiresInSeconds)
      if (result.error || !result.url) throw new Error(result.error ?? 'Storage did not return a signed URL.')
      if (
        this.activeScopes.get(entry.request.scopeId) !== entry.request.userId
        && !this.hasActiveScopeForUser(entry.request.userId)
      ) {
        throw abortError('Obsolete media signing response was ignored.')
      }
      const issuedAt = this.now()
      const asset: SignedMediaAsset = {
        url: result.url,
        path: entry.request.path,
        bucket: entry.request.bucket,
        userId: entry.request.userId,
        issuedAt,
        expiresAt: issuedAt + this.expiresInSeconds * 1000,
      }
      if (this.keyVersions.get(entry.key) === entry.version) this.cache.set(entry.key, asset)
      entry.resolve(asset)
    } catch (error) {
      entry.reject(error instanceof Error ? error : new Error('Unexpected media signing failure.'))
    } finally {
      if (this.pending.get(entry.key) === entry) this.pending.delete(entry.key)
      this.activeCount -= 1
      this.pump()
    }
  }
}
