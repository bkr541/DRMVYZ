import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useReactStore } from '../../../stores/reactStore'
import { useVisualStore } from '../../../stores/visualStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { isSvgFilename } from '../../../lib/mediaRoles'
import {
  SliderRow, SelectRow, ToggleRow, TextInputRow, CtrlSection,
} from './ReactControlRows'
import {
  computeViewportRangeLayout,
  computeWaveformViewport,
  resolvePositiveDuration,
  timeToViewportRatio,
  type TimelineViewport,
} from '../../../features/timeline/timelineViewport'
import type { ReactTrackSection, SoundDrawingLayer, SoundDrawingClip, SoundDrawingLayerSourceType, BuiltinOscillatorShape, OscillatorFontAsset } from './ReactTypes'
import type { BeatMarkerMI } from '../../../features/musicIntelligence/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const LS_COLLAPSED = 'drmvyz:sd-lane:collapsed'
const CLIP_MIN_DUR = 0.1
const CLIP_DEFAULT_DUR = 4

// ── Types ─────────────────────────────────────────────────────────────────────

type SnapMode = 'none' | 'beat' | 'bar' | 'section'

interface DragState {
  type:          'move' | 'left' | 'right'
  clipId:        string
  startX:        number
  origStart:     number
  origEnd:       number
  timelineWidth: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readLS<T>(key: string, fb: T): T {
  try {
    const v = localStorage.getItem(key)
    return v !== null ? (JSON.parse(v) as T) : fb
  } catch { return fb }
}

function writeLS(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

function formatTimeFmt(s: number): string {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2).padStart(5, '0')
  return `${m}:${sec}`
}

/** Greedy interval scheduling: assign each clip to the lowest-index row it fits in. */
function assignClipRows(clips: SoundDrawingClip[]): Map<string, number> {
  const sorted = [...clips].sort((a, b) => a.startSec - b.startSec)
  const rowEnds: number[] = []
  const map = new Map<string, number>()
  for (const clip of sorted) {
    let row = rowEnds.findIndex(end => end <= clip.startSec + 0.01)
    if (row === -1) { row = rowEnds.length; rowEnds.push(0) }
    rowEnds[row] = clip.endSec
    map.set(clip.id, row)
  }
  return map
}

function snapTime(
  t:        number,
  mode:     SnapMode,
  beatGrid: BeatMarkerMI[],
  sections: ReactTrackSection[],
  dur:      number,
): number {
  t = Math.max(0, Math.min(dur, t))
  if (mode === 'none') return t

  let best = t
  let bestDist = Infinity

  const check = (candidate: number) => {
    const d = Math.abs(candidate - t)
    if (d < bestDist) { bestDist = d; best = candidate }
  }

  if (mode === 'beat') {
    for (const b of beatGrid) check(b.timeSec)
  } else if (mode === 'bar') {
    for (const b of beatGrid) { if (b.isDownbeat) check(b.timeSec) }
  } else if (mode === 'section') {
    for (const s of sections) { check(s.startSec); check(s.endSec) }
    check(0); check(dur)
  }

  return best
}

// ── Layer editor sub-component ────────────────────────────────────────────────

interface LayerEditorProps {
  clip:          SoundDrawingClip
  layer:         SoundDrawingLayer
  trackId:       string
  fontAssets:    OscillatorFontAsset[]
  svgOptions:    { value: string; label: string }[]
  onUpdateLayer: (trackId: string, id: string, patch: Partial<SoundDrawingLayer>) => void
  onUpdateClip:  (trackId: string, id: string, patch: Partial<SoundDrawingClip>) => void
  onDuplicate:   () => void
  onDelete:      () => void
  onClose:       () => void
}

function LayerEditor({
  clip, layer, trackId, fontAssets, svgOptions,
  onUpdateLayer, onUpdateClip,
  onDuplicate, onDelete, onClose,
}: LayerEditorProps) {
  const idPrefix = useId()
  const pl = (patch: Partial<SoundDrawingLayer>) => onUpdateLayer(trackId, layer.id, patch)
  const pc = (patch: Partial<SoundDrawingClip>)  => onUpdateClip(trackId, clip.id, patch)

  const [startStr, setStartStr] = useState(formatTimeFmt(clip.startSec))
  const [endStr,   setEndStr]   = useState(formatTimeFmt(clip.endSec))

  // Sync local time fields when clip changes externally
  useEffect(() => { setStartStr(formatTimeFmt(clip.startSec)) }, [clip.startSec])
  useEffect(() => { setEndStr(formatTimeFmt(clip.endSec))     }, [clip.endSec])

  function parseTimeFmt(s: string): number | null {
    const m = s.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/)
    if (!m) return null
    return parseFloat(m[1]) * 60 + parseFloat(m[2])
  }

  function commitStart() {
    const t = parseTimeFmt(startStr)
    if (t !== null && t < clip.endSec) pc({ startSec: t })
    else setStartStr(formatTimeFmt(clip.startSec))
  }

  function commitEnd() {
    const t = parseTimeFmt(endStr)
    if (t !== null && t > clip.startSec) pc({ endSec: t })
    else setEndStr(formatTimeFmt(clip.endSec))
  }

  return (
    <div className="rv-sd-layer-editor">
      <div className="rv-sd-layer-editor-header">
        <span className="rv-sd-layer-editor-title">{layer.name}</span>
        <div className="rv-sd-layer-editor-actions">
          <button type="button" className="rv-sd-action-btn" onClick={onDuplicate} title="Duplicate clip" aria-label={`Duplicate clip ${layer.name}`}>
            ⧉
          </button>
          <button type="button" className="rv-sd-action-btn rv-sd-action-btn--danger" onClick={onDelete} title="Delete clip" aria-label={`Delete clip ${layer.name}`}>
            ✕
          </button>
          <button type="button" className="rv-sd-action-btn" onClick={onClose} title="Close editor" aria-label="Close clip editor">
            ↓
          </button>
        </div>
      </div>

      <div className="rv-sd-layer-editor-body">
        {/* ── Clip controls ── */}
        <CtrlSection label="Clip" />

        <div className="rv-ctrl-row">
          <span className="rv-ctrl-label" id={`${idPrefix}-enabled-label`}>Enabled</span>
          <button
            type="button"
            className={`rv-ctrl-toggle${clip.enabled ? ' rv-ctrl-toggle--on' : ''}`}
            onClick={() => pc({ enabled: !clip.enabled })}
            aria-pressed={clip.enabled}
            aria-labelledby={`${idPrefix}-enabled-label`}
          >
            {clip.enabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="rv-ctrl-row">
          <label className="rv-ctrl-label" htmlFor={`${idPrefix}-start`}>Start</label>
          <input
            id={`${idPrefix}-start`}
            className="rv-ctrl-text-input rv-ctrl-text-input--time"
            value={startStr}
            onChange={e => setStartStr(e.target.value)}
            onBlur={commitStart}
            onKeyDown={e => e.key === 'Enter' && commitStart()}
          />
        </div>

        <div className="rv-ctrl-row">
          <label className="rv-ctrl-label" htmlFor={`${idPrefix}-end`}>End</label>
          <input
            id={`${idPrefix}-end`}
            className="rv-ctrl-text-input rv-ctrl-text-input--time"
            value={endStr}
            onChange={e => setEndStr(e.target.value)}
            onBlur={commitEnd}
            onKeyDown={e => e.key === 'Enter' && commitEnd()}
          />
        </div>

        <SliderRow
          label="Z-Index"
          value={clip.zIndex}
          onChange={v => pc({ zIndex: Math.round(v) })}
          min={0} max={10} step={1}
          color="#b84fc9"
        />
        <SliderRow
          label="Fade In (ms)"
          value={clip.fadeInMs}
          onChange={v => pc({ fadeInMs: Math.round(v) })}
          min={0} max={2000} step={50}
          color="#61d6aa"
        />
        <SliderRow
          label="Fade Out (ms)"
          value={clip.fadeOutMs}
          onChange={v => pc({ fadeOutMs: Math.round(v) })}
          min={0} max={2000} step={50}
          color="#61d6aa"
        />

        {/* ── Layer controls ── */}
        <CtrlSection label="Layer" />

        <ToggleRow
          label="Layer Enabled"
          value={layer.enabled}
          onChange={v => pl({ enabled: v })}
        />

        <TextInputRow
          label="Name"
          value={layer.name}
          onChange={v => pl({ name: v })}
          maxLength={48}
        />

        <SelectRow
          label="Source"
          value={layer.sourceType}
          onChange={v => pl({ sourceType: v as SoundDrawingLayerSourceType })}
          options={[
            { value: 'text',         label: 'Text' },
            { value: 'builtinShape', label: 'Shape' },
            { value: 'svg',          label: 'SVG' },
          ]}
        />

        {/* Text fields */}
        {layer.sourceType === 'text' && (
          <>
            <div className="rv-ctrl-row rv-ctrl-row--col">
              <label className="rv-ctrl-label" htmlFor={`${idPrefix}-text`}>Text</label>
              <textarea
                id={`${idPrefix}-text`}
                className="rv-sd-textarea"
                value={layer.text}
                onChange={e => pl({ text: e.target.value })}
                rows={3}
                placeholder="Enter text (newline for multiline)"
                spellCheck={false}
              />
            </div>
            {fontAssets.length > 0 && (
              <SelectRow
                label="Font"
                value={layer.fontId ?? ''}
                onChange={v => pl({ fontId: v || null })}
                options={[
                  { value: '', label: '— canvas fallback —' },
                  ...fontAssets.map(f => ({ value: f.id, label: f.name })),
                ]}
              />
            )}
            <SelectRow
              label="Alignment"
              value={layer.alignment}
              onChange={v => pl({ alignment: v as 'left' | 'center' | 'right' })}
              options={[
                { value: 'left',   label: 'Left'   },
                { value: 'center', label: 'Center' },
                { value: 'right',  label: 'Right'  },
              ]}
            />
            <SliderRow
              label="Line Height"
              value={layer.lineHeight}
              onChange={v => pl({ lineHeight: v })}
              min={0.8} max={3.0} step={0.05}
              color="#d8b95a"
            />
            <SliderRow
              label="Letter Spacing"
              value={layer.letterSpacing}
              onChange={v => pl({ letterSpacing: Math.round(v) })}
              min={-20} max={80} step={1}
              color="#d8b95a"
            />
          </>
        )}

        {/* Shape fields */}
        {layer.sourceType === 'builtinShape' && (
          <SelectRow
            label="Shape"
            value={layer.shape}
            onChange={v => pl({ shape: v as BuiltinOscillatorShape })}
            options={[
              { value: 'circle',   label: 'Circle'   },
              { value: 'square',   label: 'Square'   },
              { value: 'triangle', label: 'Triangle' },
              { value: 'star',     label: 'Star'     },
              { value: 'hexagon',  label: 'Hexagon'  },
              { value: 'infinity', label: 'Infinity' },
              { value: 'spiral',   label: 'Spiral'   },
              { value: 'line',     label: 'Line'     },
            ]}
          />
        )}

        {/* SVG fields */}
        {layer.sourceType === 'svg' && (
          svgOptions.length === 0 ? (
            <div className="rv-ctrl-info">No SVG files — import from the Media tab.</div>
          ) : (
            <SelectRow
              label="SVG File"
              value={layer.svgId ?? ''}
              onChange={v => pl({ svgId: v || null })}
              options={[
                ...(layer.svgId ? [] : [{ value: '', label: '— select SVG —' }]),
                ...svgOptions,
              ]}
            />
          )
        )}

        {/* Position / transform */}
        <CtrlSection label="Transform" />
        <SliderRow
          label="X"
          value={layer.x}
          onChange={v => pl({ x: v })}
          min={-1} max={1} step={0.01}
          color="#4ac7db"
        />
        <SliderRow
          label="Y"
          value={layer.y}
          onChange={v => pl({ y: v })}
          min={-1} max={1} step={0.01}
          color="#4ac7db"
        />
        <SliderRow
          label="Scale"
          value={layer.scale}
          onChange={v => pl({ scale: v })}
          min={0.1} max={5} step={0.05}
          color="#61d6aa"
        />
        <SliderRow
          label="Rotation"
          value={layer.rotation}
          onChange={v => pl({ rotation: Math.round(v) })}
          min={-180} max={180} step={1}
          color="#d8b95a"
        />
      </div>
    </div>
  )
}

// ── Add clip form ─────────────────────────────────────────────────────────────

interface AddClipFormProps {
  onAdd:    (sourceType: SoundDrawingLayerSourceType, name: string) => void
  onCancel: () => void
}

function AddClipForm({ onAdd, onCancel }: AddClipFormProps) {
  const idPrefix = useId()
  const [sourceType, setSourceType] = useState<SoundDrawingLayerSourceType>('text')
  const [name, setName]             = useState('')

  return (
    <div className="rv-sd-add-form">
      <span className="rv-sd-add-title">New Clip</span>
      <select
        id={`${idPrefix}-source`}
        className="rv-ctrl-select rv-ctrl-select--sm"
        aria-label="Clip source type"
        value={sourceType}
        onChange={e => setSourceType(e.target.value as SoundDrawingLayerSourceType)}
      >
        <option value="text">Text</option>
        <option value="builtinShape">Shape</option>
        <option value="svg">SVG</option>
      </select>
      <input
        id={`${idPrefix}-name`}
        className="rv-ctrl-text-input rv-ctrl-text-input--sm"
        aria-label="Layer name"
        placeholder="Layer name (optional)"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onAdd(sourceType, name)}
        autoFocus
      />
      <button
        type="button"
        className="rv-sd-add-btn rv-sd-add-btn--confirm"
        onClick={() => onAdd(sourceType, name)}
      >
        Add at playhead
      </button>
      <button
        type="button"
        className="rv-sd-add-btn rv-sd-add-btn--cancel"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  )
}


function applySoundDrawingViewport(
  timeline: HTMLDivElement,
  viewport: TimelineViewport,
): void {
  const clipBlocks = timeline.querySelectorAll<HTMLElement>('[data-sd-clip]')
  clipBlocks.forEach(block => {
    const startSec = Number(block.dataset.startSec)
    const endSec   = Number(block.dataset.endSec)
    const layout   = computeViewportRangeLayout({ startSec, endSec }, viewport)
    block.style.display = layout.visible ? '' : 'none'
    if (!layout.visible) return
    block.style.left  = `${layout.leftPct}%`
    block.style.width = `${Math.max(0.5, layout.widthPct)}%`
  })
}

// ── Main component ────────────────────────────────────────────────────────────

interface SoundDrawingTimelineLaneProps {
  audioDurationSec: number
  trackSections: ReactTrackSection[]
}

export function SoundDrawingTimelineLane({
  audioDurationSec,
  trackSections,
}: SoundDrawingTimelineLaneProps) {
  const snapLabelId = useId()
  const engine       = useSharedAudio()
  const allMediaItems = useMediaStore(s => s.items)

  const { waveformZoom } = useVisualStore(useShallow(s => ({ waveformZoom: s.waveformZoom })))

  const {
    soundDrawingLayersByTrackId,
    soundDrawingClipsByTrackId,
    oscillatorFontAssets,
    addSoundDrawingLayer,
    updateSoundDrawingLayer,
    removeSoundDrawingLayer,
    duplicateSoundDrawingClip,
    addSoundDrawingClip,
    updateSoundDrawingClip,
    removeSoundDrawingClip,
  } = useReactStore(useShallow(s => ({
    soundDrawingLayersByTrackId: s.soundDrawingLayersByTrackId,
    soundDrawingClipsByTrackId:  s.soundDrawingClipsByTrackId,
    oscillatorFontAssets:        s.oscillatorFontAssets,
    addSoundDrawingLayer:        s.addSoundDrawingLayer,
    updateSoundDrawingLayer:     s.updateSoundDrawingLayer,
    removeSoundDrawingLayer:     s.removeSoundDrawingLayer,
    duplicateSoundDrawingClip:   s.duplicateSoundDrawingClip,
    addSoundDrawingClip:         s.addSoundDrawingClip,
    updateSoundDrawingClip:      s.updateSoundDrawingClip,
    removeSoundDrawingClip:      s.removeSoundDrawingClip,
  })))

  const activeTrackId = engine.currentTrack?.id ?? null
  const beatGrid      = (engine.currentEffectiveBeatGrid ?? engine.currentAnalysis?.beatGrid ?? []) as BeatMarkerMI[]
  const svgOptions    = allMediaItems
    .filter(m => m.mediaRole === 'svg' || isSvgFilename(m.name))
    .map(m => ({ value: m.id, label: m.title ?? m.name }))

  // ── State ───────────────────────────────────────────────────────────────────

  const [collapsed, setCollapsed] = useState(() => readLS<boolean>(LS_COLLAPSED, false))
  const [snapMode,  setSnapMode]  = useState<SnapMode>('beat')
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const safeDurationSec = resolvePositiveDuration(audioDurationSec)
  // React state changes only when track duration or zoom changes. Playback-follow
  // viewport motion is kept in refs and applied directly to clip/playhead styles.
  const [layoutViewport, setLayoutViewport] = useState<TimelineViewport>({
    startSec: 0,
    endSec:   safeDurationSec,
  })

  const timelineRef  = useRef<HTMLDivElement>(null)
  const playheadRef  = useRef<HTMLDivElement>(null)
  const dragRef      = useRef<DragState | null>(null)
  const rafRef       = useRef<number | null>(null)
  const viewportRef  = useRef<TimelineViewport>(layoutViewport)
  const waveformZoomRef    = useRef(waveformZoom)
  const audioDurationSecRef = useRef(safeDurationSec)

  // Local drag preview (avoids re-rendering other clips during drag)
  const [localDrag, setLocalDrag] = useState<{ id: string; startSec: number; endSec: number } | null>(null)

  // ── Data ────────────────────────────────────────────────────────────────────

  const layers = activeTrackId ? (soundDrawingLayersByTrackId[activeTrackId] ?? []) : []
  const clips  = activeTrackId ? (soundDrawingClipsByTrackId[activeTrackId]  ?? []) : []
  const sortedClips = [...clips].sort((a, b) =>
    a.startSec !== b.startSec ? a.startSec - b.startSec : a.zIndex - b.zIndex
  )
  const clipRows = assignClipRows(sortedClips)
  const rowCount = sortedClips.length === 0
    ? 1
    : Math.max(...Array.from(clipRows.values())) + 1

  const selectedClip  = clips.find(c => c.id === selectedClipId) ?? null
  const selectedLayer = selectedClip ? layers.find(l => l.id === selectedClip.layerId) ?? null : null

  // Deselect if selected clip was deleted
  useEffect(() => {
    if (selectedClipId && !clips.find(c => c.id === selectedClipId)) {
      setSelectedClipId(null)
    }
  }, [clips, selectedClipId])

  // ── Persist collapse ─────────────────────────────────────────────────────────

  useEffect(() => { writeLS(LS_COLLAPSED, collapsed) }, [collapsed])

  // ── Viewport sync ────────────────────────────────────────────────────────────

  waveformZoomRef.current     = waveformZoom
  audioDurationSecRef.current = safeDurationSec

  useEffect(() => {
    const t  = engine.getCurrentTime()
    const vp = computeWaveformViewport(safeDurationSec, t, waveformZoom)
    viewportRef.current = vp
    setLayoutViewport(vp)
  }, [waveformZoom, safeDurationSec, engine.getCurrentTime])

  // Playback clock: update only DOM geometry. The clip/layer React tree is not
  // rerendered as the playhead advances or the follow viewport scrolls.
  useEffect(() => {
    if (collapsed) return

    const tick = () => {
      const dur  = audioDurationSecRef.current
      const zoom = waveformZoomRef.current
      const t    = engine.getCurrentTime()
      const vp   = computeWaveformViewport(dur, t, zoom)
      const prev = viewportRef.current
      viewportRef.current = vp

      const ph = playheadRef.current
      if (ph) {
        const ratio = timeToViewportRatio(t, vp)
        if (ratio >= 0 && ratio <= 1) {
          ph.style.left    = `${ratio * 100}%`
          ph.style.display = 'block'
        } else {
          ph.style.display = 'none'
        }
      }

      if (prev.startSec !== vp.startSec || prev.endSec !== vp.endSec) {
        const timeline = timelineRef.current
        if (timeline) applySoundDrawingViewport(timeline, vp)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [collapsed, engine.getCurrentTime])

  // ── Drag / resize ────────────────────────────────────────────────────────────

  const handleBlockPointerDown = useCallback((
    e:       React.PointerEvent<HTMLElement>,
    clip:    SoundDrawingClip,
    type:    DragState['type'],
  ) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelectedClipId(clip.id)
    dragRef.current = {
      type,
      clipId:        clip.id,
      startX:        e.clientX,
      origStart:     clip.startSec,
      origEnd:       clip.endSec,
      timelineWidth: timelineRef.current?.getBoundingClientRect().width ?? 1,
    }
    setLocalDrag({ id: clip.id, startSec: clip.startSec, endSec: clip.endSec })
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const activeViewport = viewportRef.current
    const vpDur = activeViewport.endSec - activeViewport.startSec
    const tw    = drag.timelineWidth
    const delta = ((e.clientX - drag.startX) / tw) * vpDur
    const dur   = audioDurationSecRef.current

    let s = drag.origStart
    let en = drag.origEnd

    if (drag.type === 'move') {
      const rawS  = drag.origStart + delta
      const rawE  = drag.origEnd   + delta
      const snappedS = snapTime(rawS, snapMode, beatGrid, trackSections, dur)
      const clipDur  = drag.origEnd - drag.origStart
      s  = Math.max(0, Math.min(dur - clipDur, snappedS))
      en = s + clipDur
    } else if (drag.type === 'left') {
      const raw = drag.origStart + delta
      s  = Math.min(drag.origEnd - CLIP_MIN_DUR, Math.max(0, snapTime(raw, snapMode, beatGrid, trackSections, dur)))
      en = drag.origEnd
    } else {
      const raw = drag.origEnd + delta
      en = Math.max(drag.origStart + CLIP_MIN_DUR, Math.min(dur, snapTime(raw, snapMode, beatGrid, trackSections, dur)))
      s  = drag.origStart
    }

    setLocalDrag({ id: drag.clipId, startSec: s, endSec: en })
  }, [snapMode, beatGrid, trackSections])

  const handlePointerUp = useCallback(() => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || !localDrag || !activeTrackId) { setLocalDrag(null); return }
    updateSoundDrawingClip(activeTrackId, drag.clipId, {
      startSec: localDrag.startSec,
      endSec:   localDrag.endSec,
    }, safeDurationSec)
    setLocalDrag(null)
  }, [localDrag, activeTrackId, safeDurationSec, updateSoundDrawingClip])

  // ── Add clip ─────────────────────────────────────────────────────────────────

  const handleAdd = useCallback((sourceType: SoundDrawingLayerSourceType, name: string) => {
    if (!activeTrackId) return
    const t       = engine.getCurrentTime()
    const layerId = addSoundDrawingLayer(activeTrackId, {
      name:          name || `${sourceType} layer`,
      enabled:       true,
      sourceType,
      text:          sourceType === 'text' ? 'DRMVYZ' : '',
      fontId:        null,
      letterSpacing: 0,
      lineHeight:    1.2,
      alignment:     'center',
      svgId:         null,
      shape:         'circle',
      x: 0, y: 0, scale: 1, rotation: 0,
      oscillatorOverride: {},
    })
    const clipId = addSoundDrawingClip(activeTrackId, {
      trackId:  activeTrackId,
      layerId,
      startSec: Math.max(0, t),
      endSec:   Math.max(CLIP_MIN_DUR, t + CLIP_DEFAULT_DUR),
      enabled:  true,
      zIndex:   0,
      fadeInMs:  0,
      fadeOutMs: 0,
    }, safeDurationSec)
    setAddOpen(false)
    setSelectedClipId(clipId)
  }, [activeTrackId, engine.getCurrentTime, safeDurationSec, addSoundDrawingLayer, addSoundDrawingClip])

  const handleDuplicateClip = useCallback(() => {
    if (!selectedClipId || !activeTrackId) return
    duplicateSoundDrawingClip(activeTrackId, selectedClipId)
  }, [selectedClipId, activeTrackId, duplicateSoundDrawingClip])

  const handleDeleteClip = useCallback(() => {
    if (!selectedClipId || !activeTrackId) return
    const clip = clips.find(c => c.id === selectedClipId)
    removeSoundDrawingClip(activeTrackId, selectedClipId)
    // Remove the layer if it has no other clips
    if (clip && !clips.some(c => c.id !== selectedClipId && c.layerId === clip.layerId)) {
      removeSoundDrawingLayer(activeTrackId, clip.layerId)
    }
    setSelectedClipId(null)
  }, [selectedClipId, activeTrackId, clips, removeSoundDrawingClip, removeSoundDrawingLayer])

  // ── Render helpers ────────────────────────────────────────────────────────────

  function clipLayout(c: SoundDrawingClip) {
    const effective = localDrag?.id === c.id ? localDrag : c
    return {
      effective,
      layout: computeViewportRangeLayout(effective, viewportRef.current),
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="rv-sd-lane">
      {/* Header */}
      <div
        className="rv-sd-lane-header rv-strip-header rv-strip-header--toggle"
        onClick={() => setCollapsed(c => !c)}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <svg
          className="rv-sd-lane-icon"
          viewBox="0 0 211.007 211.007"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M101.386,109.648c-6.895-6.894-14.969-12.173-23.76-15.683l38.207-53.184l75.343-40.753l19.831,19.831l-40.754,75.341l-53.213,38.227C113.596,124.765,108.384,116.648,101.386,109.648z M24.922,210.98c31.945,0,54.556-5.018,63.668-14.129c20.509-20.512,20.509-53.891-0.001-74.407c-9.936-9.935-23.149-15.407-37.202-15.407c-14.054,0-27.267,5.473-37.205,15.411c-14.06,14.06-15.646,58.354-13.281,87.623C6.613,210.497,15.209,210.98,24.922,210.98z"/>
        </svg>
        <span className="rv-sd-lane-title">Sound Drawing</span>
        <span className="rv-sd-clip-count">
          {clips.length > 0 ? `${clips.length} clip${clips.length !== 1 ? 's' : ''}` : ''}
        </span>

        {!collapsed && (
          <div className="rv-sd-lane-controls" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            <span id={snapLabelId} className="rv-ctrl-label" style={{ marginRight: 4, opacity: 0.65 }}>Snap</span>
            <select
              className="rv-ctrl-select rv-ctrl-select--sm"
              aria-labelledby={snapLabelId}
              value={snapMode}
              onChange={e => setSnapMode(e.target.value as SnapMode)}
            >
              <option value="none">None</option>
              <option value="beat">Beat</option>
              <option value="bar">Bar</option>
              <option value="section">Section</option>
            </select>
            <button
              type="button"
              className="rv-sd-add-btn"
              disabled={!activeTrackId}
              onClick={() => setAddOpen(o => !o)}
              title={activeTrackId ? 'Add clip at playhead' : 'Load a track first'}
            >
              {addOpen ? '✕ Cancel' : '+ Add'}
            </button>
          </div>
        )}
        <span className="rv-collapse-arrow">{collapsed ? '▶' : '▼'}</span>
      </div>

      {/* Collapsed: just show header */}
      {collapsed && null}

      {/* Expanded: timeline + editor */}
      {!collapsed && (
        <div className="rv-sd-lane-body">
          {/* Add form */}
          {addOpen && (
            <AddClipForm
              onAdd={handleAdd}
              onCancel={() => setAddOpen(false)}
            />
          )}

          {/* Timeline area */}
          <div
            ref={timelineRef}
            className="rv-sd-timeline"
          >
            {/* Playhead */}
            <div ref={playheadRef} className="rv-sd-playhead" style={{ display: 'none' }} />

            {/* Clip rows */}
            {Array.from({ length: rowCount }, (_, rowIdx) => (
              <div key={rowIdx} className="rv-sd-clip-row">
                {sortedClips
                  .filter(c => clipRows.get(c.id) === rowIdx)
                  .map(clip => {
                    const layer = layers.find(l => l.id === clip.layerId)
                    const isSelected = clip.id === selectedClipId
                    const isDragging = localDrag?.id === clip.id
                    const { effective, layout } = clipLayout(clip)

                    return (
                      <div
                        key={clip.id}
                        data-sd-clip
                        data-start-sec={effective.startSec}
                        data-end-sec={effective.endSec}
                        className={[
                          'rv-sd-clip-block',
                          isSelected ? 'rv-sd-clip-block--selected' : '',
                          !clip.enabled ? 'rv-sd-clip-block--disabled' : '',
                          isDragging ? 'rv-sd-clip-block--dragging' : '',
                        ].filter(Boolean).join(' ')}
                        style={{
                          display: layout.visible ? undefined : 'none',
                          left:  `${layout.leftPct}%`,
                          width: `${Math.max(0.5, layout.widthPct)}%`,
                        }}
                        onPointerDown={e => handleBlockPointerDown(e, clip, 'move')}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                      >
                        {/* Left resize handle */}
                        <div
                          className="rv-sd-clip-resize rv-sd-clip-resize--left"
                          onPointerDown={e => { e.stopPropagation(); handleBlockPointerDown(e, clip, 'left') }}
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          onPointerCancel={handlePointerUp}
                        />

                        <span className="rv-sd-clip-label" title={layer?.name ?? ''}>
                          {layer?.sourceType === 'text' && '〜 '}
                          {layer?.sourceType === 'svg'  && '◈ '}
                          {layer?.sourceType === 'builtinShape' && '◎ '}
                          {layer?.name ?? 'Unknown'}
                        </span>

                        {/* Right resize handle */}
                        <div
                          className="rv-sd-clip-resize rv-sd-clip-resize--right"
                          onPointerDown={e => { e.stopPropagation(); handleBlockPointerDown(e, clip, 'right') }}
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          onPointerCancel={handlePointerUp}
                        />
                      </div>
                    )
                  })
                }
              </div>
            ))}

            {/* Empty hint */}
            {sortedClips.length === 0 && (
              <div className="rv-sd-timeline-empty">
                {activeTrackId
                  ? 'No clips yet — click + Add to create one at the playhead'
                  : 'Load a track to add Sound Drawing clips'}
              </div>
            )}
          </div>

          {/* Layer / clip editor */}
          {selectedClip && selectedLayer && (
            <LayerEditor
              clip={selectedClip}
              layer={selectedLayer}
              trackId={activeTrackId!}
              fontAssets={oscillatorFontAssets}
              svgOptions={svgOptions}
              onUpdateLayer={updateSoundDrawingLayer}
              onUpdateClip={updateSoundDrawingClip}
              onDuplicate={handleDuplicateClip}
              onDelete={handleDeleteClip}
              onClose={() => setSelectedClipId(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}
