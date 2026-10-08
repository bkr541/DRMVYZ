# Lyric Manager — Track Timeline: issues review

Scope: the Track Timeline window in the Lyric Manager (ruler, track sections, audio waveform, two lyric cue lanes, beat grid), the cue editor model and hook behind it, and the toolbar zoom control.

Method: static review of the code, compared against a screenshot of the running UI. Nothing was executed. Each issue states its **confidence**:

- **Confirmed in code** — the behaviour follows directly from the code cited.
- **Inferred** — the code and the screenshot point to the cause, but it was not reproduced or isolated.

Files referenced (all under `src/`):

| Short name | Path |
| --- | --- |
| Track window | `features/lyrics/components/LyricTrackTimelineWindow.tsx` |
| Cue timeline | `features/lyrics/editor/LyricCueTimeline.tsx` |
| Waveform canvas | `features/lyrics/editor/LyricWaveformCanvas.tsx` |
| Cue model | `features/lyrics/editor/lyricCueEditorModel.ts` |
| Cue editor hook | `features/lyrics/editor/useLyricCueEditor.ts` |
| Lyric Manager view | `features/lyrics/LyricManagerView.tsx` |
| Toolbar | `features/lyrics/components/LyricTimelineToolbar.tsx` |
| Cue window wrapper | `features/lyrics/components/LyricCuesWindow.tsx` |
| Lyric CSS | `styles/lyricManager.css` |

Line numbers are as of this review and will drift.

---

## Priority summary

| Priority | Meaning | Issues |
| --- | --- | --- |
| **P1 — Critical** | Wrong timing data, or core interaction missing, in a tool whose job is precise timing | 1, 2, 3, 4, 5 |
| **P2 — High** | Visible defects that make the timeline hard to read or use | 6, 7, 8, 9, 10, 11 |
| **P3 — Medium** | Interaction rough edges and data-handling risks | 12, 13, 14, 15, 16, 17 |
| **P4 — Low** | Performance, accessibility and code health | 18, 19, 20, 21, 22 |

---

# P1 — Critical

## 1. Cue lanes and the audio / beat rows are driven by different clocks

**Confidence:** Confirmed in code (the visible effect is inferred).

**Where**
- Track window computes its viewport from the live engine time at render: `currentSec = getCurrentTimeMs?.() ?? currentTimeMs` (Track window, ~lines 133–138).
- Cue timeline computes its viewport from the `currentTimeMs` prop (Cue timeline, ~lines 213–225).
- That prop comes from `currentAudioTimeMs`, a React state value refreshed by a 200 ms `setInterval` (Lyric Manager view, ~lines 457–467).

**What happens**
The sections, waveform and beat rows use fresh time; the lyric cue lanes use time that can be up to 200 ms old. Both are meant to share one viewport ("pixel-aligned" per the component comments). At zoom 1 the viewport is the whole track, so it does not matter. At higher zoom the viewport follows the playhead, so the two groups of rows are positioned from different times.

**Impact**
During playback at zoom, lyric cues drift against the waveform and beat grid. At the toolbar's maximum zoom (16×, roughly a 10 s window across about 1,460 px) 200 ms is about 30 px of misalignment — enough to mis-place a cue edge against a beat.

**Suggested direction**
One time source for every row. Derive the viewport once in a parent from the same value and pass it down, and read the live time (not a 200 ms state value) for anything that positions content.

## 2. Playhead-based editing actions use the stale 200 ms time

**Confidence:** Confirmed in code.

**Where**
`canonicalPlayheadMs` in the cue editor hook is computed from the `currentTimeMs` prop (Cue editor hook, ~lines 144–146). It feeds "add cue at playhead", "split at playhead", and "set cue start / end to playhead" (~lines 214, 231, 297–308).

**What happens**
The value is whatever the last 200 ms tick captured, rounded to a millisecond, so it can be up to 200 ms behind the audio the user is hearing. The hook already receives `getCurrentTimeMs` but does not use it for these actions.

**Impact**
A timing editor whose "mark it now" buttons are off by up to a beat. At 150 BPM a beat is 400 ms, so 200 ms is half a beat. Users will either re-nudge every captured cue or distrust the buttons.

**Suggested direction**
Read the live time at the moment of the action (`getCurrentTimeMs()`), not from state.

## 3. The Track rows cannot be clicked, and there is no scrubbing

**Confidence:** Confirmed in code.

**Where**
- The Track window has no seek prop and no pointer handlers on its ruler, sections, waveform or beat rows (Track window, whole file).
- Only the cue lanes seek, on background pointer-down (Cue timeline `handleBackgroundSeek`, ~lines 512–523).

**What happens**
Clicking the ruler, sections or waveform does nothing. Seeking works only by clicking empty space in the lyric lanes. It fires once on pointer-down; dragging does not scrub. Every seek click also deselects the selected cue (`onSelectCue(null)`).

**Impact**
The most natural place to seek in any timeline (the waveform or ruler) is dead. Seeking from the lyric lanes also loses the user's cue selection, which interrupts editing.

**Suggested direction**
Give the whole lane stack one pointer surface for seek and drag-scrub; keep selection separate from seeking, or only clear selection on an explicit background click.

## 4. Waveform resolution does not increase with zoom

**Confidence:** Confirmed in code (peak count from the shared peak generation).

**Where**
The waveform canvas draws one bar per entry of a fixed peak array (Waveform canvas, ~lines 55–67). The stored and live peaks are a fixed 2,000 entries for the whole track.

**What happens**
Zooming only stretches the same 2,000 bars. On a 2:44 track one bar is about 82 ms. At 16× each bar is about 20 px wide and there are about 120 bars across the view.

**Impact**
For aligning words and cue edges to transients, the waveform stops being useful exactly when precision is needed. It reads as blocks rather than a waveform.

**Suggested direction**
Multi-resolution peaks (several detail levels computed once, chosen by zoom), or on-demand peaks for the visible window.

## 5. The waveform and the timeline can disagree on duration

**Confidence:** Inferred for the right-edge gap; confirmed in code for the duration fallbacks.

**Where**
- The waveform maps peak index to time using the duration passed in (Waveform canvas, ~lines 38–56). It assumes the peaks cover exactly that duration.
- The Track window clamps duration to at least 1 s (`Math.max(1, durationMs / 1000)`, ~line 133). The cue timeline instead infers duration from the cues when none is known (Cue timeline, ~lines 205–211).

**What happens**
If the stored peaks were built from a decode whose length differs even slightly from the analysis duration, the waveform ends short of, or runs past, the lane. In the reviewed screenshot the waveform appears to stop slightly before the right edge. Separately, when duration is unknown the rows are scaled to different totals.

**Impact**
A systematic, growing offset between waveform and every other row toward the end of the track, and whole rows on different scales when duration is missing.

**Suggested direction**
Store the peaks with the duration they were computed for, and scale to that. Use one shared duration resolver for all rows.

---

# P2 — High

## 6. Section labels overflow into neighbouring sections

**Confidence:** Confirmed in code.

**Where**
`TrackSectionRow` (Track window, ~lines 40–61) places `span.rv-section-label` directly inside `.rv-section-region`. In Track Map the label sits inside a flex wrapper (`.rv-section-body`) that gives the ellipsis and `flex: 1; min-width: 0` rules something to act on. The component comment says the classes are reused "verbatim", but the wrapper is missing, and `.rv-section-region` is a plain absolutely positioned block here.

**What happens**
The label's `overflow: hidden; text-overflow: ellipsis` has no effect on an inline span in a block, so text runs across the next section. In the screenshot: INTRO 1 and 2, PRE-DROP over SECTION 5, BREAKDOWN over SECTION 9, and the BUILD / PRE-DROP / BUILD 13 / SECTION / OUTRO run at the end.

**Impact**
The section row is unreadable wherever sections are short, which is most of the row on this track.

**Suggested direction**
Reuse the real Track Map markup (or give the region a flex wrapper), clip labels to their section, and hide labels for sections too narrow to hold more than a few characters.

## 7. Cue blocks overlap each other even when their times do not

**Confidence:** Confirmed in code.

**Where**
- Lane assignment looks only at time (`assignCueOverlapLanes`, Cue model, ~lines 512–527).
- Block width is `max(widthPct, 0.3%)` plus 8 px padding and two 9 px handles (Cue timeline, ~lines 774–782; Lyric CSS, ~lines 2901–2910).

**What happens**
A block's visual minimum is about 26 px. Two cues closer than that in the same lane draw on top of each other even though they do not overlap in time. Seen in the screenshot at cues 6–8, 12/13, 17–19 and 23/24.

**Impact**
Neighbouring cues cannot be told apart or grabbed individually at normal zoom.

**Suggested direction**
Pack lanes in pixels at the current zoom (a cue claims its pixel width, minimum included), or merge dense runs into a collapsed marker until zoomed in.

## 8. The "!" warning mark spills out of narrow cues

**Confidence:** Confirmed in code.

**Where**
`lyric-cue-block__state` (Cue timeline, ~lines 839–841) renders `▶`, `●` or `!` without being clipped to the block.

**What happens**
When a block is narrower than its content, the glyph overflows to the right, so warnings appear as stray `!` marks between cues (visible after cues 2, 3, 10/11, 13, 14 and 15).

**Impact**
Misleading: the mark looks like it belongs to the gap, not to the cue, and it adds clutter in the busiest areas.

**Suggested direction**
Clip the glyph to the block, or move warning state to a fixed corner badge that is hidden when the block is too narrow, with the details in a tooltip.

## 9. Cue text is invisible at overview zoom and has no tooltip

**Confidence:** Confirmed in code.

**Where**
Cue blocks have an `aria-label` but no `title` (Cue timeline, ~lines 787–788). The text span is clipped by the narrow block.

**What happens**
At zoom 1 only the cue number shows, and hovering shows nothing, so the lyric is unreadable without selecting the cue or zooming.

**Impact**
No way to scan the song's lyrics along the timeline.

**Suggested direction**
Add a `title` (or a custom hover card) with the lyric text, time range and any warning messages.

## 10. Waveform shows dark vertical lines and a saturated look

**Confidence:** Confirmed in code for the lines; inferred for the saturation.

**Where**
Each bar is drawn at `visibleIndex * barWidth` with width `max(1, barWidth - 0.4)` (Waveform canvas, ~lines 60–68). Canvas pixel width divided by the peak count is rarely a whole number.

**What happens**
Fractional bar positions and a 1 px minimum width leave a regular pattern of anti-aliased gaps (the "barcode" lines in the screenshot). The bars use raw peak values, so a loud track sits near full height with little contrast.

**Impact**
A noisy, hard-to-read waveform with visible rendering artefacts.

**Suggested direction**
Draw one column per device pixel using the min/max of the peaks that column covers; consider a mild loudness curve.

## 11. The playhead does not cross the whole stack

**Confidence:** Confirmed in code.

**Where**
The playhead element is rendered only inside the cue timeline (Cue timeline, ~lines 660–667). The ruler, sections, audio and beat rows have none (the audio lane draws a tint for the played portion only).

**What happens**
The playhead line spans the lyric lanes (and the beat row beneath them) but stops there; the audio, sections and ruler show no line.

**Impact**
Hard to read the exact audio position against the waveform, which is the row users look at to time a cue.

**Suggested direction**
Draw one playhead layer over the entire lane stack.

---

# P3 — Medium

## 12. No independent pan; the view always re-centres on the playhead

**Confidence:** Inferred from the viewport function.

**Where**
`computeWaveformViewport(duration, current, zoom)` (`features/timeline/timelineViewport.ts`) returns a window centred on the current time; both timelines call it directly.

**What happens**
At zoom above 1 the visible range cannot be moved independently of the playhead. Dragging a cue while playing means the view moves under the pointer.

**Impact**
You cannot look ahead of the playhead and edit, or edit steadily during playback.

**Suggested direction**
A user-controlled viewport (pan, follow-playhead toggle), with the current behaviour as "follow".

## 13. Content moves in 200 ms steps at high zoom

**Confidence:** Inferred.

**Where**
Because of the 200 ms state tick (issue 1), the viewport changes five times a second, while the playhead is moved every animation frame (Cue timeline, ~lines 307–342).

**What happens**
At high zoom the playhead sweeps across and then snaps back as the viewport jumps.

**Impact**
Visibly jerky timeline during playback.

**Suggested direction**
Drive viewport and playhead from the same per-frame value.

## 14. The zoom control is shared with the Audio Dock

**Confidence:** Confirmed in code.

**Where**
`waveformZoom` comes from the global visual store (Cue editor hook, ~line 132). The toolbar labels it "Shared waveform zoom" and shows the value with two decimals (Toolbar, ~lines 115–117).

**What happens**
Changing zoom in the Lyric Manager changes the Audio Dock waveform zoom, and the reverse. Integer steps display as "Zoom 1.00×".

**Impact**
Surprising cross-view side effect; the readout is noisier than it needs to be.

**Suggested direction**
Decide whether the coupling is intended; if so, say so in the UI. Show whole numbers when the value is whole.

## 15. Keyboard nudges can silently do nothing; delete has no confirmation

**Confidence:** Confirmed in code.

**Where**
- Arrow-key nudges (10 ms, 100 ms with Shift, 1 ms with Alt) pass through `snapCanonical` (Cue timeline, ~lines 344–357, 535–565). Beat, half-beat, quarter-beat and word snap modes round to the nearest grid line (Cue model, ~lines 210–243).
- Delete / Backspace on a focused cue deletes it immediately (Cue timeline, ~lines 813–819).

**What happens**
With Beat snap on, a 10 ms nudge snaps back to the same beat, so nothing moves unless Ctrl/Cmd is held. Deleting a cue with a stray key press has no confirmation.

**Impact**
Keyboard fine-tuning appears broken in snap modes; accidental deletion is easy.

**Suggested direction**
Nudges should step past the current snap position (or bypass snapping), and deletion should rely on undo or a confirmation.

## 16. A cue may be only 1 ms long

**Confidence:** Confirmed in code.

**Where**
`MIN_LYRIC_CUE_DURATION_MS = 1` (Cue model, line 11).

**What happens**
Resizing and moving accept cues down to 1 ms, which render as invisible blocks and stretch to the visual minimum.

**Impact**
Easy to create cues that cannot be seen or grabbed again.

**Suggested direction**
A practical minimum (for example 100 ms), enforced in the model.

## 17. Section naming and density

**Confidence:** Inferred from the screenshot; the labelling is generated upstream.

**Where**
`adaptMIAnalysis` / `resolveTrackSections` supply the sections shown (Lyric Manager view, ~lines 1818–1823).

**What happens**
The 2:44 track shows about 17 sections, several only seconds long, with generic names (SECTION 5, 9, 13) and back-to-back duplicates (INTRO 1, INTRO 2).

**Impact**
Compounds issue 6 and makes the section row less useful as orientation.

**Suggested direction**
Merge or hide very short sections on this row, and give unknown types a more meaningful label. This is an analysis-quality question as much as a UI one.

---

# P4 — Low

## 18. The whole Lyric Manager re-renders five times a second

**Confidence:** Confirmed in code (cost not measured).

**Where**
The 200 ms interval sets state in the 2,400-line view (Lyric Manager view, ~lines 457–467). On each render, section resolution, beat-grid conversion and (for tracks without detected beats) a synthetic BPM grid are recomputed without memoisation (~lines 1765–1823).

**Impact**
Unnecessary work during playback, and the source of the 200 ms granularity behind issues 1, 2 and 13.

**Suggested direction**
Memoise derived data; keep playback time out of React state and give consumers a live getter.

## 19. The beat and ruler canvases redraw on every render, even at zoom 1

**Confidence:** Confirmed in code.

**Where**
The viewport is built with `useMemo` keyed on the current time (Track window, ~lines 135–138), so a new object is created on every tick even when zoom is 1 and the window never changes. The beat and ruler rows redraw and re-create their `ResizeObserver` whenever the viewport object changes (~lines 65–106).

**Impact**
Wasted drawing and observer churn during playback.

**Suggested direction**
Return a stable viewport object when its values have not changed.

## 20. Cue issue checking scales poorly

**Confidence:** Confirmed in code (cost not measured).

**Where**
`getCueIssues` calls `findCueOverlaps(cues)` for every cue and then searches the cue list again for each overlap (Cue model, ~lines 292–348), from `issuesByCue` in the cue timeline.

**Impact**
Roughly quadratic or worse in the number of cues; noticeable on long cue lists after each edit.

**Suggested direction**
Compute overlaps once per edit and share the result.

## 21. Nested interactive controls in cue blocks

**Confidence:** Confirmed in code.

**Where**
Each cue is `role="button"` with `tabIndex=0` and contains two real `<button>` resize handles (Cue timeline, ~lines 759–855).

**Impact**
Buttons inside a button role are invalid for assistive technology and make focus order and screen-reader output unreliable.

**Suggested direction**
Make the handles non-interactive children with the drag handled on the block, or restructure the cue as a group with separate controls.

## 22. Dead props and missing alignment tests

**Confidence:** Confirmed in code.

**Where**
- `LyricTrackTimelineWindow` declares `trackId`, `trackUrl` and `decodedBuffer` props, and the view passes them, but the component never uses them (Track window, ~lines 14–34 vs. the destructuring at ~lines 116–132).
- The only timeline tests cover the cue timeline in isolation.

**Impact**
Misleading API surface, and nothing guards the one property the layout depends on: that the Track window's rows and the cue lanes line up.

**Suggested direction**
Remove the unused props, and add a test that renders both with the same inputs and compares their viewports.

---

## Not verified

- Whether the waveform's right-edge gap is a peaks/duration mismatch or the scroll gutter (issue 5).
- The size of the performance cost in issues 18 to 20; no profiling was done.
- Whether the lyric analysis itself produces too many short sections (issue 17).
- The visual effect of issues 1 and 13 in motion; these were derived from the code, not observed.
