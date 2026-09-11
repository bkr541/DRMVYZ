import type {
  Cinema2ModuleDiagnostic,
  Cinema2ModuleResourceFacet,
  Cinema2ModuleResourceSnapshot,
} from './Cinema2ModuleContracts'

interface TrackedResource {
  key: string
  kind: string
  value: unknown
  dispose: (value: unknown) => void
}

export class Cinema2ModuleResourceScope implements Cinema2ModuleResourceFacet {
  private readonly resources = new Map<string, TrackedResource>()
  private disposedLeaseCount = 0
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly onDiagnostic: (diagnostic: Cinema2ModuleDiagnostic) => void,
  ) {}

  acquire<T>(
    key: string,
    kind: string,
    create: (gl: WebGL2RenderingContext) => T,
    dispose: (value: T) => void,
  ): T {
    if (this.disposed) throw new Error(`Cinema 2.0 module resource scope is disposed; cannot acquire "${key}".`)
    const normalizedKey = key.trim()
    if (!normalizedKey) throw new Error('Cinema 2.0 module resource keys must be non-empty.')
    const existing = this.resources.get(normalizedKey)
    if (existing) {
      if (existing.kind !== kind) {
        throw new Error(`Cinema 2.0 module resource key \"${normalizedKey}\" is already leased as ${existing.kind}, not ${kind}.`)
      }
      return existing.value as T
    }

    const value = create(this.gl)
    this.resources.set(normalizedKey, {
      key: normalizedKey,
      kind,
      value,
      dispose: candidate => dispose(candidate as T),
    })
    return value
  }

  getSnapshot(): Cinema2ModuleResourceSnapshot {
    return Object.freeze({
      activeLeaseCount: this.resources.size,
      disposedLeaseCount: this.disposedLeaseCount,
    })
  }

  disposeAll(): void {
    if (this.disposed) return
    this.disposed = true
    const resources = [...this.resources.values()].reverse()
    this.resources.clear()
    for (const resource of resources) {
      try {
        resource.dispose(resource.value)
      } catch (error) {
        this.onDiagnostic({
          code: 'CINEMA2_MODULE_RESOURCE_DISPOSE_FAILED',
          path: `resources.${resource.key}`,
          message: `Failed to dispose ${resource.kind} resource "${resource.key}": ${errorMessage(error)}`,
        })
      } finally {
        this.disposedLeaseCount += 1
      }
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
