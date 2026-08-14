// Live Music Intelligence diagnostics panel.
// Uses requestAnimationFrame + direct DOM writes (refs) — zero React re-renders
// after mount so it never pollutes the render budget during playback.

import { useEffect, useRef } from 'react'
import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import { Collapsible } from '../react/ReactControlRows'

// ── Mini display helpers ──────────────────────────────────────────────────────

interface BarRow {
  label: string
  barEl:  HTMLDivElement | null
  valEl:  HTMLSpanElement | null
  color?: string
}

interface DotRow {
  label: string
  dotEl: HTMLSpanElement | null
  valEl: HTMLSpanElement | null
}

interface TextRow {
  label: string
  valEl: HTMLSpanElement | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface MusicIntelligenceDiagnosticsPanelProps {
  liveInputActive?: boolean
}

export function MusicIntelligenceDiagnosticsPanel({ liveInputActive = false }: MusicIntelligenceDiagnosticsPanelProps = {}) {
  const animRef = useRef<number>(0)

  // Live Input: compact operator view. Values update through DOM refs so the
  // Analysis surface observes the bus without analyser-rate React renders.
  const liveStatusRef = useRef<HTMLSpanElement | null>(null)
  const liveFrameRef = useRef<HTMLSpanElement | null>(null)
  const liveBpmRef = useRef<HTMLSpanElement | null>(null)
  const liveBpmConfidenceRef = useRef<HTMLSpanElement | null>(null)
  const liveTempoStatusRef = useRef<HTMLSpanElement | null>(null)
  const liveKickCountRef = useRef<HTMLSpanElement | null>(null)
  const liveSnareCountRef = useRef<HTMLSpanElement | null>(null)
  const liveEventDots = useRef<DotRow[]>([
    { label: 'Beat', dotEl: null, valEl: null },
    { label: 'Transient', dotEl: null, valEl: null },
    { label: 'Kick', dotEl: null, valEl: null },
    { label: 'Snare', dotEl: null, valEl: null },
  ])
  const liveMetricBars = useRef<BarRow[]>([
    { label: 'Volume', barEl: null, valEl: null },
    { label: 'Bass', barEl: null, valEl: null },
    { label: 'Mids', barEl: null, valEl: null },
    { label: 'Highs', barEl: null, valEl: null },
    { label: 'Energy', barEl: null, valEl: null },
    { label: 'Spectral Move', barEl: null, valEl: null },
    { label: 'Transient', barEl: null, valEl: null },
    { label: 'Kick', barEl: null, valEl: null },
    { label: 'Snare', barEl: null, valEl: null },
  ])
  const lastLiveEventFrameRef = useRef(0)
  const lastLiveSourceRef = useRef<string | null>(null)
  const liveKickCount = useRef(0)
  const liveSnareCount = useRef(0)

  // Bands
  const bandBars = useRef<BarRow[]>([
    { label: 'Sub',   barEl: null, valEl: null, color: '#7c6fcd' },
    { label: 'Bass',  barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'LMid',  barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Mid',   barEl: null, valEl: null, color: '#b84fc9' },
    { label: 'High',  barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Air',   barEl: null, valEl: null, color: '#80dfc0' },
  ])

  // Rhythm
  const bpmRef   = useRef<HTMLSpanElement | null>(null)
  const phaseBar = useRef<BarRow>({ label: 'Beat Phase', barEl: null, valEl: null, color: '#4ac7db' })
  const rhythmDots = useRef<DotRow[]>([
    { label: 'Beat',      dotEl: null, valEl: null },
    { label: 'Kick',      dotEl: null, valEl: null },
    { label: 'Snare',     dotEl: null, valEl: null },
    { label: 'Hat',       dotEl: null, valEl: null },
    { label: 'Downbeat',  dotEl: null, valEl: null },
  ])
  const transientBar = useRef<BarRow>({ label: 'Transient', barEl: null, valEl: null, color: '#d8b95a' })
  const beatInBarRef = useRef<HTMLSpanElement | null>(null)
  const barIdxRef    = useRef<HTMLSpanElement | null>(null)
  const ph16Bar      = useRef<BarRow>({ label: 'Ph16', barEl: null, valEl: null, color: '#61d6aa' })

  // Energy
  const energyBars = useRef<BarRow[]>([
    { label: 'RMS',    barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Peak',   barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Crest',  barEl: null, valEl: null, color: '#b84fc9' },
    { label: 'Flux',   barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Build',  barEl: null, valEl: null, color: '#80dfc0' },
    { label: 'Drop',   barEl: null, valEl: null, color: '#ff6b6b' },
    { label: 'Tension',barEl: null, valEl: null, color: '#ffa07a' },
  ])

  // Section
  const sectionTypeRef  = useRef<HTMLSpanElement | null>(null)
  const sectionProgBar  = useRef<BarRow>({ label: 'Progress', barEl: null, valEl: null, color: '#4ac7db' })
  const sectionIntBar   = useRef<BarRow>({ label: 'Intensity', barEl: null, valEl: null, color: '#61d6aa' })
  const sectionConfBar  = useRef<BarRow>({ label: 'Confidence', barEl: null, valEl: null, color: '#b84fc9' })

  // Harmonic
  const keyRef      = useRef<HTMLSpanElement | null>(null)
  const modeRef     = useRef<HTMLSpanElement | null>(null)
  const chordRef    = useRef<HTMLSpanElement | null>(null)
  const pitchRef    = useRef<HTMLSpanElement | null>(null)
  const contourRef  = useRef<HTMLSpanElement | null>(null)
  const keyConfBar  = useRef<BarRow>({ label: 'Key Conf', barEl: null, valEl: null, color: '#7c6fcd' })

  // Stems
  const stemBars = useRef<BarRow[]>([
    { label: 'Vocal',  barEl: null, valEl: null, color: '#b84fc9' },
    { label: 'Drum',   barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Bass',   barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Instr',  barEl: null, valEl: null, color: '#61d6aa' },
  ])

  // Lyrics
  const activeLineRef = useRef<HTMLSpanElement | null>(null)
  const activeWordRef = useRef<HTMLSpanElement | null>(null)
  const vocalActBar   = useRef<BarRow>({ label: 'Vocal Act', barEl: null, valEl: null, color: '#b84fc9' })

  // Semantic
  const semanticBars = useRef<BarRow[]>([
    { label: 'Build',  barEl: null, valEl: null, color: '#80dfc0' },
    { label: 'Drop',   barEl: null, valEl: null, color: '#ff6b6b' },
    { label: 'Fakeout',barEl: null, valEl: null, color: '#ffa07a' },
    { label: 'Hook',   barEl: null, valEl: null, color: '#b84fc9' },
  ])
  const moodRef    = useRef<HTMLSpanElement | null>(null)
  const textureRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    function updateBar(row: BarRow, v: number) {
      if (row.barEl) {
        row.barEl.style.width     = `${Math.max(0, Math.min(1, v)) * 100}%`
        row.barEl.style.background = row.color ?? '#4ac7db'
      }
      if (row.valEl) row.valEl.textContent = v.toFixed(2)
    }

    function updateDot(row: DotRow, active: boolean, label?: string) {
      if (row.dotEl) row.dotEl.className = `vz-mi-dot${active ? ' vz-mi-dot--on' : ''}`
      if (row.valEl && label !== undefined) row.valEl.textContent = label
    }

    function tick() {
      const f: MusicIntelligenceFrame = AudioFeatureBus.getFrame()
      const b  = f.bands
      const r  = f.rhythm
      const e  = f.energy
      const sc = f.section
      const h  = f.harmonic
      const st = f.stems
      const ly = f.lyrics
      const sm = f.semantics

      if (liveInputActive) {
        if (lastLiveSourceRef.current !== f.sourceId) {
          lastLiveSourceRef.current = f.sourceId
          lastLiveEventFrameRef.current = 0
          liveKickCount.current = 0
          liveSnareCount.current = 0
        }
        if (f.frameId !== lastLiveEventFrameRef.current) {
          lastLiveEventFrameRef.current = f.frameId
          if (r.kickHit) liveKickCount.current += 1
          if (r.snareHit) liveSnareCount.current += 1
        }
        if (liveStatusRef.current) liveStatusRef.current.textContent = f.frameId > 0 ? 'LIVE' : 'WAITING'
        if (liveFrameRef.current) liveFrameRef.current.textContent = String(f.frameId)
        if (liveBpmRef.current) liveBpmRef.current.textContent = r.bpm > 0 ? r.bpm.toFixed(1) : '—'
        if (liveBpmConfidenceRef.current) liveBpmConfidenceRef.current.textContent = `${Math.round(r.bpmConfidence * 100)}%`
        if (liveTempoStatusRef.current) {
          liveTempoStatusRef.current.textContent = r.bpm <= 0
            ? 'LISTENING'
            : f.capabilities?.beatGrid
              ? 'LOCKED'
              : 'LOW CONF'
        }
        if (liveKickCountRef.current) liveKickCountRef.current.textContent = String(liveKickCount.current)
        if (liveSnareCountRef.current) liveSnareCountRef.current.textContent = String(liveSnareCount.current)
        const mids = (b.lowMid + b.mid) * 0.5
        const highs = (b.high + b.air) * 0.5
        const liveValues = [
          b.volume,
          b.bass,
          mids,
          highs,
          e.instant,
          Math.min(1, e.spectralFlux * 8),
          r.transient,
          r.kickStrength,
          r.snareStrength,
        ]
        liveMetricBars.current.forEach((row, i) => updateBar(row, liveValues[i] ?? 0))
        const liveEvents = [r.beatHit, r.transient > 0.15, r.kickHit, r.snareHit]
        liveEventDots.current.forEach((row, i) => updateDot(row, liveEvents[i] ?? false))
      }

      // Bands
      const bandVals = [b.sub, b.bass, b.lowMid, b.mid, b.high, b.air]
      bandBars.current.forEach((row, i) => updateBar(row, bandVals[i] ?? 0))

      // Rhythm
      if (bpmRef.current)    bpmRef.current.textContent    = r.bpm.toFixed(1)
      if (beatInBarRef.current) beatInBarRef.current.textContent = String(r.beatInBar + 1)
      if (barIdxRef.current)    barIdxRef.current.textContent    = String(r.barIndex)
      updateBar(phaseBar.current,    r.beatPhase)
      updateBar(ph16Bar.current,     r.phrase16Progress)
      updateBar(transientBar.current, r.transient)
      const dotActives = [r.beatHit, r.kickHit, r.snareHit, r.hatHit, r.downbeatHit]
      rhythmDots.current.forEach((row, i) => updateDot(row, dotActives[i] ?? false))

      // Energy
      const eVals = [e.rms, e.peak, Math.min(1, e.crestFactor / 20), e.spectralFlux, e.buildProgress, e.dropImpact, e.tension]
      energyBars.current.forEach((row, i) => updateBar(row, eVals[i] ?? 0))

      // Section
      if (sectionTypeRef.current) sectionTypeRef.current.textContent = sc.type ?? '—'
      updateBar(sectionProgBar.current, sc.progress)
      updateBar(sectionIntBar.current,  sc.intensity)
      updateBar(sectionConfBar.current, sc.confidence)

      // Harmonic
      if (keyRef.current)     keyRef.current.textContent     = h.key    ?? '—'
      if (modeRef.current)    modeRef.current.textContent    = h.mode   ?? '—'
      if (chordRef.current)   chordRef.current.textContent   = h.chord  ?? '—'
      if (pitchRef.current)   pitchRef.current.textContent   = h.pitchHz != null ? `${h.pitchHz.toFixed(0)} Hz` : '—'
      if (contourRef.current) contourRef.current.textContent = h.melodyContour ?? '—'
      updateBar(keyConfBar.current, h.keyConfidence)

      // Stems
      const stemVals = [st.vocalEnergy, st.drumEnergy, st.bassStemEnergy, st.instrumentEnergy]
      stemBars.current.forEach((row, i) => updateBar(row, stemVals[i] ?? 0))

      // Lyrics
      if (activeLineRef.current) activeLineRef.current.textContent = ly.activeLine ?? '—'
      if (activeWordRef.current) activeWordRef.current.textContent = ly.activeWord  ?? '—'
      updateBar(vocalActBar.current, ly.vocalActivity)

      // Semantic
      const smVals = [sm.buildConfidence, sm.dropConfidence, sm.fakeoutConfidence, sm.vocalHookConfidence]
      semanticBars.current.forEach((row, i) => updateBar(row, smVals[i] ?? 0))
      if (moodRef.current)    moodRef.current.textContent    = sm.mood    ?? '—'
      if (textureRef.current) textureRef.current.textContent = sm.texture ?? '—'

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [liveInputActive])

  // ── Ref setters ─────────────────────────────────────────────────────────────

  function barRowRefs(row: BarRow) {
    return {
      barRef: (el: HTMLDivElement | null) => { row.barEl = el },
      valRef: (el: HTMLSpanElement | null) => { row.valEl = el },
    }
  }
  function dotRowRefs(row: DotRow) {
    return {
      dotRef: (el: HTMLSpanElement | null) => { row.dotEl = el },
      valRef: (el: HTMLSpanElement | null) => { row.valEl = el },
    }
  }

  return (
    <div className="vz-mi-panel">
      <Collapsible label="Audio Intelligence" defaultOpen>
        {liveInputActive && (
          <MiSection title="Live Input">
            <div className="vz-mi-kv-row">
              <span className="vz-mi-kv-label">Capture</span>
              <span ref={liveStatusRef} className="vz-mi-kv-val vz-mi-kv-val--tag">WAITING</span>
              <span className="vz-mi-kv-label">Frame</span>
              <span ref={liveFrameRef} className="vz-mi-kv-val">0</span>
            </div>
            <div className="vz-mi-kv-row">
              <span className="vz-mi-kv-label">BPM</span>
              <span ref={liveBpmRef} className="vz-mi-kv-val">—</span>
              <span className="vz-mi-kv-label">Confidence</span>
              <span ref={liveBpmConfidenceRef} className="vz-mi-kv-val">0%</span>
              <span className="vz-mi-kv-label">Tempo</span>
              <span ref={liveTempoStatusRef} className="vz-mi-kv-val vz-mi-kv-val--tag">LISTENING</span>
            </div>
            {liveMetricBars.current.map(row => (
              <MiBar key={row.label} row={row} barRowRefs={barRowRefs} />
            ))}
            <div className="vz-mi-dots-row">
              {liveEventDots.current.map(row => {
                const refs = dotRowRefs(row)
                return (
                  <div key={row.label} className="vz-mi-dot-item">
                    <span ref={refs.dotRef} className="vz-mi-dot" />
                    <span className="vz-mi-dot-label">{row.label}</span>
                  </div>
                )
              })}
            </div>
            <div className="vz-mi-kv-row">
              <span className="vz-mi-kv-label">Kick events</span>
              <span ref={liveKickCountRef} className="vz-mi-kv-val">0</span>
              <span className="vz-mi-kv-label">Snare events</span>
              <span ref={liveSnareCountRef} className="vz-mi-kv-val">0</span>
            </div>
            <div className="vz-mi-kv-row" data-live-input-structural-status="unavailable">
              <span className="vz-mi-kv-label">Track structure</span>
              <span className="vz-mi-kv-val vz-mi-kv-val--tag">UNAVAILABLE</span>
            </div>
            <p className="vz-mi-note">Sections, builds, drops, phrases, lyrics, and loaded-track timeline intelligence are not fabricated for Live Input.</p>
          </MiSection>
        )}
        {!liveInputActive && <>
        {/* ── Bands ────────────────────────────────────────────────────────── */}
        <MiSection title="Audio Bands">
          <div className="vz-mi-bar-group">
            {bandBars.current.map(row => {
              const r = barRowRefs(row)
              return (
                <div key={row.label} className="vz-mi-bar-col">
                  <span ref={r.valRef} className="vz-mi-bar-val">0.00</span>
                  <div className="vz-mi-bar-track">
                    <div ref={r.barRef} className="vz-mi-bar-fill" />
                  </div>
                  <span className="vz-mi-bar-lbl">{row.label}</span>
                </div>
              )
            })}
          </div>
        </MiSection>

        {/* ── Rhythm ───────────────────────────────────────────────────────── */}
        <MiSection title="Rhythm">
          <div className="vz-mi-kv-row">
            <span className="vz-mi-kv-label">BPM</span>
            <span ref={bpmRef} className="vz-mi-kv-val">—</span>
            <span className="vz-mi-kv-label">Beat</span>
            <span ref={beatInBarRef} className="vz-mi-kv-val">1</span>
            <span className="vz-mi-kv-label">Bar</span>
            <span ref={barIdxRef} className="vz-mi-kv-val">0</span>
          </div>
          <MiBar row={phaseBar.current}    barRowRefs={barRowRefs} />
          <MiBar row={ph16Bar.current}     barRowRefs={barRowRefs} />
          <MiBar row={transientBar.current} barRowRefs={barRowRefs} />
          <div className="vz-mi-dots-row">
            {rhythmDots.current.map(row => {
              const r = dotRowRefs(row)
              return (
                <div key={row.label} className="vz-mi-dot-item">
                  <span ref={r.dotRef} className="vz-mi-dot" />
                  <span className="vz-mi-dot-label">{row.label}</span>
                </div>
              )
            })}
          </div>
        </MiSection>

        {/* ── Energy ───────────────────────────────────────────────────────── */}
        <MiSection title="Energy">
          {energyBars.current.map(row => (
            <MiBar key={row.label} row={row} barRowRefs={barRowRefs} />
          ))}
        </MiSection>

        {/* ── Section ──────────────────────────────────────────────────────── */}
        <MiSection title="Section">
          <div className="vz-mi-kv-row">
            <span className="vz-mi-kv-label">Type</span>
            <span ref={sectionTypeRef} className="vz-mi-kv-val vz-mi-kv-val--tag">—</span>
          </div>
          <MiBar row={sectionProgBar.current}  barRowRefs={barRowRefs} />
          <MiBar row={sectionIntBar.current}   barRowRefs={barRowRefs} />
          <MiBar row={sectionConfBar.current}  barRowRefs={barRowRefs} />
        </MiSection>

        {/* ── Harmonic ─────────────────────────────────────────────────────── */}
        <MiSection title="Harmonic">
          <div className="vz-mi-kv-row">
            <span className="vz-mi-kv-label">Key</span>
            <span ref={keyRef} className="vz-mi-kv-val">—</span>
            <span className="vz-mi-kv-label">Mode</span>
            <span ref={modeRef} className="vz-mi-kv-val">—</span>
          </div>
          <div className="vz-mi-kv-row">
            <span className="vz-mi-kv-label">Chord</span>
            <span ref={chordRef} className="vz-mi-kv-val">—</span>
          </div>
          <div className="vz-mi-kv-row">
            <span className="vz-mi-kv-label">Pitch</span>
            <span ref={pitchRef} className="vz-mi-kv-val">—</span>
            <span className="vz-mi-kv-label">Contour</span>
            <span ref={contourRef} className="vz-mi-kv-val">—</span>
          </div>
          <MiBar row={keyConfBar.current} barRowRefs={barRowRefs} />
        </MiSection>

        {/* ── Stems ────────────────────────────────────────────────────────── */}
        <MiSection title="Stems">
          <div className="vz-mi-bar-group">
            {stemBars.current.map(row => {
              const r = barRowRefs(row)
              return (
                <div key={row.label} className="vz-mi-bar-col">
                  <span ref={r.valRef} className="vz-mi-bar-val">0.00</span>
                  <div className="vz-mi-bar-track">
                    <div ref={r.barRef} className="vz-mi-bar-fill" />
                  </div>
                  <span className="vz-mi-bar-lbl">{row.label}</span>
                </div>
              )
            })}
          </div>
        </MiSection>

        {/* ── Lyrics ───────────────────────────────────────────────────────── */}
        <MiSection title="Lyrics">
          <MiBar row={vocalActBar.current} barRowRefs={barRowRefs} />
          <div className="vz-mi-lyric-line">
            <span className="vz-mi-kv-label">Line</span>
            <span ref={activeLineRef} className="vz-mi-lyric-text">—</span>
          </div>
          <div className="vz-mi-lyric-line">
            <span className="vz-mi-kv-label">Word</span>
            <span ref={activeWordRef} className="vz-mi-lyric-text">—</span>
          </div>
        </MiSection>

        {/* ── Semantic ─────────────────────────────────────────────────────── */}
        <MiSection title="Semantic">
          {semanticBars.current.map(row => (
            <MiBar key={row.label} row={row} barRowRefs={barRowRefs} />
          ))}
          <div className="vz-mi-kv-row">
            <span className="vz-mi-kv-label">Mood</span>
            <span ref={moodRef} className="vz-mi-kv-val vz-mi-kv-val--tag">—</span>
            <span className="vz-mi-kv-label">Texture</span>
            <span ref={textureRef} className="vz-mi-kv-val vz-mi-kv-val--tag">—</span>
          </div>
        </MiSection>
        </>}
      </Collapsible>
    </div>
  )
}

// ── Local sub-components ──────────────────────────────────────────────────────

function MiSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="vz-mi-section">
      <div className="vz-mi-section-title">{title}</div>
      {children}
    </div>
  )
}

function MiBar({
  row,
  barRowRefs,
}: {
  row: BarRow
  barRowRefs: (row: BarRow) => { barRef: (el: HTMLDivElement | null) => void; valRef: (el: HTMLSpanElement | null) => void }
}) {
  const refs = barRowRefs(row)
  return (
    <div className="vz-mi-row">
      <span className="vz-mi-row-label">{row.label}</span>
      <div className="vz-mi-row-track">
        <div ref={refs.barRef} className="vz-mi-row-fill" />
      </div>
      <span ref={refs.valRef} className="vz-mi-row-val">0.00</span>
    </div>
  )
}
