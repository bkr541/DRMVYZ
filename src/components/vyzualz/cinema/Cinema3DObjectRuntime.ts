import type * as opentype from 'opentype.js'

import type { CinemaParameterValues, CinemaVector3 } from './CinemaDomain'
import type { CinemaAssetId } from './CinemaIdentifiers'
import {
  CinemaOpenTypeTextMeshCache,
  type CinemaOpenTypeGlyphMetadata,
} from './CinemaOpenTypeTextGeometry'
import {
  createCinemaObjectModelMatrix,
  type CinemaGpuMeshLease,
  type CinemaObject3DRenderService,
} from './CinemaObject3DRenderer'
import type {
  CinemaAssetRuntimeService,
  CinemaCameraUniformSnapshot,
  CinemaViewport,
} from './CinemaRendererContracts'
import {
  CinemaSvgVectorMeshCache,
  compileCinemaSvgAssetSource,
} from './CinemaSvgVectorGeometry'
import type {
  CinemaBounds3D,
  CinemaVectorMeshComponentRanges,
  CinemaVectorMeshRegionRanges,
} from './CinemaVectorGeometry'
import {
  classifyCinema3DObjectInvalidation,
  hydrateCinema3DObjectDefinition,
  serializeCinema3DObjectDefinition,
  getCinema3DObjectSvgCurveTolerance,
  getCinema3DObjectTextTessellation,
  type Cinema3DObjectDefinition,
  type Cinema3DObjectInvalidation,
} from './Cinema3DObjectState'

export type Cinema3DObjectRuntimeStatus = 'unavailable' | 'ready' | 'error'

export interface Cinema3DObjectComponentMetadata {
  components: readonly Readonly<CinemaVectorMeshComponentRanges>[]
  regions: readonly Readonly<CinemaVectorMeshRegionRanges>[]
  glyphs: readonly Readonly<CinemaOpenTypeGlyphMetadata>[]
}

export interface Cinema3DObjectRuntimeSnapshot {
  status: Cinema3DObjectRuntimeStatus
  error: string | null
  meshKey: string | null
  localBounds: Readonly<CinemaBounds3D> | null
  worldBounds: Readonly<CinemaBounds3D> | null
  focusAnchor: CinemaVector3
  metadata: Readonly<Cinema3DObjectComponentMetadata>
  lastInvalidation: Cinema3DObjectInvalidation
}

export interface Cinema3DObjectTextRuntimeSource {
  font: opentype.Font
  fontIdentity?: string
  fontRevision?: string | number
}

export class Cinema3DObjectRuntime {
  private definition: Cinema3DObjectDefinition
  private lease: CinemaGpuMeshLease | null = null
  private status: Cinema3DObjectRuntimeStatus = 'unavailable'
  private error: string | null = null
  private meshKey: string | null = null
  private localBounds: CinemaBounds3D | null = null
  private glyphs: readonly Readonly<CinemaOpenTypeGlyphMetadata>[] = Object.freeze([])
  private lastInvalidation: Cinema3DObjectInvalidation = 'none'
  private disposed = false

  constructor(
    definition: Readonly<Cinema3DObjectDefinition>,
    private readonly renderer: CinemaObject3DRenderService,
    private readonly textCache: CinemaOpenTypeTextMeshCache,
    private readonly svgCache: CinemaSvgVectorMeshCache,
    private readonly onDispose: (runtime: Cinema3DObjectRuntime) => void,
  ) {
    this.definition = canonicalDefinition(definition)
  }

  setDefinition(definition: Readonly<Cinema3DObjectDefinition>): Cinema3DObjectInvalidation {
    this.assertActive()
    return this.applyDefinition(canonicalDefinition(definition))
  }

  setResolvedParameterValues(values: Readonly<CinemaParameterValues>): Cinema3DObjectInvalidation {
    this.assertActive()
    return this.applyDefinition(hydrateCinema3DObjectDefinition(values))
  }

  prepareText(source: Readonly<Cinema3DObjectTextRuntimeSource>): Readonly<Cinema3DObjectRuntimeSnapshot> {
    this.assertActive()
    if (this.definition.source.type !== 'text') return this.fail('Cinema 3D object is not authored with a text source.')
    const authoredIdentity = this.definition.source.fontIdentity.trim() || source.fontIdentity?.trim() || ''
    const assetIdentity = this.definition.source.font?.assetId ?? ''
    const identity = assetIdentity && authoredIdentity
      ? `${assetIdentity}:${authoredIdentity}`
      : assetIdentity || authoredIdentity
    if (!identity) return this.fail('Cinema 3D text source is missing a stable font identity.')
    const result = this.textCache.getOrCompile({
      font: source.font,
      fontIdentity: identity,
      fontRevision: source.fontRevision,
      text: this.definition.source.text,
      tessellation: getCinema3DObjectTextTessellation(this.definition.geometry.quality),
    })
    if (!result.ok) return this.fail(result.error.message)
    if (!result.value.mesh) {
      this.clearMesh()
      this.status = 'unavailable'
      this.error = null
      this.glyphs = result.value.glyphs
      return this.getSnapshot()
    }
    try {
      return this.adoptMesh(result.value.cacheKey, result.value.mesh, result.value.glyphs)
    } catch (error) {
      return this.fail(`Cinema 3D text GPU preparation failed: ${errorMessage(error)}`)
    }
  }

  async prepareSvg(
    assetManager: CinemaAssetRuntimeService,
    signal?: AbortSignal,
  ): Promise<Readonly<Cinema3DObjectRuntimeSnapshot>> {
    this.assertActive()
    if (this.definition.source.type !== 'svg') return this.fail('Cinema 3D object is not authored with an SVG source.')
    const asset = this.definition.source.asset
    if (!asset) return this.fail('Cinema 3D SVG source asset is missing or unavailable.')
    try {
      const result = await compileCinemaSvgAssetSource(
        assetManager,
        this.svgCache,
        asset.assetId as CinemaAssetId,
        { curveTolerance: getCinema3DObjectSvgCurveTolerance(this.definition.geometry.quality) },
        signal,
      )
      if (!result.ok) return this.fail(result.error.message)
      try {
        return this.adoptMesh(result.value.cacheKey, result.value.mesh, Object.freeze([]))
      } catch (error) {
        return this.fail(`Cinema 3D SVG GPU preparation failed: ${errorMessage(error)}`)
      }
    } catch (error) {
      if (signal?.aborted) throw error
      return this.fail(`Cinema 3D SVG source preparation failed: ${errorMessage(error)}`)
    }
  }

  draw(
    viewport: Readonly<CinemaViewport>,
    camera: Readonly<CinemaCameraUniformSnapshot> | null,
  ): boolean {
    if (this.disposed || this.status !== 'ready' || !this.lease) return false
    const scale = this.definition.transform.scale
    try {
      return this.renderer.draw({
        mesh: this.lease,
        viewport,
        camera,
        transform: {
          position: this.definition.transform.position,
          rotation: this.definition.transform.rotation,
          scale: [scale[0], scale[1], scale[2] * this.definition.geometry.extrusionDepth],
          pivot: this.definition.geometry.pivotPolicy === 'center'
            ? this.localBounds?.center ?? [0, 0, 0]
            : [0, 0, 0],
        },
        material: {
          frontColor: this.definition.appearance.frontColor,
          sideColor: this.definition.appearance.sideColor,
          emissiveIntensity: this.definition.appearance.emissiveIntensity,
        },
      })
    } catch (error) {
      this.fail(`Cinema 3D object draw failed: ${errorMessage(error)}`)
      return false
    }
  }

  getSnapshot(): Readonly<Cinema3DObjectRuntimeSnapshot> {
    const localBounds = this.localBounds ? freezeBounds(this.localBounds) : null
    const worldBounds = localBounds ? transformBounds(localBounds, this.definition) : null
    return Object.freeze({
      status: this.status,
      error: this.error,
      meshKey: this.meshKey,
      localBounds,
      worldBounds,
      focusAnchor: worldBounds?.center ?? this.definition.transform.position,
      metadata: Object.freeze({
        components: Object.freeze(this.lease?.components.map(freezeComponent) ?? []),
        regions: Object.freeze(this.lease?.regions.map(freezeRegion) ?? []),
        glyphs: this.glyphs,
      }),
      lastInvalidation: this.lastInvalidation,
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.clearMesh()
    this.onDispose(this)
  }

  private applyDefinition(definition: Cinema3DObjectDefinition): Cinema3DObjectInvalidation {
    const invalidation = classifyCinema3DObjectInvalidation(this.definition, definition)
    this.definition = definition
    this.lastInvalidation = invalidation
    if (invalidation === 'source' || invalidation === 'geometry') this.clearMesh()
    return invalidation
  }

  private adoptMesh(
    meshKey: string,
    mesh: Parameters<CinemaObject3DRenderService['acquireMesh']>[1],
    glyphs: readonly Readonly<CinemaOpenTypeGlyphMetadata>[],
  ): Readonly<Cinema3DObjectRuntimeSnapshot> {
    if (!this.lease || this.meshKey !== meshKey) {
      this.lease?.release()
      this.lease = null
      this.meshKey = null
      this.lease = this.renderer.acquireMesh(meshKey, mesh)
    }
    this.meshKey = meshKey
    this.localBounds = cloneBounds(mesh.bounds)
    this.glyphs = Object.freeze(glyphs.map(glyph => Object.freeze({ ...glyph })))
    this.status = 'ready'
    this.error = null
    return this.getSnapshot()
  }

  private fail(message: string): Readonly<Cinema3DObjectRuntimeSnapshot> {
    this.clearMesh()
    this.status = 'error'
    this.error = message
    return this.getSnapshot()
  }

  private clearMesh(): void {
    this.lease?.release()
    this.lease = null
    this.meshKey = null
    this.localBounds = null
    this.glyphs = Object.freeze([])
    if (!this.disposed) {
      this.status = 'unavailable'
      this.error = null
    }
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('Cinema 3D object runtime is disposed.')
  }
}

export class Cinema3DObjectRuntimeService {
  private readonly textCache = new CinemaOpenTypeTextMeshCache()
  private readonly svgCache = new CinemaSvgVectorMeshCache()
  private readonly objects = new Set<Cinema3DObjectRuntime>()
  private disposed = false

  constructor(private readonly renderer: CinemaObject3DRenderService) {}

  createObject(definition: Readonly<Cinema3DObjectDefinition>): Cinema3DObjectRuntime {
    if (this.disposed) throw new Error('Cinema 3D object runtime service is disposed.')
    const object = new Cinema3DObjectRuntime(
      definition,
      this.renderer,
      this.textCache,
      this.svgCache,
      runtime => this.objects.delete(runtime),
    )
    this.objects.add(object)
    return object
  }

  getDiagnostics(): Readonly<{
    activeObjectCount: number
    textCache: ReturnType<CinemaOpenTypeTextMeshCache['getStats']>
    svgCache: ReturnType<CinemaSvgVectorMeshCache['getStats']>
  }> {
    return Object.freeze({
      activeObjectCount: this.objects.size,
      textCache: this.textCache.getStats(),
      svgCache: this.svgCache.getStats(),
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const object of [...this.objects]) object.dispose()
    this.textCache.clear()
    this.svgCache.clear()
  }
}

function canonicalDefinition(definition: Readonly<Cinema3DObjectDefinition>): Cinema3DObjectDefinition {
  return hydrateCinema3DObjectDefinition(serializeCinema3DObjectDefinition(definition))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function cloneBounds(bounds: Readonly<CinemaBounds3D>): CinemaBounds3D {
  return {
    min: [...bounds.min] as CinemaVector3,
    max: [...bounds.max] as CinemaVector3,
    size: [...bounds.size] as CinemaVector3,
    center: [...bounds.center] as CinemaVector3,
  }
}

function freezeBounds(bounds: Readonly<CinemaBounds3D>): Readonly<CinemaBounds3D> {
  return Object.freeze({
    min: Object.freeze([...bounds.min]) as CinemaVector3,
    max: Object.freeze([...bounds.max]) as CinemaVector3,
    size: Object.freeze([...bounds.size]) as CinemaVector3,
    center: Object.freeze([...bounds.center]) as CinemaVector3,
  })
}

function freezeComponent(component: Readonly<CinemaVectorMeshComponentRanges>): Readonly<CinemaVectorMeshComponentRanges> {
  return Object.freeze({
    componentId: component.componentId,
    front: Object.freeze({ ...component.front }),
    back: Object.freeze({ ...component.back }),
    sides: Object.freeze({ ...component.sides }),
  })
}

function freezeRegion(region: Readonly<CinemaVectorMeshRegionRanges>): Readonly<CinemaVectorMeshRegionRanges> {
  return Object.freeze({
    componentId: region.componentId,
    regionId: region.regionId,
    front: Object.freeze({ ...region.front }),
    back: Object.freeze({ ...region.back }),
    sides: Object.freeze({ ...region.sides }),
  })
}

function transformBounds(bounds: Readonly<CinemaBounds3D>, definition: Readonly<Cinema3DObjectDefinition>): Readonly<CinemaBounds3D> {
  const scale = definition.transform.scale
  const pivot = definition.geometry.pivotPolicy === 'center' ? bounds.center : ([0, 0, 0] as const)
  const matrix = createCinemaObjectModelMatrix({
    position: definition.transform.position,
    rotation: definition.transform.rotation,
    scale: [scale[0], scale[1], scale[2] * definition.geometry.extrusionDepth],
    pivot,
  })
  const points: CinemaVector3[] = []
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) points.push(transformPoint(matrix, [x, y, z]))
    }
  }
  const min: CinemaVector3 = [
    Math.min(...points.map(point => point[0])),
    Math.min(...points.map(point => point[1])),
    Math.min(...points.map(point => point[2])),
  ]
  const max: CinemaVector3 = [
    Math.max(...points.map(point => point[0])),
    Math.max(...points.map(point => point[1])),
    Math.max(...points.map(point => point[2])),
  ]
  return freezeBounds({
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    center: [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5],
  })
}

function transformPoint(matrix: ArrayLike<number>, point: CinemaVector3): CinemaVector3 {
  return [
    matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
    matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
    matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
  ]
}
