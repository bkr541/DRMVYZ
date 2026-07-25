import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import type { ShaderModulationRoute } from '../modulation/shaderModulationTypes'

function cloneRoute(route: ShaderModulationRoute): ShaderModulationRoute {
  return {
    ...route,
    fallbackSources: route.fallbackSources ? [...route.fallbackSources] : undefined,
    fallbackTargetParamIds: route.fallbackTargetParamIds ? [...route.fallbackTargetParamIds] : undefined,
    conditions: route.conditions ? {
      ...route.conditions,
      sectionTypes: route.conditions.sectionTypes ? [...route.conditions.sectionTypes] : undefined,
      excludeSectionTypes: route.conditions.excludeSectionTypes ? [...route.conditions.excludeSectionTypes] : undefined,
      sectionPhases: route.conditions.sectionPhases ? [...route.conditions.sectionPhases] : undefined,
      sectionOccurrences: route.conditions.sectionOccurrences ? [...route.conditions.sectionOccurrences] : undefined,
      dropOccurrences: route.conditions.dropOccurrences ? [...route.conditions.dropOccurrences] : undefined,
      requiredCapabilities: route.conditions.requiredCapabilities ? [...route.conditions.requiredCapabilities] : undefined,
    } : undefined,
  }
}

export function createBuiltInShaderRoute(
  shaderId: string,
  programVersion: number,
  routeKey: string,
  route: Omit<ShaderModulationRoute, 'id' | 'origin' | 'authoredRouteId' | 'authoredProgramVersion' | 'modified'>,
): ShaderModulationRoute {
  return {
    ...route,
    id: `builtin:${shaderId}:${routeKey}`,
    origin: 'built-in',
    authoredRouteId: routeKey,
    authoredProgramVersion: programVersion,
    modified: false,
  }
}

function isBuiltInRoute(route: ShaderModulationRoute): boolean {
  return route.origin === 'built-in' || route.id.startsWith('builtin:')
}

function normalizePersistedRoute(route: ShaderModulationRoute): ShaderModulationRoute {
  if (isBuiltInRoute(route)) {
    return {
      ...route,
      origin: 'built-in',
      authoredRouteId: route.authoredRouteId ?? route.id.split(':').slice(2).join(':'),
      modified: route.modified ?? false,
    }
  }
  return {
    ...route,
    origin: route.origin ?? 'legacy',
    modified: route.modified ?? false,
  }
}

/**
 * Merge authored preset routes with persisted routes without clobbering edits.
 * Stable authoredRouteId values allow untouched routes to receive safe updates,
 * while disabled or modified built-in routes remain exactly as the user left them.
 */
export function resolveShaderRoutesForDefinition(
  def: ShaderDefinition | null | undefined,
  persistedRoutes: readonly ShaderModulationRoute[] | null | undefined,
): ShaderModulationRoute[] {
  const existing = (persistedRoutes ?? []).map(normalizePersistedRoute)
  const authored = def?.performanceProgram?.authoredRoutes ?? []
  if (!authored.length) return existing.map(cloneRoute)

  const byAuthoredId = new Map<string, ShaderModulationRoute>()
  for (const route of existing) {
    if (!isBuiltInRoute(route)) continue
    const key = route.authoredRouteId ?? route.id
    if (!byAuthoredId.has(key)) byAuthoredId.set(key, route)
  }

  const consumedIds = new Set<string>()
  const resolved: ShaderModulationRoute[] = []
  for (const defaultRoute of authored) {
    const key = defaultRoute.authoredRouteId ?? defaultRoute.id
    const saved = byAuthoredId.get(key)
    if (!saved) {
      resolved.push(cloneRoute(defaultRoute))
      continue
    }
    consumedIds.add(saved.id)
    if (saved.modified || saved.enabled === false) {
      resolved.push(cloneRoute(saved))
      continue
    }
    // Untouched route: adopt improved authored behavior while retaining its
    // persisted identity and explicit enabled state.
    resolved.push(cloneRoute({
      ...defaultRoute,
      id: saved.id,
      enabled: saved.enabled,
      origin: 'built-in',
      authoredRouteId: key,
      modified: false,
    }))
  }

  // Preserve user, legacy, future-version, and modified orphaned routes.
  for (const route of existing) {
    if (consumedIds.has(route.id)) continue
    resolved.push(cloneRoute(route))
  }
  return resolved
}

export function markShaderRouteModified(
  route: ShaderModulationRoute,
  patch: Partial<ShaderModulationRoute>,
): ShaderModulationRoute {
  const builtIn = isBuiltInRoute(route)
  return {
    ...route,
    ...patch,
    modified: builtIn ? true : (patch.modified ?? route.modified),
    origin: builtIn ? 'built-in' : (route.origin ?? 'user'),
  }
}

export function createUserShaderRoute(route: ShaderModulationRoute): ShaderModulationRoute {
  return { ...route, origin: 'user', modified: true }
}
