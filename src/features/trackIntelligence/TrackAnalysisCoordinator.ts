// Coordinates automatic track analysis for every playlist entry.
// Owns: decoding, job queuing, priority, buffer cache, analysis cache,
// stale-result protection, error reporting, and MI-engine wiring.
// Pure class — no React dependencies; all React interaction goes through callbacks.

import type { Track, TrackAnalysisRuntime } from '../../types'
import type { TrackIntelligenceAnalysis } from '../musicIntelligence/types'

// ── Schema version ────────────────────────────────────────────────────────────
// Bump this string whenever the analysis schema changes incompatibly.
// It is embedded in the analysis key so old cached results are never reused.
export const CURRENT_ANALYSIS_VERSION = 'auto-1.0'

// ── Analysis key ──────────────────────────────────────────────────────────────

type KeyableTrack = Pick<Track, 'sourceKind' | 'url'> & { sourceFile?: File }

/**
 * Compute a stable, version-sensitive cache key for a track.
 * File tracks: keyed by name + size + lastModified (collision-free, offline).
 * Remote tracks: keyed by URL without signed-token query params.
 */
export function computeAnalysisKey(track: KeyableTrack): string {
  if (track.sourceKind === 'file' && track.sourceFile) {
    const f = track.sourceFile
    return `f:${f.name}:${f.size}:${f.lastModified}:${CURRENT_ANALYSIS_VERSION}`
  }
  // Strip signed-URL query params so the key stays stable across token refreshes
  const base = track.url.split('?')[0] ?? track.url
  return `u:${base}:${CURRENT_ANALYSIS_VERSION}`
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
  trackId:     string
  analysisKey: string
  url:         string
  sourceFile?: File
  generation:  number
  priority:    'high' | 'normal'
}

// ── Dependency / callback interfaces ─────────────────────────────────────────

export interface CoordinatorDeps {
  /** Fetch and decode a track into an AudioBuffer. */
  decodeBuffer: (track: { url: string; sourceFile?: File }) => Promise<AudioBuffer>
  /** Run the full offline analysis on a decoded buffer. */
  analyze: (buffer: AudioBuffer) => Promise<TrackIntelligenceAnalysis>
  /** Look up a completed analysis in the persistent cache. Returns null on miss. */
  getCachedAnalysis: (key: string) => TrackIntelligenceAnalysis | null
  /** Persist a completed analysis so it survives page reload. */
  saveCachedAnalysis: (key: string, analysis: TrackIntelligenceAnalysis) => void
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
  private queue:        AnalysisJob[] = []
  private running       = 0
  private generation    = 0
  private cancelledIds  = new Set<string>()
  private bufferCache:  LRUCache<string, AudioBuffer>
  private maxConcurrent: number

  constructor(
    private readonly deps:      CoordinatorDeps,
    private readonly callbacks: CoordinatorCallbacks,
  ) {
    this.bufferCache  = new LRUCache(deps.maxBufferCacheSize ?? 10)
    this.maxConcurrent = deps.maxConcurrent ?? 1
  }

  /**
   * Add a track to the analysis queue.  If the track is already queued, it is
   * moved to the correct position.  Already-cancelled tracks are un-cancelled.
   */
  enqueue(track: Track, priority: 'high' | 'normal'): void {
    // Remove existing job for this track (de-duplicate / re-prioritize)
    this.queue = this.queue.filter(j => j.trackId !== track.id)
    this.cancelledIds.delete(track.id)

    const job: AnalysisJob = {
      trackId:     track.id,
      analysisKey: track.analysisRuntime.analysisKey,
      url:         track.url,
      sourceFile:  track.sourceFile,
      generation:  this.generation,
      priority,
    }

    if (priority === 'high') {
      this.queue.unshift(job)
    } else {
      this.queue.push(job)
    }

    this.pump()
  }

  /**
   * Increment the generation counter.  All queued and in-flight jobs from the
   * previous generation will be silently discarded when they complete.
   * Call this before replacing the entire playlist.
   */
  invalidate(): void {
    this.generation++
    this.queue = []
    // cancelledIds from prior generation are irrelevant after invalidation; clear them.
    this.cancelledIds.clear()
  }

  /**
   * Prevent a specific track's result from being committed.
   * The job is removed from the queue; if already running, the result check at
   * completion will see the cancellation flag and discard it.
   */
  cancelTrack(trackId: string): void {
    this.queue = this.queue.filter(j => j.trackId !== trackId)
    this.cancelledIds.add(trackId)
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

    // ── 1. Check persistent analysis cache ──────────────────────────────────
    const cached = this.deps.getCachedAnalysis(analysisKey)
    if (cached) {
      if (this.isStale(trackId, generation)) return
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

    // ── 2. Decode ────────────────────────────────────────────────────────────
    this.callbacks.onRuntimeUpdate(trackId, { status: 'decoding', error: null })

    let buffer: AudioBuffer
    try {
      const inCache = this.bufferCache.get(trackId)
      if (inCache) {
        buffer = inCache
      } else {
        buffer = await this.deps.decodeBuffer({ url: job.url, sourceFile: job.sourceFile })
        this.bufferCache.set(trackId, buffer)
      }
    } catch (err) {
      if (this.isStale(trackId, generation)) return
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[TrackAnalysis] ${trackId}: decode failed — ${msg}`)
      this.callbacks.onRuntimeUpdate(trackId, {
        status: 'failed',
        error:  `Decode error: ${msg}`,
      })
      return
    }

    if (this.isStale(trackId, generation)) return

    // Update track duration from the decoded buffer
    this.callbacks.onDurationUpdate(trackId, buffer.duration)

    // ── 3. Analyze ───────────────────────────────────────────────────────────
    this.callbacks.onRuntimeUpdate(trackId, { status: 'analyzing' })

    let analysis: TrackIntelligenceAnalysis
    try {
      analysis = await this.deps.analyze(buffer)
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
    } catch { /* non-fatal — cache miss on next load is acceptable */ }

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
