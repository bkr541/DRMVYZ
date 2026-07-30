import { useState, useEffect, useRef, useCallback } from 'react'
import { useSharedAudio } from '../../context/AudioEngineContext'
import { useLyricsStore } from '../../stores/lyricsStore'
import type { LyricAnimationName } from '../../types/lyrics'
import { DropdownSelect } from '../shared/Dropdown/Dropdown'

const MIN_CUE_DURATION_MS = 100

const POSITION_PRESETS = {
  'Top Center':    { x: 0.5,  y: 0.15 },
  'Middle Center': { x: 0.5,  y: 0.5  },
  'Bottom Center': { x: 0.5,  y: 0.82 },
  'Bottom Left':   { x: 0.08, y: 0.82 },
  'Bottom Right':  { x: 0.92, y: 0.82 },
} as const

type PositionKey = keyof typeof POSITION_PRESETS
type AlignOption = 'Left' | 'Center' | 'Right'

const IN_ANIM_OPTIONS: { label: string; value: LyricAnimationName }[] = [
  { label: 'None',       value: 'none'       },
  { label: 'Fade',       value: 'fade'       },
  { label: 'Fade Up',    value: 'fadeUp'     },
  { label: 'Fade Down',  value: 'fadeDown'   },
  { label: 'Scale',      value: 'scale'      },
  { label: 'Scale Pop',  value: 'scalePop'   },
  { label: 'Slide',      value: 'slide'      },
  { label: 'Blur In',    value: 'blurIn'     },
  { label: 'Glitch',     value: 'glitch'     },
  { label: 'Typewriter', value: 'typewriter' },
]

const OUT_ANIM_OPTIONS: { label: string; value: LyricAnimationName }[] = [
  { label: 'None',       value: 'none'       },
  { label: 'Fade',       value: 'fade'       },
  { label: 'Fade Up',    value: 'fadeUp'     },
  { label: 'Fade Down',  value: 'fadeDown'   },
  { label: 'Scale',      value: 'scale'      },
  { label: 'Slide',      value: 'slide'      },
  { label: 'Blur Out',   value: 'blurOut'    },
  { label: 'Glitch',     value: 'glitch'     },
  { label: 'Glitch Out', value: 'glitchOut'  },
  { label: 'Typewriter', value: 'typewriter' },
]

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function AddCueModal({ isOpen, onClose }: Props) {
  const engine = useSharedAudio()
  const { getCurrentTime, duration: trackDuration } = engine
  const addCue           = useLyricsStore(s => s.addCue)
  const setLyricsEnabled = useLyricsStore(s => s.setLyricsEnabled)
  const saveTimingChanges = useLyricsStore(s => s.saveTimingChanges)
  const activeDocumentId = useLyricsStore(s => s.activeDocumentId)

  const [lyricText,      setLyricText]      = useState('')
  const [startMs,        setStartMs]        = useState(0)
  const [endMs,          setEndMs]          = useState(2000)
  const [position,       setPosition]       = useState<PositionKey>('Bottom Center')
  const [textAlign,      setTextAlign]      = useState<AlignOption>('Center')
  const [fontSize,       setFontSize]       = useState(72)
  const [textColor,      setTextColor]      = useState('#00E6FF')
  const [opacityPercent, setOpacityPercent] = useState(100)
  const [inAnimation,    setInAnimation]    = useState<LyricAnimationName>('fadeUp')
  const [outAnimation,   setOutAnimation]   = useState<LyricAnimationName>('fade')
  const [inDurationMs,   setInDurationMs]   = useState(220)
  const [outDurationMs,  setOutDurationMs]  = useState(220)
  const [errors,         setErrors]         = useState<Record<string, string>>({})

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Initialise fresh form every time the modal opens
  useEffect(() => {
    if (!isOpen) return
    const currentMs = Math.max(0, Math.round(getCurrentTime() * 1000))
    const trackDurMs = trackDuration > 0 ? Math.floor(trackDuration * 1000) : Infinity
    const rawEnd = currentMs + 2000
    const safeEnd = Math.min(rawEnd, trackDurMs)
    const clampedEnd = Math.max(safeEnd, currentMs + MIN_CUE_DURATION_MS)

    setLyricText('')
    setStartMs(currentMs)
    setEndMs(clampedEnd)
    setPosition('Bottom Center')
    setTextAlign('Center')
    setFontSize(72)
    setTextColor('#00E6FF')
    setOpacityPercent(100)
    setInAnimation('fadeUp')
    setOutAnimation('fade')
    setInDurationMs(220)
    setOutDurationMs(220)
    setErrors({})

    requestAnimationFrame(() => { textareaRef.current?.focus() })
  }, [getCurrentTime, isOpen, trackDuration])

  // Escape to close
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const durationMs = Math.max(0, endMs - startMs)

  const handleUsePlayhead = useCallback(() => {
    const ms = Math.max(0, Math.round(getCurrentTime() * 1000))
    const dur = Math.max(endMs - startMs, MIN_CUE_DURATION_MS)
    setStartMs(ms)
    setEndMs(ms + dur)
    setErrors(e => ({ ...e, startMs: '', endMs: '' }))
  }, [endMs, getCurrentTime, startMs])

  const handleSetEndFromPlayhead = useCallback(() => {
    const ms = Math.round(getCurrentTime() * 1000)
    if (ms > startMs) {
      setEndMs(ms)
      setErrors(e => ({ ...e, endMs: '' }))
    } else {
      setErrors(e => ({ ...e, endMs: 'Playhead must be after start time' }))
    }
  }, [getCurrentTime, startMs])

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!lyricText.trim())                        next.lyricText  = 'Lyric text is required'
    if (!isFinite(startMs) || startMs < 0)        next.startMs    = 'Must be ≥ 0'
    if (!isFinite(endMs))                         next.endMs      = 'Invalid value'
    if (isFinite(endMs) && endMs <= startMs)      next.endMs      = 'Must be after start time'
    if (isFinite(endMs) && endMs - startMs < MIN_CUE_DURATION_MS)
                                                  next.endMs      = `Minimum ${MIN_CUE_DURATION_MS} ms`
    if (fontSize < 12 || fontSize > 240)          next.fontSize   = 'Must be 12–240'
    if (opacityPercent < 0 || opacityPercent > 100) next.opacity  = 'Must be 0–100'
    if (!isFinite(inDurationMs)  || inDurationMs  < 0) next.inDuration  = 'Must be ≥ 0'
    if (!isFinite(outDurationMs) || outDurationMs < 0) next.outDuration = 'Must be ≥ 0'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const isValid =
    lyricText.trim().length > 0 &&
    isFinite(startMs) && startMs >= 0 &&
    isFinite(endMs) && endMs > startMs &&
    endMs - startMs >= MIN_CUE_DURATION_MS &&
    fontSize >= 12 && fontSize <= 240 &&
    opacityPercent >= 0 && opacityPercent <= 100 &&
    isFinite(inDurationMs)  && inDurationMs  >= 0 &&
    isFinite(outDurationMs) && outDurationMs >= 0

  async function handleCreate() {
    if (!validate()) return

    const pos = POSITION_PRESETS[position]
    const align = textAlign.toLowerCase() as 'left' | 'center' | 'right'

    addCue({
      text: lyricText.trim(),
      startMs,
      endMs,
      style: {
        x:        pos.x,
        y:        pos.y,
        align,
        fontSize,
        color:    textColor,
        opacity:  opacityPercent / 100,
      },
      animation: {
        in:    inAnimation,
        out:   outAnimation,
        inMs:  inDurationMs,
        outMs: outDurationMs,
      },
    })

    setLyricsEnabled(true)
    saveTimingChanges()   // no-op when no active document
    onClose()
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isValid) {
      e.preventDefault()
      handleCreate()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="acm-backdrop"
      role="presentation"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="acm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="acm-title"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="acm-header">
          <span id="acm-title" className="acm-title">ADD CUE</span>
          <button className="acm-close" aria-label="Close dialog" onClick={onClose}>×</button>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="acm-body">

          {/* Left nav */}
          <div className="acm-nav">
            <div className="acm-nav-section-label">Cue Type</div>

            <div className="acm-nav-item acm-nav-item--active">
              Add Lyric Cue
            </div>

            <div className="acm-nav-item acm-nav-item--disabled" aria-disabled="true">
              Add FX Cue
              <span className="acm-nav-coming-soon">Coming soon</span>
            </div>

            <div className="acm-nav-item acm-nav-item--disabled" aria-disabled="true">
              Add Trigger Cue
              <span className="acm-nav-coming-soon">Coming soon</span>
            </div>

            <div className="acm-nav-item acm-nav-item--disabled" aria-disabled="true">
              Add Section Marker
              <span className="acm-nav-coming-soon">Coming soon</span>
            </div>

            <p className="acm-nav-note">Only Lyric Cue is available in this build.</p>
          </div>

          {/* Right content */}
          <div className="acm-content">
            <div className="acm-section-heading">Lyric Cue Details</div>

            {/* Cue Label (disabled) + Lyric Text */}
            <div className="acm-row acm-row--two-col">
              <div className="acm-field">
                <label className="acm-label">
                  Cue Label <span className="acm-label-hint">(Optional)</span>
                </label>
                <input
                  className="acm-input acm-input--disabled"
                  type="text"
                  placeholder="e.g. Chorus Line 1"
                  disabled
                />
              </div>
              <div className="acm-field acm-field--grow">
                <label className="acm-label">
                  Lyric Text <span className="acm-required">*</span>
                </label>
                <textarea
                  ref={textareaRef}
                  className={`acm-textarea${errors.lyricText ? ' acm-field--error' : ''}`}
                  placeholder="Enter the lyric text that should appear on screen..."
                  value={lyricText}
                  rows={3}
                  onChange={e => {
                    setLyricText(e.target.value)
                    setErrors(er => ({ ...er, lyricText: '' }))
                  }}
                  onKeyDown={handleTextareaKeyDown}
                />
                {errors.lyricText && <span className="acm-error-msg">{errors.lyricText}</span>}
              </div>
            </div>

            {/* Timing */}
            <div className="acm-row acm-row--timing">
              <div className="acm-field">
                <label className="acm-label">Start Time (MS) <span className="acm-required">*</span></label>
                <input
                  className={`acm-input${errors.startMs ? ' acm-field--error' : ''}`}
                  type="number"
                  min={0}
                  step={1}
                  value={startMs}
                  onChange={e => {
                    setStartMs(Math.max(0, parseInt(e.target.value) || 0))
                    setErrors(er => ({ ...er, startMs: '' }))
                  }}
                />
                {errors.startMs && <span className="acm-error-msg">{errors.startMs}</span>}
              </div>
              <div className="acm-field">
                <label className="acm-label">End Time (MS) <span className="acm-required">*</span></label>
                <input
                  className={`acm-input${errors.endMs ? ' acm-field--error' : ''}`}
                  type="number"
                  min={0}
                  step={1}
                  value={endMs}
                  onChange={e => {
                    setEndMs(Math.max(0, parseInt(e.target.value) || 0))
                    setErrors(er => ({ ...er, endMs: '' }))
                  }}
                />
                {errors.endMs && <span className="acm-error-msg">{errors.endMs}</span>}
              </div>
              <div className="acm-field">
                <label className="acm-label">Duration</label>
                <input
                  className="acm-input acm-input--readonly"
                  type="text"
                  value={`${durationMs} ms`}
                  readOnly
                  tabIndex={-1}
                />
              </div>
            </div>

            {/* Playhead buttons */}
            <div className="acm-row acm-row--playhead">
              <button className="acm-playhead-btn" type="button" onClick={handleUsePlayhead}>
                <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M8 5.5v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Use Current Playhead
              </button>
              <button className="acm-playhead-btn" type="button" onClick={handleSetEndFromPlayhead}>
                <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden="true">
                  <path d="M2 8h9M8 5l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="13" y1="4" x2="13" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Set End From Playhead
              </button>
            </div>

            {/* Track / Source (disabled) + Style Preset (disabled) */}
            <div className="acm-row acm-row--two-col">
              <div className="acm-field">
                <label className="acm-label">Track / Source</label>
                <DropdownSelect className="acm-select acm-select--disabled" disabled>
                  <option>Current Audio Track</option>
                </DropdownSelect>
              </div>
              <div className="acm-field">
                <label className="acm-label">Style Preset</label>
                <DropdownSelect className="acm-select acm-select--disabled" disabled>
                  <option>Default Lyric</option>
                </DropdownSelect>
              </div>
            </div>

            {/* ── Display ─────────────────────────────────────── */}
            <div className="acm-section-heading">Display</div>
            <div className="acm-row acm-row--display">
              <div className="acm-field">
                <label className="acm-label">Position</label>
                <DropdownSelect
                  className="acm-select"
                  value={position}
                  onChange={e => setPosition(e.target.value as PositionKey)}
                >
                  {(Object.keys(POSITION_PRESETS) as PositionKey[]).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </DropdownSelect>
              </div>
              <div className="acm-field">
                <label className="acm-label">Text Align</label>
                <DropdownSelect
                  className="acm-select"
                  value={textAlign}
                  onChange={e => setTextAlign(e.target.value as AlignOption)}
                >
                  <option>Left</option>
                  <option>Center</option>
                  <option>Right</option>
                </DropdownSelect>
              </div>
              <div className="acm-field">
                <label className="acm-label">Font Size</label>
                <input
                  className={`acm-input${errors.fontSize ? ' acm-field--error' : ''}`}
                  type="number"
                  min={12}
                  max={240}
                  value={fontSize}
                  onChange={e => {
                    setFontSize(parseInt(e.target.value) || 72)
                    setErrors(er => ({ ...er, fontSize: '' }))
                  }}
                />
                {errors.fontSize && <span className="acm-error-msg">{errors.fontSize}</span>}
              </div>
              <div className="acm-field">
                <label className="acm-label">Text Color</label>
                <div className="acm-color-wrap">
                  <input
                    className="acm-color-native"
                    type="color"
                    value={textColor}
                    onChange={e => setTextColor(e.target.value)}
                    title="Pick color"
                  />
                  <div className="acm-color-swatch" style={{ background: textColor }} />
                  <span className="acm-input acm-input--hex">{textColor.toUpperCase()}</span>
                </div>
              </div>
              <div className="acm-field">
                <label className="acm-label">Opacity</label>
                <div className="acm-opacity-wrap">
                  <input
                    className={`acm-input${errors.opacity ? ' acm-field--error' : ''}`}
                    type="number"
                    min={0}
                    max={100}
                    value={opacityPercent}
                    onChange={e => {
                      setOpacityPercent(Math.min(100, Math.max(0, parseInt(e.target.value) ?? 100)))
                      setErrors(er => ({ ...er, opacity: '' }))
                    }}
                  />
                  <span className="acm-opacity-pct">%</span>
                </div>
                {errors.opacity && <span className="acm-error-msg">{errors.opacity}</span>}
              </div>
            </div>

            {/* ── Animation ───────────────────────────────────── */}
            <div className="acm-section-heading">Animation</div>
            <div className="acm-row acm-row--animation">
              <div className="acm-field">
                <label className="acm-label">In Animation</label>
                <DropdownSelect
                  className="acm-select"
                  value={inAnimation}
                  onChange={e => setInAnimation(e.target.value as LyricAnimationName)}
                >
                  {IN_ANIM_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </DropdownSelect>
              </div>
              <div className="acm-field">
                <label className="acm-label">Out Animation</label>
                <DropdownSelect
                  className="acm-select"
                  value={outAnimation}
                  onChange={e => setOutAnimation(e.target.value as LyricAnimationName)}
                >
                  {OUT_ANIM_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </DropdownSelect>
              </div>
              <div className="acm-field">
                <label className="acm-label">In Duration (MS)</label>
                <input
                  className={`acm-input${errors.inDuration ? ' acm-field--error' : ''}`}
                  type="number"
                  min={0}
                  value={inDurationMs}
                  onChange={e => {
                    setInDurationMs(Math.max(0, parseInt(e.target.value) || 0))
                    setErrors(er => ({ ...er, inDuration: '' }))
                  }}
                />
                {errors.inDuration && <span className="acm-error-msg">{errors.inDuration}</span>}
              </div>
              <div className="acm-field">
                <label className="acm-label">Out Duration (MS)</label>
                <input
                  className={`acm-input${errors.outDuration ? ' acm-field--error' : ''}`}
                  type="number"
                  min={0}
                  value={outDurationMs}
                  onChange={e => {
                    setOutDurationMs(Math.max(0, parseInt(e.target.value) || 0))
                    setErrors(er => ({ ...er, outDuration: '' }))
                  }}
                />
                {errors.outDuration && <span className="acm-error-msg">{errors.outDuration}</span>}
              </div>
            </div>

            {/* ── Disabled footer controls ─────────────────────── */}
            <div className="acm-row acm-row--disabled-controls">
              <div className="acm-disabled-toggle" aria-disabled="true">
                <div className="acm-toggle-thumb--off" />
                <span className="acm-disabled-label">Enabled</span>
              </div>
              <label className="acm-disabled-checkbox">
                <input type="checkbox" disabled />
                <span>Create another after save</span>
              </label>
              <label className="acm-disabled-checkbox">
                <input type="checkbox" disabled />
                <span>Open cue in editor after create</span>
              </label>
            </div>

            {/* Local-only notice */}
            {!activeDocumentId && (
              <div className="acm-local-notice">
                Lyric cue added locally. Open Lyrics to save it to a document.
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="acm-footer">
          <button className="acm-btn acm-btn--cancel" type="button" onClick={onClose}>Cancel</button>
          <button
            className="acm-btn acm-btn--create"
            type="button"
            disabled={!isValid}
            onClick={handleCreate}
          >Create Cue</button>
        </div>
      </div>
    </div>
  )
}
