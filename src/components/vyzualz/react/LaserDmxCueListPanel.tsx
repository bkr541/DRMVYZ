import { useId, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import type { LaserDmxBeamMatrixCue } from './ReactTypes'
import { BEATS_PER_BAR } from './ReactTypes'

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m        = Math.floor(totalSec / 60)
  const s        = totalSec % 60
  const msFrac   = Math.round(ms % 1000)
  return `${m}:${String(s).padStart(2, '0')}.${String(msFrac).padStart(3, '0')}`
}

function parseMs(raw: string): number | undefined {
  const trimmed = raw.trim()
  // Accept "m:ss.mmm", "s.mmm", or plain integer ms
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/)
  if (colonMatch) {
    const m    = parseInt(colonMatch[1], 10)
    const s    = parseInt(colonMatch[2], 10)
    const msFr = colonMatch[3] ? parseInt(colonMatch[3].padEnd(3, '0'), 10) : 0
    return (m * 60 + s) * 1000 + msFr
  }
  const numericMs = parseFloat(trimmed)
  if (!isNaN(numericMs) && numericMs >= 0) return Math.round(numericMs)
  return undefined
}

function validateMusical(
  startBar?: number, startBeat?: number,
  endBar?: number,   endBeat?: number,
  action?: string,
): string | null {
  if (!startBar || startBar < 1)               return 'Start bar must be ≥ 1'
  if (!startBeat || startBeat < 1 || startBeat > BEATS_PER_BAR)
    return `Start beat must be 1–${BEATS_PER_BAR}`
  if (action === 'gate' && endBar != null) {
    if (endBar < 1) return 'End bar must be ≥ 1'
    const endBeatVal = endBeat ?? 1
    if (endBeatVal < 1 || endBeatVal > BEATS_PER_BAR) return `End beat must be 1–${BEATS_PER_BAR}`
    const startPos = (startBar - 1) * BEATS_PER_BAR + (startBeat - 1)
    const endPos   = (endBar   - 1) * BEATS_PER_BAR + (endBeatVal - 1)
    if (endPos <= startPos) return 'End must be after start'
  }
  return null
}

function validateAbsolute(startMs?: number, endMs?: number, action?: string): string | null {
  if (startMs == null || startMs < 0) return 'Start time must be ≥ 0'
  if (action === 'gate' && endMs != null) {
    if (endMs <= startMs) return 'End time must be after start'
  }
  return null
}

function validateCue(cue: LaserDmxBeamMatrixCue, beamIds: Set<string>, groupIds: Set<string>): string | null {
  if (!cue.targetId) return 'No target selected'
  if (cue.targetType === 'beam'  && !beamIds.has(cue.targetId))  return 'Target beam not found'
  if (cue.targetType === 'group' && !groupIds.has(cue.targetId)) return 'Target group not found'
  if (cue.timingMode === 'musical') {
    return validateMusical(cue.startBar, cue.startBeat, cue.endBar, cue.endBeat, cue.action)
  }
  return validateAbsolute(cue.startMs, cue.endMs, cue.action)
}

// ── Cue row editor ────────────────────────────────────────────────────────────

function CueRow({
  cue,
  beams,
  groups,
}: {
  cue:    LaserDmxBeamMatrixCue
  beams:  { id: string; name: string }[]
  groups: { id: string; name: string }[]
}) {
  const idPrefix = useId()
  const {
    updateLaserDmxBeamMatrixCue,
    removeLaserDmxBeamMatrixCue,
    duplicateLaserDmxBeamMatrixCue,
  } = useReactStore(useShallow(s => ({
    updateLaserDmxBeamMatrixCue:    s.updateLaserDmxBeamMatrixCue,
    removeLaserDmxBeamMatrixCue:    s.removeLaserDmxBeamMatrixCue,
    duplicateLaserDmxBeamMatrixCue: s.duplicateLaserDmxBeamMatrixCue,
  })))

  const [expanded, setExpanded] = useState(false)

  const upd = (patch: Partial<LaserDmxBeamMatrixCue>) =>
    updateLaserDmxBeamMatrixCue(cue.id, patch)

  const beamIds  = new Set(beams.map(b => b.id))
  const groupIds = new Set(groups.map(g => g.id))
  const validationError = validateCue(cue, beamIds, groupIds)

  const targetOptions = cue.targetType === 'beam'
    ? beams.map(b  => ({ value: b.id,  label: b.name  }))
    : groups.map(g => ({ value: g.id,  label: g.name  }))

  const startMsStr = cue.startMs != null ? fmtMs(cue.startMs) : ''
  const endMsStr   = cue.endMs   != null ? fmtMs(cue.endMs)   : ''

  return (
    <div className={`rv-cue-row${!cue.enabled ? ' rv-cue-row--disabled' : ''}${validationError ? ' rv-cue-row--invalid' : ''}`}>
      {/* Header */}
      <div className="rv-cue-row-header">
        <button
          type="button"
          className={`rv-ctrl-toggle${cue.enabled ? ' rv-ctrl-toggle--on' : ''}`}
          onClick={() => upd({ enabled: !cue.enabled })}
          aria-pressed={cue.enabled}
          aria-label={`${cue.enabled ? 'Disable' : 'Enable'} cue ${cue.name}`}
          title="Enable / disable cue"
        >
          {cue.enabled ? 'On' : 'Off'}
        </button>
        <input
          className="rv-cue-name-input"
          value={cue.name}
          onChange={e => upd({ name: e.target.value })}
          placeholder="Cue name"
          aria-label="Cue name"
        />
        <span className="rv-cue-badge rv-cue-badge--action">{cue.action}</span>
        <span className="rv-cue-badge rv-cue-badge--timing">{cue.timingMode === 'musical' ? 'musical' : 'abs'}</span>
        {validationError && <span className="rv-cue-error-icon" title={validationError}>⚠</span>}
        <button
          type="button"
          className="rv-glyph-upload-btn"
          title="Expand / collapse cue editor"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} cue ${cue.name}`}
        >
          {expanded ? '▲' : '▼'}
        </button>
        <button
          type="button"
          className="rv-glyph-upload-btn"
          title="Duplicate cue"
          aria-label={`Duplicate cue ${cue.name}`}
          onClick={() => duplicateLaserDmxBeamMatrixCue(cue.id)}
        >⧉</button>
        <button
          type="button"
          className="rv-glyph-upload-btn rv-glyph-upload-btn--danger"
          title="Delete cue"
          aria-label={`Delete cue ${cue.name}`}
          onClick={() => {
            if (window.confirm(`Delete cue "${cue.name}"?`)) removeLaserDmxBeamMatrixCue(cue.id)
          }}
        >×</button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="rv-cue-body">
          {validationError && (
            <p className="rv-cue-validation-error">{validationError}</p>
          )}

          {/* Target type */}
          <div className="rv-ctrl-row rv-cue-field-row">
            <label className="rv-ctrl-label" htmlFor={`${idPrefix}-target-type`}>Target type</label>
            <select
              id={`${idPrefix}-target-type`}
              className="rv-ctrl-select"
              value={cue.targetType}
              onChange={e => upd({ targetType: e.target.value as 'beam' | 'group', targetId: '' })}
            >
              <option value="beam">Beam</option>
              <option value="group">Reaction Group</option>
            </select>
          </div>

          {/* Target */}
          <div className="rv-ctrl-row rv-cue-field-row">
            <label className="rv-ctrl-label" htmlFor={`${idPrefix}-target`}>Target</label>
            <select
              id={`${idPrefix}-target`}
              className="rv-ctrl-select"
              value={cue.targetId}
              onChange={e => upd({ targetId: e.target.value })}
            >
              {targetOptions.length === 0 && (
                <option value="">— none available —</option>
              )}
              {targetOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Action */}
          <div className="rv-ctrl-row rv-cue-field-row">
            <label className="rv-ctrl-label" htmlFor={`${idPrefix}-action`}>Action</label>
            <select
              id={`${idPrefix}-action`}
              className="rv-ctrl-select"
              value={cue.action}
              onChange={e => upd({ action: e.target.value as 'gate' | 'trigger' })}
            >
              <option value="gate">Gate (active range)</option>
              <option value="trigger">Trigger (one-shot)</option>
            </select>
          </div>

          {/* Timing mode */}
          <div className="rv-ctrl-row rv-cue-field-row">
            <label className="rv-ctrl-label" htmlFor={`${idPrefix}-timing`}>Timing</label>
            <select
              id={`${idPrefix}-timing`}
              className="rv-ctrl-select"
              value={cue.timingMode}
              onChange={e => upd({ timingMode: e.target.value as 'musical' | 'absolute' })}
            >
              <option value="musical">Musical (bar / beat)</option>
              <option value="absolute">Absolute (time)</option>
            </select>
          </div>

          {/* Musical timing inputs */}
          {cue.timingMode === 'musical' && (
            <>
              <div className="rv-ctrl-row rv-cue-field-row">
                <span className="rv-ctrl-label">Start</span>
                <div className="rv-cue-time-fields">
                  <label className="rv-cue-time-label">Bar
                    <input
                      type="number"
                      className="rv-cue-num-input"
                      value={cue.startBar ?? 1}
                      min={1}
                      step={1}
                      onChange={e => upd({ startBar: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    />
                  </label>
                  <label className="rv-cue-time-label">Beat
                    <input
                      type="number"
                      className="rv-cue-num-input"
                      value={cue.startBeat ?? 1}
                      min={1}
                      max={BEATS_PER_BAR}
                      step={1}
                      onChange={e => upd({ startBeat: Math.max(1, Math.min(BEATS_PER_BAR, parseInt(e.target.value, 10) || 1)) })}
                    />
                  </label>
                </div>
              </div>
              {cue.action === 'gate' && (
                <div className="rv-ctrl-row rv-cue-field-row">
                  <span className="rv-ctrl-label">End</span>
                  <div className="rv-cue-time-fields">
                    <label className="rv-cue-time-label">Bar
                      <input
                        type="number"
                        className="rv-cue-num-input"
                        value={cue.endBar ?? ''}
                        min={1}
                        step={1}
                        placeholder="∞"
                        onChange={e => {
                          const v = parseInt(e.target.value, 10)
                          upd({ endBar: isNaN(v) ? undefined : Math.max(1, v) })
                        }}
                      />
                    </label>
                    <label className="rv-cue-time-label">Beat
                      <input
                        type="number"
                        className="rv-cue-num-input"
                        value={cue.endBeat ?? ''}
                        min={1}
                        max={BEATS_PER_BAR}
                        step={1}
                        placeholder="1"
                        disabled={cue.endBar == null}
                        onChange={e => {
                          const v = parseInt(e.target.value, 10)
                          upd({ endBeat: isNaN(v) ? undefined : Math.max(1, Math.min(BEATS_PER_BAR, v)) })
                        }}
                      />
                    </label>
                  </div>
                  {cue.endBar == null && (
                    <p className="rv-ctrl-info">No end = open-ended (active until track end)</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Absolute timing inputs */}
          {cue.timingMode === 'absolute' && (
            <>
              <div className="rv-ctrl-row rv-cue-field-row">
                <label className="rv-ctrl-label" htmlFor={`${idPrefix}-start-ms`}>Start (m:ss.mmm)</label>
                <input
                  id={`${idPrefix}-start-ms`}
                  type="text"
                  className="rv-cue-ms-input"
                  defaultValue={startMsStr}
                  placeholder="0:00.000"
                  onBlur={e => {
                    const ms = parseMs(e.target.value)
                    if (ms != null) upd({ startMs: ms })
                    else e.target.value = startMsStr
                  }}
                />
              </div>
              {cue.action === 'gate' && (
                <div className="rv-ctrl-row rv-cue-field-row">
                  <label className="rv-ctrl-label" htmlFor={`${idPrefix}-end-ms`}>End (m:ss.mmm)</label>
                  <input
                    id={`${idPrefix}-end-ms`}
                    type="text"
                    className="rv-cue-ms-input"
                    defaultValue={endMsStr}
                    placeholder="∞"
                    onBlur={e => {
                      const raw = e.target.value.trim()
                      if (raw === '' || raw === '∞') {
                        upd({ endMs: undefined })
                      } else {
                        const ms = parseMs(raw)
                        if (ms != null) upd({ endMs: ms })
                        else e.target.value = endMsStr
                      }
                    }}
                  />
                  {cue.endMs == null && (
                    <p className="rv-ctrl-info">No end = open-ended (active until track end)</p>
                  )}
                </div>
              )}
            </>
          )}

          {cue.action === 'gate' && (
            <p className="rv-ctrl-info">
              Gate: beam is active while playhead is inside the range. Cue-gating activates on seek into range.
            </p>
          )}
          {cue.action === 'trigger' && (
            <p className="rv-ctrl-info">
              Trigger: fires once when playhead crosses start in forward playback. Rearms when playhead rewinds before start.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Cue list panel ────────────────────────────────────────────────────────────

export function LaserDmxCueListPanel() {
  const {
    beams,
    groups,
    cues,
    addLaserDmxBeamMatrixCue,
  } = useReactStore(useShallow(s => ({
    beams:                   s.laserDmxBeamMatrix.beams,
    groups:                  s.laserDmxBeamMatrix.groups,
    cues:                    s.laserDmxBeamMatrix.cues ?? [],
    addLaserDmxBeamMatrixCue: s.addLaserDmxBeamMatrixCue,
  })))

  const gateCount    = cues.filter(c => c.enabled && c.action === 'gate').length
  const triggerCount = cues.filter(c => c.enabled && c.action === 'trigger').length

  return (
    <div className="rv-cue-list">
      <div className="rv-cue-list-header">
        <button
          type="button"
          className="rv-glyph-upload-btn"
          onClick={addLaserDmxBeamMatrixCue}
          disabled={beams.length === 0 && groups.length === 0}
          title={beams.length === 0 && groups.length === 0 ? 'Add beams or groups before creating cues' : 'Add a new cue'}
        >
          + Add Cue
        </button>
        {cues.length > 0 && (
          <span className="rv-cue-stats">
            {cues.length} cue{cues.length !== 1 ? 's' : ''}
            {gateCount > 0 && ` · ${gateCount} gate`}
            {triggerCount > 0 && ` · ${triggerCount} trigger`}
          </span>
        )}
      </div>

      {cues.length === 0 && (
        <p className="rv-ctrl-info" style={{ margin: '6px 0' }}>
          No cues. Add cues to schedule beam or group activation at exact musical or absolute positions.
        </p>
      )}

      {gateCount > 0 && (
        <p className="rv-ctrl-info" style={{ margin: '2px 0 6px' }}>
          Beams with gate cues are silenced outside active ranges.
        </p>
      )}

      {cues.map(cue => (
        <CueRow
          key={cue.id}
          cue={cue}
          beams={beams}
          groups={groups}
        />
      ))}
    </div>
  )
}
