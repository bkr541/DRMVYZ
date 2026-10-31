# Lyric Manager

Lyric Manager is the track-first authoring and review surface for timed lyrics. It shares the canonical audio transport, decoded waveform, Track Map analysis, and runtime lyric state used elsewhere in DRMVYZ.

## Saved-track identity

In the left Track Workspace, Tracks, Import, and AI Extract content uses the
same horizontal inset as the tab row. Group bodies add no second side inset;
track artwork, search controls, group headings, and row dividers start on the
cyan underline's left edge and share the tab row's right content edge.

A User Media audio row is the canonical lyric owner. Loading a saved track preserves its `audio_tracks.id` as the runtime `dbId`; active lyrics are resolved only from that persisted identity. Loading an unpersisted local file clears the previous runtime lyrics. Linking a local file to User Media requires an explicit confirmation and reloads the confirmed saved track rather than associating files by name.

## Versions, activation, and global display

Saving the open editor document and activating a runtime version are separate actions. The first successful AI extraction becomes active only when the track has no active version. Later extractions remain inactive until the user confirms replacement. The global lyric-display switch controls whether the actual active document is rendered during playback; it does not silently activate the document currently open in the editor.

## AI extraction and Cue Styles

The header activity indicator animates while AI Extract recovers a job, prepares audio, starts or retries extraction, or waits for a queued or processing job. It returns to idle after completion, failure, or cancellation when no other page work is active. The extraction panel also updates the page's job summary as job status changes.

AI extraction uses the configured Groq transcription provider and stores word timing when it is available. The user-facing Cue Styles are Hip-Hop / Rap, Balanced, Melodic, and Vocal Chops. Track Map beats, bars, phrases, and sections guide segmentation without changing authoritative word timestamps. **Reformat Cues** creates a new lyric version from existing word timing and leaves the source version unchanged.

## Vocal Reference

A saved vocal stem can be selected as the transcription source while the full mix remains the playback track and lyric owner. The job records the source relationship and timing offset. The offset is applied once when provider timing is converted to the full-mix timeline. Normal playback continues to load the full mix and resolve its active lyrics.

## Waveform editing

The lyric timeline reuses the shared Audio Engine waveform and playhead. Click the waveform to seek. Drag a cue body to move it, drag either edge to resize it, and edit selected cue and word timing in the expanded Cue list record. Clicking a record again collapses its details. The top header owns add, undo/redo, timing commands, analysis, and cue deletion, plus the Track Map label-gutter toggle. Overlaps are assigned readable lanes. Undo and redo cover cue and word timing operations. Snapping can use milliseconds, frames, words, or the authoritative detected beat grid.

Track Timeline uses an integrated surface: its ruler, label gutter, reference rows, and lyric lanes share the surrounding window background with neutral row dividers. The waveform uses muted neutral bars without a playback gradient. Cue blocks have quiet fills and fine resize grips; the selected cue uses the app accent, while a neutral underline identifies a playing cue. Section colors retain their analysis meaning. Beat grid ticks use React Track Map's shared renderer and original color opacity without additional dimming.

When detected analysis is unavailable, the editor labels a BPM-derived grid as temporary and offers **Analyze Track**, **Retry Track Analysis**, or **Load & Analyze Track** as appropriate. Completing analysis refreshes overlays and snapping without discarding unsaved lyric edits.

## Presentation controls

Document defaults and cue overrides expose the common renderer-supported controls: text color, font size, weight, alignment, screen anchor, custom position, opacity, animation preset, and effect preset. Cue overrides inherit document defaults until changed. Advanced JSON remains available for uncommon supported metadata, and unknown fields are preserved during edits.

## Review and validation

The Review tab owns validation and review counts; there is no pinned summary below the inspector. Review status is reported as separate counts for unreviewed cues, low-confidence cues, warnings, errors, and unique cues needing attention. A validation issue opens the affected cue, seeks and centers the waveform near it, scrolls the cue into view, and focuses the affected word where available.

Cue count means timed lyric lines. Word count means optional timed word objects nested inside those cues, so a document can contain cues without word timing.

## Workflow Status and troubleshooting

The right rail includes **Workflow Status** for the selected track, loaded-track match, active version, cue count, Track Map availability, extraction source, Cue Style, save state, and review state. Its collapsed advanced diagnostics show bounded identifiers and revisions for the final signal path. Provider secrets, signed URLs, raw payloads, and private storage paths are never displayed.

For extraction deployment and provider configuration, see [lyric-transcription-deployment.md](lyric-transcription-deployment.md). For repository validation, see [verification.md](verification.md).

The header button group stays centered on the full header row at every layout size, independently of the status and profile controls aligned at the right.

## Cue list controls

Track Timeline and Cue list parent groups share the standard workspace side inset, a 10px gap below their heading divider, and no extra horizontal body inset. Track Timeline also removes the label gutter's leading padding, aligning the lane icons and timeline edge with its heading and divider. Its compact 80px label column leaves more space for the ruler, waveform, sections, and cues; every lane and the playhead share that same offset. Cue list uses the same integrated surface, neutral dividers, and accent selection as Track Timeline, without an inset card or dark toolbar fill. Its sticky table header matches the window background, and expanded cue editors use a quiet neutral surface.

The Cue list uses the shared dropdown and a search field. Search highlights matching literal text (case insensitive) and scrolls to the first matching record within the current filter, without changing the document or cue selection. Expanded word text fields highlight matches as well. Row status dots use amber for unreviewed, green for reviewed, cyan for corrected, and red for rejected. Cue records use the timeline lyric-row height.

Cue presentation uses the shared inline palette color picker. Animation preset sits in the appearance grid; opacity spans its own row below the positions. Advanced warning toggles use two columns. Advanced diagnostics offer icon-only identifier copying.

The header actions use a single toolbar of direct icon buttons. Lyrics display,
save, cue editing, analysis and lane controls share centered 12px artwork with no
nested editing toolbar or icon wrappers. Header SVG view boxes fit the artwork
bounds so source-canvas padding does not shrink the visible icons.
The toolbar uses a 44px header, 28px button targets and 2px gaps, with subtle
hover and active surfaces and muted disabled actions.

Track cards use a 2px gap between artist and title and a 4px total gap between
the title and the duration/BPM/key row. Metadata values use plain 10px text with leading clock,
metronome and music-note icons, without visible labels or badge styling.

Loaded tracks use a single cyan status dot with a Loaded tooltip and accessible
label, without a capsule or visible status text.

Track card action icons share the title row, centering vertically on the title
rather than the full card; metadata remains on its own row below.
