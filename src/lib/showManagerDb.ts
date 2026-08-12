import type { SupabaseClient } from '@supabase/supabase-js'
import {
  normalizeShowManagerShowRecord,
  type ShowManagerShowRecord,
} from '../components/vyzualz/showManager/ShowManagerDomain'
import {
  normalizeCanvasShowManagerShows,
  type CanvasShowManagerShow,
} from '../components/vyzualz/showManager/CanvasShowManagerDomain'
import {
  normalizeLaserDmxShowManagerShows,
  type LaserDmxShowManagerShow,
} from '../components/vyzualz/showManager/LaserDmxShowManagerDomain'
import { supabase, supabaseConfigured } from './supabase'
import type { Json, ShowEngineConfigRow, ShowRow } from '../types/database'

// Isolate the generic client widening here, consistent with mediaDb/audioDb.
const db = supabase as unknown as SupabaseClient
const SHOW_MANAGER_CLOUD_REVISION_CACHE_PREFIX = 'drmvyz:show-manager-cloud-revisions:v1:'

function revisionCacheKey(userId: string): string {
  return `${SHOW_MANAGER_CLOUD_REVISION_CACHE_PREFIX}${userId}`
}

function readRevisionCache(userId: string): Record<string, number> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(revisionCacheKey(userId)) ?? '{}')
    if (!isRecord(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).flatMap(([showId, value]) => {
      const revision = asRevision(value)
      return revision ? [[showId, revision]] : []
    }))
  } catch {
    return {}
  }
}

function replaceRevisionCache(userId: string, bundles: readonly ShowManagerCloudBundle[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      revisionCacheKey(userId),
      JSON.stringify(Object.fromEntries(bundles.map(bundle => [bundle.show.id, bundle.revision]))),
    )
  } catch {
    // Revision metadata is only an offline concurrency aid; Supabase remains authoritative.
  }
}

function rememberRevision(userId: string, showId: string, revision: number): void {
  if (typeof localStorage === 'undefined') return
  try {
    const cache = readRevisionCache(userId)
    cache[showId] = revision
    localStorage.setItem(revisionCacheKey(userId), JSON.stringify(cache))
  } catch {
    // Best-effort cache only.
  }
}

function forgetRevision(userId: string, showId: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    const cache = readRevisionCache(userId)
    delete cache[showId]
    localStorage.setItem(revisionCacheKey(userId), JSON.stringify(cache))
  } catch {
    // Best-effort cache only.
  }
}

export interface ShowManagerCloudBundle {
  show: ShowManagerShowRecord
  canvas: CanvasShowManagerShow | null
  laserDmx: LaserDmxShowManagerShow | null
  revision: number
}

export type ShowManagerCloudFailureKind = 'validation' | 'conflict' | 'authorization' | 'transport' | 'unexpected'

export type ShowManagerCloudListResult =
  | { ok: true; mode: 'cloud'; bundles: ShowManagerCloudBundle[]; userId: string }
  | { ok: true; mode: 'local-fallback'; bundles: []; userId: null }
  | { ok: false; kind: ShowManagerCloudFailureKind; message: string; code?: string }

export type ShowManagerCloudSaveResult =
  | { ok: true; mode: 'cloud'; bundle: ShowManagerCloudBundle; userId: string }
  | { ok: true; mode: 'local-fallback'; bundle: null; userId: null }
  | { ok: false; kind: ShowManagerCloudFailureKind; message: string; code?: string; currentRevision?: number }

export type ShowManagerCloudDeleteResult =
  | { ok: true; mode: 'cloud'; userId: string }
  | { ok: true; mode: 'local-fallback'; userId: null }
  | { ok: false; kind: ShowManagerCloudFailureKind; message: string; code?: string; currentRevision?: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRevision(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
  }
  return null
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}

function parseFailure(
  data: unknown,
  fallback: string,
): { ok: false; kind: ShowManagerCloudFailureKind; message: string; code?: string; currentRevision?: number } {
  if (!isRecord(data)) return { ok: false, kind: 'unexpected', message: fallback }
  const message = typeof data.message === 'string' ? data.message : fallback
  const code = typeof data.error_code === 'string' ? data.error_code : undefined
  const currentRevision = asRevision(data.current_revision) ?? undefined
  switch (data.status) {
    case 'validation_failure':
      return { ok: false, kind: 'validation', message, ...(code ? { code } : {}) }
    case 'conflict':
      return { ok: false, kind: 'conflict', message, ...(code ? { code } : {}), ...(currentRevision ? { currentRevision } : {}) }
    case 'authorization_failure':
      return { ok: false, kind: 'authorization', message, ...(code ? { code } : {}) }
    default:
      return { ok: false, kind: 'unexpected', message, ...(code ? { code } : {}) }
  }
}

async function resolveCloudUser(): Promise<
  | { ok: true; mode: 'cloud'; userId: string }
  | { ok: true; mode: 'local-fallback'; userId: null }
  | { ok: false; kind: 'transport' | 'authorization'; message: string; code?: string }
> {
  if (!supabaseConfigured) return { ok: true, mode: 'local-fallback', userId: null }
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      const authSessionMissing = /auth session missing|session.*missing/i.test(error.message ?? '')
      return {
        ok: false,
        kind: authSessionMissing ? 'authorization' : 'transport',
        message: authSessionMissing
          ? 'Sign in before using Supabase Show Manager persistence.'
          : error.message || 'The signed-in user could not be verified for Show Manager persistence.',
        ...(typeof error.status === 'number' ? { code: String(error.status) } : {}),
      }
    }
    if (!data.user?.id) {
      return { ok: false, kind: 'authorization', message: 'Sign in before using Supabase Show Manager persistence.' }
    }
    return { ok: true, mode: 'cloud', userId: data.user.id }
  } catch (error) {
    return {
      ok: false,
      kind: 'transport',
      message: error instanceof Error ? error.message : 'Show Manager authentication failed unexpectedly.',
    }
  }
}

function parseShowRow(row: ShowRow): { show: ShowManagerShowRecord; revision: number } | null {
  const revision = asRevision(row.revision)
  if (!revision || typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.linked_audio_track_id !== 'string') return null
  const show = normalizeShowManagerShowRecord({
    schemaVersion: row.schema_version,
    id: row.id,
    name: row.name,
    linkedAudioTrackId: row.linked_audio_track_id,
    tags: row.tags,
    groupId: row.group_id,
    engineIds: row.engine_ids,
    trackMap: row.track_map,
  })
  if (!show.linkedAudioTrackId) return null
  return { show, revision }
}

function parseEnginePayload<T>(
  row: ShowEngineConfigRow,
  normalizer: (raw: unknown) => T[],
): T | null {
  if (!isRecord(row.payload)) return null
  const normalized = normalizer([row.payload])
  return normalized[0] ?? null
}

function assembleBundles(rows: ShowRow[], configRows: ShowEngineConfigRow[]): ShowManagerCloudBundle[] | null {
  const configsByShow = new Map<string, ShowEngineConfigRow[]>()
  for (const config of configRows) {
    const list = configsByShow.get(config.show_id) ?? []
    list.push(config)
    configsByShow.set(config.show_id, list)
  }

  const bundles: ShowManagerCloudBundle[] = []
  for (const row of rows) {
    const parsed = parseShowRow(row)
    if (!parsed) return null
    const configs = configsByShow.get(parsed.show.id) ?? []
    const canvasRow = configs.find(config => config.engine_id === 'canvas') ?? null
    const laserRow = configs.find(config => config.engine_id === 'laserDmx') ?? null
    const canvas = canvasRow ? parseEnginePayload(canvasRow, normalizeCanvasShowManagerShows) : null
    const laserDmx = laserRow ? parseEnginePayload(laserRow, normalizeLaserDmxShowManagerShows) : null

    if (parsed.show.engineIds.includes('canvas') && (!canvas || canvas.id !== parsed.show.id)) return null
    if (parsed.show.engineIds.includes('laserDmx') && (!laserDmx || laserDmx.id !== parsed.show.id)) return null

    bundles.push({ ...parsed, canvas, laserDmx })
  }
  return bundles
}

export async function listShowManagerCloudBundles(): Promise<ShowManagerCloudListResult> {
  const user = await resolveCloudUser()
  if (!user.ok) return user
  if (user.mode === 'local-fallback') return { ok: true, mode: 'local-fallback', bundles: [], userId: null }

  try {
    // Fetch the registry row and its engine payloads in one PostgREST query so
    // a concurrent Save cannot leave this client combining two different revisions.
    const { data: showData, error: showError } = await db
      .from('shows')
      .select('*, show_engine_configs(*)')
      .eq('user_id', user.userId)
      .order('updated_at', { ascending: false })
    if (showError) {
      return { ok: false, kind: 'transport', message: showError.message, ...(showError.code ? { code: showError.code } : {}) }
    }

    const joinedRows = (showData as Array<ShowRow & { show_engine_configs?: ShowEngineConfigRow[] | null }> | null) ?? []
    if (joinedRows.length === 0) {
      replaceRevisionCache(user.userId, [])
      return { ok: true, mode: 'cloud', bundles: [], userId: user.userId }
    }
    const rows = joinedRows.map(({ show_engine_configs: _configs, ...row }) => row as ShowRow)
    const configRows = joinedRows.flatMap(row => row.show_engine_configs ?? [])
    const bundles = assembleBundles(rows, configRows)
    if (!bundles) {
      return { ok: false, kind: 'unexpected', message: 'Supabase returned malformed or incomplete Show Manager data.' }
    }
    replaceRevisionCache(user.userId, bundles)
    return { ok: true, mode: 'cloud', bundles, userId: user.userId }
  } catch (error) {
    return {
      ok: false,
      kind: 'transport',
      message: error instanceof Error ? error.message : 'The Show library could not be loaded from Supabase.',
    }
  }
}

export async function saveShowManagerCloudBundle(
  bundle: Omit<ShowManagerCloudBundle, 'revision'>,
  expectedRevision: number | null,
  intent: 'create' | 'update' = 'update',
): Promise<ShowManagerCloudSaveResult> {
  const user = await resolveCloudUser()
  if (!user.ok) return user
  if (user.mode === 'local-fallback') return { ok: true, mode: 'local-fallback', bundle: null, userId: null }

  const { show } = bundle
  const resolvedExpectedRevision = intent === 'create'
    ? null
    : expectedRevision ?? readRevisionCache(user.userId)[show.id] ?? null
  if (intent === 'update' && resolvedExpectedRevision == null) {
    return {
      ok: false,
      kind: 'conflict',
      message: 'Reload the Show library once while online before saving this locally recovered Show.',
    }
  }
  if (!show.linkedAudioTrackId) {
    return { ok: false, kind: 'validation', message: 'A Show must be linked to a persisted Audio Library track before it can be saved to Supabase.' }
  }
  if (show.engineIds.includes('canvas') && !bundle.canvas) {
    return { ok: false, kind: 'validation', message: 'The Show references Canvas but its Canvas authoring payload is unavailable.' }
  }
  if (show.engineIds.includes('laserDmx') && !bundle.laserDmx) {
    return { ok: false, kind: 'validation', message: 'The Show references LaserDMX but its LaserDMX authoring payload is unavailable.' }
  }

  const engineConfigs: Json[] = []
  if (bundle.canvas) {
    const canvas = { ...bundle.canvas, id: show.id, name: show.name }
    engineConfigs.push(toJson({
      engine_id: 'canvas',
      schema_version: canvas.schemaVersion,
      payload: canvas,
    }))
  }
  if (bundle.laserDmx) {
    const laserDmx = { ...bundle.laserDmx, id: show.id, name: show.name }
    engineConfigs.push(toJson({
      engine_id: 'laserDmx',
      schema_version: laserDmx.schemaVersion,
      payload: laserDmx,
    }))
  }

  try {
    const { data, error } = await db.rpc('save_show_bundle', {
      p_show_id: show.id,
      p_expected_revision: resolvedExpectedRevision,
      p_show: toJson({
        name: show.name,
        linked_audio_track_id: show.linkedAudioTrackId,
        tags: show.tags,
        group_id: show.groupId,
        engine_ids: show.engineIds,
        track_map: show.trackMap,
        schema_version: show.schemaVersion,
      }),
      p_engine_configs: engineConfigs,
    })
    if (error) {
      return { ok: false, kind: 'transport', message: error.message, ...(error.code ? { code: error.code } : {}) }
    }
    if (!isRecord(data)) return { ok: false, kind: 'unexpected', message: 'The Show save RPC returned malformed data.' }
    if (data.status !== 'success') return parseFailure(data, 'The Show could not be saved.')
    if (!isRecord(data.show) || !Array.isArray(data.engine_configs)) {
      return { ok: false, kind: 'unexpected', message: 'The Show save RPC returned an incomplete success payload.' }
    }

    const assembled = assembleBundles(
      [data.show as unknown as ShowRow],
      data.engine_configs as unknown as ShowEngineConfigRow[],
    )
    if (!assembled?.[0]) {
      return { ok: false, kind: 'unexpected', message: 'The saved Show could not be normalized after persistence.' }
    }
    rememberRevision(user.userId, show.id, assembled[0].revision)
    return { ok: true, mode: 'cloud', bundle: assembled[0], userId: user.userId }
  } catch (error) {
    return {
      ok: false,
      kind: 'transport',
      message: error instanceof Error ? error.message : 'Unexpected Show Manager persistence failure.',
    }
  }
}

export async function deleteShowManagerCloudShow(
  showId: string,
  expectedRevision: number | null,
): Promise<ShowManagerCloudDeleteResult> {
  const user = await resolveCloudUser()
  if (!user.ok) return user
  if (user.mode === 'local-fallback') return { ok: true, mode: 'local-fallback', userId: null }
  const resolvedExpectedRevision = expectedRevision ?? readRevisionCache(user.userId)[showId] ?? null
  if (resolvedExpectedRevision == null) {
    return { ok: false, kind: 'conflict', message: 'Reload the Show library once while online before deleting this locally recovered Show.' }
  }

  try {
    const { data, error } = await db.rpc('delete_show', {
      p_show_id: showId,
      p_expected_revision: resolvedExpectedRevision,
    })
    if (error) {
      return { ok: false, kind: 'transport', message: error.message, ...(error.code ? { code: error.code } : {}) }
    }
    if (!isRecord(data)) return { ok: false, kind: 'unexpected', message: 'The Show delete RPC returned malformed data.' }
    if (data.status !== 'success') return parseFailure(data, 'The Show could not be deleted.')
    forgetRevision(user.userId, showId)
    return { ok: true, mode: 'cloud', userId: user.userId }
  } catch (error) {
    return {
      ok: false,
      kind: 'transport',
      message: error instanceof Error ? error.message : 'Unexpected Show Manager deletion failure.',
    }
  }
}
