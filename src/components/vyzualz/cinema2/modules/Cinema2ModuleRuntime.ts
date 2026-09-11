import type {
  Cinema2JsonValue,
  Cinema2ModuleId,
  Cinema2ModuleManifest,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2CompiledPresetPlan } from '../presets/Cinema2PresetCompiler'
import type {
  Cinema2FinalValueResolver,
  Cinema2TargetContribution,
  Cinema2TargetHandle,
  Cinema2TargetId,
  Cinema2TargetUserAuthority,
} from '../parameters/Cinema2TargetRuntime'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleFrameReadContext,
  Cinema2ModuleInstance,
  Cinema2ModuleMediaFacet,
  Cinema2ModuleParameterReadFacet,
  Cinema2ModuleRenderPassProvider,
  Cinema2ModuleTargetFacet,
} from './Cinema2ModuleContracts'
import { Cinema2ModuleRegistry } from './Cinema2ModuleRegistry'
import { Cinema2ModuleResourceScope } from './Cinema2ModuleResources'
import { Cinema2MediaSlotRuntime } from '../media/Cinema2MediaSlotRuntime'

export type Cinema2ModuleRuntimeStatus = 'inactive' | 'active' | 'failed' | 'disposed'

export interface Cinema2ModuleInstanceSnapshot {
  moduleId: Cinema2ModuleId
  status: Cinema2ModuleRuntimeStatus
  activeResourceLeaseCount: number
  renderProviderCount: number
  diagnostics: readonly Cinema2ModuleDiagnostic[]
}

export interface Cinema2ModuleRuntimeSnapshot {
  activeModuleCount: number
  failedModuleCount: number
  activeResourceLeaseCount: number
  modules: readonly Readonly<Cinema2ModuleInstanceSnapshot>[]
}

interface ModuleRecord {
  module: Readonly<Cinema2ModuleManifest>
  status: Cinema2ModuleRuntimeStatus
  instance: Cinema2ModuleInstance | null
  resources: Cinema2ModuleResourceScope | null
  parameters: Cinema2ModuleParameterReadFacet
  targets: Cinema2ModuleTargetFacet
  media: Cinema2ModuleMediaFacet
  diagnostics: Cinema2ModuleDiagnostic[]
}

/**
 * Runtime host for authored module instances. It owns lifecycle coordination
 * and tracked resource scopes; module code owns only local creative/simulation
 * state and optional render providers.
 */
export class Cinema2ModuleRuntime {
  private readonly records: ModuleRecord[]
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    plan: Readonly<Cinema2CompiledPresetPlan>,
    targetResolver: Cinema2FinalValueResolver,
    private readonly registry: Cinema2ModuleRegistry,
    mediaRuntime: Cinema2MediaSlotRuntime,
  ) {
    const moduleTargets = indexModuleTargets(plan.targets.targets)
    this.records = (plan.manifest.modules ?? []).map(module => ({
      module,
      status: 'inactive' as const,
      instance: null,
      resources: null,
      parameters: createParameterFacet(module, moduleTargets.get(module.id) ?? new Map(), targetResolver),
      targets: createTargetFacet(targetResolver),
      media: createMediaFacet(module, mediaRuntime),
      diagnostics: [],
    }))
  }

  activate(): void {
    if (this.disposed) return
    for (const record of this.records) {
      if (record.module.enabled === false || record.status !== 'inactive') continue
      this.activateRecord(record)
    }
  }

  update(frame: Readonly<Cinema2ModuleFrameReadContext>): void {
    if (this.disposed) return
    for (const record of this.records) {
      if (record.status !== 'active' || !record.instance) continue
      try {
        record.instance.lifecycle.update({ frame, parameters: record.parameters, targets: record.targets })
      } catch (error) {
        this.failRecord(record, 'CINEMA2_MODULE_UPDATE_FAILED', `Module update failed: ${errorMessage(error)}`)
      }
    }
  }

  /** Stage 07 consumes these providers and remains the only frame scheduler. */
  getRenderPassProviders(): readonly Readonly<Cinema2ModuleRenderPassProvider>[] {
    const providers: Cinema2ModuleRenderPassProvider[] = []
    for (const record of this.records) {
      if (record.status !== 'active' || !record.instance?.render) continue
      for (const provider of record.instance.render.providers) {
        providers.push(Object.freeze({
          ...provider,
          moduleId: record.module.id,
          execute: (context: Parameters<Cinema2ModuleRenderPassProvider['execute']>[0]) => {
            if (record.status !== 'active') return
            try {
              provider.execute(context)
            } catch (error) {
              this.failRecord(record, 'CINEMA2_MODULE_RENDER_FAILED', `Module render provider "${provider.id}" failed: ${errorMessage(error)}`)
              throw error
            }
          },
        }))
      }
    }
    return Object.freeze(providers)
  }

  handleContextLost(): void {
    if (this.disposed) return
    for (const record of this.records) {
      if (record.status === 'active') this.retireRecord(record, 'inactive')
    }
  }

  handleContextRestored(): void {
    this.activate()
  }

  getSnapshot(): Readonly<Cinema2ModuleRuntimeSnapshot> {
    const modules = this.records.map(record => Object.freeze({
      moduleId: record.module.id,
      status: record.status,
      activeResourceLeaseCount: record.resources?.getSnapshot().activeLeaseCount ?? 0,
      renderProviderCount: record.instance?.render?.providers.length ?? 0,
      diagnostics: Object.freeze(record.diagnostics.map(diagnostic => Object.freeze({ ...diagnostic }))),
    }))
    return Object.freeze({
      activeModuleCount: modules.filter(module => module.status === 'active').length,
      failedModuleCount: modules.filter(module => module.status === 'failed').length,
      activeResourceLeaseCount: modules.reduce((sum, module) => sum + module.activeResourceLeaseCount, 0),
      modules: Object.freeze(modules),
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const record of this.records) this.retireRecord(record, 'disposed')
  }

  private activateRecord(record: ModuleRecord): void {
    const definition = this.registry.get(record.module.typeId, record.module.version)
    if (!definition) {
      this.failRecord(record, 'CINEMA2_MODULE_TYPE_VERSION_UNAVAILABLE', `No module implementation is registered for "${record.module.typeId}" version ${record.module.version}.`)
      return
    }

    record.diagnostics = []
    const resources = new Cinema2ModuleResourceScope(this.gl, diagnostic => {
      record.diagnostics.push({ ...diagnostic, moduleId: record.module.id })
    })
    const createContext: Cinema2ModuleCreateContext = {
      module: record.module,
      parameters: record.parameters,
      targets: record.targets,
      media: record.media,
      resources,
    }
    try {
      record.resources = resources
      record.instance = definition.create(createContext)
      record.status = 'active'
    } catch (error) {
      resources.disposeAll()
      record.resources = null
      record.instance = null
      record.status = 'failed'
      record.diagnostics.push({
        code: 'CINEMA2_MODULE_CREATE_FAILED',
        path: `module.${record.module.id}`,
        moduleId: record.module.id,
        message: `Module creation failed: ${errorMessage(error)}`,
      })
    }
  }

  private failRecord(record: ModuleRecord, code: string, message: string): void {
    record.diagnostics.push({ code, message, path: `module.${record.module.id}`, moduleId: record.module.id })
    this.retireRecord(record, 'failed')
  }

  private retireRecord(record: ModuleRecord, nextStatus: Cinema2ModuleRuntimeStatus): void {
    if (record.instance) {
      try {
        record.instance.lifecycle.dispose()
      } catch (error) {
        record.diagnostics.push({
          code: 'CINEMA2_MODULE_DISPOSE_FAILED',
          path: `module.${record.module.id}`,
          moduleId: record.module.id,
          message: `Module dispose failed: ${errorMessage(error)}`,
        })
      }
    }
    record.resources?.disposeAll()
    record.instance = null
    record.resources = null
    record.status = nextStatus
  }
}

function indexModuleTargets(
  targets: readonly Readonly<Cinema2TargetHandle>[],
): Map<Cinema2ModuleId, Map<string, Readonly<Cinema2TargetHandle>>> {
  const result = new Map<Cinema2ModuleId, Map<string, Readonly<Cinema2TargetHandle>>>()
  for (const target of targets) {
    if (target.kind !== 'module') continue
    const moduleId = target.ownerId as Cinema2ModuleId
    const properties = result.get(moduleId) ?? new Map<string, Readonly<Cinema2TargetHandle>>()
    properties.set(target.property, target)
    result.set(moduleId, properties)
  }
  return result
}

function createParameterFacet(
  module: Readonly<Cinema2ModuleManifest>,
  targetsByProperty: ReadonlyMap<string, Readonly<Cinema2TargetHandle>>,
  resolver: Cinema2FinalValueResolver,
): Cinema2ModuleParameterReadFacet {
  return Object.freeze({
    getAuthored(name: string): Cinema2JsonValue | undefined {
      return cloneJson(module.parameters?.[name])
    },
    resolve(name: string) {
      const target = targetsByProperty.get(name)
      return target ? resolver.resolve(target.id) : null
    },
    get(name: string): Cinema2JsonValue | undefined {
      const target = targetsByProperty.get(name)
      if (!target) return undefined
      const resolved = resolver.resolve(target.id)
      return resolved.ok ? cloneJson(resolved.value) : undefined
    },
  })
}

function createTargetFacet(resolver: Cinema2FinalValueResolver): Cinema2ModuleTargetFacet {
  const facet: Cinema2ModuleTargetFacet = {
    getTarget(targetId: Cinema2TargetId) {
      return resolver.getTarget(targetId)
    },
    resolve(
      targetId: Cinema2TargetId,
      contributions: readonly Readonly<Cinema2TargetContribution>[] = [],
      userAuthority: Cinema2TargetUserAuthority = 'base',
    ) {
      return resolver.resolve(targetId, contributions, userAuthority)
    },
    dispatch(targetId: Cinema2TargetId, contributions: readonly Readonly<Cinema2TargetContribution>[]) {
      return resolver.dispatch(targetId, contributions)
    },
  }
  return Object.freeze(facet)
}

function createMediaFacet(
  module: Readonly<Cinema2ModuleManifest>,
  mediaRuntime: Cinema2MediaSlotRuntime,
): Cinema2ModuleMediaFacet {
  return Object.freeze({
    get(bindingName: string) {
      const slot = module.media?.[bindingName]
      return slot ? mediaRuntime.getManagedResource(slot.$ref) : null
    },
    getSlot(bindingName: string) {
      const slot = module.media?.[bindingName]
      return slot ? mediaRuntime.getSlotSnapshot(slot.$ref) : null
    },
  })
}

function cloneJson<T extends Cinema2JsonValue | undefined>(value: T): T {
  if (value === undefined || value === null || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value)) as T
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
