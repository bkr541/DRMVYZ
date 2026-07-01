# Lyric Transcription Deployment Guide

## Architecture

DRMVYZ keeps the provider key in the Supabase Edge Function. Small stored files are sent directly from the function. Oversized files are normalized in the browser to private mono, 16 kHz, 16-bit PCM WAV chunks, uploaded to the existing `audio-tracks` bucket, and recorded in `audio_tracks.transcription_assets`. The function validates ownership, size, timing, and format before reading those chunks.

The original upload remains the canonical playback file. Prepared transcription audio is a private derivative and is deleted with the track.

The completed job records `provider_metadata.fnVersion`, `pipelineVersion`, `processingMode`, and safe preprocessing metadata so stale deployments are visible without exposing storage paths or secrets.

## Required migration

Apply the new schema before deploying the function:

```bash
supabase db push
```

Migration `0019_audio_transcription_assets.sql` adds the bounded JSON manifest used by the prepared-audio pipeline.

## Environment variables

Set secrets with:

```bash
supabase secrets set --env-file supabase/functions/.env.local
```

Required:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Server-only transcription provider key |
| `SUPABASE_URL` | Injected by Supabase |
| `SUPABASE_ANON_KEY` | Injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected by Supabase |

Optional OpenAI tuning:

| Variable | Default | Description |
|---|---:|---|
| `OPENAI_TRANSCRIPTION_MODEL` | `whisper-1` | Transcription model |
| `OPENAI_MAX_AUDIO_BYTES` | `26214400` | Documented provider file maximum |
| `OPENAI_SAFE_AUDIO_BYTES` | `24117248` | Application-safe direct/chunk limit, clamped below the documented maximum |
| `OPENAI_CHUNK_SAFETY_BYTES` | `262144` | Additional reserve used by server-side WAV splitting |
| `OPENAI_TRANSCRIPTION_OVERLAP_MS` | `4000` | Server-side WAV overlap |
| `OPENAI_TRANSCRIPTION_CONCURRENCY` | `2` | Bounded parallel provider requests, maximum 4 |

Optional worker fallback:

| Variable | Description |
|---|---|
| `LYRIC_TRANSCRIPTION_ENDPOINT` | Private codec-aware transcription service |
| `LYRIC_TRANSCRIPTION_ENDPOINT_TOKEN` | Bearer token for that service |
| `LYRIC_TRANSCRIPTION_CHUNK_MS` | Worker segment duration |
| `LYRIC_TRANSCRIPTION_OVERLAP_MS` | Worker segment overlap |
| `LYRIC_TRANSCRIPTION_PROVIDER` | Set to `custom` only to force the worker for every job |

The worker is no longer required for ordinary oversized songs. It is only a fallback when the current browser cannot decode the source codec.

## Processing modes

| Mode | Behavior |
|---|---|
| `direct` | Stored file is below the safe request limit |
| `wav-chunking` | Oversized uncompressed PCM/IEEE-float WAV is split inside the Edge Function |
| `prepared-audio` | Browser-generated private PCM WAV chunks are validated and transcribed by the Edge Function |
| `long-audio-worker` | Optional external fallback or explicitly selected custom provider |

Prepared audio uses version `browser-pcm16-v1`, mono PCM16 at 16 kHz, 20 MiB target chunks, and 3 seconds of overlap. Chunk-relative provider timestamps are shifted back to the source timeline and overlap duplicates are removed by the existing reconciliation layer. `globalOffsetMs` is still applied only when the lyric document is saved.

## Secure deployment

Deploy with JWT verification enabled:

```bash
supabase functions deploy lyric-transcription
```

The function also calls `auth.getUser()`, checks track/job ownership, and validates every prepared storage path against the authenticated owner. Do not use `--no-verify-jwt` for the normal production deployment.

Inspect logs:

```bash
supabase functions logs lyric-transcription --tail
```

## Verification

1. Run `supabase db push`.
2. Deploy the function.
3. Reload the DRMVYZ frontend so it includes the browser preparation code.
4. Test a small file. The completed job should show `processingMode: "direct"`.
5. Test an oversized PCM WAV. It may use `wav-chunking` or `prepared-audio` depending on whether DRMVYZ prepared it before the job began.
6. Test an oversized MP3 or M4A. The UI should show local download, decode, encode, and upload progress, followed by a completed job with `processingMode: "prepared-audio"`.
7. Confirm `provider_metadata.fnVersion` and `pipelineVersion` are `3.0.0`.
8. Confirm `audio_tracks.transcription_assets` contains only private chunk metadata and no signed URLs.

A source codec the browser cannot decode produces `unsupported_audio_codec`. In that case, convert the source to a browser-decodable format or configure the optional worker fallback.

## Security and cleanup

- Provider credentials remain server-side.
- Prepared chunks live under the authenticated user's first storage-path segment and are protected by the existing `audio-tracks` RLS policies.
- Signed source URLs are short-lived and are never stored in job metadata.
- Prepared manifests are limited to 128 KiB and 64 chunks.
- Deleting a track also removes its prepared transcription chunks.
- A job is not marked complete unless `complete_lyric_transcription_job` atomically saves a lyric document and cues.
