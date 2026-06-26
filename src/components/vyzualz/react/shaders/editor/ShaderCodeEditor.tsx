import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { ShaderDefinitionValidator } from '../registry/ShaderDefinitionValidator'
import { useShaderLibraryStore } from '../library/ShaderLibraryStore'
import { shaderRegistry } from '../registry'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompileError {
  line:    number | null
  message: string
  level:   'error' | 'warning'
}

// Parse GLSL compile errors into structured form.
function parseGlslErrors(log: string): CompileError[] {
  const results: CompileError[] = []
  for (const line of log.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // Common format: ERROR: 0:34: 'uTime' : undeclared identifier
    const m = /^(ERROR|WARNING):\s*\d+:(\d+):\s*(.+)$/i.exec(trimmed)
    if (m) {
      results.push({
        level:   m[1].toLowerCase() === 'warning' ? 'warning' : 'error',
        line:    parseInt(m[2], 10),
        message: m[3].trim(),
      })
    } else if (trimmed.length > 0) {
      results.push({ level: 'error', line: null, message: trimmed })
    }
  }
  return results
}

// ── ShaderCodeEditor ──────────────────────────────────────────────────────────

export interface ShaderCodeEditorProps {
  /** The definition being edited. Must be a user scene or undefined for scratch. */
  definition:  ShaderDefinition | null
  /** True when `definition` is an editable user scene (not a bundled built-in). */
  isUserScene?: boolean
  /** Called when the user saves the edited source. */
  onSave?:     (def: ShaderDefinition) => void
  /** Called when user requests live compile-and-preview. */
  onCompile?:  (fragSrc: string, vertSrc?: string) => void
  /** Called when the user discards unsaved changes and resets to the saved source. */
  onResetPreview?: () => void
  /** Compile error from the live runtime, if any. */
  runtimeError?: string | null
  /** Last successful compile timestamp. */
  lastSuccessAt?: string | null
}

export function ShaderCodeEditor({
  definition,
  isUserScene = false,
  onSave,
  onCompile,
  onResetPreview,
  runtimeError,
  lastSuccessAt,
}: ShaderCodeEditorProps) {
  const store = useShaderLibraryStore()
  const editorPrefs = store.editorPreferences

  const [fragSrc,  setFragSrc]  = useState('')
  const [vertSrc,  setVertSrc]  = useState('')
  const [showVert, setShowVert] = useState(false)
  const [editName, setEditName] = useState('')
  const [isDirty,  setIsDirty]  = useState(false)
  const [errors,   setErrors]   = useState<CompileError[]>([])

  const autoCompileTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A scene is bundled (read-only) when it's in the registry but NOT a user scene.
  const isBundled = definition
    ? (shaderRegistry.has(definition.id) && !isUserScene)
    : false

  // Sync state when definition changes
  useEffect(() => {
    if (!definition) {
      setFragSrc('#version 300 es\nprecision highp float;\nout vec4 fragColor;\nvoid main() {\n  fragColor = vec4(0.1, 0.1, 0.2, 1.0);\n}\n')
      setVertSrc('')
      setEditName('Untitled Shader')
      setIsDirty(false)
      setErrors([])
      return
    }
    setFragSrc(definition.fragSrc ?? definition.passes?.[0]?.fragSrc ?? '')
    setVertSrc(typeof definition.vertSrc === 'string' && definition.vertSrc !== 'shared'
      ? definition.vertSrc : '')
    setEditName(definition.name)
    setIsDirty(false)
    setErrors([])
  }, [definition?.id])

  // Parse runtime error into structured errors
  useEffect(() => {
    if (runtimeError) {
      setErrors(parseGlslErrors(runtimeError))
    } else {
      setErrors([])
    }
  }, [runtimeError])

  const handleFragChange = useCallback((src: string) => {
    setFragSrc(src)
    setIsDirty(true)

    if (editorPrefs.autoCompile) {
      if (autoCompileTimer.current) clearTimeout(autoCompileTimer.current)
      autoCompileTimer.current = setTimeout(() => {
        onCompile?.(src, showVert ? vertSrc : undefined)
      }, editorPrefs.autoCompileDelayMs)
    }
  }, [editorPrefs.autoCompile, editorPrefs.autoCompileDelayMs, onCompile, showVert, vertSrc])

  const handleVertChange = useCallback((src: string) => {
    setVertSrc(src)
    setIsDirty(true)
  }, [])

  function handleCompile() {
    if (autoCompileTimer.current) clearTimeout(autoCompileTimer.current)
    onCompile?.(fragSrc, showVert && vertSrc ? vertSrc : undefined)
  }

  function handleSave() {
    if (!onSave) return
    // For user scenes, preserve the existing ID so updateUserScene() can find it.
    // For new scenes (no definition or bundled-only), generate a fresh ID.
    const saveId = (isUserScene && definition?.id)
      ? definition.id
      : `user-shader-${Date.now().toString(36)}`
    const newDef: ShaderDefinition = {
      ...(definition ?? {}),
      id:       saveId,
      name:     editName.trim() || 'Untitled Shader',
      fragSrc,
      vertSrc:  showVert && vertSrc ? vertSrc : 'shared',
      params:   definition?.params   ?? [],
      defaults: definition?.defaults ?? {},
      version:  (definition?.version ?? 0) + 1,
      category: definition?.category ?? 'generator',
      description: definition?.description ?? '',
    }
    const validation = ShaderDefinitionValidator.validate(newDef)
    if (!validation.valid) {
      setErrors(validation.errors.map(e => ({ level: 'error', line: null, message: e.message })))
      return
    }
    onSave(newDef)
    setIsDirty(false)
  }

  function handleDuplicateToCopy() {
    if (!definition) return
    const result = store.duplicateScene(definition.id)
    if (!result.ok) {
      setErrors([{ level: 'error', line: null, message: result.error }])
    }
  }

  function handleReset() {
    if (!definition) return
    setFragSrc(definition.fragSrc ?? definition.passes?.[0]?.fragSrc ?? '')
    setVertSrc(typeof definition.vertSrc === 'string' && definition.vertSrc !== 'shared' ? definition.vertSrc : '')
    setIsDirty(false)
    setErrors([])
    // Also reset the live preview graph so the canvas shows the saved source
    onResetPreview?.()
  }

  // Cleanup on unmount
  useEffect(() => () => {
    if (autoCompileTimer.current) clearTimeout(autoCompileTimer.current)
  }, [])

  return (
    <div className="rv-shader-editor">
      {/* ── Header ── */}
      <div className="rv-shader-editor-header">
        <input
          type="text"
          className="rv-ctrl-text-input rv-shader-editor-name"
          value={editName}
          onChange={e => setEditName(e.target.value)}
          placeholder="Scene name"
          readOnly={isBundled}
          title={isBundled ? 'Bundled scenes cannot be renamed. Duplicate to edit.' : 'Scene name'}
        />

        {isBundled && (
          <span className="rv-shader-editor-badge rv-shader-editor-badge--bundled">
            read-only
          </span>
        )}
        {isDirty && !isBundled && (
          <span className="rv-shader-editor-badge rv-shader-editor-badge--dirty">
            unsaved
          </span>
        )}
      </div>

      {/* ── Pass selector (fragment / vertex) ── */}
      <div className="rv-shader-editor-tabs">
        <button
          type="button"
          className={`rv-shader-editor-tab${!showVert ? ' rv-shader-editor-tab--active' : ''}`}
          onClick={() => setShowVert(false)}
        >
          Fragment
        </button>
        <button
          type="button"
          className={`rv-shader-editor-tab${showVert ? ' rv-shader-editor-tab--active' : ''}`}
          onClick={() => setShowVert(true)}
        >
          Vertex
        </button>
      </div>

      {/* ── Code area ── */}
      {!isBundled ? (
        <textarea
          className="rv-shader-editor-code"
          spellCheck={false}
          value={showVert ? vertSrc : fragSrc}
          onChange={e => showVert ? handleVertChange(e.target.value) : handleFragChange(e.target.value)}
          style={{ fontSize: editorPrefs.fontSize }}
          aria-label={showVert ? 'Vertex shader source' : 'Fragment shader source'}
        />
      ) : (
        <textarea
          className="rv-shader-editor-code rv-shader-editor-code--readonly"
          spellCheck={false}
          value={showVert ? vertSrc : fragSrc}
          readOnly
          style={{ fontSize: editorPrefs.fontSize }}
          aria-label={showVert ? 'Vertex shader source (read-only)' : 'Fragment shader source (read-only)'}
        />
      )}

      {/* ── Error list ── */}
      {errors.length > 0 && (
        <div className="rv-shader-editor-errors">
          {errors.map((err, i) => (
            <div
              key={i}
              className={`rv-shader-editor-error rv-shader-editor-error--${err.level}`}
            >
              {err.line !== null && <span className="rv-shader-editor-error-line">:{err.line}</span>}
              <span className="rv-shader-editor-error-msg">{err.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Status ── */}
      {!runtimeError && lastSuccessAt && (
        <div className="rv-shader-editor-status rv-shader-editor-status--ok">
          Compiled ok — {new Date(lastSuccessAt).toLocaleTimeString()}
        </div>
      )}

      {/* ── Action bar ── */}
      <div className="rv-shader-editor-actions">
        {!isBundled && (
          <>
            <button type="button" className="rv-shader-editor-btn" onClick={handleCompile}>
              Compile
            </button>
            <button
              type="button"
              className="rv-shader-editor-btn"
              onClick={handleSave}
              disabled={!isDirty}
              title={isUserScene ? 'Save changes to this user scene' : 'Save as a new user scene'}
            >
              Save
            </button>
            <button
              type="button"
              className="rv-shader-editor-btn rv-shader-editor-btn--secondary"
              onClick={handleReset}
              disabled={!isDirty}
              title="Discard unsaved changes"
            >
              Reset
            </button>
          </>
        )}

        {isBundled && (
          <button
            type="button"
            className="rv-shader-editor-btn"
            onClick={handleDuplicateToCopy}
            title="Duplicate this bundled scene into an editable user scene"
          >
            Duplicate to Edit
          </button>
        )}

        <label className="rv-shader-editor-pref" title="Compile automatically while typing">
          <input
            type="checkbox"
            checked={editorPrefs.autoCompile}
            onChange={e => store.setEditorPreferences({ autoCompile: e.target.checked })}
          />
          Auto-compile
        </label>
      </div>
    </div>
  )
}
