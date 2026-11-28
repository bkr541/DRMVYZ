import { enableAccountScopedPersistence } from './accountScopedPersistence'
import { peekCachedSessionUserId } from './offlineSessionFallback'

// Imported first by main.tsx, before any store is created: from here on, user-authored data is saved per account. The
// account in the cached session is loaded at start-up; App switches to the account that actually signs in (or to none).
enableAccountScopedPersistence(peekCachedSessionUserId())
