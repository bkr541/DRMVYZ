import type { ShaderDefinition } from '../react/shaders/registry/shaderRegistryTypes'
import { ShaderPassCompiler } from '../react/shaders/rendergraph/ShaderPassCompiler'
import type { CompiledGraph, RenderGraphError } from '../react/shaders/rendergraph/shaderRenderGraphTypes'

const MAXIMUM_CACHED_SHADER_GRAPHS = 8

interface CacheEntry {
  graph: CompiledGraph
  referenceCount: number
}

interface ContextCache {
  entries: Map<string, CacheEntry>
  hitCount: number
  missCount: number
  evictionCount: number
}

export interface CinemaShaderProgramLease {
  graph: CompiledGraph | null
  error: RenderGraphError | null
  cacheHit: boolean
  release(): void
}

const contextCaches = new WeakMap<WebGL2RenderingContext, ContextCache>()

/** Acquires a compiled graph from a bounded cache owned by exactly one GL context. */
export function acquireCinemaShaderProgramGraph(
  gl: WebGL2RenderingContext,
  shader: Readonly<ShaderDefinition>,
): CinemaShaderProgramLease {
  const cache = contextCache(gl)
  const key = shaderCacheKey(shader)
  const cached = cache.entries.get(key)
  if (cached) {
    cache.entries.delete(key)
    cache.entries.set(key, cached)
    cached.referenceCount += 1
    cache.hitCount += 1
    return createLease(cache, key, cached, true)
  }

  cache.missCount += 1
  const result = new ShaderPassCompiler(gl).compile(shader as ShaderDefinition)
  if (!result.graph) {
    return Object.freeze({ graph: null, error: result.error, cacheHit: false, release: () => {} })
  }
  const entry: CacheEntry = { graph: result.graph, referenceCount: 1 }
  cache.entries.set(key, entry)
  trimCache(cache)
  return createLease(cache, key, entry, false)
}

export function disposeCinemaShaderProgramCache(gl: WebGL2RenderingContext): void {
  const cache = contextCaches.get(gl)
  if (!cache) return
  for (const entry of cache.entries.values()) {
    try { ShaderPassCompiler.disposeGraph(entry.graph) } catch { /* Context loss may have already invalidated programs. */ }
  }
  cache.entries.clear()
  contextCaches.delete(gl)
}

export function getCinemaShaderProgramCacheDiagnostics(gl: WebGL2RenderingContext): Readonly<{
  size: number
  referencedCount: number
  hitCount: number
  missCount: number
  evictionCount: number
}> {
  const cache = contextCaches.get(gl)
  if (!cache) return Object.freeze({ size: 0, referencedCount: 0, hitCount: 0, missCount: 0, evictionCount: 0 })
  let referencedCount = 0
  for (const entry of cache.entries.values()) if (entry.referenceCount > 0) referencedCount += 1
  return Object.freeze({
    size: cache.entries.size,
    referencedCount,
    hitCount: cache.hitCount,
    missCount: cache.missCount,
    evictionCount: cache.evictionCount,
  })
}

function contextCache(gl: WebGL2RenderingContext): ContextCache {
  let cache = contextCaches.get(gl)
  if (!cache) {
    cache = { entries: new Map(), hitCount: 0, missCount: 0, evictionCount: 0 }
    contextCaches.set(gl, cache)
  }
  return cache
}

function createLease(cache: ContextCache, key: string, entry: CacheEntry, cacheHit: boolean): CinemaShaderProgramLease {
  let released = false
  return Object.freeze({
    graph: entry.graph,
    error: null,
    cacheHit,
    release: () => {
      if (released) return
      released = true
      entry.referenceCount = Math.max(0, entry.referenceCount - 1)
      trimCache(cache)
    },
  })
}

function trimCache(cache: ContextCache): void {
  if (cache.entries.size <= MAXIMUM_CACHED_SHADER_GRAPHS) return
  for (const [key, entry] of cache.entries) {
    if (cache.entries.size <= MAXIMUM_CACHED_SHADER_GRAPHS) break
    if (entry.referenceCount > 0) continue
    cache.entries.delete(key)
    ShaderPassCompiler.disposeGraph(entry.graph)
    cache.evictionCount += 1
  }
}

function shaderCacheKey(shader: Readonly<ShaderDefinition>): string {
  const source = JSON.stringify({
    id: shader.id,
    version: shader.version,
    vertSrc: shader.vertSrc,
    fragSrc: shader.fragSrc,
    passes: shader.passes,
    textureInputs: shader.textureInputs,
    quality: shader.quality,
  })
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${shader.id}:${shader.version}:${(hash >>> 0).toString(16)}`
}
