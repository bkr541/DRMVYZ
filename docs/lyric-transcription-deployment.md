# Lyric Transcription — Deployment Guide

## Overview

Automatic lyric extraction runs entirely server-side via the `lyric-transcription` Supabase Edge Function. The browser never touches audio files directly; it invokes the function with an `audio_tracks.id` and the function downloads the file from private storage using a service-role key.

The function version is embedded in `provider_metadata.fnVersion` on every job record. Use this to verify the deployed function matches the repository.

---

## Environment Variables

Set all secrets with:

```
supabase secrets set --env-file supabase/functions/.env.local
```

**Required**

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI secret key for Whisper transcription |
| `SUPABASE_URL` | Injected automatically by the Supabase runtime |
| `SUPABASE_ANON_KEY` | Injected automatically |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected automatically |

**Optional — OpenAI tuning**

| Variable | Default | Description |
|---|---|---|
| `OPENAI_TRANSCRIPTION_MODEL` | `whisper-1` | Whisper model identifier |
| `OPENAI_MAX_AUDIO_BYTES` | `26214400` (25 MB) | Per-request upload limit; matches the OpenAI API hard limit |
| `OPENAI_CHUNK_SAFETY_BYTES` | `262144` (256 KB) | Safety margin subtracted from `OPENAI_MAX_AUDIO_BYTES` per chunk |
| `OPENAI_TRANSCRIPTION_OVERLAP_MS` | `4000` | Overlap between WAV chunks for deduplication |
| `OPENAI_TRANSCRIPTION_CONCURRENCY` | `2` | Parallel chunk uploads (max 4) |

**Optional — Long-audio backend (required for oversized compressed files)**

MP3, M4A, AAC, FLAC, and OGG files larger than `OPENAI_MAX_AUDIO_BYTES` cannot be byte-split in the Edge Function. They must be handled by an external backend that accepts a signed storage URL.

| Variable | Description |
|---|---|
| `LYRIC_TRANSCRIPTION_ENDPOINT` | HTTPS URL of your private transcription service |
| `LYRIC_TRANSCRIPTION_ENDPOINT_TOKEN` | Bearer token sent with every request to the endpoint |
| `LYRIC_TRANSCRIPTION_CHUNK_MS` | Max segment duration sent to the custom backend (default: 240000) |
| `LYRIC_TRANSCRIPTION_OVERLAP_MS` | Segment overlap for the custom backend (default: 4000) |
| `LYRIC_TRANSCRIPTION_PROVIDER` | Set to `custom` to always use the custom backend; omit for auto-routing |

When `LYRIC_TRANSCRIPTION_ENDPOINT` and `LYRIC_TRANSCRIPTION_ENDPOINT_TOKEN` are both set, oversized compressed files are automatically routed to the custom backend. When they are not set and a compressed file exceeds the per-request limit, the job fails with `error_code: long_audio_backend_not_configured`.

---

## Processing Modes

| Mode | When used |
|---|---|
| `direct` | File fits within `OPENAI_MAX_AUDIO_BYTES`; single Whisper request |
| `wav-chunking` | Oversized uncompressed PCM/IEEE-float WAV; byte-split into overlapping chunks |
| `long-audio-worker` | Compressed file exceeds limit, or `LYRIC_TRANSCRIPTION_PROVIDER=custom`; signed URL forwarded to external backend |

The active mode is stored in `provider_metadata.processingMode` on the completed job record.

---

## Deployment

1. Deploy the function:
   ```
   supabase functions deploy lyric-transcription --no-verify-jwt
   ```
   JWT verification is handled inside the function via `auth.getUser()`.

2. Verify the deployed version matches the repository:
   ```
   supabase functions deploy --dry-run lyric-transcription
   ```
   Or check a completed job's `provider_metadata.fnVersion` field in the database.

3. Check function logs after deployment:
   ```
   supabase functions logs lyric-transcription --tail
   ```

---

## Verification Steps

After deployment, start a test extraction from a known track:

- **Small file (any format, < 25 MB)**: job should reach `completed` with `processingMode: "direct"` in provider_metadata.
- **Oversized PCM WAV**: job should complete with `processingMode: "wav-chunking"` and per-chunk progress visible in `provider_metadata.chunksCompleted` / `chunksTotal` during processing.
- **Oversized MP3/AAC/FLAC without backend**: job should fail with `error_code: long_audio_backend_not_configured` and no retry button in the UI.
- **Oversized compressed with backend configured**: job should complete with `processingMode: "long-audio-worker"`.

---

## Supported Audio Formats

WAV, MP3, M4A (AAC), AAC, FLAC, OGG. Files with an unsupported MIME type or extension fail immediately with `error_code: unsupported_audio`.

Files larger than 100 MB (hard limit regardless of format) are rejected at job creation with `error_code: unsupported_audio`.

---

## Security Notes

- Never prefix provider secrets with `VITE_` — they must only exist in the Edge Function environment.
- The custom backend receives a signed storage URL (valid for 10 minutes). The URL is redacted from stored `provider_metadata`.
- JWT verification is mandatory; removing `--no-verify-jwt` from production deploys is strongly recommended once verified.
- The `complete_lyric_transcription_job` RPC is the only path that marks a job `completed`. A job cannot be marked complete without a saved lyric document.
