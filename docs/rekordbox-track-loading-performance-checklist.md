# Rekordbox Track Loading Performance Checklist

This document tracks the production-critical work required to ensure that loading a track from a Rekordbox-prepared USB never blocks audio playback while Rekordbox metadata is being discovered and parsed.

## Status legend

- `[x]` Completed and verified.
- `[~]` Partially implemented; required production behavior is not complete.
- `[ ]` Not completed.

## Target user experience

When a user selects an audio track, DRMVYZ must create the runtime track and make the audio available immediately. Rekordbox BPM, beat grids, cues, phrases, and other metadata must load in the background and enrich that same runtime track without replacing its audio source, resetting playback, or allowing an outdated request to modify a newer track.

The intended sequence is:

```text
Select audio
  → create and load the runtime audio track immediately
  → allow playback and interaction
  → scan or reuse Rekordbox metadata asynchronously
  → validate that the request still belongs to the loaded track
  → enrich the existing track in place
```

---

## 1. Prioritize audio loading

**Status:** [x] Completed and verified

### Required change

- Create or replace the runtime audio track immediately after file selection.
- Do not await USB discovery, Rekordbox library scanning, ANLZ parsing, PDB parsing, or metadata matching before loading the audio source.
- Start Rekordbox discovery only after the audio-loading mutation has been committed.
- Show a non-blocking metadata status such as `Audio ready · Rekordbox metadata loading`.
- A Rekordbox failure must not prevent the audio track from loading or playing.

### Implemented summary

- `VyzualzAudioDock.handleFiles()` now calls the audio engine's add/replace mutation before starting native Rekordbox discovery.
- Native USB scanning runs as detached background work and reports `Audio ready · Rekordbox metadata loading…` while it is pending.
- Scan failures update the metadata status without removing or blocking the already-loaded audio.
- Focused tests verify that the audio mutation precedes a deferred scan and that scan rejection leaves the audio loaded.

Late metadata now hydrates the existing runtime track in place as completed under Fix #5.

### Acceptance criteria

- Audio loading begins without waiting for Rekordbox scanning.
- The transport and waveform can become available while metadata is still pending.
- A slow, unavailable, malformed, or disconnected Rekordbox USB does not block ordinary audio loading.
- Production instrumentation separately records time-to-audio-ready and time-to-Rekordbox-ready.

---

## 2. Load Rekordbox metadata asynchronously

**Status:** [x] Completed and verified

### Required change

- Move Rekordbox USB discovery, library parsing, matching, and hydration into a background enrichment task.
- Keep BPM, beat-grid, cue, phrase, key, and external track metadata independent from the audio source lifecycle.
- Apply the authoritative timing payload atomically so BPM, beat grid, downbeats, phrases, and sections cannot temporarily disagree.
- Allow the UI to report staged progress without exposing a partially inconsistent musical timeline.
- Treat metadata failure as a recoverable degradation rather than an audio-loading failure.

### Implemented summary

- Automatic USB discovery, native library parsing, track matching, and payload preparation run as detached work after the audio mutation completes.
- The pending metadata operation does not disable the audio file input or transport interaction.
- The dock exposes an accessible live status for metadata loading, matched/unmatched completion, cancellation, and failure.
- Rekordbox BPM, beat-grid, cue, phrase, key, and external metadata are prepared together and committed through one prepared-track mutation, avoiding partial musical-timeline updates.
- Focused tests cover the pending, successful, and failed background-scan paths.

The metadata commit now preserves the existing runtime track, URL, and playback state as completed under Fix #5.

### Acceptance criteria

- Audio remains usable during every Rekordbox scan stage.
- Metadata appears on the already-loaded track when ready.
- Metadata status clearly distinguishes loading, matched, unmatched, and failed outcomes. Stale/ignored outcomes are tracked under Fix #6.
- BPM, grid, cues, and phrases are internally consistent at every committed revision.

---

## 3. Optimize Rekordbox ANLZ and PDB scanning

**Status:** [x] Completed and verified

### Required change

- Replace sequential ANLZ file reads with bounded parallel batches.
- Begin with a measured worker limit, such as eight concurrent file reads, rather than unbounded `Promise.all()`.
- Parse files independently, then merge results deterministically in stable file order.
- Run compatible PDB and ANLZ work concurrently rather than waiting for all ANLZ files before beginning PDB parsing.
- Consider bounded parallel directory traversal where it improves real USB performance.
- Preserve the current scan cap, parsing warnings, cue merging, beat-grid merging, phrase alignment, and integrity reporting.

### Implemented summary

- Native ANLZ reads and parsing now use a bounded pool of eight workers instead of sequential file processing.
- Parsed results retain their stable sorted file positions, so track merging and warning order remain deterministic regardless of read completion order.
- `export.pdb` detection runs alongside ANLZ discovery, and compatible PDB parsing runs concurrently with the ANLZ batch.
- The 50,000-file cap, per-file failure isolation, cue/beat-grid/phrase merging, and parser fallback warnings are preserved.
- Native tests verify that concurrency reaches but never exceeds the configured limit and that reversed completion order produces stable output.

Real removable-media benchmarking remains a release-validation task because representative USB hardware is not available in the automated test environment.

### Acceptance criteria

- Output is deterministic across repeated scans regardless of task completion order.
- Concurrency is bounded and does not exhaust file descriptors or memory on libraries approaching the 50,000-file cap.
- Malformed files remain isolated and produce warnings without failing the complete scan.
- Benchmarks cover representative real Rekordbox USB devices in addition to synthetic storage.
- Before/after timing is recorded for enumeration, ANLZ reads, ANLZ parsing, PDB parsing, merging, and IPC delivery.

---

## 4. Eliminate duplicate Rekordbox scans

**Status:** [x] Completed and verified

### Implemented summary

- The Electron main process now owns a scan coordinator shared by automatic known-root scans and native USB-picker scans.
- Normalized USB roots share one in-flight promise, and successful libraries are reused for a bounded two-minute TTL.
- Different USB roots have isolated entries.
- Failed, cancelled, and library-less scans are evicted immediately so subsequent requests can retry.
- Renderer batch caches also evict failed or empty results instead of retaining a poisoned promise.
- The coordinator exposes explicit invalidation, while the bounded TTL prevents removed or changed media from remaining cached indefinitely.
- Native tests cover concurrent sharing, sequential reuse, root isolation, TTL refresh, cancellation, failure recovery, and IPC wiring.

### Required change

- Introduce a shared scan coordinator keyed by normalized USB root.
- Share the same in-flight scan promise across Audio Dock loads, media imports, and concurrent renderer requests.
- Cache completed libraries so subsequent tracks on the same USB do not rescan the full library.
- Own the authoritative cache in the Electron main process so it survives component remounts and can serve all renderer callers.
- Optionally retain a renderer-side service cache to avoid repeated large IPC transfers.
- Do not permanently cache failures or cancelled scans.
- Invalidate completed entries when the USB disappears, the relevant Rekordbox files change, or a bounded TTL expires.
- Ensure failed promises are removed so later requests can retry.

### Acceptance criteria

- Concurrent requests for the same normalized root execute one native scan.
- Sequential track loads from an unchanged USB reuse the completed library.
- Different USB roots remain isolated.
- A failed or cancelled scan can be retried.
- Removing or changing a USB cannot serve an obsolete library indefinitely.

---

## 5. Hydrate metadata without reloading audio

**Status:** [x] Completed and verified

### Required change

- Add an audio-engine operation such as `hydrateTrackMetadata(trackId, importedMetadata)`.
- Patch the existing runtime track instead of calling `replacePreparedTracks()` when Rekordbox metadata arrives.
- Preserve the runtime track ID, source `File`, blob URL, audio element source, current playlist index, playback position, playing/paused state, volume, Web Audio graph, and decoded-buffer cache.
- Update external metadata, cue markers, cue regions, Rekordbox phrases, analysis seed, and the `isRekordbox` flag in place.
- Recompute the analysis key using the imported Rekordbox grid revision without changing the audio URL.
- Rely on the existing stable-URL guard so ordinary state updates never call `HTMLMediaElement.load()` again.

### Implemented summary

- Added `hydrateTrackMetadata(trackId, importedMetadata)` to the shared audio engine.
- Hydration atomically patches external metadata, cue markers and regions, Rekordbox phrases, the imported analysis seed, display metadata, and the Rekordbox flag on the existing runtime track.
- The analysis key is recomputed from the imported grid revision without changing the track ID, source `File`, blob URL, playlist index, playback position, play state, volume, media element, Web Audio graph, or decoded-buffer cache.
- Automatic native scans retain the exact runtime IDs returned by the initial audio mutation and hydrate those tracks when metadata arrives.
- XML import and manual USB rehydration now use the same in-place mutation.
- Late metadata no longer calls `replacePreparedTracks()`, revokes the audio URL, or re-enters `HTMLMediaElement.load()`.

### Acceptance criteria

- Metadata hydration never calls `replacePreparedTracks()`.
- The audio element source URL is unchanged.
- Playback continues without an audible interruption.
- Current time does not reset or jump.
- Runtime track identity and playlist position remain stable.
- Existing decoded audio is reused.

---

## 6. Protect against outdated metadata and analysis results

**Status:** [~] Audio-analysis protection exists; Rekordbox protection is not completed

### Existing partial behavior

- `TrackAnalysisCoordinator` uses generation counters, cancellation state, abort controllers, and final stale checks.
- Playlist replacement invalidates older analysis jobs.
- BPM reanalysis uses per-track cancellation tokens.

### Required change

- Give every audio selection and Rekordbox enrichment request a monotonically increasing request generation.
- Capture the expected runtime track ID, file identity, normalized USB root, and scan/library revision.
- Commit Rekordbox metadata only when the request generation and track/file identity still match.
- Allow a stale scan to populate the shared USB cache, but never allow it to alter the current track or current UI status.
- Prevent an older scan from overwriting a newer Rekordbox library selection.
- Ignore results after component disposal or source-mode changes.
- Carry stale-result protection through analysis re-enrichment as well as initial metadata matching.

### Acceptance criteria

- Loading track A and then track B cannot allow track A metadata to modify track B.
- Starting two scans for different roots cannot allow the older result to replace the newer selected library.
- Switching to live input or another source invalidates pending file-track hydration.
- Stale operations produce no playback mutation and no misleading success status.
- Automated tests cover reversed completion order for audio loads, USB scans, metadata matching, and analysis jobs.

---

## 7. Reconcile late Rekordbox metadata with track analysis

**Status:** [ ] Not completed

### Required change

- Account for the ordinary offline analysis job potentially starting before Rekordbox metadata arrives.
- When a Rekordbox match arrives, update the track's imported analysis seed and compute a new grid-aware analysis key.
- Supersede or cancel an analysis job that captured the older seed.
- Reuse the decoded `AudioBuffer`; do not recreate or reload the playback source.
- Prefer a targeted merge/rebuild that applies authoritative Rekordbox BPM, beat grid, downbeats, key, and phrases while preserving already-extracted spectral and energy features.
- If a full seeded reanalysis is temporarily necessary, it must still reuse the decoded buffer and remain invisible to playback.
- Prevent a cached ordinary analysis from overwriting a newer Rekordbox-enriched revision.

### Current problem

`TrackAnalysisCoordinator.enqueue()` snapshots `importedAnalysisSeed` into the queued job. Metadata arriving later does not update that job, and the original analysis key may still identify a non-Rekordbox cached result.

### Acceptance criteria

- Late metadata receives Rekordbox feature precedence without repeating audio decoding.
- Spectral and energy analysis already completed for the same audio remains reusable.
- Cache keys distinguish ordinary analysis from every relevant Rekordbox grid revision.
- An older ordinary result cannot overwrite a newer enriched result.
- Music Intelligence updates without resetting the transport.

---

## Required validation coverage

**Status:** [ ] Not completed

- [x] Unit test: audio-track mutation occurs before a deferred Rekordbox scan resolves.
- [x] Unit test: scan failure leaves the audio track loaded and usable.
- [x] Unit test: pending metadata status is announced while the audio file input remains enabled.
- [x] Unit test: metadata hydration preserves track ID and URL.
- [x] Unit test: metadata hydration does not call `replacePreparedTracks()` or reload the media element.
- Unit test: reversed scan completion cannot overwrite the newest track or library.
- [x] Unit test: concurrent requests for one USB root share one native scan.
- [x] Unit test: failed shared scans are evicted and retryable.
- Unit test: late metadata changes the analysis revision and supersedes the old job.
- [x] Native test: bounded ANLZ concurrency never exceeds its configured limit.
- [x] Native test: parallel parsing produces deterministic output and warning order.
- [x] Integration test: playback time and play state remain stable when Rekordbox metadata arrives.
- Integration test: switching tracks repeatedly while scanning never applies metadata to the wrong track.
- Performance test: record time-to-audio-ready independently from time-to-metadata-ready.
- Performance test: compare sequential and bounded-parallel scanning on representative real USB hardware.

## Recommended implementation order

1. [x] Load audio immediately.
2. [x] Add in-place metadata hydration.
3. [ ] Add request-generation and track-identity guards.
4. [ ] Reconcile late metadata with existing analysis.
5. [x] Add the shared USB scan coordinator and cache.
6. [x] Add bounded parallel ANLZ/PDB scanning.
7. [ ] Add production timing instrumentation and complete the validation matrix.

The first four items remove the unacceptable user-facing wait and prevent playback interruption. Shared caching and parallel scanning then reduce how long background metadata remains pending.
