# Loaded Audio Musical Structure Analysis

DRMVYZ has one shared, local interpretation layer for every loaded track. It answers musical timing and structure questions once, resolves user/import authority once, and publishes one authoritative timeline to Track Map, Music Intelligence, Show Director, Shaders, Sound Drawing, Cinematic Worlds, CANVAS, and generic React automation.

An engine may interpret an authoritative section for its own choreography. It must not run a second Track Section analyzer or replace the shared section identity.

## Production pipeline

The production path is coordinated by `TrackAnalysisCoordinator` and implemented by `analyzeTrackBuffer`:

1. Decode the selected source once.
2. Mix channels into one analysis signal.
3. Extract FFT, band, onset, transient, RMS, spectral, pitch, and chroma features in one pass.
4. Estimate BPM or accept trusted imported/manual timing.
5. resolve beat phase.
6. Resolve downbeat phase.
7. Build beat, downbeat, and bar markers.
8. Aggregate per-bar musical features.
9. Build a bounded self-similarity representation.
10. Generate bar-boundary candidates from acoustic, rhythmic, harmonic, similarity, energy, silence, and impact evidence.
11. Globally optimize coherent structural regions.
12. Classify regions contextually as Intro, Verse, Build, Pre-Drop, Drop, Breakdown, Bridge, Outro, or Unknown.
13. Refine Build starts and optional Pre-Drop boundaries around actual Drop anchors.
14. Generate section families and occurrences.
15. Generate phrase hierarchy and phrase markers.
16. Generate semantic transition moments.
17. Resolve automatic, imported, manual, locked, replacement, created, and suppressed section authority.
18. Publish the complete analysis and resolved timeline atomically, then persist a bounded cache record.

The legacy time-domain detector remains only as an explicitly diagnosed fallback when a reliable bar grid cannot be established. It is not a competing production analyzer.

## Shared analysis versus engine interpretation

Shared track-level analysis determines:

- beat, downbeat, and bar timing
- structural boundaries
- section labels, confidence, alternatives, families, and occurrence identity
- phrase markers and semantic moments
- the final resolved section timeline after user/import authority is applied

Engine-level interpretation may determine:

- which fixture family responds to the current section
- how a Shader evolves inside a Build
- how Sound Drawing maps phrase progress to motion
- how Show Director distinguishes a first Drop occurrence from an evolved return

Engine interpretation consumes shared facts. It must not produce a different answer to “What section is active right now?”

## Authority hierarchy

`resolveAuthoritativeTimeline` owns the final non-overlapping timeline. Higher authority wins overlap and identity conflicts:

1. Locked user-created or user-edited sections
2. User-created sections and manual replacements
3. Imported/locked metadata
4. Automatic analyzed sections
5. Explicit safe fallback spans

Suppressed automatic sections stay removed. A manual replacement keeps the original automatic identity in provenance so suppression, editing, persistence, and later reanalysis can reconcile it deterministically. Manual and imported authority is not weakened by cache invalidation or BPM grid rebuilds.

## Confidence and uncertainty

Confidence is evidence, not decoration. Consumers should inspect the published capability and confidence fields before assuming fine musical precision:

- `bpmConfidence`
- `beatPhaseConfidence`
- `downbeatPhaseConfidence`
- `barGridConfidence`
- per-section `confidence`
- section interpretation alternatives and evidence
- structural candidate diagnostics
- `analysisWarnings` and `analysisDiagnostics`
- published `analysisCapabilities`

The contextual classifier intentionally prefers `Unknown` when the leading interpretation is weak and nearly tied with an alternative. It retains bounded alternatives rather than presenting a confident wrong label. Engines must degrade gracefully by using section progress, energy, beat/bar timing, or conservative defaults when fine semantics are unavailable.

## Tunable constants

Production tuning is centralized in `src/features/musicIntelligence/analysisTuning.ts`.

The groups are:

- `performance`: retained feature cadence, chroma cadence, cooperative yield frequency, and self-similarity bounds
- `structural`: novelty weights, phrase/section-count priors, short or weak boundary penalties, and global optimization rewards
- `semantic`: Build, Pre-Drop, Drop, family, alternative, and uncertainty thresholds
- `persistence`: maximum retained phrases, moments, candidates, alternatives, and hierarchy units

Do not add track-specific constants. Tune against synthetic structure fixtures and representative genre profiles. A change to these constants should include a regression demonstrating the intended correction and the structures that must remain unchanged.

## Cache identity, versioning, and migration

`CURRENT_ANALYSIS_VERSION` is part of every automatic cache key. Patch 6 uses `auto-6.0`; changing the analysis contract must bump this value.

Cache identity also includes:

- stable file identity or normalized remote resource identity
- imported timing-grid revision
- committed BPM override
- reanalysis mode

The persisted Zustand store is version 6. Hydration treats persisted values as untrusted input. Structurally invalid records are quarantined, removed from the usable analysis map, and marked stale instead of crashing track loading. Valid older-schema records may be retained for migration/reference but are never accepted by the coordinator as a current cache hit.

A failed or corrupt migration falls back to fresh local analysis. User-created Track Map sections and suppression state live outside the automatic cache and therefore survive automatic cache invalidation. Grid-only rebuilds preserve manual, imported, and locked sections.

## Cancellation and track replacement

The coordinator owns both decode and CPU-analysis cancellation. One `AbortSignal` flows through decoding and `analyzeTrackBuffer`. The analyzer checks it at stage boundaries and yields cooperatively during the feature pass, allowing a removed or replaced track to stop without publishing stale results.

Generation checks, active-track checks, and atomic publication provide a second guard. A late result from an old track cannot overwrite the newly selected track.

## Performance safeguards

- One decode and one shared feature-extraction pass per cache miss
- Bounded in-memory decoded-buffer LRU
- One analysis job by default, with priority for the active track
- Full-hop FFT/transient state, but retained feature snapshots approximately every 50 ms
- Retained chroma snapshots approximately every 250 ms
- Pitch estimation only on retained feature frames
- Cooperative CPU yields every 256 analysis frames
- Self-similarity dimension capped at 512 bars
- No full similarity/novelty matrices persisted after completion
- Feature curves downsampled before persistence
- Bounded structural candidates, alternatives, phrases, semantic moments, and hierarchy units
- One atomic Music Intelligence publication rather than chained React state updates
- Render-loop consumers read the shared frame directly and avoid high-frequency React rerenders

`analysisDiagnostics` records feature-pass count, retained point counts, cooperative yields, grid counts, structural source, matrix dimensions/bytes, and hierarchy/classifier counts. These fields are suitable for diagnostics and regression assertions, not UI choreography.

## Fallback behavior

Sophisticated interpretation is optional to app usability. Expected fallback cases include silence, extremely short material, weak or unavailable BPM, free-time intros, sparse percussion, time-signature ambiguity, missing harmonic confidence, decode failure, cancellation, and malformed cache data.

Fallback principles:

- never throw a corrupt cache payload into the live engine
- never silently promote a low-confidence guess to authoritative semantics
- preserve deterministic time spans when musical bars cannot be trusted
- publish capability flags that expose what is and is not reliable
- keep transport, Track Map editing, visual rendering, seeking, and looping usable
- leave uncertain regions Unknown when that is more honest than a forced label

## Manual editing

Track Map is the editing surface for the resolved timeline. Manual boundary drags, replacements, created sections, locks, imports, and suppression are resolved through the authority layer before publication. Downstream consumers do not merge these sources independently.

When adding a new edit operation:

1. Preserve stable section/provenance identity.
2. Update the authoritative resolver, not an engine-specific array.
3. Publish analysis and resolved sections together.
4. Add seek, loop, suppression, and persistence regression coverage.

## Adding future structural features

1. Add the feature to the shared offline pass or per-bar aggregation.
2. Keep retained data bounded and include a diagnostic count/size where useful.
3. Add its candidate evidence to the centralized structural weighting model.
4. Add contextual evidence without forcing unrelated genres into bass-music labels.
5. Preserve `Unknown` and fallback behavior.
6. Bump the analysis version if persisted shape or interpretation compatibility changes.
7. Add synthetic fixtures for the intended structure and adjacent failure modes.
8. Publish through `setAuthoritativeTrackState`; do not wire a new direct engine path.

## Consumer contract

Section-aware systems must consume these fields from the shared Music Intelligence frame:

- `resolvedSections`
- `currentResolvedSection`
- `timelineRevision`
- `analysisRevision`
- `analysisCapabilities`
- `phraseMarkers`
- `semanticMoments`

Fallbacks inside renderers are compatibility guards for absent legacy data, not alternate authority. New code must not import `detectSections` into an engine, renderer, preset, or automation module.

Show Director may compile macro performance sections from the authoritative fine timeline, but occurrence identity, seeking, looping, and 4/8/16-bar counters must remain deterministic. Track replacement must reset compiled state. Low-confidence upstream analysis must reduce specificity rather than destabilize choreography.

## Known limitations

- Automatic downbeat and section interpretation currently assumes a four-beat bar for generated grids. Imported grids can supply stronger timing authority, but arbitrary changing meters are not fully modeled.
- No required learned model or genre classifier is used. The contextual rules are local, explainable, and deliberately conservative.
- Free-time, highly ambient, sparse, or rhythmically ambiguous music may use fallback bars or more `Unknown` sections.
- Browser/Electron decode support still determines which local file formats can be analyzed.
- CPU analysis is cooperative and cancellable but remains in the browser process. A future worker may wrap the same analyzer contract without changing timeline authority or cache identity.
