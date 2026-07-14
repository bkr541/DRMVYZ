import type { CanvasMediaItem } from '../ReactTypes'
import {
  CANVAS_MEDIA_ROLES,
  type CanvasMediaRole,
  type CanvasMediaRoleResolution,
  type CanvasOrchestrationSettings,
} from './CanvasPerformanceTypes'

function uniqueRoles(roles: readonly CanvasMediaRole[]): CanvasMediaRole[] {
  const allowed = new Set<CanvasMediaRole>(CANVAS_MEDIA_ROLES)
  return [...new Set(roles.filter(role => allowed.has(role)))]
}

function hasToken(item: CanvasMediaItem, token: string): boolean {
  const haystack = [item.name, item.meta, item.libraryRole, ...(item.tags ?? [])]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()
  return haystack.includes(token.toLowerCase())
}

function aspectRatio(item: CanvasMediaItem): number | null {
  if (!item.width || !item.height || item.width <= 0 || item.height <= 0) return null
  return item.width / item.height
}

/**
 * Conservative role fallback based only on existing metadata. It intentionally
 * avoids content analysis and always leaves a generic hero route available.
 */
export function deriveAutomaticCanvasMediaRoles(item: CanvasMediaItem): CanvasMediaRole[] {
  const roles: CanvasMediaRole[] = []
  const ratio = aspectRatio(item)
  const alphaFriendly = item.type === 'svg' || item.hasAlpha === true
  const shortLoop = item.type === 'video' && Boolean(item.loopable || (item.durationSec && item.durationSec <= 16))

  if (hasToken(item, 'transition') || item.libraryRole === 'transition') roles.push('transition')
  if (hasToken(item, 'texture') || item.libraryRole === 'texture') roles.push('texture')
  if (hasToken(item, 'drop')) roles.push('dropAsset')
  if (hasToken(item, 'breakdown') || hasToken(item, 'ambient')) roles.push('breakdownAsset')
  if (hasToken(item, 'build')) roles.push('buildAsset')
  if (hasToken(item, 'intro')) roles.push('introAsset')
  if (hasToken(item, 'outro')) roles.push('outroAsset')

  if (item.libraryRole === 'background_image' || item.libraryRole === 'background_video') roles.push('background')
  if (item.libraryRole === 'overlay' || item.libraryRole === 'transparent_element' || item.libraryRole === 'logo') {
    roles.push('foregroundAccent')
  }
  if (item.libraryRole === 'svg') roles.push('foregroundAccent')

  if (alphaFriendly) {
    roles.push('foregroundAccent')
    if (item.type !== 'video') roles.push('mask')
  }

  if (ratio != null && ratio >= 1.45) roles.push('background', 'hero')
  else if (ratio != null && ratio <= 0.82) roles.push('foregroundAccent', 'alternateHero')
  else roles.push('hero')

  if (shortLoop) roles.push('hero', 'alternateHero', 'dropAsset')
  if (item.energy === 'low') roles.push('breakdownAsset', 'background')
  if (item.energy === 'high' || item.energy === 'peak') roles.push('dropAsset', 'hero')
  if (item.type === 'image' && !alphaFriendly) roles.push('background')
  if (item.type === 'video' && !roles.includes('hero')) roles.push('hero')

  return uniqueRoles(roles.length > 0 ? roles : ['hero'])
}

export function resolveCanvasMediaRoles(
  item: CanvasMediaItem,
  settings: Pick<CanvasOrchestrationSettings, 'mediaRolesById' | 'autoRoleEnabled'>,
): CanvasMediaRoleResolution {
  const explicit = uniqueRoles(settings.mediaRolesById[item.id] ?? [])
  const automatic = settings.autoRoleEnabled ? deriveAutomaticCanvasMediaRoles(item) : []
  const effective: readonly CanvasMediaRole[] = explicit.length > 0 ? explicit : automatic.length > 0 ? automatic : ['hero']
  return { explicit, automatic, effective }
}

export function canvasMediaSupportsAnyRole(
  item: CanvasMediaItem,
  roles: readonly CanvasMediaRole[],
  settings: Pick<CanvasOrchestrationSettings, 'mediaRolesById' | 'autoRoleEnabled'>,
): boolean {
  const effective = resolveCanvasMediaRoles(item, settings).effective
  return roles.some(role => effective.includes(role))
}

export function normalizeCanvasMediaRoleMap(value: unknown): Record<string, CanvasMediaRole[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const normalized: Record<string, CanvasMediaRole[]> = {}
  for (const [mediaId, rawRoles] of Object.entries(value as Record<string, unknown>)) {
    if (!mediaId.trim() || !Array.isArray(rawRoles)) continue
    const roles = uniqueRoles(rawRoles.filter((role): role is CanvasMediaRole => typeof role === 'string' && CANVAS_MEDIA_ROLES.includes(role as CanvasMediaRole)))
    if (roles.length > 0) normalized[mediaId] = roles
  }
  return normalized
}
