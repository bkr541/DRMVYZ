import { adminDb, adminRequest } from '../adminApi'

/** An invitation to the private beta (migration 0065). Sign-up through the app works only for an invited email. */
export interface BetaInvite { email: string; note: string | null; created_at: string; accepted_at: string | null }

/** Lower case, no surrounding spaces: the form the database stores and checks. */
export const normalizeInviteEmail = (email: string) => email.trim().toLowerCase()
export const isValidInviteEmail = (email: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizeInviteEmail(email)) && email.trim().length <= 320

export const loadBetaInvites = () =>
  adminRequest<BetaInvite[]>(() => adminDb.from('beta_invites').select('email, note, created_at, accepted_at').order('created_at', { ascending: false })).then(rows => rows ?? [])

export const addBetaInvite = (email: string, note: string) =>
  adminRequest<BetaInvite>(() => adminDb.from('beta_invites').insert({ email: normalizeInviteEmail(email), note: note.trim() || null }).select('email, note, created_at, accepted_at').single())

/** Withdraws an invite. An account already created with it is not affected (remove or ban it from the Supabase dashboard). */
export const removeBetaInvite = (email: string) =>
  adminRequest<null>(() => adminDb.from('beta_invites').delete().eq('email', email))
