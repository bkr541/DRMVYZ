import { useState, useEffect, useCallback } from 'react'
import { useLyricsStore } from '../../stores/lyricsStore'
import { parseLyricCueJson, LyricParseError, formatMs } from '../../lib/lyricsImport'
import type { CreateLyricCueInput } from '../../types/lyrics'
import { createLyricCueInputFromCue } from '../../types/lyrics'

const ANIM_IN_OPTIONS = [
  'none','fade','fadeUp','fadeDown','scale','scalePop',
  'typewriter','glitch','waveReveal','slide','blurIn',
] as const

const ANIM_OUT_OPTIONS = [
  'none','fade','fadeDown','scale','glitchOut','blurOut',
] as const

const EASING_OPTIONS = [
  'linear','easeIn','easeOut','easeInOut',
  'easeOutCubic','easeInCubic','easeInOutCubic',
] as const

const ALIGN_OPTIONS = ['left','center','right'] as const

const JSON_PLACEHOLDER = `[
  {
    "startMs": 9000,
    "endMs": 12000,
    "text": "I love the way you love me"
  }
]`

// ── Small helpers ─────────────────────────────────────────────────────────────

function SelectCaret() {
  return (
    <svg className="lmm-select-caret" viewBox="0 0 10 6" fill="currentColor" aria-hidden="true">
      <path d="M0 0l5 6 5-6z"/>
    </svg>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="lmm-field">
      <label className="lmm-field-label">{label}</label>
      {hint && <div className="lmm-field-hint">{hint}</div>}
      {children}
    </div>
  )
}

function SliderRow({
  label, value, min = 0, max = 1, step = 0.01, onChange,
}: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="lmm-slider-row">
      <span className="lmm-slider-label">{label}</span>
      <input
        type="range"
        className="lmm-slider"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      <span className="lmm-slider-val">{value.toFixed(2)}</span>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function LyricManagerModal({ onClose }: { onClose: () => void }) {
  const {
    lyricsEnabled,    setLyricsEnabled,
    activeDocument,   setActiveDocument,
    cues,             setCues,
    isLoading,        isSaving,
    error,            setError,
    draftTitle,       setDraftTitle,
    draftArtist,      setDraftArtist,
    draftDefaultStyle,     updateDraftDefaultStyle,
    draftDefaultAnimation, updateDraftDefaultAnimation,
    draftDefaultEffects,   updateDraftDefaultEffects,
    globalOffsetMs,   setGlobalOffsetMs,
    saveActiveLyricDocument,
    clearLyrics,
  } = useLyricsStore()

  const [jsonInput,    setJsonInput]    = useState('')
  const [importError,  setImportError]  = useState<string | null>(null)
  const [pendingCues,  setPendingCues]  = useState<CreateLyricCueInput[] | null>(null)

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isSaving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, isSaving])

  // Seed pending cues from existing store cues when opening
  useEffect(() => {
    if (cues.length > 0 && pendingCues === null) {
      setPendingCues(cues.map((cue, index) =>
        createLyricCueInputFromCue(cue, activeDocument?.id ?? '', index),
      ))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleImport = useCallback(() => {
    setImportError(null)
    try {
      const parsed = parseLyricCueJson(jsonInput)
      const inputs: CreateLyricCueInput[] = parsed.map((cue, index) =>
        createLyricCueInputFromCue(cue, activeDocument?.id ?? '', index),
      )
      setPendingCues(inputs)
      // Update store preview immediately
      setCues(parsed)
      setJsonInput('')
    } catch (err) {
      setImportError(err instanceof LyricParseError ? err.message : 'Parse error — check your JSON')
    }
  }, [jsonInput, activeDocument?.id, setCues])

  const handleSave = useCallback(async () => {
    setError(null)
    // The store saves document fields and the complete preview cue set in one RPC.
    // This includes an intentionally empty array when the user removes every cue.
    await saveActiveLyricDocument()
    if (!useLyricsStore.getState().error) onClose()
  }, [saveActiveLyricDocument, setError, onClose])

  const displayCues = pendingCues
    ? pendingCues.map(c => ({
        startMs: c.startMs, endMs: c.endMs, text: c.text,
        wordCount:  c.words?.length  ?? 0,
        groupCount: c.groups?.length ?? 0,
      }))
    : cues.map(c => ({
        startMs: c.startMs, endMs: c.endMs, text: c.text,
        wordCount:  c.words?.length  ?? 0,
        groupCount: c.groups?.length ?? 0,
      }))

  const previewCues  = displayCues.slice(0, 10)
  const hiddenCount  = displayCues.length - previewCues.length

  const ds  = draftDefaultStyle
  const da  = draftDefaultAnimation
  const de  = draftDefaultEffects

  return (
    <div
      className="lmm-backdrop"
      onClick={e => { if (e.target === e.currentTarget && !isSaving) onClose() }}
    >
      <div className="lmm-modal" role="dialog" aria-modal="true" aria-label="Lyric Manager">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="lmm-header">
          <div>
            <div className="lmm-title">LYRIC MANAGER</div>
            <div className="lmm-subtitle">Import, style, and organize synced lyrics for VYZUALZ.</div>
          </div>
          <button
            className="lmm-close"
            onClick={() => { if (!isSaving) onClose() }}
            aria-label="Close"
          >×</button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="lmm-body">

          {/* ── Left: import + cue preview ─────────────────────────── */}
          <div className="lmm-left">
            <div className="lmm-left-scroll">

              {/* Document info */}
              <div className="lmm-section">DOCUMENT</div>

              <Field label="TITLE">
                <input
                  className="lmm-input"
                  placeholder="e.g. My Song Title"
                  value={draftTitle}
                  onChange={e => setDraftTitle(e.target.value)}
                />
              </Field>

              <Field label="ARTIST">
                <input
                  className="lmm-input"
                  placeholder="e.g. Artist Name"
                  value={draftArtist}
                  onChange={e => setDraftArtist(e.target.value)}
                />
              </Field>

              {activeDocument && (
                <div className="lmm-doc-info">
                  <strong>Active:</strong> {activeDocument.title || '(Untitled)'}<br/>
                  <strong>ID:</strong> {activeDocument.id.slice(0, 8)}…<br/>
                  <strong>Cues:</strong> {cues.length}
                  <span style={{ marginLeft: 12 }}>
                    <button className="lmm-link-btn" onClick={() => {
                      clearLyrics()
                      setPendingCues(null)
                    }}>Clear</button>
                  </span>
                </div>
              )}

              {/* JSON import */}
              <div className="lmm-section">IMPORT JSON</div>

              <Field
                label="LYRIC CUES JSON"
                hint="Paste a cue array or { cues: [...] } object."
              >
                <textarea
                  className="lmm-textarea"
                  rows={8}
                  placeholder={JSON_PLACEHOLDER}
                  value={jsonInput}
                  onChange={e => { setJsonInput(e.target.value); setImportError(null) }}
                  spellCheck={false}
                />
              </Field>

              {importError && <div className="lmm-error">{importError}</div>}

              <button
                className="lmm-import-btn"
                onClick={handleImport}
                disabled={!jsonInput.trim()}
              >
                Import JSON
              </button>

              {/* Cue preview */}
              {displayCues.length > 0 && (
                <>
                  <div className="lmm-section">CUE PREVIEW</div>
                  <div className="lmm-cue-header">
                    <span className="lmm-cue-count">{displayCues.length} cue{displayCues.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="lmm-cue-list">
                    {previewCues.map((c, i) => (
                      <div key={i} className="lmm-cue-row">
                        <span className="lmm-cue-ts">{formatMs(c.startMs)} → {formatMs(c.endMs)}</span>
                        <span className="lmm-cue-text">{c.text}</span>
                        {(c.wordCount > 0 || c.groupCount > 0) && (
                          <span className="lmm-cue-meta">
                            {c.wordCount  > 0 ? `w:${c.wordCount}`  : ''}
                            {c.wordCount > 0 && c.groupCount > 0 ? ' ' : ''}
                            {c.groupCount > 0 ? `g:${c.groupCount}` : ''}
                          </span>
                        )}
                      </div>
                    ))}
                    {hiddenCount > 0 && (
                      <div className="lmm-cue-more">+{hiddenCount} more cues</div>
                    )}
                  </div>
                </>
              )}

            </div>
          </div>

          {/* ── Right: settings ─────────────────────────────────────── */}
          <div className="lmm-right">

            {/* Style defaults */}
            <div className="lmm-section">DEFAULT STYLE</div>

            <div className="lmm-grid2">
              <Field label="FONT FAMILY">
                <input
                  className="lmm-input"
                  placeholder="Orbitron"
                  value={ds.fontFamily ?? ''}
                  onChange={e => updateDraftDefaultStyle({ fontFamily: e.target.value || undefined })}
                />
              </Field>
              <Field label="FONT SIZE">
                <input
                  className="lmm-num"
                  type="number" min={8} max={300} step={1}
                  placeholder="72"
                  value={ds.fontSize ?? ''}
                  onChange={e => updateDraftDefaultStyle({ fontSize: parseFloat(e.target.value) || undefined })}
                />
              </Field>
            </div>

            <div className="lmm-grid2">
              <Field label="COLOR">
                <input
                  className="lmm-input"
                  placeholder="#ffffff"
                  value={ds.color ?? ''}
                  onChange={e => updateDraftDefaultStyle({ color: e.target.value || undefined })}
                />
              </Field>
              <Field label="FONT WEIGHT">
                <input
                  className="lmm-num"
                  type="number" min={100} max={900} step={100}
                  placeholder="700"
                  value={ds.fontWeight ?? ''}
                  onChange={e => updateDraftDefaultStyle({ fontWeight: parseFloat(e.target.value) || undefined })}
                />
              </Field>
            </div>

            <div className="lmm-grid2">
              <Field label="STROKE COLOR">
                <input
                  className="lmm-input"
                  placeholder="#00eaff"
                  value={ds.strokeColor ?? ''}
                  onChange={e => updateDraftDefaultStyle({ strokeColor: e.target.value || undefined })}
                />
              </Field>
              <Field label="STROKE WIDTH">
                <input
                  className="lmm-num"
                  type="number" min={0} max={20} step={0.5}
                  placeholder="2"
                  value={ds.strokeWidth ?? ''}
                  onChange={e => updateDraftDefaultStyle({ strokeWidth: parseFloat(e.target.value) || undefined })}
                />
              </Field>
            </div>

            <div className="lmm-grid2">
              <Field label="SHADOW COLOR">
                <input
                  className="lmm-input"
                  placeholder="#00eaff"
                  value={ds.shadowColor ?? ''}
                  onChange={e => updateDraftDefaultStyle({ shadowColor: e.target.value || undefined })}
                />
              </Field>
              <Field label="SHADOW BLUR">
                <input
                  className="lmm-num"
                  type="number" min={0} max={100} step={1}
                  placeholder="24"
                  value={ds.shadowBlur ?? ''}
                  onChange={e => updateDraftDefaultStyle({ shadowBlur: parseFloat(e.target.value) || undefined })}
                />
              </Field>
            </div>

            <div className="lmm-grid3">
              <Field label="X POS (0–1)">
                <input
                  className="lmm-num"
                  type="number" min={0} max={1} step={0.01}
                  placeholder="0.5"
                  value={ds.x ?? ''}
                  onChange={e => updateDraftDefaultStyle({ x: parseFloat(e.target.value) })}
                />
              </Field>
              <Field label="Y POS (0–1)">
                <input
                  className="lmm-num"
                  type="number" min={0} max={1} step={0.01}
                  placeholder="0.78"
                  value={ds.y ?? ''}
                  onChange={e => updateDraftDefaultStyle({ y: parseFloat(e.target.value) })}
                />
              </Field>
              <Field label="ALIGN">
                <div className="lmm-select-wrap">
                  <select
                    className="lmm-select"
                    value={ds.align ?? 'center'}
                    onChange={e => updateDraftDefaultStyle({ align: e.target.value as typeof ALIGN_OPTIONS[number] })}
                  >
                    {ALIGN_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <SelectCaret />
                </div>
              </Field>
            </div>

            {/* Animation defaults */}
            <div className="lmm-section">DEFAULT ANIMATION</div>

            <div className="lmm-grid2">
              <Field label="ANIMATE IN">
                <div className="lmm-select-wrap">
                  <select
                    className="lmm-select"
                    value={da.in ?? 'none'}
                    onChange={e => updateDraftDefaultAnimation({ in: e.target.value as typeof ANIM_IN_OPTIONS[number] })}
                  >
                    {ANIM_IN_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <SelectCaret />
                </div>
              </Field>
              <Field label="ANIMATE OUT">
                <div className="lmm-select-wrap">
                  <select
                    className="lmm-select"
                    value={da.out ?? 'none'}
                    onChange={e => updateDraftDefaultAnimation({ out: e.target.value as typeof ANIM_OUT_OPTIONS[number] })}
                  >
                    {ANIM_OUT_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <SelectCaret />
                </div>
              </Field>
            </div>

            <div className="lmm-grid3">
              <Field label="IN MS">
                <input
                  className="lmm-num"
                  type="number" min={0} max={2000} step={50}
                  placeholder="250"
                  value={da.inMs ?? ''}
                  onChange={e => updateDraftDefaultAnimation({ inMs: parseFloat(e.target.value) || undefined })}
                />
              </Field>
              <Field label="OUT MS">
                <input
                  className="lmm-num"
                  type="number" min={0} max={2000} step={50}
                  placeholder="300"
                  value={da.outMs ?? ''}
                  onChange={e => updateDraftDefaultAnimation({ outMs: parseFloat(e.target.value) || undefined })}
                />
              </Field>
              <Field label="EASING">
                <div className="lmm-select-wrap">
                  <select
                    className="lmm-select"
                    value={da.easing ?? 'easeOutCubic'}
                    onChange={e => updateDraftDefaultAnimation({ easing: e.target.value as typeof EASING_OPTIONS[number] })}
                  >
                    {EASING_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <SelectCaret />
                </div>
              </Field>
            </div>

            {/* Effects defaults */}
            <div className="lmm-section">DEFAULT EFFECTS</div>

            <SliderRow label="Glow"      value={de.glow      ?? 0} onChange={v => updateDraftDefaultEffects({ glow:      v })} />
            <SliderRow label="Glitch"    value={de.glitch    ?? 0} onChange={v => updateDraftDefaultEffects({ glitch:    v })} />
            <SliderRow label="RGB Split" value={de.rgbSplit  ?? 0} onChange={v => updateDraftDefaultEffects({ rgbSplit:  v })} />
            <SliderRow label="Beat Punch" value={de.beatPunch ?? 0} onChange={v => updateDraftDefaultEffects({ beatPunch: v })} />
            <SliderRow label="Bass Scale" value={de.bassScale ?? 0} onChange={v => updateDraftDefaultEffects({ bassScale: v })} />

            {/* Timing */}
            <div className="lmm-section">TIMING</div>

            <Field
              label="GLOBAL OFFSET MS"
              hint="Shifts all cue timestamps at render time. Positive = later, negative = earlier."
            >
              <input
                className="lmm-num"
                type="number" step={10}
                placeholder="0"
                value={globalOffsetMs}
                onChange={e => setGlobalOffsetMs(parseInt(e.target.value, 10) || 0)}
              />
            </Field>

            {/* Store error */}
            {error && <div className="lmm-error">{error}</div>}

          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div className="lmm-footer">
          <button
            className="lmm-cancel-btn"
            onClick={() => { if (!isSaving) onClose() }}
          >
            Cancel
          </button>

          <div className="lmm-footer-center">
            <label className="lmm-toggle">
              <input
                type="checkbox"
                checked={lyricsEnabled}
                onChange={e => setLyricsEnabled(e.target.checked)}
              />
              <span className="lmm-toggle-track"><span className="lmm-toggle-thumb" /></span>
              <span className="lmm-toggle-label">Lyrics Enabled</span>
            </label>

            <button
              className="lmm-save-btn"
              disabled={isSaving || isLoading || !draftTitle.trim()}
              onClick={handleSave}
            >
              {isSaving ? 'Saving…' : 'Save Lyrics'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
