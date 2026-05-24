import { supabase, supabaseConfigured } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../types/database'

// Use the untyped client to avoid the custom Database generic fighting .update()
const db = supabase as unknown as SupabaseClient

export type ProfilePatch = Pick<Profile, 'display_name' | 'artist_name'>

export interface ProfileResult {
  profile: Profile | null
  error: string | null
}

export interface AvatarUploadResult {
  avatarUrl: string | null
  error: string | null
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<ProfileResult> {
  if (!supabaseConfigured) return { profile: null, error: 'Supabase not configured' }
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { profile: (data as Profile) ?? null, error: (error as { message: string } | null)?.message ?? null }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateProfile(
  userId: string,
  patch: Partial<ProfilePatch>,
): Promise<{ error: string | null }> {
  if (!supabaseConfigured) return { error: 'Supabase not configured' }
  const { error } = await db
    .from('profiles')
    .update(patch)
    .eq('id', userId)
  return { error: (error as { message: string } | null)?.message ?? null }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<AvatarUploadResult> {
  if (!supabaseConfigured) return { avatarUrl: null, error: 'Supabase not configured' }

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${userId}/avatar-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return { avatarUrl: null, error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(path)

  const { error: updateError } = await db
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId)

  if (updateError) return { avatarUrl: null, error: (updateError as { message: string }).message }

  return { avatarUrl: publicUrl, error: null }
}
