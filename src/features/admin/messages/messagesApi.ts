import { supabase } from '../../../lib/supabase'
import type { Announcement } from '../../announcements/announcements'
import { adminDb, adminRequest, AdminApiError } from '../adminApi'
import { draftToRow, normalizeStats, type AnnouncementDraft, type AnnouncementStats } from './announcementForm'

export const loadAnnouncements = () => adminRequest<Announcement[]>(() => adminDb.from('announcements').select('*').order('created_at', { ascending: false })).then(rows => rows ?? [])

export const loadAnnouncementStats = () => adminRequest<Parameters<typeof normalizeStats>[0][]>(() => adminDb.rpc('admin_announcement_stats')).then(rows => (rows ?? []).map(normalizeStats))

export async function saveAnnouncement(id: string | null, draft: AnnouncementDraft): Promise<Announcement> {
  const row = draftToRow(draft)
  if (id) return adminRequest<Announcement>(() => adminDb.from('announcements').update(row).eq('id', id).select('*').single())
  const { data } = await supabase.auth.getUser()
  return adminRequest<Announcement>(() => adminDb.from('announcements').insert({ ...row, created_by: data.user?.id ?? null }).select('*').single())
}

export const setAnnouncementActive = (id: string, isActive: boolean) =>
  adminRequest<Announcement>(() => adminDb.from('announcements').update({ is_active: isActive }).eq('id', id).select('*').single())

export const deleteAnnouncement = (id: string) => adminRequest<null>(() => adminDb.from('announcements').delete().eq('id', id)).then(() => undefined)

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Uploads an announcement image to the public announcements bucket (admins only) and returns its public address. */
export async function uploadAnnouncementImage(file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new AdminApiError('Choose a JPEG, PNG, WebP or GIF image.')
  if (file.size > MAX_IMAGE_BYTES) throw new AdminApiError('The image can be at most 5 MB.')
  const extension = file.type.split('/')[1]!.replace('jpeg', 'jpg')
  const path = `${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('announcements').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new AdminApiError(error.message)
  return supabase.storage.from('announcements').getPublicUrl(path).data.publicUrl
}
