import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  hasUsableLyricWordTiming,
  type LyricCue,
  type LyricWord,
} from "../../../types/lyrics";
import {
  assignCueOverlapLanes,
  getCueIssues,
  isCueActive,
  LOW_LYRIC_CONFIDENCE,
  moveCueToStart,
  resizeCueEnd,
  resizeCueStart,
  resizeLyricWordBoundary,
  snapTimeMs,
  type CueBounds,
  type LyricSnapContext,
  type LyricWordBoundaryEdge,
} from "./lyricCueEditorModel";
import { LyricWaveformCanvas } from "./LyricWaveformCanvas";
import {
  toCanonicalLyricTimeMs,
  toEffectiveLyricTimeMs,
} from "../runtime/lyricPlaybackResolver";
import {
  clientXToTimelineTime,
  computeViewportRangeLayout,
  computeWaveformViewport,
  timeToViewportRatio,
  type TimelineViewport,
} from "../../timeline/timelineViewport";
import {
  DEFAULT_TIMELINE_OVERLAY_VISIBILITY,
  selectVisibleTimelineOverlays,
  type TimelineOverlaySource,
  type TimelineOverlayVisibility,
} from "../../timeline/timelineOverlays";

export type LyricCueDragKind = "move" | "resize-start" | "resize-end";
export type LyricCueContextAction =
  | "split"
  | "merge-previous"
  | "merge-next"
  | "duplicate"
  | "mark-reviewed"
  | "delete";

type DragState =
  | { type: "cue"; cue: LyricCue; kind: LyricCueDragKind; startClientX: number }
  | {
      type: "word";
      cue: LyricCue;
      wordId: string;
      edge: LyricWordBoundaryEdge;
      startClientX: number;
      originalWords: LyricWord[];
    };

interface Props {
  cues: LyricCue[];
  selectedCueId: string | null;
  currentTimeMs: number | null;
  getCurrentTimeMs?: () => number | null;
  durationMs: number;
  zoom: number;
  globalOffsetMs?: number;
  compact?: boolean;
  waveformPeaks?: number[] | null;
  waveformLoading?: boolean;
  snapContext: LyricSnapContext;
  overlaySource?: TimelineOverlaySource;
  overlayVisibility?: TimelineOverlayVisibility;
  inactiveCueIds?: ReadonlySet<string>;
  onSelectCue: (cueId: string | null) => void;
  onSeek: (timeMs: number) => void;
  onAddCueAt?: (timeMs: number) => void;
  onCommitCue: (cueId: string, bounds: CueBounds) => void;
  onCommitWords?: (cueId: string, words: LyricWord[]) => void;
  onCueContextAction?: (
    cueId: string,
    action: LyricCueContextAction,
    authoredTimeMs: number,
  ) => void;
  onDeleteCue?: (cueId: string) => void;
}

const MAX_VISIBLE_CUE_LANES = 6;
const CUE_LANE_HEIGHT = 24;
const CUE_LANE_GAP = 4;

function keyboardDelta(event: ReactKeyboardEvent): number {
  if (event.altKey) return 1;
  if (event.shiftKey) return 100;
  return 10;
}

function formatTimelineMs(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const millis = safe % 1_000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function isBackgroundTarget(
  target: EventTarget | null,
  currentTarget: HTMLElement,
): boolean {
  return (
    target === currentTarget ||
    (target instanceof HTMLElement &&
      Boolean(target.closest('[data-timeline-background="true"]')))
  );
}

function cueStateLabel(
  cue: LyricCue,
  issues: number,
  active: boolean,
  selected: boolean,
): string {
  const states = [
    active ? "playing" : null,
    selected ? "selected" : null,
    cue.confidence !== undefined && cue.confidence < LOW_LYRIC_CONFIDENCE
      ? "low confidence"
      : null,
    issues > 0 ? `${issues} warning${issues === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return states.length ? `, ${states.join(", ")}` : "";
}

export function LyricCueTimeline({
  cues,
  selectedCueId,
  currentTimeMs,
  getCurrentTimeMs,
  durationMs,
  zoom,
  globalOffsetMs = 0,
  compact = false,
  waveformPeaks = null,
  waveformLoading = false,
  snapContext,
  overlaySource = { authoritative: false, markers: [], ranges: [] },
  overlayVisibility = DEFAULT_TIMELINE_OVERLAY_VISIBILITY,
  inactiveCueIds = new Set<string>(),
  onSelectCue,
  onSeek,
  onAddCueAt,
  onCommitCue,
  onCommitWords,
  onCueContextAction,
  onDeleteCue,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [widthPx, setWidthPx] = useState(1);
  const [liveBounds, setLiveBounds] = useState<{
    cueId: string;
    bounds: CueBounds;
  } | null>(null);
  const [liveWords, setLiveWords] = useState<{
    cueId: string;
    words: LyricWord[];
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    cueId: string;
    x: number;
    y: number;
    authoredTimeMs: number;
  } | null>(null);
  const liveBoundsRef = useRef<typeof liveBounds>(null);
  const liveWordsRef = useRef<typeof liveWords>(null);

  const knownDurationMs =
    Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : 0;
  const inferredDurationMs = Math.max(
    currentTimeMs ?? 0,
    ...cues.map((cue) => toEffectiveLyricTimeMs(cue.endMs, globalOffsetMs)),
  );
  const safeDurationMs = Math.max(1, knownDurationMs || inferredDurationMs);
  const durationSec = safeDurationMs / 1000;
  const safeCurrentMs = Math.max(
    0,
    Math.min(safeDurationMs, currentTimeMs ?? 0),
  );
  const viewport = useMemo(
    () =>
      computeWaveformViewport(
        durationSec,
        safeCurrentMs / 1000,
        Math.max(1, zoom),
      ),
    [durationSec, safeCurrentMs, zoom],
  );
  const viewportSpanMs = Math.max(
    1,
    (viewport.endSec - viewport.startSec) * 1000,
  );
  const issuesByCue = useMemo(
    () =>
      new Map(cues.map((cue) => [cue.id, getCueIssues(cue, cues, durationMs)])),
    [cues, durationMs],
  );
  const laneLayout = useMemo(() => assignCueOverlapLanes(cues), [cues]);
  const laneByCue = useMemo(
    () =>
      new Map(laneLayout.assignments.map((item) => [item.cueId, item.lane])),
    [laneLayout],
  );
  const shownLaneCount = Math.max(
    1,
    Math.min(MAX_VISIBLE_CUE_LANES, laneLayout.laneCount || 1),
  );
  const selectedCue = cues.find((cue) => cue.id === selectedCueId) ?? null;
  const selectedWords = (
    liveWords?.cueId === selectedCueId
      ? liveWords.words
      : (selectedCue?.words ?? [])
  ).filter(hasUsableLyricWordTiming);
  const hasWordLane =
    !compact && Boolean(selectedCue && selectedWords.length > 0);
  const cueAreaTop = compact ? 2 : hasWordLane ? 140 : 108;
  const timelineHeight = compact
    ? undefined
    : cueAreaTop + shownLaneCount * (CUE_LANE_HEIGHT + CUE_LANE_GAP) + 8;
  const visibleOverlays = useMemo(
    () =>
      selectVisibleTimelineOverlays(
        overlaySource,
        viewport,
        widthPx,
        overlayVisibility,
      ),
    [overlaySource, overlayVisibility, viewport, widthPx],
  );

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const update = () =>
      setWidthPx(Math.max(1, inner.getBoundingClientRect().width));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (compact) return;
    const updatePlayhead = () => {
      const playhead = playheadRef.current;
      if (!playhead) return;
      const current =
        Math.max(
          0,
          Math.min(safeDurationMs, getCurrentTimeMs?.() ?? currentTimeMs ?? 0),
        ) / 1000;
      const ratio = timeToViewportRatio(current, viewport);
      playhead.style.transform = `translateX(${Math.max(0, Math.min(1, ratio)) * widthPx}px)`;
      playhead.hidden = ratio < 0 || ratio > 1;
    };
    updatePlayhead();
    if (!getCurrentTimeMs) return;
    let frame = 0;
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      updatePlayhead();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(frame);
    };
  }, [
    compact,
    currentTimeMs,
    getCurrentTimeMs,
    safeDurationMs,
    viewport,
    widthPx,
  ]);

  const snapCanonical = useCallback(
    (rawMs: number, bypass = false) => {
      if (bypass) return Math.max(0, Math.round(rawMs));
      const displayed = toEffectiveLyricTimeMs(rawMs, globalOffsetMs);
      return Math.max(
        0,
        toCanonicalLyricTimeMs(
          snapTimeMs(displayed, snapContext),
          globalOffsetMs,
        ),
      );
    },
    [globalOffsetMs, snapContext],
  );

  const boundsForDrag = useCallback(
    (
      drag: Extract<DragState, { type: "cue" }>,
      deltaMs: number,
      bypassSnap: boolean,
    ): CueBounds => {
      if (drag.kind === "move") {
        return moveCueToStart(
          drag.cue,
          snapCanonical(drag.cue.startMs + deltaMs, bypassSnap),
          durationMs,
        );
      }
      if (drag.kind === "resize-start") {
        return resizeCueStart(
          drag.cue,
          snapCanonical(drag.cue.startMs + deltaMs, bypassSnap),
          durationMs,
        );
      }
      return resizeCueEnd(
        drag.cue,
        snapCanonical(drag.cue.endMs + deltaMs, bypassSnap),
        durationMs,
      );
    },
    [durationMs, snapCanonical],
  );

  const beginCueDrag = useCallback(
    (event: ReactPointerEvent, cue: LyricCue, kind: LyricCueDragKind) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      onSelectCue(cue.id);
      dragRef.current = { type: "cue", cue, kind, startClientX: event.clientX };
      const initial = {
        cueId: cue.id,
        bounds: { startMs: cue.startMs, endMs: cue.endMs },
      };
      liveBoundsRef.current = initial;
      setLiveBounds(initial);
    },
    [onSelectCue],
  );

  const beginWordDrag = useCallback(
    (
      event: ReactPointerEvent,
      cue: LyricCue,
      wordId: string,
      edge: LyricWordBoundaryEdge,
    ) => {
      if (event.button !== 0 || !cue.words?.length) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const originalWords = cue.words.map((word) => ({ ...word }));
      dragRef.current = {
        type: "word",
        cue,
        wordId,
        edge,
        startClientX: event.clientX,
        originalWords,
      };
      const initial = { cueId: cue.id, words: originalWords };
      liveWordsRef.current = initial;
      setLiveWords(initial);
    },
    [],
  );

  const updateDrag = useCallback(
    (event: ReactPointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const liveWidthPx =
        innerRef.current?.getBoundingClientRect().width || widthPx;
      const deltaMs =
        ((event.clientX - drag.startClientX) / Math.max(1, liveWidthPx)) *
        viewportSpanMs;
      const bypassSnap = event.ctrlKey || event.metaKey;
      if (drag.type === "cue") {
        const next = {
          cueId: drag.cue.id,
          bounds: boundsForDrag(drag, deltaMs, bypassSnap),
        };
        liveBoundsRef.current = next;
        setLiveBounds(next);
        return;
      }

      const originalWord = drag.originalWords.find(
        (word) => word.id === drag.wordId,
      );
      if (!originalWord || !hasUsableLyricWordTiming(originalWord)) return;
      const base =
        drag.edge === "start" ? originalWord.startMs : originalWord.endMs;
      const syntheticCue = { ...drag.cue, words: drag.originalWords };
      const words = resizeLyricWordBoundary(
        syntheticCue,
        drag.wordId,
        drag.edge,
        snapCanonical(base + deltaMs, bypassSnap),
      );
      const next = { cueId: drag.cue.id, words };
      liveWordsRef.current = next;
      setLiveWords(next);
    },
    [boundsForDrag, snapCanonical, viewportSpanMs, widthPx],
  );

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    const bounds = liveBoundsRef.current;
    const words = liveWordsRef.current;
    dragRef.current = null;
    liveBoundsRef.current = null;
    liveWordsRef.current = null;
    setLiveBounds(null);
    setLiveWords(null);
    if (!drag) return;
    if (drag.type === "cue") {
      if (!bounds || bounds.cueId !== drag.cue.id) return;
      if (
        bounds.bounds.startMs === drag.cue.startMs &&
        bounds.bounds.endMs === drag.cue.endMs
      )
        return;
      onCommitCue(drag.cue.id, bounds.bounds);
      return;
    }
    if (!words || words.cueId !== drag.cue.id || !onCommitWords) return;
    if (JSON.stringify(words.words) !== JSON.stringify(drag.originalWords))
      onCommitWords(drag.cue.id, words.words);
  }, [onCommitCue, onCommitWords]);

  const authoredTimeAtPointer = useCallback(
    (clientX: number): number => {
      const inner = innerRef.current;
      if (!inner) return 0;
      return Math.round(
        clientXToTimelineTime(
          clientX,
          inner.getBoundingClientRect(),
          viewport,
          durationSec,
        ) * 1000,
      );
    },
    [durationSec, viewport],
  );

  const handleBackgroundSeek = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        event.button !== 0 ||
        !isBackgroundTarget(event.target, event.currentTarget)
      )
        return;
      onSelectCue(null);
      onSeek(authoredTimeAtPointer(event.clientX));
    },
    [authoredTimeAtPointer, onSeek, onSelectCue],
  );

  const handleBackgroundDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!onAddCueAt || !isBackgroundTarget(event.target, event.currentTarget))
        return;
      event.preventDefault();
      onAddCueAt(authoredTimeAtPointer(event.clientX));
    },
    [authoredTimeAtPointer, onAddCueAt],
  );

  const adjustCueByKeyboard = useCallback(
    (event: ReactKeyboardEvent, cue: LyricCue, kind: LyricCueDragKind) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      event.stopPropagation();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const amount = keyboardDelta(event) * direction;
      const bypassSnap = event.ctrlKey || event.metaKey;
      let bounds: CueBounds;
      if (kind === "move")
        bounds = moveCueToStart(
          cue,
          snapCanonical(cue.startMs + amount, bypassSnap),
          durationMs,
        );
      else if (kind === "resize-start")
        bounds = resizeCueStart(
          cue,
          snapCanonical(cue.startMs + amount, bypassSnap),
          durationMs,
        );
      else
        bounds = resizeCueEnd(
          cue,
          snapCanonical(cue.endMs + amount, bypassSnap),
          durationMs,
        );
      onCommitCue(cue.id, bounds);
    },
    [durationMs, onCommitCue, snapCanonical],
  );

  const rulerTicks = useMemo(() => {
    if (compact) return [];
    const count = 8;
    return Array.from(
      { length: count + 1 },
      (_, index) =>
        viewport.startSec +
        ((viewport.endSec - viewport.startSec) * index) / count,
    );
  }, [compact, viewport]);

  const timeline = (
    <div
      ref={innerRef}
      className={`lyric-cue-timeline__inner${compact ? " lyric-cue-timeline__inner--compact" : ""}`}
      style={timelineHeight ? { height: timelineHeight } : undefined}
      onPointerDown={handleBackgroundSeek}
      onDoubleClick={handleBackgroundDoubleClick}
      onPointerMove={updateDrag}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      data-testid="lyric-cue-timeline"
      data-timeline-background="true"
    >
      {!compact && (
        <div
          className="lyric-cue-timeline__ruler"
          aria-hidden="true"
          data-timeline-background="true"
        >
          {rulerTicks.map((tickSec, index) => (
            <span
              key={`${tickSec}-${index}`}
              className="lyric-cue-timeline__tick"
              style={{
                left: `${(index / Math.max(1, rulerTicks.length - 1)) * 100}%`,
              }}
            >
              {formatTimelineMs(tickSec * 1000).replace(".000", "")}
            </span>
          ))}
        </div>
      )}

      {!compact &&
        visibleOverlays.ranges.map((range) => {
          const layout = computeViewportRangeLayout(range, viewport);
          if (!layout.visible) return null;
          return (
            <div
              key={`section-${range.id}`}
              className="lyric-timeline-section"
              style={{
                left: `${layout.leftPct}%`,
                width: `${layout.widthPct}%`,
              }}
              title={range.label}
              aria-hidden="true"
            >
              <span>{range.label}</span>
            </div>
          );
        })}

      {!compact &&
        visibleOverlays.markers.map((marker) => (
          <div
            key={marker.id}
            className={`lyric-timeline-marker lyric-timeline-marker--${marker.kind}`}
            style={{
              left: `${timeToViewportRatio(marker.timeSec, viewport) * 100}%`,
            }}
            title={marker.label}
            aria-hidden="true"
          >
            {marker.label &&
              marker.kind !== "beat" &&
              marker.kind !== "downbeat" && <span>{marker.label}</span>}
          </div>
        ))}

      {!compact && (
        <LyricWaveformCanvas
          peaks={waveformPeaks}
          loading={waveformLoading}
          durationSec={durationSec}
          currentTimeSec={safeCurrentMs / 1000}
          viewport={viewport}
        />
      )}

      {!compact && (
        <div
          ref={playheadRef}
          className="lyric-cue-timeline__playhead"
          aria-label={`Playhead at ${formatTimelineMs(currentTimeMs ?? 0)}`}
          data-testid="lyric-playhead"
        />
      )}

      {hasWordLane && selectedCue && (
        <div
          className="lyric-word-timing-lane"
          aria-label="Selected cue word timing lane"
        >
          <span className="lyric-word-timing-lane__label">WORDS</span>
          {selectedWords.map((word, index) => {
            const displayStartMs = toEffectiveLyricTimeMs(
              word.startMs,
              globalOffsetMs,
            );
            const displayEndMs = toEffectiveLyricTimeMs(
              word.endMs,
              globalOffsetMs,
            );
            const layout = computeViewportRangeLayout(
              { startSec: displayStartMs / 1000, endSec: displayEndMs / 1000 },
              viewport,
            );
            if (!layout.visible) return null;
            const invalid =
              word.startMs < selectedCue.startMs ||
              word.endMs > selectedCue.endMs ||
              word.endMs <= word.startMs;
            const lowConfidence =
              word.confidence !== undefined &&
              word.confidence < LOW_LYRIC_CONFIDENCE;
            return (
              <div
                key={word.id}
                className={`lyric-word-segment${invalid ? " lyric-word-segment--invalid" : ""}${lowConfidence ? " lyric-word-segment--low-confidence" : ""}`}
                style={{
                  left: `${layout.leftPct}%`,
                  width: `${Math.max(layout.widthPct, 0.3)}%`,
                }}
                title={`${word.text}: ${formatTimelineMs(word.startMs)} to ${formatTimelineMs(word.endMs)}`}
                data-testid={`lyric-word-${word.id}`}
              >
                <button
                  type="button"
                  className="lyric-word-handle lyric-word-handle--start"
                  aria-label={`Adjust start of word ${index + 1}`}
                  onPointerDown={(event) =>
                    beginWordDrag(event, selectedCue, word.id, "start")
                  }
                />
                <span>{word.text}</span>
                <button
                  type="button"
                  className="lyric-word-handle lyric-word-handle--end"
                  aria-label={`Adjust end of word ${index + 1}`}
                  onPointerDown={(event) =>
                    beginWordDrag(event, selectedCue, word.id, "end")
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {cues.map((cue, index) => {
        const bounds = liveBounds?.cueId === cue.id ? liveBounds.bounds : cue;
        const displayStartMs = toEffectiveLyricTimeMs(
          bounds.startMs,
          globalOffsetMs,
        );
        const displayEndMs = toEffectiveLyricTimeMs(
          bounds.endMs,
          globalOffsetMs,
        );
        const layout = computeViewportRangeLayout(
          { startSec: displayStartMs / 1000, endSec: displayEndMs / 1000 },
          viewport,
        );
        if (!layout.visible) return null;
        const selected = cue.id === selectedCueId;
        const active =
          currentTimeMs !== null &&
          isCueActive(
            { startMs: displayStartMs, endMs: displayEndMs },
            currentTimeMs,
          );
        const issues = issuesByCue.get(cue.id) ?? [];
        const lane = laneByCue.get(cue.id) ?? 0;
        const visibleLane = Math.min(MAX_VISIBLE_CUE_LANES - 1, lane);
        const lowConfidence =
          cue.confidence !== undefined && cue.confidence < LOW_LYRIC_CONFIDENCE;
        const inactive = inactiveCueIds.has(cue.id);
        return (
          <div
            key={cue.id}
            className={[
              "lyric-cue-block",
              compact ? "lyric-cue-block--compact" : "",
              selected ? "lyric-cue-block--selected" : "",
              active ? "lyric-cue-block--active" : "",
              lowConfidence ? "lyric-cue-block--low-confidence" : "",
              inactive ? "lyric-cue-block--inactive" : "",
              liveBounds?.cueId === cue.id ? "lyric-cue-block--dragging" : "",
              issues.length ? "lyric-cue-block--warning" : "",
              lane >= MAX_VISIBLE_CUE_LANES ? "lyric-cue-block--stacked" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: `${layout.leftPct}%`,
              width: `${Math.max(layout.widthPct, 0.3)}%`,
              top: compact
                ? 2
                : cueAreaTop + visibleLane * (CUE_LANE_HEIGHT + CUE_LANE_GAP),
            }}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-current={active ? "time" : undefined}
            aria-label={`Cue ${index + 1}: ${cue.text || "empty text"}, ${formatTimelineMs(bounds.startMs)} to ${formatTimelineMs(bounds.endMs)}${cueStateLabel(cue, issues.length, active, selected)}`}
            data-cue-id={cue.id}
            data-testid={`lyric-cue-${cue.id}`}
            onPointerDown={(event) => beginCueDrag(event, cue, "move")}
            onClick={(event) => {
              event.stopPropagation();
              onSelectCue(cue.id);
            }}
            onContextMenu={(event) => {
              if (!onCueContextAction) return;
              event.preventDefault();
              event.stopPropagation();
              onSelectCue(cue.id);
              setContextMenu({
                cueId: cue.id,
                x: event.clientX,
                y: event.clientY,
                authoredTimeMs: authoredTimeAtPointer(event.clientX),
              });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectCue(cue.id);
                return;
              }
              if (
                (event.key === "Delete" || event.key === "Backspace") &&
                onDeleteCue
              ) {
                event.preventDefault();
                onDeleteCue(cue.id);
                return;
              }
              adjustCueByKeyboard(event, cue, "move");
            }}
          >
            <button
              type="button"
              className="lyric-cue-handle lyric-cue-handle--start"
              aria-label={`Adjust start of cue ${index + 1}`}
              aria-valuetext={`${bounds.startMs} milliseconds`}
              onPointerDown={(event) =>
                beginCueDrag(event, cue, "resize-start")
              }
              onKeyDown={(event) =>
                adjustCueByKeyboard(event, cue, "resize-start")
              }
            />
            <span className="lyric-cue-block__number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="lyric-cue-block__state" aria-hidden="true">
              {active ? "▶" : selected ? "●" : issues.length ? "!" : ""}
            </span>
            <span className="lyric-cue-block__text">
              {cue.text || "Empty cue"}
            </span>
            <button
              type="button"
              className="lyric-cue-handle lyric-cue-handle--end"
              aria-label={`Adjust end of cue ${index + 1}`}
              aria-valuetext={`${bounds.endMs} milliseconds`}
              onPointerDown={(event) => beginCueDrag(event, cue, "resize-end")}
              onKeyDown={(event) =>
                adjustCueByKeyboard(event, cue, "resize-end")
              }
            />
          </div>
        );
      })}

      {cues.length === 0 && (
        <div className="lyric-cue-timeline__empty">
          Double-click the waveform to add a timed lyric cue.
        </div>
      )}

      {contextMenu && onCueContextAction && (
        <div
          className="lyric-cue-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label="Lyric cue actions"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {(
            [
              ["split", "Split here"],
              ["merge-previous", "Merge previous"],
              ["merge-next", "Merge next"],
              ["duplicate", "Duplicate"],
              ["mark-reviewed", "Mark reviewed"],
              ["delete", "Delete"],
            ] as const
          ).map(([action, label]) => (
            <button
              type="button"
              role="menuitem"
              key={action}
              onClick={() => {
                onCueContextAction(
                  contextMenu.cueId,
                  action,
                  contextMenu.authoredTimeMs,
                );
                setContextMenu(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (compact) return timeline;
  return <div className="lyric-cue-timeline__scroll">{timeline}</div>;
}
