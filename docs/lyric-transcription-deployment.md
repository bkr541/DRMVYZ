# Lyric Transcription Deployment Guide

## Architecture

DRMVYZ lyric extraction currently requires an internet connection. The frontend uses the browser online/offline signal to stop local audio preparation before it starts when the user is offline, then still relies on normal async error handling for Supabase and Groq reachability. Browser users never call Groq or any transcription provider directly. The React client starts and monitors a server-owned job, and `supabase/functions/lyric-transcription` keeps provider credentials inside Supabase Edge Function secrets.

Groq Whisper is the provider for new lyric transcription jobs. Historical `openai` job rows remain valid for status display and retry compatibility, but active server execution and retries route through Groq. The optional `custom` provider remains available only for the existing long-audio/custom backend fallback path.

Small stored files are sent directly from the Edge Function. Safe-sized oversized files are normalized in the browser to private mono, 16 kHz, 16-bit PCM WAV chunks, uploaded to the existing `audio-tracks` bucket, and recorded in `audio_tracks.transcription_assets`. The function validates ownership, operation identity, size, timing, format, and every server-derived path before reading those chunks server-side.

The original upload remains the canonical playback file. Prepared transcription audio is a private derivative and is deleted through the same canonical audio-track deletion operation used by Lyric Manager and the audio library.

The completed job records `provider_metadata.fnVersion`, `pipelineVersion`, `processingMode`, and safe preprocessing metadata so stale deployments are visible without exposing storage paths, signed URLs, or secrets. Existing lyric document and cue storage remains unchanged.

## Required migration

Apply the schema before deploying the function:

```bash
supabase db push
```

Migration `0019_audio_transcription_assets.sql` adds the bounded JSON manifest used by the prepared-audio pipeline. Migration `0020_groq_lyric_transcription_provider.sql` updates the transcription job provider constraint so new jobs can use `groq` while historical `openai` and `custom` rows remain valid. Migration `0027_audio_deletion_preparation_safety.sql` adds the preparation-operation ledger, exact-path cleanup records, deletion tombstones, and owner-only RPCs used for retry, rollback, cancellation, and canonical track deletion.

## Environment variables

Set secrets with:

```bash
supabase secrets set --env-file supabase/functions/.env.local
```

Required:

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Server-only Groq transcription provider key |
| `SUPABASE_URL` | Injected by Supabase |
| `SUPABASE_ANON_KEY` | Injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected by Supabase |

Groq tuning:

| Variable | Default | Description |
|---|---:|---|
| `GROQ_TRANSCRIPTION_MODEL` | `whisper-large-v3-turbo` | Primary Groq Whisper model |
| `GROQ_FALLBACK_TRANSCRIPTION_MODEL` | unset | Optional retry model, commonly `whisper-large-v3`, for transient or model-specific Groq failures |
| `GROQ_MAX_AUDIO_BYTES` | `26214400` | Documented Groq file maximum |
| `GROQ_SAFE_AUDIO_BYTES` | `24117248` | Application-safe direct/chunk limit, clamped below the documented maximum |
| `GROQ_CHUNK_SAFETY_BYTES` | `262144` | Additional reserve used by server-side WAV splitting |
| `GROQ_TRANSCRIPTION_OVERLAP_MS` | `4000` | Server-side WAV overlap |
| `GROQ_TRANSCRIPTION_CONCURRENCY` | `1` | Bounded parallel provider requests during rollout |
| `GROQ_PROVIDER_TIMEOUT_MS` | `180000` | Provider request timeout in milliseconds |

Optional worker fallback:

| Variable | Description |
|---|---|
| `LYRIC_TRANSCRIPTION_ENDPOINT` | Private codec-aware transcription service |
| `LYRIC_TRANSCRIPTION_ENDPOINT_TOKEN` | Bearer token for that service |
| `LYRIC_TRANSCRIPTION_CHUNK_MS` | Worker segment duration |
| `LYRIC_TRANSCRIPTION_OVERLAP_MS` | Worker segment overlap |

The worker is no longer required for ordinary oversized songs. It is only a fallback when the current browser cannot decode the source codec or when a historical custom-provider job is resumed.

Do not expose Groq, custom backend, or Supabase service-role secrets through any `VITE_*` variable. There is intentionally no `VITE_GROQ_API_KEY`, and the browser must never call Groq directly.

## Processing modes

| Mode | Behavior |
|---|---|
| `direct` | Stored file is below the safe request limit |
| `wav-chunking` | Oversized uncompressed PCM/IEEE-float WAV is split inside the Edge Function |
| `prepared-audio` | Browser-generated private PCM WAV chunks are validated and transcribed by the Edge Function |
| `long-audio-worker` | Optional external fallback for undecodable sources or historical custom-provider jobs |

Prepared audio uses version `browser-pcm16-v2`, mono PCM16 at 16 kHz, 20 MiB target chunks, and 3 seconds of overlap. Each preparation has a durable operation UUID and deterministic user/track/operation-scoped chunk paths. Retry reuses valid chunks instead of duplicating them, while failure or cancellation removes every intended exact path or records durable cleanup work. Chunk-relative provider timestamps are shifted back to the source timeline and overlap duplicates are removed by the existing reconciliation layer. `globalOffsetMs` is still applied only when the lyric document is saved.

## Renderer memory preflight

Local preparation performs a conservative workload estimate before full decode or resampling. The model includes source bytes, decoded source PCM (`duration × sample rate × channels × 4`), target mono PCM, encoded WAV bytes, chunk count, resampling work, and temporary-copy overhead. Browser and verified Electron limits are centralized in `audioPreparationLimits.ts` and covered by deterministic tests.

Sources that exceed the safe byte, duration, channel, decoded-PCM, peak-memory, or resampling-work limit are rejected before the dangerous allocation. The UI names the limiting factor and recommends a shorter or pre-converted source. When a server omits `Content-Length`, the downloader applies the stricter unknown-length cap while streaming and stops before an unbounded buffer is assembled.

Browser `decodeAudioData()` cannot be interrupted after decoding begins. Cancellation still prevents every later resample, worker, upload, manifest, job, poll, and result-application stage, then releases local resources and rolls back operation-owned remote assets.

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

Run the local app checks before deploying the Edge Function:

```bash
npm run typecheck
npm run test
npm run build
```

Apply migrations and deploy the server-owned transcription function from a Supabase-linked environment:

```bash
supabase db push
supabase secrets set --env-file supabase/functions/.env.local
supabase functions deploy lyric-transcription
```

The Supabase CLI commands require a linked project, authenticated CLI session, and network access to Supabase. If a local sandbox or CI worker does not have those credentials or outbound access, record them as not runnable there and execute them from the deployment environment instead.

Sample manual extraction test steps:

1. Reload the DRMVYZ frontend so it includes the browser preparation and offline-guard code.
2. Confirm new queued jobs store `provider: "groq"` and display as `Groq Whisper` in the extractor.
3. Test a small file. The completed job should show `processingMode: "direct"`.
4. Test an oversized PCM WAV. It may use `wav-chunking` or `prepared-audio` depending on whether DRMVYZ prepared it before the job began.
5. Test an oversized MP3 or M4A. The UI should show local download, decode, encode, and upload progress, followed by a completed job with `processingMode: "prepared-audio"` and model/chunk metadata when available.
6. Confirm `provider_metadata.fnVersion` and `pipelineVersion` are `3.1.0`.
7. Confirm `audio_tracks.transcription_assets` contains only private chunk metadata and no signed URLs.
8. Turn off network access or use browser offline simulation. The extractor button should be disabled and show: `Lyric extraction requires an internet connection. Connect to the internet and try again.`
9. Return the browser online and confirm extraction can start again without reloading.
10. Simulate a provider/network failure and confirm the UI shows a useful sanitized error without stack traces, signed URLs, storage paths, tokens, or keys.
11. Cancel during download, encoding, and upload. Confirm no later manifest or job is created and any uploaded deterministic chunks are removed or remain visible in `audio_preparation_operations` as `cleanup_pending`.
12. Delete the same track once from Lyric Manager and once from the audio library. Both surfaces should call the canonical deletion operation; a repeated request should reconcile the existing cleanup job without deleting similarly named paths.

A source codec the browser cannot decode shows a browser-decode error before local preparation completes. The UI then lets the Edge Function try the secure server fallback when that fallback is configured; otherwise, convert the source to a browser-decodable format such as MP3, M4A, WAV, or OGG.

## Retry and rate-limit troubleshooting

- `provider_configuration_missing`: set `GROQ_API_KEY` as a Supabase Edge Function secret, then redeploy or restart the local function runtime.
- `provider_authentication_failed`: rotate the Groq key and confirm the deployed function is reading the server-side secret, not a browser `VITE_*` variable.
- `rate_limit`: reduce `GROQ_TRANSCRIPTION_CONCURRENCY`, wait for the provider quota window, then retry the job from Lyric Manager.
- `provider_timeout` or `provider_unavailable`: check Supabase function logs, confirm outbound internet access, and consider setting `GROQ_FALLBACK_TRANSCRIPTION_MODEL=whisper-large-v3` for one fallback attempt.
- `transcription_asset_required`: reload the frontend and retry extraction so the browser can prepare private PCM WAV chunks before the Edge Function calls Groq.

## Security and cleanup

- Provider credentials remain server-side.
- Browser users do not send audio or credentials directly to Groq.
- Prepared chunks live under deterministic authenticated user/track/operation prefixes and are protected by the existing `audio-tracks` RLS policies.
- Signed source URLs are short-lived and are never stored in job metadata.
- Prepared manifests are limited to 128 KiB and 64 chunks.
- Every preparation operation records intended paths, uploaded chunks, manifest state, job state, retry state, and recoverable cleanup progress.
- Deleting a track first creates an owner-scoped tombstone containing server-derived exact paths. The database row and cascading lyric/job derivatives are finalized only after storage cleanup completes.
- Partial track or preparation cleanup remains retryable and visible instead of silently orphaning storage objects.
- A job is not marked complete unless `complete_lyric_transcription_job` atomically saves a lyric document and cues.
