# Lyric Manager

Lyric Manager is the track-first authoring and review surface for timed lyrics. It shares the canonical audio transport, decoded waveform, Track Map analysis, and runtime lyric state used elsewhere in DRMVYZ.

## Saved-track identity

A User Media audio row is the canonical lyric owner. Loading a saved track preserves its `audio_tracks.id` as the runtime `dbId`; active lyrics are resolved only from that persisted identity. Loading an unpersisted local file clears the previous runtime lyrics. Linking a local file to User Media requires an explicit confirmation and reloads the confirmed saved track rather than associating files by name.

## Versions, activation, and global display

Saving the open editor document and activating a runtime version are separate actions. The first successful AI extraction becomes active only when the track has no active version. Later extractions remain inactive until the user confirms replacement. The global lyric-display switch controls whether the actual active document is rendered during playback; it does not silently activate the document currently open in the editor.

## AI extraction and Cue Styles

AI extraction uses the configured Groq transcription provider and stores word timing when it is available. The user-facing Cue Styles are Hip-Hop / Rap, Balanced, Melodic, and Vocal Chops. Track Map beats, bars, phrases, and sections guide segmentation without changing authoritative word timestamps. **Reformat Cues** creates a new lyric version from existing word timing and leaves the source version unchanged.

## Vocal Reference

A saved vocal stem can be selected as the transcription source while the full mix remains the playback track and lyric owner. The job records the source relationship and timing offset. The offset is applied once when provider timing is converted to the full-mix timeline. Normal playback continues to load the full mix and resolve its active lyrics.

## Waveform editing

The lyric timeline reuses the shared Audio Engine waveform and playhead. Click the waveform to seek. Drag a cue body to move it, drag either edge to resize it, and edit selected word boundaries in the word lane or inspector. Overlaps are assigned readable lanes. Undo and redo cover cue and word timing operations. Snapping can use milliseconds, frames, words, or the authoritative detected beat grid.

When detected analysis is unavailable, the editor labels a BPM-derived grid as temporary and offers **Analyze Track**, **Retry Track Analysis**, or **Load & Analyze Track** as appropriate. Completing analysis refreshes overlays and snapping without discarding unsaved lyric edits.

## Presentation controls

Document defaults and cue overrides expose the common renderer-supported controls: text color, font size, weight, alignment, screen anchor, custom position, opacity, animation preset, and effect preset. Cue overrides inherit document defaults until changed. Advanced JSON remains available for uncommon supported metadata, and unknown fields are preserved during edits.

## Review and validation

Review status is reported as separate counts for unreviewed cues, low-confidence cues, warnings, errors, and unique cues needing attention. A validation issue opens the affected cue, seeks and centers the waveform near it, scrolls the cue into view, and focuses the affected word where available.

Cue count means timed lyric lines. Word count means optional timed word objects nested inside those cues, so a document can contain cues without word timing.

## Workflow Status and troubleshooting

The right rail includes **Workflow Status** for the selected track, loaded-track match, active version, cue count, Track Map availability, extraction source, Cue Style, save state, and review state. Its collapsed advanced diagnostics show bounded identifiers and revisions for the final signal path. Provider secrets, signed URLs, raw payloads, and private storage paths are never displayed.

For extraction deployment and provider configuration, see [lyric-transcription-deployment.md](lyric-transcription-deployment.md). For repository validation, see [verification.md](verification.md).
