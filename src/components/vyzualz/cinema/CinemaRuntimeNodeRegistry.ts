import {
  createCinemaDiagnostic,
  deduplicateCinemaDiagnostics,
  type CinemaDiagnostic,
} from './CinemaDiagnostics'
import { parseCinemaNamespacedId } from './CinemaIdentifiers'
import type {
  CinemaNodeTypeId,
  CinemaRendererPluginId,
} from './CinemaIdentifiers'
import type { CinemaNodePlugin } from './CinemaRendererContracts'

export interface CinemaRuntimeNodeRegistration {
  pluginId: CinemaRendererPluginId
  plugin: CinemaNodePlugin
}

export interface CinemaRuntimeNodeRegistryCreateResult {
  registry: CinemaRuntimeNodeRegistry
  diagnostics: readonly CinemaDiagnostic[]
}

const CONSTRUCTION_TOKEN = Symbol('CinemaRuntimeNodeRegistry')

/** Runtime-only plugin factory registry. It is never serialized or written to canonical state. */
export class CinemaRuntimeNodeRegistry {
  readonly diagnostics: readonly CinemaDiagnostic[]
  readonly fingerprint: string
  readonly #byPluginId: ReadonlyMap<CinemaRendererPluginId, Readonly<CinemaRuntimeNodeRegistration>>
  readonly #byTypeId: ReadonlyMap<CinemaNodeTypeId, Readonly<CinemaRuntimeNodeRegistration>>

  constructor()
  constructor(
    token: typeof CONSTRUCTION_TOKEN,
    byPluginId: ReadonlyMap<CinemaRendererPluginId, Readonly<CinemaRuntimeNodeRegistration>>,
    byTypeId: ReadonlyMap<CinemaNodeTypeId, Readonly<CinemaRuntimeNodeRegistration>>,
    diagnostics: readonly CinemaDiagnostic[],
  )
  constructor(
    token?: typeof CONSTRUCTION_TOKEN,
    byPluginId: ReadonlyMap<CinemaRendererPluginId, Readonly<CinemaRuntimeNodeRegistration>> = new Map(),
    byTypeId: ReadonlyMap<CinemaNodeTypeId, Readonly<CinemaRuntimeNodeRegistration>> = new Map(),
    diagnostics: readonly CinemaDiagnostic[] = [],
  ) {
    this.#byPluginId = token === CONSTRUCTION_TOKEN ? byPluginId : new Map()
    this.#byTypeId = token === CONSTRUCTION_TOKEN ? byTypeId : new Map()
    this.diagnostics = deduplicateCinemaDiagnostics(token === CONSTRUCTION_TOKEN ? diagnostics : [])
    this.fingerprint = createFingerprint([...this.#byPluginId.values()])
  }

  getByPluginId(pluginId: CinemaRendererPluginId): Readonly<CinemaRuntimeNodeRegistration> | undefined {
    return this.#byPluginId.get(pluginId)
  }

  getByTypeId(typeId: CinemaNodeTypeId): Readonly<CinemaRuntimeNodeRegistration> | undefined {
    return this.#byTypeId.get(typeId)
  }

  hasPlugin(pluginId: CinemaRendererPluginId): boolean {
    return this.#byPluginId.has(pluginId)
  }

  list(): readonly Readonly<CinemaRuntimeNodeRegistration>[] {
    return [...this.#byPluginId.values()].sort((left, right) => compareStrings(left.pluginId, right.pluginId))
  }

  get size(): number {
    return this.#byPluginId.size
  }
}

export function createCinemaRuntimeNodeRegistry(
  registrations: readonly CinemaRuntimeNodeRegistration[],
): CinemaRuntimeNodeRegistryCreateResult {
  const diagnostics: CinemaDiagnostic[] = []
  const byPluginId = new Map<CinemaRendererPluginId, Readonly<CinemaRuntimeNodeRegistration>>()
  const byTypeId = new Map<CinemaNodeTypeId, Readonly<CinemaRuntimeNodeRegistration>>()

  for (const registration of [...registrations].sort((left, right) => compareStrings(
    String(left?.pluginId ?? ''),
    String(right?.pluginId ?? ''),
  ))) {
    if (!registration?.plugin || typeof registration.plugin.createNode !== 'function') {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_NODE_REGISTRY_INVALID',
        severity: 'error',
        message: 'Cinema runtime plugin registration must include a node factory.',
      }))
      continue
    }
    const pluginId = registration.pluginId
    const typeId = registration.plugin.definition.typeId
    const pluginIdResult = parseCinemaNamespacedId(pluginId, 'renderer plugin')
    const typeIdResult = parseCinemaNamespacedId(typeId, 'node type')
    if (!pluginIdResult.ok || !typeIdResult.ok) {
      diagnostics.push(...pluginIdResult.diagnostics, ...typeIdResult.diagnostics)
      continue
    }
    if (byPluginId.has(pluginId)) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_NODE_REGISTRY_DUPLICATE',
        severity: 'error',
        message: `Cinema renderer plugin "${pluginId}" was registered more than once.`,
        details: { pluginId: String(pluginId) },
      }))
      continue
    }
    if (byTypeId.has(typeId)) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_NODE_REGISTRY_INCOMPATIBLE',
        severity: 'error',
        message: `Cinema node type "${typeId}" has more than one runtime renderer plugin.`,
        details: { typeId: String(typeId) },
      }))
      continue
    }
    const frozen = Object.freeze({ pluginId, plugin: registration.plugin })
    byPluginId.set(pluginId, frozen)
    byTypeId.set(typeId, frozen)
  }

  const normalized = deduplicateCinemaDiagnostics(diagnostics)
  return {
    registry: new CinemaRuntimeNodeRegistry(CONSTRUCTION_TOKEN, byPluginId, byTypeId, normalized),
    diagnostics: normalized,
  }
}

function createFingerprint(registrations: readonly Readonly<CinemaRuntimeNodeRegistration>[]): string {
  const value = registrations
    .map(registration => `${registration.pluginId}:${registration.plugin.definition.typeId}:${registration.plugin.definition.version}`)
    .sort(compareStrings)
    .join('|')
  return `cinema-runtime-registry-${fnv1a32(value).toString(16).padStart(8, '0')}`
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
