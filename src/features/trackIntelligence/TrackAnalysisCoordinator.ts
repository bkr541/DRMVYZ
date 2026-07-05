// Coordinates automatic track analysis for every playlist entry.
// Owns: decoding, job queuing, priority, buffer cache, analysis cache,
// stale-result protection, error reporting, and MI-engine wiring.
// Pure class — no React dependencies; all React interaction goes through callbacks.

import type { Track, TrackAnalysisRuntime } from '../../types'
import type { TrackIntelligenceAnalysis } from '../musicIntelligence/types'
import type { RekordboxAnalysisSeed } from '../rekordboxImport/types'

// ── Schema version ────────────────────────────────────────────────────────────
// Bump this string whenever the analysis schema changes incompatibly.
// It is embedded in the analysis key so old cached results are never reused.
export const CURRENT_ANALYSIS_VERSION = 'auto-1.0'

// ── URL normalisation ─────────────────────────────────────────────────────────

// Known short-lived signing parameters from AWS, GCS, Azure, and Supabase.
// These are stripped from remote URLs so the cache key stays stable across
// token refreshes.  All other query params are retained — some carry meaningful
// content identity (e.g. version=2, quality=hq).
const SIGNING_PARAMS = new Set([
  // AWS S3 pre-signed URLs
  'X-Amz-Algorithm', 'X-Amz-Credential', 'X-Amz-Date', 'X-Amz-Expires',
  'X-Amz-Security-Token', 'X-Amz-Signature', 'X-Amz-SignedHeaders',
  // Generic signing tokens
  'token', 'Expires', 'Signature',
  // Azure SAS / Supabase Storage tokens
  'sv', 'se', 'sp', 'sr', 'sig',
  // GCS signed URLs
  'X-Goog-Algorithm', 'X-Goog-Credential', 'X-Goog-Date',
  'X-Goog-Expires', 'X-Goog-Signature', 'X-Goog-SignedHeaders',
])

/**
 * Normalize a remote audio URL for use as a cache key.
 * Strips known short-lived signing parameters; preserves all other query params.
 * Falls back to stripping the entire query string if URL parsing fails.
 */
function normalizeRemoteUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const meaningful: string[] = []
    for (const [k, v] of parsed.searchParams.entries()) {
      if (!SIGNING_PARAMS.has(k)) meaningful.push(`${k}=${encodeURIComponent(v)}`)
    }
    const query = meaningful.length > 0 ? `?${meaningful.join('&')}` : ''
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}${query}`
  } catch {
    return url.split('?')[0] ?? url
  }
}

// ── Analysis key ──────────────────────────────────────────────────────────────

type KeyableTrack = Pick<Track, 'sourceKind' | 'url'> & { sourceFile?: File }

/**
 * Compute a stable, version-sensitive cache key for a track.
 * File tracks: keyed by name + size + lastModified (collision-free, offline).
 * Remote tracks: keyed by normalized URL (signing params stripped, meaningful
 * params retained) so the same audio resource always maps to the same key
 * even after token refresh.
 */
export function computeAnalysisKey(track: KeyableTrack): string {
  if (track.sourceKind === 'file' && track.sourceFile) {
    const f = track.sourceFile
    return `f:${f.name}:${f.size}:${f.lastModified}:${CURRENT_ANALYSIS_VERSION}`
  }
  return `u:${normalizeRemoteUrl(track.url)}:${CURRENT_ANALYSIS_VERSION}`
}

// ── Minimal LRU cache ─────────────────────────────────────────────────────────

class LRUCache<K, V> {
  private readonly map = new Map<K, V>()
  constructor(private readonly max: number) {}

  get(key: K): V | undefined {
    const v = this.map.get(key)
    if (v !== undefined) { this.map.delete(key); this.map.set(key, v) }
    return v
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key)
    else if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
    this.map.set(key, value)
  }

  has(key: K): boolean { return this.map.has(key) }
  delete(key: K): void { this.map.delete(key) }
  get size(): number   { return this.map.size }
}

// ── Job type ──────────────────────────────────────────────────────────────────

interface AnalysisJob {
  trackId:               string
  analysisKey:           string
  url:                   string
  sourceFile?:           File
  generation:            number
  priority:              'high' | 'normal'
  bypassMemoryCache?:    boolean
  bypassPersistentCache?: boolean
  analysisSeed?:          RekordboxAnalysisSeed
}

// ── Dependency / callback interfaces ─────────────────────────────────────────

export interface CoordinatorDeps {
  /** Fetch and decode a track into an AudioBuffer.  May receive an AbortSignal. */
  decodeBuffer: (track: { url: string; sourceFile?: File; signal?: AbortSignal }) => Promise<AudioBuffer>
  /** Run the full offline analysis on a decoded buffer. */
  analyze: (buffer: AudioBuffer, seed?: RekordboxAnalysisSeed) => Promise<TrackIntelligenceAnalysis>
  /** Look up a completed analysis in the persistent cache. Returns null on miss. */
  getCachedAnalysis: (key: string) => TrackIntelligenceAnalysis | null
  /** Persist a completed analysis so it survives page reload. */
  saveCachedAnalysis: (key: string, analysis: TrackIntelligenceAnalysis) => void
  /** Optional app-level persistence for decoded track records, e.g. Supabase track_analyses. */
  saveCompletedTrackAnalysis?: (trackId: string, analysis: TrackIntelligenceAnalysis) => void | Promise<void>
  /** Max decoded buffers kept in memory (default 10). */
  maxBufferCacheSize?: number
  /** Max concurrent analysis jobs (default 1). */
  maxConcurrent?: number
}

export interface CoordinatorCallbacks {
  /** Update fields on a track's analysisRuntime in React state. */
  onRuntimeUpdate: (trackId: string, patch: Partial<TrackAnalysisRuntime>) => void
  /** Set the track's duration field (extracted from decoded buffer). */
  onDurationUpdate: (trackId: string, duration: number) => void
  /** Apply completed analysis to the live MI engine. */
  onApplyToEngine: (analysis: TrackIntelligenceAnalysis, trackId: string) => void
  /** Return true when trackId is the currently selected active track. */
  isActiveTrack: (trackId: string) => boolean
}

// ── Coordinator ───────────────────────────────────────────────────────────────

export class TrackAnalysisCoordinator {
  private queue:           AnalysisJob[] = []
  private running          = 0
  private generation       = 0
  private cancelledIds     = new Set<string>()
  private bufferCache:     LRUCache<string, AudioBuffer>
  private maxConcurrent:   number
  private abortControllers = new Map<string, AbortController>()

  constructor(
    private readonly deps:      CoordinatorDeps,
    private readonly callbacks: CoordinatorCallbacks,
  ) {
    this.bufferCache   = new LRUCache(deps.maxBufferCacheSize ?? 10)
    this.maxConcurrent = deps.maxConcurrent ?? 1
  }

  /**
   * Add a track to the analysis queue.  If the track is already queued, it is
   * moved to the correct position.  Already-cancelled tracks are un-cancelled.
   */
  enqueue(track: Track, priority: 'high' | 'normal'): void {
    this.queue = this.queue.filter(j => j.trackId !== track.id)
    this.cancelledIds.delete(track.id)

    const job: AnalysisJob = {
      trackId:     track.id,
      analysisKey: track.analysisRuntime.analysisKey,
      url:         track.url,
      sourceFile:  track.sourceFile,
      generation:  this.generation,
      priority,
      analysisSeed: track.importedAnalysisSeed,
    }

    if (priority === 'high') {
      this.queue.unshift(job)
    } else {
      this.queue.push(job)
    }

    this.pump()
  }

  /**
   * Force a fresh analysis, bypassing both the in-memory buffer cache and the
   * persistent analysis cache.  Preserves the original analyzed beat grid and
   * sections in storage — only the re-run result replaces them.
   *
   * Use this when the user explicitly requests fresh analysis (Reanalyze button),
   * as opposed to `enqueue` which reuses a valid cached analysis when available.
   */
  reanalyze(track: Track): void {
    this.queue = this.queue.filter(j => j.trackId !== track.id)
    this.cancelledIds.delete(track.id)

    const job: AnalysisJob = {
      trackId:              track.id,
      analysisKey:          track.analysisRuntime.analysisKey,
      url:                  track.url,
      sourceFile:           track.sourceFile,
      generation:           this.generation,
      priority:             'high',
      bypassMemoryCache:    true,
      bypassPersistentCache: true,
      analysisSeed:          track.importedAnalysisSeed,
    }

    this.queue.unshift(job)
    this.pump()
  }

  /**
   * Increment the generation counter.  All queued and in-flight jobs from the
   * previous generation will be silently discarded when they complete.
   * Aborts any in-flight network fetches.
   * Call this before replacing the entire playlist.
   */
  invalidate(): void {
    this.generation++
    this.queue = []
    this.cancelledIds.clear()
    for (const ac of this.abortControllers.values()) ac.abort()
    this.abortControllers.clear()
  }

  /**
   * Prevent a specific track's result from being committed.
   * Aborts any in-flight network fetch for this track.
   */
  cancelTrack(trackId: string): void {
    this.queue = this.queue.filter(j => j.trackId !== trackId)
    this.cancelledIds.add(trackId)
    this.abortControllers.get(trackId)?.abort()
    this.abortControllers.delete(trackId)
  }

  /**
   * Move an already-queued track to the front of the queue with high priority.
   * No-op if the track is not queued (already running or not yet enqueued).
   */
  prioritize(trackId: string): void {
    const idx = this.queue.findIndex(j => j.trackId === trackId)
    if (idx > 0) {
      const [job] = this.queue.splice(idx, 1)
      job!.priority = 'high'
      this.queue.unshift(job!)
    }
  }

  /** Return the decoded AudioBuffer for a track if it is in the buffer cache. */
  getDecodedBuffer(trackId: string): AudioBuffer | undefined {
    return this.bufferCache.get(trackId)
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private pump(): void {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift()!
      this.running++
      this.runJob(job).finally(() => {
        this.running--
        this.pump()
      })
    }
  }

  private async runJob(job: AnalysisJob): Promise<void> {
    const { trackId, analysisKey, generation } = job

    if (this.isStale(trackId, generation)) return

    // ── 1. Check persistent analysis cache (skipped when reanalyzing) ────────
    if (!job.bypassPersistentCache) {
      let cached: TrackIntelligenceAnalysis | null = null
      try {
        cached = this.deps.getCachedAnalysis(analysisKey)
      } catch (err) {
        console.warn(`[TrackAnalysis] cache load failed — key=${analysisKey} trackId=${trackId}:`, err)
      }
      if (cached) {
        if (this.isStale(trackId, generation)) return

        // Decode and cache the buffer so AudioEngine/Peaks can initialize.
        // Full analysis is skipped — the cached result is used as-is.
        this.callbacks.onRuntimeUpdate(trackId, { status: 'decoding', error: null })
        try {
          let buffer: AudioBuffer | undefined = this.bufferCache.get(trackId)
          if (!buffer) {
            const ac = new AbortController()
            this.abortControllers.set(trackId, ac)
            try {
              buffer = await this.deps.decodeBuffer({ url: job.url, sourceFile: job.sourceFile, signal: ac.signal })
            } finally {
              this.abortControllers.delete(trackId)
            }
            this.bufferCache.set(trackId, buffer)
          }
          if (!this.isStale(trackId, generation)) {
            this.callbacks.onDurationUpdate(trackId, buffer.duration)
          }
        } catch (err) {
          if (this.isStale(trackId, generation)) return
          if (err instanceof Error && err.name === 'AbortError') return
          // Non-fatal: cached analysis is still valid even if buffer decode fails.
          console.warn(
            `[TrackAnalysis] ${trackId}: buffer decode failed (analysis cached) — ${err instanceof Error ? err.message : String(err)}`,
          )
        }

        if (this.isStale(trackId, generation)) return
        try {
          await this.deps.saveCompletedTrackAnalysis?.(trackId, cached)
        } catch (err) {
          console.warn(`[TrackAnalysis] cached analysis persistence failed — trackId=${trackId}:`, err)
        }
        this.callbacks.onRuntimeUpdate(trackId, {
          status:          'complete',
          analysis:        cached,
          analysisVersion: cached.analysisVersion,
          error:           null,
        })
        if (this.callbacks.isActiveTrack(trackId)) {
          this.callbacks.onApplyToEngine(cached, trackId)
        }
        return
      }
    }

    // ── 2. Decode ────────────────────────────────────────────────────────────
    this.callbacks.onRuntimeUpdate(trackId, { status: 'decoding', error: null })

    let buffer: AudioBuffer
    try {
      const inCache = !job.bypassMemoryCache && this.bufferCache.get(trackId)
      if (inCache) {
        buffer = inCache
      } else {
        const ac = new AbortController()
        this.abortControllers.set(trackId, ac)
        try {
          buffer = await this.deps.decodeBuffer({
            url:        job.url,
            sourceFile: job.sourceFile,
            signal:     ac.signal,
          })
        } finally {
          this.abortControllers.delete(trackId)
        }
        this.bufferCache.set(trackId, buffer)
      }
    } catch (err) {
      if (this.isStale(trackId, generation)) return
      // AbortError means the job was cancelled — do not report as failure
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[TrackAnalysis] ${trackId}: decode failed — ${msg}`)
      this.callbacks.onRuntimeUpdate(trackId, {
        status: 'failed',
        error:  `Decode error: ${msg}`,
      })
      return
    }

    if (this.isStale(trackId, generation)) return

    this.callbacks.onDurationUpdate(trackId, buffer.duration)

    // ── 3. Analyze ───────────────────────────────────────────────────────────
    this.callbacks.onRuntimeUpdate(trackId, { status: 'analyzing' })

    let analysis: TrackIntelligenceAnalysis
    try {
      analysis = await this.deps.analyze(buffer, job.analysisSeed)
    } catch (err) {
      if (this.isStale(trackId, generation)) return
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[TrackAnalysis] ${trackId}: analysis failed — ${msg}`)
      this.callbacks.onRuntimeUpdate(trackId, {
        status: 'failed',
        error:  `Analysis error: ${msg}`,
      })
      return
    }

    // ── 4. Final stale check then commit ────────────────────────────────────
    if (this.isStale(trackId, generation)) return

    try {
      this.deps.saveCachedAnalysis(analysisKey, analysis)
    } catch (err) {
      console.warn(`[TrackAnalysis] cache save failed — key=${analysisKey} trackId=${trackId}:`, err)
    }

    try {
      await this.deps.saveCompletedTrackAnalysis?.(trackId, analysis)
    } catch (err) {
      console.warn(`[TrackAnalysis] persisted analysis save failed — trackId=${trackId}:`, err)
    }

    this.callbacks.onRuntimeUpdate(trackId, {
      status:          'complete',
      analysis,
      analysisVersion: analysis.analysisVersion,
      error:           null,
    })

    if (this.callbacks.isActiveTrack(trackId)) {
      this.callbacks.onApplyToEngine(analysis, trackId)
    }
  }

  private isStale(trackId: string, generation: number): boolean {
    return generation !== this.generation || this.cancelledIds.has(trackId)
  }
}
