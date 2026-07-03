# Lyric Transcription Deployment Guide

## Architecture

DRMVYZ lyric extraction currently requires an internet connection. Browser users never call Groq or any transcription provider directly. The React client starts and monitors a server-owned job, and `supabase/functions/lyric-transcription` keeps provider credentials inside Supabase Edge Function secrets.

Groq Whisper is the intended provider for new lyric transcription jobs. OpenAI remains only as legacy historical/transitional compatibility while the staged provider replacement is completed. The optional `custom` provider is still available only for the existing long-audio/custom backend path.

Small stored files are sent directly from the Edge Function. Oversized files are normalized in the browser to private mono, 16 kHz, 16-bit PCM WAV chunks, uploaded to the existing `audio-tracks` bucket, and recorded in `audio_tracks.transcription_assets`. The function validates ownership, size, timing, and format before reading those chunks server-side.

The original upload remains the canonical playback file. Prepared transcription audio is a private derivative and is deleted with the track.

The completed job records `provider_metadata.fnVersion`, `pipelineVersion`, `processingMode`, and safe preprocessing metadata so stale deployments are visible without exposing storage paths, signed URLs, or secrets. Existing lyric document and cue storage remains unchanged.

## Required migration

Apply the schema before deploying the function:

```bash
supabase db push
```

Migration `0019_audio_transcription_assets.sql` adds the bounded JSON manifest used by the prepared-audio pipeline. Migration `0020_groq_lyric_transcription_provider.sql` updates the transcription job provider constraint so new jobs can use `groq` while historical `openai` and `custom` rows remain valid.

## Environment variables

Set secrets with:

```bash
supabase secrets set --env-file supabase/functions/.env.local
```

Required:

| Variable | Description |
|---|---|
| `LYRIC_TRANSCRIPTION_PROVIDER` | Defaults new jobs to `groq`; set to `custom` only to force the existing private worker |
| `GROQ_API_KEY` | Server-only Groq transcription provider key |
| `SUPABASE_URL` | Injected by Supabase |
| `SUPABASE_ANON_KEY` | Injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected by Supabase |

Groq tuning:

| Variable | Default | Description |
|---|---:|---|
| `GROQ_TRANSCRIPTION_MODEL` | `whisper-large-v3-turbo` | Primary Groq Whisper model |
| `GROQ_FALLBACK_TRANSCRIPTION_MODEL` | `whisper-large-v3` | Fallback Groq Whisper model for staged rollout |
| `GROQ_MAX_AUDIO_BYTES` | `26214400` | Documented provider file maximum |
| `GROQ_SAFE_AUDIO_BYTES` | `24117248` | Application-safe direct/chunk limit, clamped below the documented maximum |
| `GROQ_CHUNK_SAFETY_BYTES` | `262144` | Additional reserve used by server-side WAV splitting |
| `GROQ_TRANSCRIPTION_OVERLAP_MS` | `4000` | Server-side WAV overlap |
| `GROQ_TRANSCRIPTION_CONCURRENCY` | `1` | Bounded parallel provider requests during rollout |
| `GROQ_PROVIDER_TIMEOUT_MS` | `180000` | Provider request timeout in milliseconds |

Legacy transitional OpenAI settings:

| Variable | Default | Description |
|---|---:|---|
| `OPENAI_API_KEY` | none | Legacy server-only key retained only until the Groq runtime swap is complete |
| `OPENAI_TRANSCRIPTION_MODEL` | `whisper-1` | Legacy transcription model |
| `OPENAI_MAX_AUDIO_BYTES` | `26214400` | Legacy documented provider file maximum |
| `OPENAI_SAFE_AUDIO_BYTES` | `24117248` | Legacy application-safe direct/chunk limit |
| `OPENAI_CHUNK_SAFETY_BYTES` | `262144` | Legacy server-side WAV split reserve |
| `OPENAI_TRANSCRIPTION_OVERLAP_MS` | `4000` | Legacy server-side WAV overlap |
| `OPENAI_TRANSCRIPTION_CONCURRENCY` | `2` | Legacy bounded provider requests, maximum 4 |

Optional worker fallback:

| Variable | Description |
|---|---|
| `LYRIC_TRANSCRIPTION_ENDPOINT` | Private codec-aware transcription service |
| `LYRIC_TRANSCRIPTION_ENDPOINT_TOKEN` | Bearer token for that service |
| `LYRIC_TRANSCRIPTION_CHUNK_MS` | Worker segment duration |
| `LYRIC_TRANSCRIPTION_OVERLAP_MS` | Worker segment overlap |

The worker is no longer required for ordinary oversized songs. It is only a fallback when the current browser cannot decode the source codec or when `LYRIC_TRANSCRIPTION_PROVIDER=custom` is explicitly configured.

Do not expose Groq, OpenAI, custom backend, or Supabase service-role secrets through any `VITE_*` variable.

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
4. Confirm new queued jobs store `provider: "groq"` unless `LYRIC_TRANSCRIPTION_PROVIDER=custom` is explicitly configured.
5. Test a small file. The completed job should show `processingMode: "direct"`.
6. Test an oversized PCM WAV. It may use `wav-chunking` or `prepared-audio` depending on whether DRMVYZ prepared it before the job began.
7. Test an oversized MP3 or M4A. The UI should show local download, decode, encode, and upload progress, followed by a completed job with `processingMode: "prepared-audio"`.
8. Confirm `provider_metadata.fnVersion` and `pipelineVersion` are `3.0.0`.
9. Confirm `audio_tracks.transcription_assets` contains only private chunk metadata and no signed URLs.

A source codec the browser cannot decode produces `unsupported_audio_codec`. In that case, convert the source to a browser-decodable format or configure the optional worker fallback.

## Security and cleanup

- Provider credentials remain server-side.
- Browser users do not send audio or credentials directly to Groq.
- Prepared chunks live under the authenticated user's first storage-path segment and are protected by the existing `audio-tracks` RLS policies.
- Signed source URLs are short-lived and are never stored in job metadata.
- Prepared manifests are limited to 128 KiB and 64 chunks.
- Deleting a track also removes its prepared transcription chunks.
- A job is not marked complete unless `complete_lyric_transcription_job` atomically saves a lyric document and cues.
