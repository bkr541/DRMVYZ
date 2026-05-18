# DRMVYZ Supabase Schema

## Overview

21 tables across 3 views plus shared infrastructure. All tables have Row-Level Security (RLS) enabled — users can only read/write their own rows.

## Quick Start

1. Copy env file: `cp .env.example .env`
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project dashboard (Settings → API)
3. Apply migration: paste `supabase/migrations/0001_initial_drmvyz_schema.sql` into the Supabase SQL editor, or run `supabase db push` with the CLI

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
| `media_items` | Uploaded images and videos for canvas (metadata + storage path) |
| `visual_presets` | Saved effect presets (name, color, full VzEffects snapshot) |
| `visual_sessions` | Per-session canvas state (active preset, media, BPM, effects) |
| `canvas_exports` | Recorded/exported canvas frames |

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

Supabase Auth is pre-wired. On `auth.users` insert, a trigger auto-creates a `profiles` row and `user_settings` row. Use `supabase.auth.signInWithOAuth`, `signInWithPassword`, etc. as usual.
