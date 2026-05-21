import { useState, useCallback } from 'react'
import type { LyricExtractionOptions, LyricExtractionResult } from '../services/lyricExtraction'
import { extractLyricsFromAudio } from '../services/lyricExtraction'
import { formatMs } from '../../../lib/lyricsImport'
import type { LyricDocumentImportResult } from '../utils/lyricDocumentImport'

const ACCEPTED = '.wav,.mp3,.flac,.m4a,audio/*'

const TIMING_OPTS = [
  { value: 'line',       label: 'Line-level' },
  { value: 'word',       label: 'Word-level' },
  { value: 'line+word',  label: 'Line + Word' },
] as const

const STYLE_PRESETS = [
  'Inherit document defaults',
  'Neon Bass',
  'Clean White',
  'Glitch Pink',
  'Minimal',
]

interface Props {
  onImportToDraft: (result: LyricDocumentImportResult) => void
}

export function AiLyricExtractor({ onImportToDraft }: Props) {
  const [file, setFile]           = useState<File | null>(null)
  const [dragOver, setDragOver]   = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [result, setResult]       = useState<LyricExtractionResult | null>(null)

  const [opts, setOpts] = useState<LyricExtractionOptions>({
    language:           'auto',
    timingDetail:       'line+word',
    stylePreset:        'Inherit document defaults',
    confidenceThreshold: 0.6,
    globalOffsetMs:     0,
  })

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setResult(null); setError(null) }
  }, [])

  const handleExtract = useCallback(async () => {
    if (!file) return
    setExtracting(true)
    setError(null)
    setResult(null)
    try {
      const res = await extractLyricsFromAudio(file, opts)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setExtracting(false)
    }
  }, [file, opts])

  const handleImport = useCallback(() => {
    if (!result) return
    const importResult: LyricDocumentImportResult = {
      documentPatch: {
        title:         result.title,
        artist:        result.artist,
        sourceType:    'ai_transcription',
        sourceFormat:  'json',
        globalOffsetMs: result.globalOffsetMs,
        metadata:      result.metadata as Record<string, unknown>,
      },
      cues:           result.cues,
      detectedFormat: 'full_document',
      warnings:       [],
      errors:         [],
    }
    onImportToDraft(importResult)
  }, [result, onImportToDraft])

  return (
    <div className="lmv-workflow-content">

      <div className="lmv-ai-notice">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ flexShrink: 0, opacity: 0.7 }}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        <span>
          AI extraction requires a connected backend transcription service.
          The workflow and review UI are ready — wire up <code>lyricExtraction.ts</code> to enable.
        </span>
      </div>

      <div className="lmv-section-label">UPLOAD VOCAL AUDIO</div>

      <div
        className={`lmv-drop-zone${dragOver ? ' lmv-drop-zone--over' : ''}${file ? ' lmv-drop-zone--has-file' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {file ? (
          <>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" style={{ opacity: 0.6 }}>
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            <span className="lmv-drop-zone-text">{file.name}</span>
            <span className="lmv-drop-zone-sub">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            <button className="lmv-btn lmv-btn--ghost" onClick={() => setFile(null)} style={{ marginTop: 6 }}>
              Remove
            </button>
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" opacity={0.35}>
              <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
            </svg>
            <span className="lmv-drop-zone-text">Drop vocal audio here</span>
            <span className="lmv-drop-zone-sub">.wav · .mp3 · .flac · .m4a</span>
            <label className="lmv-btn lmv-btn--ghost lmv-drop-browse">
              Browse File
              <input type="file" accept={ACCEPTED} style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setResult(null); setError(null) } }} />
            </label>
          </>
        )}
      </div>

      {/* Extraction settings */}
      <div className="lmv-section-label" style={{ marginTop: 18 }}>EXTRACTION SETTINGS</div>
      <div className="lmv-grid2">
        <div className="lmv-field">
          <label className="lmv-field-label">LANGUAGE</label>
          <select className="lmv-select" value={opts.language}
            onChange={e => setOpts(o => ({ ...o, language: e.target.value }))}>
            <option value="auto">Auto-detect</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
          </select>
        </div>
        <div className="lmv-field">
          <label className="lmv-field-label">TIMING DETAIL</label>
          <select className="lmv-select" value={opts.timingDetail}
            onChange={e => setOpts(o => ({ ...o, timingDetail: e.target.value as LyricExtractionOptions['timingDetail'] }))}>
            {TIMING_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="lmv-field">
          <label className="lmv-field-label">STYLE PRESET</label>
          <select className="lmv-select" value={opts.stylePreset}
            onChange={e => setOpts(o => ({ ...o, stylePreset: e.target.value }))}>
            {STYLE_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="lmv-field">
          <label className="lmv-field-label">GLOBAL OFFSET MS</label>
          <input className="lmv-num" type="number" step={50} value={opts.globalOffsetMs ?? 0}
            onChange={e => setOpts(o => ({ ...o, globalOffsetMs: parseInt(e.target.value, 10) || 0 }))} />
        </div>
      </div>

      <div className="lmv-field">
        <label className="lmv-field-label">CONFIDENCE THRESHOLD</label>
        <div className="lmv-slider-row">
          <input type="range" className="lmv-slider" min={0} max={1} step={0.05}
            value={opts.confidenceThreshold ?? 0.6}
            onChange={e => setOpts(o => ({ ...o, confidenceThreshold: parseFloat(e.target.value) }))} />
          <span className="lmv-slider-val">{(opts.confidenceThreshold ?? 0.6).toFixed(2)}</span>
        </div>
      </div>

      <button
        className="lmv-btn lmv-btn--primary lmv-extract-btn"
        disabled={!file || extracting}
        onClick={handleExtract}
      >
        {extracting ? 'Extracting…' : 'Start AI Extraction'}
      </button>

      {error && (
        <div className="lmv-msg-list lmv-msg-list--error" style={{ marginTop: 12 }}>
          <div className="lmv-msg-item">✕ {error}</div>
        </div>
      )}

      {/* AI review area */}
      {result && (
        <>
          <div className="lmv-section-label" style={{ marginTop: 18 }}>AI REVIEW</div>
          <div className="lmv-validation-box">
            {result.metadata.language && (
              <div className="lmv-validation-row">
                <span className="lmv-val-label">Language</span>
                <span className="lmv-val-value">{result.metadata.language}</span>
              </div>
            )}
            <div className="lmv-validation-row">
              <span className="lmv-val-label">Cues</span>
              <span className="lmv-val-value">{result.cues.length}</span>
            </div>
            {result.metadata.confidence !== undefined && (
              <div className="lmv-validation-row">
                <span className="lmv-val-label">Avg Confidence</span>
                <span className="lmv-val-value">{(result.metadata.confidence * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>

          <div className="lmv-cue-preview-list" style={{ marginTop: 8 }}>
            {result.cues.slice(0, 8).map((cue, i) => (
              <div key={i} className="lmv-cue-preview-row">
                <span className="lmv-cue-ts">{formatMs(cue.startMs)} → {formatMs(cue.endMs)}</span>
                <span className="lmv-cue-text">{cue.text}</span>
                {'confidence' in cue && typeof (cue as { confidence?: number }).confidence === 'number' && (
                  <span className="lmv-cue-badge">
                    {((cue as { confidence?: number }).confidence! * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
            {result.cues.length > 8 && (
              <div className="lmv-cue-more">+{result.cues.length - 8} more cues</div>
            )}
          </div>

          <div className="lmv-import-actions" style={{ marginTop: 12 }}>
            <button className="lmv-btn lmv-btn--primary" onClick={handleImport}>
              Import to Draft
            </button>
          </div>
        </>
      )}
    </div>
  )
}
