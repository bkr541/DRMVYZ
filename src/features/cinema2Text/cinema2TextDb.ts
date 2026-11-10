import type { SupabaseClient } from '@supabase/supabase-js'
import type { Cinema2SavedTextRow, Cinema2TextPoolRow, Cinema2TextPoolEntryRow } from '../../types/database'
import { supabase } from '../../lib/supabase'
import {
  type Cinema2TextPresetId, type TextParameters, type Cinema2SavedText, type Cinema2TextPool, type Cinema2TextMembership, type Cinema2TextLibraryData,
} from '../../components/vyzualz/cinema2/text/Cinema2TextConfiguration'

const db = supabase as unknown as SupabaseClient
export interface Cinema2TextRepository {
  load(userId: string): Promise<Cinema2TextLibraryData>
  insertRecords(userId: string, records: Cinema2SavedText[]): Promise<void>
  insertPools(userId: string, pools: Cinema2TextPool[]): Promise<void>
  insertMemberships(userId: string, memberships: Cinema2TextMembership[]): Promise<void>
}
async function readAll<Row>(table: string, columns: string, userId: string, order: string[]) {
  const rows: Row[] = []
  for (let start = 0; ; start += 1000) {
    let query = db.from(table).select(columns).eq('user_id', userId)
    for (const column of order) query = query.order(column)
    const { data, error } = await query.returns<Row[]>().range(start, start + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) return rows
  }
}
export const cinema2TextRepository: Cinema2TextRepository = {
  async load(userId) {
    const results = await Promise.all([
      readAll<Cinema2SavedTextRow>('cinema2_saved_text', 'id,preset_id,name,schema_version,parameters,created_at', userId, ['preset_id', 'id']),
      readAll<Cinema2TextPoolRow>('cinema2_text_pools', 'id,preset_id,name,created_at', userId, ['preset_id', 'id']),
      readAll<Cinema2TextPoolEntryRow>('cinema2_text_pool_entries', 'preset_id,pool_id,record_id', userId, ['preset_id', 'pool_id', 'record_id']),
    ])
    // The store validates schema versions, parameter values and preset IDs before exposing these external rows.
    return {
      records: results[0].map(row => ({ id: row.id, presetId: row.preset_id as Cinema2TextPresetId, name: row.name, schemaVersion: row.schema_version as 1, parameters: row.parameters as TextParameters, createdAt: row.created_at })),
      pools: results[1].map(row => ({ id: row.id, presetId: row.preset_id as Cinema2TextPresetId, name: row.name, createdAt: row.created_at })),
      memberships: results[2].map(row => ({ presetId: row.preset_id as Cinema2TextPresetId, poolId: row.pool_id, recordId: row.record_id })),
    }
  },
  async insertRecords(userId, records) {
    if (!records.length) return
    const { error } = await db.from('cinema2_saved_text').upsert(records.map(record => ({ user_id: userId, id: record.id, preset_id: record.presetId, name: record.name, schema_version: record.schemaVersion, parameters: record.parameters, created_at: record.createdAt })), { onConflict: 'user_id,preset_id,id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  },
  async insertPools(userId, pools) {
    if (!pools.length) return
    const { error } = await db.from('cinema2_text_pools').upsert(pools.map(pool => ({ user_id: userId, id: pool.id, preset_id: pool.presetId, name: pool.name, created_at: pool.createdAt })), { onConflict: 'user_id,preset_id,id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  },
  async insertMemberships(userId, memberships) {
    if (!memberships.length) return
    const { error } = await db.from('cinema2_text_pool_entries').upsert(memberships.map(item => ({ user_id: userId, preset_id: item.presetId, pool_id: item.poolId, record_id: item.recordId })), { onConflict: 'user_id,preset_id,pool_id,record_id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  },
}
