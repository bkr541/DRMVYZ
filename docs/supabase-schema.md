# DRMVYZ Supabase Schema

## Overview

21 tables across 3 views plus shared infrastructure. All tables have Row-Level Security (RLS) enabled — users can only read/write their own rows.

## Quick Start

1. Copy env file: `cp .env.example .env`
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project dashboard (Settings → API)
3. Apply migrations in order: paste each file from `supabase/migrations/` into the Supabase SQL editor, or run `supabase db push` with the CLI

## Tables

### Shared / Auth

| Table | Purpose |
|-------|---------|
| `profiles` | Mirrors `auth.users`; auto-created on signup via trigger |
| `sessions` | App usage sessions (start/end time, client info) |
| `user_settings` | Per-user preferences (theme, default view, FFT size, volume) |
| `tags` | User-defined labels |
| `audio_track_tags` | M2M: tracks ↔ tags |
| `media_item_tags` | M2M: media items ↔ tags |

#### `profiles` columns

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK — references `auth.users(id)` |
| `email` | `text` | Copied from `auth.users.email` |
| `display_name` | `text` | From signup metadata `display_name` |
| `artist_name` | `text` | From signup metadata `artist_name` (added in migration 0004) |
| `avatar_url` | `text` | User-uploaded avatar |
| `created_at` | `timestamptz` | Auto-set |
| `updated_at` | `timestamptz` | Auto-updated via trigger |

### Analyzer View

| Table | Purpose |
|-------|---------|
| `audio_tracks` | Uploaded/imported audio files (metadata + storage path) |
| `track_analyses` | Cached offline analysis: LUFS, BPM, spectrum, stereo, bands |
| `analyzer_sessions` | Per-session settings: FFT size, smoothing, source, volume |
| `ring_buffer_exports` | WAV export records from the ring buffer |
| `bpm_detections` | History of BPM detection runs per track |

### Reference View

| Table | Purpose |
|-------|---------|
| `reference_sessions` | A comparison session: 1 main track + view mode + transport options |
| `reference_slots` | The 3 reference track slots within a session |
| `reference_comparisons` | Cached match scores (overall + per-metric diffs) |

### VYZUALZ View

| Table | Purpose |
|-------|---------|
| `effect_chain_options` | Shared app-wide catalog of every Effect Chain option (metadata only — not session state) |
| `media_items` | Uploaded images and videos for canvas (metadata + storage path) |
| `visual_presets` | Saved effect presets (name, color, full VzEffects snapshot) |
| `visual_sessions` | Per-session canvas state (active preset, media, BPM, effects) |
| `canvas_exports` | Recorded/exported canvas frames |

#### Media mutation integrity

`media_items.revision` is the canonical optimistic-concurrency token. Existing rows begin at revision `1`, and the database advances the token only when a media-row update commits. The client must reconcile from the canonical item returned by `save_media_item_atomic`; it must not invent the next revision.

`save_media_item_atomic` locks and ownership-checks the media row, verifies the expected revision, validates owned collections, updates supported metadata, replaces tags and collection memberships, and returns the complete canonical item in one transaction. `reorder_media_collection_atomic` validates the complete owned membership set and applies the final order in one bulk transaction. Collection-membership writes lock their parent collection so edits, uploads, deletes, and reorders cannot interleave into a partial order. Both RPCs are executable only by authenticated users and retain explicit ownership checks in addition to RLS.

#### Recoverable media upload and deletion

Migration `0024_media_upload_deletion_recovery.sql` adds a user-scoped `upload_operation_id`, lifecycle state, and canonical derivative-path metadata to `media_items`. Uploads use deterministic paths under `<user_id>/uploads/<operation_id>/`, and `(user_id, upload_operation_id)` is unique so retrying the same logical operation reconciles one canonical row.

`begin_media_upload` durably binds the operation to its exact original and derivative paths before storage work begins. `finalize_media_upload_atomic` creates or reconciles the media row, role, tags, collections, derivative state, and revision in one database transaction. A pre-created upload rollback record means an interrupted or failed cross-system upload always retains owned cleanup paths. Successful finalization closes that rollback record so a stale client cannot later delete canonical storage.

Deletion is a tombstone workflow. `request_media_deletion` ownership-checks and locks the media row, captures the original, thumbnail, filmstrip, and all known derivative paths, creates an idempotent cleanup job, and moves the row out of the normal library with `deletion_pending`. The client removes only those exact paths and persists progress after each object. `finalize_media_deletion` deletes the canonical row, and its tag and collection relationships through foreign-key behavior, only after every recorded path is complete. Failed cleanup remains user-visible and retryable through `media_cleanup_jobs`; RLS and RPC path validation prevent cross-user, traversal, or broad-prefix cleanup.

#### `effect_chain_options` columns

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` | PK — stable camelCase identifier (e.g. `rgbSplit`, `beatFlash`) |
| `chain_name` | `text` | Exact user-facing label used by the Effect Chain panel and `enabledFx` logic (e.g. `'RGB Split'`) |
| `effect_key` | `text` | Related `VzEffects` property key used by `EffectControlsPanel` (mirrors `EFFECT_CONTROL_CHAIN_MAP`) |
| `description` | `text` | Human-readable description for tooltips, filtering, and effect browsers |
| `category` | `text` | `VzEffectCategory` value: `color`, `distortion`, `audioReactive`, `generative`, `post`, or `utility` |
| `control_group` | `text` | Related controls section: `Global`, `Motion`, `Audio Reactive`, `Distortion`, or `Lighting / Atmosphere` |
| `sort_order` | `integer` | Display order matching `EFFECT_CHAIN_ITEMS` in `EffectChainPanel.tsx` |
| `is_available` | `boolean` | `false` hides a retired effect without deleting its metadata |
| `created_at` | `timestamptz` | Auto-set |
| `updated_at` | `timestamptz` | Auto-updated via trigger |

**Architecture note:** `effect_chain_options` is the single source of truth for _what effects exist_ and what they mean. It intentionally does not store session or preset state. `visual_sessions` and `visual_presets` continue to own all per-user enabled-effect values and slider state. Descriptions and categories are not duplicated into those tables.

**Effect catalog — rows added by migration (cumulative):**

| sort_order | id | chain_name | category | control_group |
|---|---|---|---|---|
| 27 | `pixelDistortion` | Pixel Distortion | distortion | Distortion |
| 28 | `frameQuantization` | Frame Quantization | distortion | Motion |

Rows 1–26 were seeded by `0008_effect_chain_options.sql`. Rows 27–28 added by `0009_distortion_pixels_effect_options.sql` for the **Distortion Pixels** built-in preset.

## Storage Buckets

| Bucket | Max Size | Allowed Types |
|--------|----------|---------------|
| `audio-tracks` | 500 MB | MP3, WAV, AIFF, FLAC, OGG, M4A |
| `media-items` | 200 MB | JPEG, PNG, GIF, WebP, MP4, WebM, MOV |
| `ring-buffers` | 100 MB | WAV |
| `canvas-exports` | 100 MB | PNG, JPEG, WebM, GIF |

All buckets are private. Storage RLS policies enforce that each user can only access files under their own `user_id/` path prefix.

## TypeScript Types

All types are in [`src/types/database.ts`](../src/types/database.ts). The `Database` interface is passed to `createClient<Database>()` in [`src/lib/supabase.ts`](../src/lib/supabase.ts) for end-to-end type safety.

## Security

- **No secrets in code**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are loaded from environment variables only
- **Anon key is safe for the client**: it only grants access to public schema with RLS enforced
- **Never use the service role key** (`SUPABASE_SERVICE_ROLE_KEY`) client-side
- `.env` is in `.gitignore`; only `.env.example` (with placeholder values) is committed

## Adding the Supabase Client to a Component

```typescript
import { supabase } from '../lib/supabase'

// Typed query example
const { data, error } = await supabase
  .from('audio_tracks')
  .select('*')
  .order('created_at', { ascending: false })
```

## Auth

Supabase Auth is pre-wired. On `auth.users` insert, a trigger auto-creates a `profiles` row and `user_settings` row. The trigger copies `display_name` and `artist_name` from `raw_user_meta_data`, which the client sets during signup:

```typescript
await supabase.auth.signUp({
  email,
  password,
  options: { data: { display_name: name, artist_name: artistName } },
})
```

Use `supabase.auth.signInWithOAuth`, `signInWithPassword`, etc. as usual.
