/**
 * Reference-counted ownership of GPU-backed Three resources (geometries, materials, textures, render targets).
 *
 * `disposeObject` in the asset cache frees everything under a model, which is right while one scene owns it but would pull a texture out from under
 * a second scene that shares it. Code that shares resources between scenes retains each shared resource here and releases it when finished; the
 * resource is disposed exactly when its last holder lets go, whichever scene that is. Releasing a resource that was never retained, or more times
 * than it was retained, is ignored, so teardown paths can be written defensively.
 */
export interface Cinema2Disposable {
  dispose(): void
}

export interface Cinema2ResourceLedgerSnapshot {
  /** Distinct resources currently held. */
  liveCount: number
  /** Sum of all holds (a resource held by two scenes counts twice). */
  holdCount: number
  /** Resources disposed since creation. */
  disposedCount: number
}

export class Cinema2ThreeResourceLedger {
  private readonly holds = new Map<Cinema2Disposable, number>()
  private disposedCount = 0

  /** Adds a hold and returns the resource for chaining. */
  retain<T extends Cinema2Disposable>(resource: T): T {
    this.holds.set(resource, (this.holds.get(resource) ?? 0) + 1)
    return resource
  }

  /** Drops a hold; disposes the resource when it was the last. Returns whether it was disposed. */
  release(resource: Cinema2Disposable | null | undefined): boolean {
    if (!resource) return false
    const count = this.holds.get(resource)
    if (count == null) return false
    if (count > 1) {
      this.holds.set(resource, count - 1)
      return false
    }
    this.holds.delete(resource)
    this.disposedCount += 1
    resource.dispose()
    return true
  }

  holdsOf(resource: Cinema2Disposable): number {
    return this.holds.get(resource) ?? 0
  }

  /** Disposes everything still held (shutdown and context-loss seam). */
  clear(): void {
    const remaining = [...this.holds.keys()]
    this.holds.clear()
    for (const resource of remaining) {
      this.disposedCount += 1
      try { resource.dispose() } catch { /* The context may already be gone; the resource is forgotten either way. */ }
    }
  }

  getSnapshot(): Readonly<Cinema2ResourceLedgerSnapshot> {
    let holdCount = 0
    for (const count of this.holds.values()) holdCount += count
    return Object.freeze({ liveCount: this.holds.size, holdCount, disposedCount: this.disposedCount })
  }
}

/** The ledger shared by default. Scenes that want isolated accounting create their own. */
export const cinema2ThreeResourceLedger = new Cinema2ThreeResourceLedger()
