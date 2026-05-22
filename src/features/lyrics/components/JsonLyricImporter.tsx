import { useState, useCallback, useRef } from 'react'
import type { LyricCue } from '../../../types/lyrics'
import { parseLyricDocumentJson, type LyricDocumentImportResult } from '../utils/lyricDocumentImport'
import { formatMs } from '../../../lib/lyricsImport'

const PLACEHOLDER = `// Paste one of these three formats:

// 1. Cue array
[
  { "startMs": 9000, "endMs": 12000, "text": "Dreams in the wire" }
]

// 2. Cue wrapper
{ "cues": [ { "startMs": 9000, "endMs": 12000, "text": "Dreams in the wire" } ] }

// 3. Full document
{
  "title": "Stolen Dreams", "artist": "DVYDRM",
  "defaultStyle": { "color": "#ffffff", "fontSize": 72 },
  "cues": [ { "startMs": 9000, "endMs": 12000, "text": "Dreams in the wire" } ]
}`

interface Props {
  onImportToDraft: (result: LyricDocumentImportResult) => void
}

const FORMAT_LABELS: Record<string, string> = {
  cue_array:     'Cue Array',
  cue_wrapper:   'Cue Wrapper',
  full_document: 'Full Document',
  unknown:       'Unknown',
}

export function JsonLyricImporter({ onImportToDraft }: Props) {
  const [jsonInput, setJsonInput]     = useState('')
  const [result, setResult]           = useState<LyricDocumentImportResult | null>(null)
  const [dragOver, setDragOver]       = useState(false)
  const [fileName, setFileName]       = useState<string | null>(null)
  const [parseSource, setParseSource] = useState<'file' | 'validate' | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const scrollToResult = useCallback(() => {
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 0)
  }, [])

  const runParse = useCallback((text: string, source: 'file' | 'validate') => {
    setResult(parseLyricDocumentJson(text))
    setParseSource(source)
    scrollToResult()
  }, [scrollToResult])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file || !file.name.endsWith('.json')) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setJsonInput(text)
      setFileName(file.name)
      runParse(text, 'file')
    }
    reader.readAsText(file)
  }, [runParse])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setJsonInput(text)
      setFileName(file.name)
      runParse(text, 'file')
    }
    reader.readAsText(file)
  }, [runParse])

  const handleValidate = useCallback(() => {
    if (!jsonInput.trim()) {
      setResult({
        cues: [],
        errors: ['Paste or upload lyric JSON before validating.'],
        warnings: [],
        detectedFormat: 'unknown',
        documentPatch: {},
      })
      setParseSource('validate')
      scrollToResult()
      return
    }
    runParse(jsonInput, 'validate')
  }, [jsonInput, runParse, scrollToResult])

  const hasErrors   = result && result.errors.length > 0
  const canImport   = result && result.errors.length === 0 && result.cues.length > 0
  const previewCues: LyricCue[] = result?.cues.slice(0, 6) ?? []
  const hiddenCount = (result?.cues.length ?? 0) - previewCues.length

  const statusVariant = hasErrors ? 'error' : (result?.warnings.length ?? 0) > 0 ? 'warn' : 'ok'
  const statusIcon    = hasErrors ? '✕' : (result?.warnings.length ?? 0) > 0 ? '⚠' : '✓'
  const statusMsg = hasErrors
    ? `Parse error — ${result!.errors.length} issue${result!.errors.length !== 1 ? 's' : ''}`
    : (result?.warnings.length ?? 0) > 0
      ? `Valid with warnings · ${result!.cues.length} cue${result!.cues.length !== 1 ? 's' : ''} detected`
      : `Valid lyric JSON · ${result!.cues.length} cue${result!.cues.length !== 1 ? 's' : ''} detected`

  return (
    <div className="lmv-workflow-content">
      <div className="lmv-section-label">UPLOAD OR PASTE JSON</div>

      {/* Drop zone */}
      <div
        className={`lmv-drop-zone${dragOver ? ' lmv-drop-zone--over' : ''}${fileName ? ' lmv-drop-zone--has-file' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {fileName ? (
          <>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style={{ color: 'rgba(74,199,219,0.7)', flexShrink: 0 }}>
              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
            </svg>
            <span className="lmv-drop-zone-text" style={{ color: 'rgba(74,199,219,0.85)' }}>{fileName}</span>
            <span className="lmv-drop-zone-sub">Replace by dropping another file</span>
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" opacity={0.35}>
              <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
            </svg>
            <span className="lmv-drop-zone-text">Drop .json file here</span>
            <span className="lmv-drop-zone-or">or</span>
          </>
        )}
        <label className="lmv-btn lmv-btn--ghost lmv-drop-browse">
          {fileName ? 'Replace File' : 'Browse File'}
          <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFileInput} />
        </label>
      </div>

      {/* Paste fallback */}
      <div className="lmv-section-label" style={{ marginTop: 16 }}>OR PASTE JSON</div>
      <textarea
        className="lmv-textarea lmv-json-textarea"
        rows={10}
        placeholder={PLACEHOLDER}
        value={jsonInput}
        spellCheck={false}
        onChange={e => {
          setJsonInput(e.target.value)
          if (!e.target.value.trim()) { setResult(null); setFileName(null); return }
        }}
      />

      <div className="lmv-import-actions">
        <button
          className="lmv-btn lmv-btn--ghost"
          onClick={handleValidate}
        >
          {result ? 'Re-validate' : 'Validate'}
        </button>
        <button
          className="lmv-btn lmv-btn--primary"
          disabled={!canImport}
          onClick={() => {
            if (result) onImportToDraft({
              ...result,
              documentPatch: {
                ...result.documentPatch,
                rawSourceText: result.documentPatch.rawSourceText ?? jsonInput,
              },
            })
          }}
        >
          Import to Draft
        </button>
      </div>

      {/* Validation results */}
      {result && (
        <div ref={resultRef} className="lmv-validation-box">

          {/* Status banner — aria-live announces changes to screen readers */}
          <div
            className={`lmv-parse-status lmv-parse-status--${statusVariant}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="lmv-parse-status-icon" aria-hidden="true">{statusIcon}</span>
            <span className="lmv-parse-status-msg">{statusMsg}</span>
            {parseSource === 'file' && fileName && (
              <span className="lmv-parse-source-tag" aria-label={`from file: ${fileName}`}>from file</span>
            )}
          </div>

          {/* Next-action hint when valid */}
          {!hasErrors && result.cues.length > 0 && (
            <div className="lmv-parse-next-hint">
              Click <strong>Import to Draft</strong> to load these cues, then use{' '}
              <strong>Preview in Visualizer</strong> to see them live.
            </div>
          )}

          {result.detectedFormat !== 'unknown' && (
            <div className="lmv-validation-row">
              <span className="lmv-val-label">Format</span>
              <span className="lmv-val-value">{FORMAT_LABELS[result.detectedFormat]}</span>
            </div>
          )}
          <div className="lmv-validation-row">
            <span className="lmv-val-label">Cues</span>
            <span className="lmv-val-value">{result.cues.length}</span>
          </div>
          {result.documentPatch.title && (
            <div className="lmv-validation-row">
              <span className="lmv-val-label">Title</span>
              <span className="lmv-val-value">{result.documentPatch.title}</span>
            </div>
          )}
          {result.documentPatch.artist && (
            <div className="lmv-validation-row">
              <span className="lmv-val-label">Artist</span>
              <span className="lmv-val-value">{result.documentPatch.artist}</span>
            </div>
          )}
          {result.documentPatch.globalOffsetMs !== undefined && (
            <div className="lmv-validation-row">
              <span className="lmv-val-label">Offset</span>
              <span className="lmv-val-value">{result.documentPatch.globalOffsetMs}ms</span>
            </div>
          )}
          {result.documentPatch.defaultStyle && (
            <div className="lmv-validation-row">
              <span className="lmv-val-label">Default Style</span>
              <span className="lmv-val-value lmv-val-yes">✓ Included</span>
            </div>
          )}
          {result.documentPatch.defaultAnimation && (
            <div className="lmv-validation-row">
              <span className="lmv-val-label">Default Animation</span>
              <span className="lmv-val-value lmv-val-yes">✓ Included</span>
            </div>
          )}
          {result.documentPatch.metadata && Object.keys(result.documentPatch.metadata).length > 0 && (
            <div className="lmv-validation-row">
              <span className="lmv-val-label">Metadata</span>
              <span className="lmv-val-value">
                {Object.keys(result.documentPatch.metadata).length} field{Object.keys(result.documentPatch.metadata).length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="lmv-msg-list lmv-msg-list--error">
              {result.errors.map((e, i) => <div key={i} className="lmv-msg-item">✕ {e}</div>)}
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="lmv-msg-list lmv-msg-list--warn">
              {result.warnings.map((w, i) => <div key={i} className="lmv-msg-item">⚠ {w}</div>)}
            </div>
          )}

          {!hasErrors && previewCues.length > 0 && (
            <>
              <div className="lmv-section-label" style={{ marginTop: 14 }}>PARSED PREVIEW</div>
              <div className="lmv-cue-preview-list">
                {previewCues.map((c, i) => (
                  <div key={i} className="lmv-cue-preview-row">
                    <span className="lmv-cue-ts">{formatMs(c.startMs)} → {formatMs(c.endMs)}</span>
                    <span className="lmv-cue-text">{c.text}</span>
                    {c.words && c.words.length > 0 && (
                      <span className="lmv-cue-badge">w:{c.words.length}</span>
                    )}
                  </div>
                ))}
                {hiddenCount > 0 && (
                  <div className="lmv-cue-more">+{hiddenCount} more cues</div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
