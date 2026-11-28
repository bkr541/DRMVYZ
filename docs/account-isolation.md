# Account isolation of local data

Beta remediation package 01 (SEC-01, SEC-02). Several accounts can use the same computer without one account's local work appearing in, or being uploaded to, another account.

## What is scoped

The stores that hold user-authored work save through `scopeStorageToAccount` (`src/lib/accountScopedPersistence.ts`):

| Store | Storage name | Holds |
| --- | --- | --- |
| React store | `drmvyz:react-store` (localStorage + IndexedDB `drmvyz-project-state`) | Projects, Cinema 2.0 workspaces, PixGrid projects, media selections and pools, Shows, automation cues, performance pads, user presets |
| Visual store | `drmvyz-visual-store` | User presets, sessions, effect chains, visual preferences |
| Shader library | `drmvyz:shader-library` | User shader scenes, presets, collections, favourites |
| Shader panel | `drmvyz:shader-panel` | Shader routing and panel state |

Each is saved under `<storage name>::account:<user id>`. With no account signed in nothing is read or written.

Stores that were already per account are unchanged: Brand Kit, Appearance, System Settings and the Cinema 2.0 text library clear on sign-out and load per user; the media store clears on every account change; pad sync metadata, the Show cloud-migration markers and lyric recovery drafts are keyed by user id.

## Account changes

`App.tsx` calls `switchPersistenceAccount(userId)` when an account signs in and `switchPersistenceAccount(null)` on sign-out. A switch:

1. stops writes, resets every registered store to its initial state (so the reset never overwrites anyone's saved data), then
2. loads the new account's own data.

A write already under way finishes under the account it was started for. A read that finishes after the account changed is discarded, so a slow load cannot put the previous account's data into the next one. The studio opens only once the signed-in account's data is loaded (a loading screen shows meanwhile).

## Cloud sync

- **Performance pads (SEC-02).** Pad sync starts only after `whenPersistenceAccountReady(userId)`, and it neither reads, pushes nor replaces local pads unless that account's data is the one loaded (`ownsLocalPads`). An unedited stock pad set is never pushed, including the migrated stock set a new account starts with.
- **Shows (SEC-01).** The one-time upload of local Shows to an empty cloud library runs only while the listed account's own library is loaded, and the check is repeated before every upload.

## Data saved before this change

Older builds saved under the unscoped names. On the first start of this build the app records, once per computer, which account's session was cached (`drmvyz:local-data-owner:v1`). Only that account receives the old data, which is moved into its own space and removed from the shared name. Any other account starts clean. If no session was cached, the old data is never handed to anyone.

## Enabling

`main.tsx` imports `lib/accountScopedPersistenceBoot` before anything else, so the stores are created scoped. Without it (unit tests, browser harnesses) storage passes straight through to the unscoped names as before.

## Tests

- `src/lib/accountScopedPersistence.test.ts`: scoping, sign-out, ownership of old data, stale reads, readiness.
- `src/stores/accountIsolation.test.ts`: the two-account regression on the real stores (projects, Shows, pads, presets, Show upload, pad sync).
