import type { ShaderDefinition, ShaderParamDef } from '../registry/shaderRegistryTypes'
import type {
  ShaderModulationRoute,
  ModulationValidationError,
} from './shaderModulationTypes'

// Parameter types supported as modulation targets.
// Gradient / enum / texture / trigger cannot be meaningfully driven by 0-1 signals.
const SUPPORTED_TARGET_TYPES = new Set(['float', 'integer', 'boolean', 'color', 'vec2'])

// ── ShaderModulationMatrix ────────────────────────────────────────────────────
//
// Stores and validates modulation routes for one Shader scene.
//
// The matrix is NOT persisted here — the caller serialises `toArray()` into
// the Shader preset model when that task is implemented.  The matrix accepts
// a ShaderDefinition at construction time for validation and updates it via
// `setDefinition()` when the active scene changes.

export class ShaderModulationMatrix {
  private readonly _routes = new Map<string, ShaderModulationRoute>()
  private _def: ShaderDefinition | null = null

  // ── Scene management ──────────────────────────────────────────────────────

  /** Update the active definition.  Routes that no longer resolve are kept but
   *  will be flagged invalid on the next validateAll() call. */
  setDefinition(def: ShaderDefinition | null): void {
    this._def = def
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /**
   * Validate a route against the active definition.
   * Returns an error object on failure, null on success.
   *
   * Validation rules:
   *   1. Target param must exist in the active definition.
   *   2. Target param must have `modulatable: true`.
   *   3. Target param type must be in SUPPORTED_TARGET_TYPES.
   */
  validateRoute(
    route: Pick<ShaderModulationRoute, 'targetParamId' | 'fallbackTargetParamIds'>,
    def: ShaderDefinition = this._def!,
  ): ModulationValidationError | null {
    if (!def) {
      return {
        code: 'TARGET_NOT_FOUND',
        message: 'No active shader definition — cannot validate modulation target.',
      }
    }

    const targetIds = [route.targetParamId, ...(route.fallbackTargetParamIds ?? [])]
    const param = targetIds
      .map(targetId => def.params.find(candidate => candidate.id === targetId))
      .find(candidate => candidate?.modulatable === true && SUPPORTED_TARGET_TYPES.has(candidate.type))
    if (!param) {
      const existing = targetIds.map(targetId => def.params.find(candidate => candidate.id === targetId)).find(Boolean)
      if (!existing) {
        return {
          code: 'TARGET_NOT_FOUND',
          message: `No target in [${targetIds.map(id => `"${id}"`).join(', ')}] exists in shader "${def.id}".`,
        }
      }
      if (!existing.modulatable) {
        return {
          code: 'NOT_MODULATABLE',
          message: `Param "${existing.id}" (${existing.type}) has modulatable: false or is a trigger type — it cannot be driven by modulation.`,
        }
      }
      return {
        code: 'TYPE_NOT_SUPPORTED',
        message: `Param type "${existing.type}" is not supported as a modulation target. Supported types: ${[...SUPPORTED_TARGET_TYPES].join(', ')}.`,
      }
    }

    return null
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Add a route.  Returns null on success, or a validation error.
   * Duplicate IDs silently overwrite the previous entry.
   */
  addRoute(route: ShaderModulationRoute): ModulationValidationError | null {
    if (this._def) {
      const err = this.validateRoute(route)
      if (err) return err
    }
    this._routes.set(route.id, { ...route })
    return null
  }

  removeRoute(id: string): void {
    this._routes.delete(id)
  }

  updateRoute(id: string, patch: Partial<ShaderModulationRoute>): void {
    const existing = this._routes.get(id)
    if (!existing) return
    this._routes.set(id, { ...existing, ...patch })
  }

  /** Enable or disable a route without full validation. */
  setRouteEnabled(id: string, enabled: boolean): void {
    this.updateRoute(id, { enabled })
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  getRoute(id: string): ShaderModulationRoute | undefined {
    return this._routes.get(id)
  }

  /** All routes in insertion order. */
  getRoutes(): ShaderModulationRoute[] {
    return Array.from(this._routes.values())
  }

  /** Routes targeting a specific param, in insertion order. */
  getRoutesForParam(paramId: string): ShaderModulationRoute[] {
    return this.getRoutes().filter(route =>
      route.targetParamId === paramId || route.fallbackTargetParamIds?.includes(paramId),
    )
  }

  /** All routes that are both enabled and pass validation against the active def. */
  getActiveRoutes(): ShaderModulationRoute[] {
    if (!this._def) return []
    return this.getRoutes().filter(r => {
      if (!r.enabled) return false
      return this.validateRoute(r) === null
    })
  }

  /** Re-validate every route. Returns a map of routeId → error (null if valid). */
  validateAll(): Record<string, ModulationValidationError | null> {
    const results: Record<string, ModulationValidationError | null> = {}
    for (const route of this._routes.values()) {
      results[route.id] = this._def ? this.validateRoute(route) : null
    }
    return results
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  /** Serializable snapshot — suitable for Shader preset storage. */
  toArray(): ShaderModulationRoute[] {
    return this.getRoutes()
  }

  /** Restore from a serialised snapshot. Existing routes are replaced. */
  fromArray(routes: ShaderModulationRoute[]): void {
    this._routes.clear()
    for (const r of routes) this._routes.set(r.id, { ...r })
  }

  /** Remove all routes. */
  clear(): void {
    this._routes.clear()
  }

  get size(): number { return this._routes.size }

  // ── Static helpers ────────────────────────────────────────────────────────

  static isTargetTypeSupported(param: ShaderParamDef): boolean {
    return SUPPORTED_TARGET_TYPES.has(param.type)
  }

  /** Params in the definition that can accept modulation routes. */
  static getModulatableParams(def: ShaderDefinition): ShaderParamDef[] {
    return def.params.filter(
      p => p.modulatable === true && SUPPORTED_TARGET_TYPES.has(p.type),
    )
  }
}
