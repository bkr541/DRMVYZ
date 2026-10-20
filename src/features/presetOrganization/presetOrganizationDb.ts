import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../../lib/supabase'

const db = supabase as unknown as SupabaseClient

export interface PresetOrganization {
  tags: string[]
  collectionIds: string[]
}

interface PresetOrganizationRow {
  preset_key: string
  tags: string[] | null
  collection_ids: string[] | null
}

async function currentUserId(): Promise<string | null> {
  if (!supabaseConfigured) return null
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user?.id ?? null
}

export async function loadPresetOrganizations(): Promise<Record<string, PresetOrganization>> {
  const userId = await currentUserId()
  if (!userId) return {}
  const { data, error } = await db
    .from('preset_organization')
    .select('preset_key, tags, collection_ids')
    .eq('user_id', userId)
  if (error) throw error
  return Object.fromEntries(((data ?? []) as PresetOrganizationRow[]).map(row => [
    row.preset_key,
    { tags: [...(row.tags ?? [])], collectionIds: [...(row.collection_ids ?? [])] },
  ]))
}

export async function savePresetOrganization(
  presetKey: string,
  organization: PresetOrganization,
): Promise<boolean> {
  const userId = await currentUserId()
  if (!userId) return false
  const { error } = await db.from('preset_organization').upsert({
    user_id: userId,
    preset_key: presetKey,
    tags: organization.tags,
    collection_ids: organization.collectionIds,
  }, { onConflict: 'user_id,preset_key' })
  return !error
}
