import type { CinemaNodeId, CinemaPortId, CinemaStableId } from '../CinemaIdentifiers'
import type {
  CinemaOutputDescriptor,
  CinemaTextureGraphService,
  CinemaTextureView,
} from '../CinemaRendererContracts'

export interface CinemaTextureHandle extends CinemaTextureView {
  readonly width: number
  readonly height: number
}

interface CinemaTextureRecord {
  view: CinemaTextureHandle
  texture: WebGLTexture | null
}

/**
 * Runtime-only texture graph and opaque-handle registry.
 *
 * Raw WebGLTexture values stay inside this class. Public render-node contracts
 * only receive CinemaTextureView handles, which are serialization-safe shapes
 * with no GPU object attached.
 */
export class CinemaTextureManager implements CinemaTextureGraphService {
  private nextTextureViewId = 1
  private readonly records = new Map<string, CinemaTextureRecord>()
  private readonly publishedOutputs = new Map<string, CinemaTextureView>()
  private disposed = false

  createRuntimeView(input: {
    ownerNodeId: CinemaNodeId
    descriptor: CinemaOutputDescriptor
    width: number
    height: number
    texture: WebGLTexture | null
    existingView?: CinemaTextureView
  }): CinemaTextureHandle {
    this.assertActive()
    const textureViewId = input.existingView?.textureViewId
      ?? (`cinema.runtime.texture.${this.nextTextureViewId++}` as CinemaStableId<'runtime-texture-view'>)
    const view = Object.freeze({
      textureViewId,
      ownerNodeId: input.ownerNodeId,
      descriptor: Object.freeze({ ...input.descriptor }),
      width: Math.max(1, Math.floor(input.width)),
      height: Math.max(1, Math.floor(input.height)),
    }) satisfies CinemaTextureHandle
    this.records.set(textureViewId, { view, texture: input.texture })
    return view
  }

  replaceRuntimeTexture(
    view: CinemaTextureView,
    input: { texture: WebGLTexture | null; width: number; height: number },
  ): CinemaTextureHandle {
    const current = this.records.get(view.textureViewId)
    if (!current) throw new Error(`Unknown Cinema texture view: ${view.textureViewId}`)
    return this.createRuntimeView({
      ownerNodeId: current.view.ownerNodeId,
      descriptor: current.view.descriptor,
      width: input.width,
      height: input.height,
      texture: input.texture,
      existingView: current.view,
    })
  }

  resolveRuntimeTexture(view: CinemaTextureView): WebGLTexture | null {
    return this.records.get(view.textureViewId)?.texture ?? null
  }

  unpublishRuntimeView(view: CinemaTextureView): void {
    for (const [key, published] of this.publishedOutputs) {
      if (published.textureViewId === view.textureViewId) this.publishedOutputs.delete(key)
    }
  }

  releaseRuntimeView(view: CinemaTextureView): void {
    this.records.delete(view.textureViewId)
    this.unpublishRuntimeView(view)
  }

  resolveInput(nodeId: CinemaNodeId, portId: CinemaPortId): CinemaTextureView | null {
    return this.publishedOutputs.get(textureRouteKey(nodeId, portId)) ?? null
  }

  publishOutput(nodeId: CinemaNodeId, portId: CinemaPortId, texture: CinemaTextureView): void {
    this.assertActive()
    if (!this.records.has(texture.textureViewId)) {
      throw new Error(`Cinema cannot publish an unknown texture view: ${texture.textureViewId}`)
    }
    this.publishedOutputs.set(textureRouteKey(nodeId, portId), texture)
  }

  clearPublishedOutputs(): void {
    this.publishedOutputs.clear()
  }

  abandonContext(): void {
    for (const record of this.records.values()) record.texture = null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.records.clear()
    this.publishedOutputs.clear()
  }

  getDiagnostics(): Readonly<{
    textureViewCount: number
    publishedOutputCount: number
  }> {
    return {
      textureViewCount: this.records.size,
      publishedOutputCount: this.publishedOutputs.size,
    }
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('Cinema texture manager is disposed')
  }
}

function textureRouteKey(nodeId: CinemaNodeId, portId: CinemaPortId): string {
  return `${nodeId}\u0000${portId}`
}
