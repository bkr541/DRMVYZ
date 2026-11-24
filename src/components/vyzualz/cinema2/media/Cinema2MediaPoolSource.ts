import type { Cinema2MediaSource } from './Cinema2MediaSlotRuntime'

/** Read-only bridge to the workspace's canonical named media pools. Runtime
 * selections are transient; this interface never mutates the pool or preset. */
export interface Cinema2MediaPoolSource {
  getSelection(): Readonly<{ id: string; mediaIds: readonly string[] }> | null
  resolve(mediaId: string): Promise<Readonly<Cinema2MediaSource> | null>
}
