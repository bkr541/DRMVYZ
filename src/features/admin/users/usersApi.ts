import { adminDb, adminRequest } from '../adminApi'
import type { AdminUser } from './userDirectory'

/** Every registered user, newest first (migration 0056: admin_list_users, which checks for an admin itself). Read-only. */
export const loadAdminUsers = () => adminRequest<AdminUser[]>(() => adminDb.rpc('admin_list_users')).then(rows => rows ?? [])
