import type { ReactFrameContext }        from '../../renderers/reactRenderUtils'
import type { MusicIntelligenceFrame }   from '../../../../../features/musicIntelligence/types'
import type { ShaderProgram }            from '../runtime/ShaderProgram'
import type { ShaderSpectrumTexture }    from './ShaderSpectrumTexture'
import type { ShaderWaveformTexture }    from './ShaderWaveformTexture'
import {
  AudioSmootherSet,
}                                        from './ShaderAudioSmoothing'
import {
  type ShaderAudioUniformFrame,
  type ShaderTimingUniformFrame,
  NEUTRAL_AUDIO_FRAME,
  NEUTRAL_TIMING_FRAME,
  SECTION_TYPE_CODES,
  encodeSectionType,
}                                        from './shaderAudioTypes'
import { SPECTRUM_BIN_COUNT }            from './ShaderSpectrumTexture'
import { WAVEFORM_SAMPLE_COUNT }         from './ShaderWaveformTexture'

// WebGL2 texture units reserved for the audio bridge.
// These are high enough to avoid collision with scene-specific textures (0–13).
const SPECTRUM_TEX_UNIT  = 14
const WAVEFORM_TEX_UNIT  = 15

// ── ShaderAudioBridge ─────────────────────────────────────────────────────────
//
// Reads a ReactFrameContext each frame and produces two typed uniform frames:
//
//   audioFrame  — smoothed audio/spectral values, guaranteed finite and 0..1
//   timingFrame — beat-grid phases, section metadata, and playback timing
//
// The bridge owns an AudioSmootherSet for per-value attack/release smoothing
// and TriggerEnvelopes for per-onset decaying hit signals.
//
// Consuming code (the future Shader renderer) should:
//   1. Call bridge.update(frame, runtimeTimeSec, runtimeDeltaSec) once per frame.
//   2. Call spectrumTex.update(frame.freqData) and waveformTex.update(frame.timeDomainData).
//   3. Call bridge.applyToProgram(program, gl, spectrumTex, waveformTex) to set uniforms.
//
// No Music Intelligence algorithms, BPM detection, or other engine code is
// modified by this module.

export class ShaderAudioBridge {
  private readonly _smoothers = new AudioSmootherSet()

  private _audioFrame:  ShaderAudioUniformFrame  = { ...NEUTRAL_AUDIO_FRAME }
  private _timingFrame: ShaderTimingUniformFrame  = { ...NEUTRAL_TIMING_FRAME }

  // State for detecting track changes and section changes
  private _lastTrackId: string | null        = null
  private _lastSectionStartSec: number       = -1
  private _lastSectionType: string | null    = null
  private _durationSec: number               = 0

  // ── Public frame accessors ────────────────────────────────────────────────

  /** Current smoothed audio uniform frame. Valid after the first `update()`. */
  get audioFrame(): ShaderAudioUniformFrame  { return this._audioFrame }

  /** Current timing uniform frame. Valid after the first `update()`. */
  get timingFrame(): ShaderTimingUniformFrame { return this._timingFrame }

  // ── Update ────────────────────────────────────────────────────────────────

  /**
   * Process one frame.
   *
   * @param frame           The current ReactFrameContext produced by the React engine.
   * @param runtimeTimeSec  Seconds since the ShaderWebGLRuntime was created (FrameState.time).
   * @param runtimeDeltaSec Seconds since the last frame (FrameState.deltaTime).
   * @param durationSec     Track duration in seconds for playbackProgress (0 = unknown).
   */
  update(
    frame: ReactFrameContext,
    runtimeTimeSec:  number,
    runtimeDeltaSec: number,
    durationSec?:    number,
  ): void {
    this._durationSec = durationSec ?? 0
    const dt = Math.max(0, runtimeDeltaSec)
    const mi = frame.musicIntelligence

    // ── Track-change detection ────────────────────────────────────────────────
    // When the track changes all smoothers reset so stale energy from the
    // previous track does not bleed into the first bars of the new one.
    const currentTrackId = mi?.trackId ?? null
    if (currentTrackId !== this._lastTrackId) {
      this._smoothers.resetAll()
      this._lastTrackId = currentTrackId
      this._lastSectionStartSec = -1
      this._lastSectionType = null
    }

    // ── Section-change detection ──────────────────────────────────────────────
    const sectionStartSec = mi?.section.startSec ?? -1
    const sectionChanged  = sectionStartSec !== this._lastSectionStartSec
    if (sectionChanged) {
      this._lastSectionStartSec = sectionStartSec
      this._lastSectionType     = mi?.section.type ?? null
    }

    this._audioFrame  = this._buildAudioFrame(frame, dt, mi)
    this._timingFrame = this._buildTimingFrame(
      frame, runtimeTimeSec, runtimeDeltaSec, sectionChanged,
    )
  }

  // ── Uniform application ───────────────────────────────────────────────────

  /**
   * Set all audio/timing uniforms on `program`.
   *
   * Uniforms are optional — the shader is not required to declare every name.
   * ShaderProgram.setFloat silently skips any uniform not present in the linked
   * program, so calling this with a simple or partial shader is safe.
   *
   * Texture units 14 (spectrum) and 15 (waveform) are used.
   * Call gl.activeTexture / gl.bindTexture before applyToProgram if those units
   * are already in use by other resources.
   *
   * @param program     The compiled shader program to receive uniforms.
   * @param gl          The WebGL2 context (needed to bind textures).
   * @param spectrumTex Optional spectrum texture.
   * @param waveformTex Optional waveform texture.
   */
  applyToProgram(
    program:      ShaderProgram,
    gl:           WebGL2RenderingContext,
    spectrumTex?: ShaderSpectrumTexture | null,
    waveformTex?: ShaderWaveformTexture | null,
  ): void {
    const a = this._audioFrame
    const t = this._timingFrame

    // ── Timing ──────────────────────────────────────────────────────────────
    program.setFloat('uTime',             t.time)
    program.setFloat('uDeltaTime',        t.deltaTime)
    program.setFloat('uPlaybackTime',     t.playbackTime)
    program.setFloat('uPlaybackProgress', t.playbackProgress)

    // ── Spectral bands ───────────────────────────────────────────────────────
    program.setFloat('uSub',     a.sub)
    program.setFloat('uBass',    a.bass)
    program.setFloat('uLowMid',  a.lowMid)
    program.setFloat('uMid',     a.mid)
    program.setFloat('uHighMid', a.highMid)
    program.setFloat('uHigh',    a.high)
    program.setFloat('uAir',     a.air)

    // ── Percussion ──────────────────────────────────────────────────────────
    program.setFloat('uKick',  a.kick)
    program.setFloat('uSnare', a.snare)
    program.setFloat('uHat',   a.hat)

    // ── Hit triggers ─────────────────────────────────────────────────────────
    program.setFloat('uKickHit',     a.kickHit)
    program.setFloat('uSnareHit',    a.snareHit)
    program.setFloat('uHatHit',      a.hatHit)
    program.setFloat('uBeatHit',     a.beatHit)
    program.setFloat('uDownbeatHit', a.downbeatHit)

    // ── Beat-grid phases ─────────────────────────────────────────────────────
    program.setFloat('uBeatPhase',    t.beatPhase)
    program.setFloat('uBarPhase',     t.barPhase)
    program.setFloat('uPhrasePhase',  t.phrasePhase)
    program.setFloat('uSectionPhase', t.sectionPhase)

    // ── Energy and spectral ──────────────────────────────────────────────────
    program.setFloat('uEnergy',           a.energy)
    program.setFloat('uTension',          a.tension)
    program.setFloat('uBuildProgress',    a.buildProgress)
    program.setFloat('uDropImpact',       a.dropImpact)
    program.setFloat('uSpectralCentroid', a.spectralCentroid)
    program.setFloat('uSpectralFlux',     a.spectralFlux)
    program.setFloat('uSpectralSpread',   a.spectralSpread)
    program.setFloat('uSpectralFlatness', a.spectralFlatness)

    // ── Textures ──────────────────────────────────────────────────────────────
    if (spectrumTex) {
      gl.activeTexture(gl.TEXTURE0 + SPECTRUM_TEX_UNIT)
      gl.bindTexture(gl.TEXTURE_2D, spectrumTex.texture)
      program.setSampler('uSpectrumTexture', SPECTRUM_TEX_UNIT)
      program.setInt('uSpectrumBinCount', SPECTRUM_BIN_COUNT)
    }

    if (waveformTex) {
      gl.activeTexture(gl.TEXTURE0 + WAVEFORM_TEX_UNIT)
      gl.bindTexture(gl.TEXTURE_2D, waveformTex.texture)
      program.setSampler('uWaveformTexture', WAVEFORM_TEX_UNIT)
      program.setInt('uWaveformSampleCount', WAVEFORM_SAMPLE_COUNT)
    }
  }

  // ── Frame builders ────────────────────────────────────────────────────────

  private _buildAudioFrame(
    frame: ReactFrameContext,
    dt:    number,
    mi:    MusicIntelligenceFrame | null,
  ): ShaderAudioUniformFrame {
    const s = this._smoothers

    if (mi !== null) {
      // ── MI path: full set of values ────────────────────────────────────────
      const b = mi.bands
      const r = mi.rhythm
      const e = mi.energy

      // Fire trigger envelopes for boolean onsets
      if (r.kickHit)     s.kickHitEnv.trigger()
      if (r.snareHit)    s.snareHitEnv.trigger()
      if (r.hatHit)      s.hatHitEnv.trigger()
      if (r.beatHit)     s.beatHitEnv.trigger()
      if (r.downbeatHit) s.downbeatHitEnv.trigger()

      return {
        sub:     s.sub.update(safe(b.normalizedSub),    dt),
        bass:    s.bass.update(safe(b.normalizedBass),   dt),
        lowMid:  s.lowMid.update(safe(b.normalizedLowMid), dt),
        mid:     s.mid.update(safe(b.normalizedMid),    dt),
        // highMid: average of mid and high bands (deterministic derivation; see shaderAudioTypes.ts)
        highMid: s.highMid.update(
          safe((b.normalizedMid + b.normalizedHigh) * 0.5),
          dt,
        ),
        high:  s.high.update(safe(b.normalizedHigh),   dt),
        air:   s.air.update(safe(b.normalizedAir),     dt),

        kick:  s.kick.update(safe(r.kickStrength),  dt),
        snare: s.snare.update(safe(r.snareStrength), dt),
        hat:   s.hat.update(safe(r.hatStrength),    dt),

        kickHit:     s.kickHitEnv.update(dt),
        snareHit:    s.snareHitEnv.update(dt),
        hatHit:      s.hatHitEnv.update(dt),
        beatHit:     s.beatHitEnv.update(dt),
        downbeatHit: s.downbeatHitEnv.update(dt),

        energy:           s.energy.update(safe(e.instant),         dt),
        spectralCentroid: s.spectralCentroid.update(safe(e.spectralCentroid),  dt),
        spectralFlux:     s.spectralFlux.update(safe(e.spectralFlux),     dt),
        spectralSpread:   s.spectralSpread.update(safe(e.spectralSpread),   dt),
        spectralFlatness: s.spectralFlatness.update(safe(e.spectralFlatness), dt),
        tension:          s.tension.update(safe(e.tension),         dt),
        buildProgress:    s.buildProgress.update(safe(e.buildProgress),  dt),
        dropImpact:       s.dropImpact.update(safe(e.dropImpact),    dt),
      }
    }

    // ── Fallback path: basic audio only ───────────────────────────────────────
    // When MI is absent, use the three-band audio values from the base frame.
    // Sub, lowMid, highMid, air have no fallback source — they decay to 0.
    // Energy is derived from the available bands using the same formula as
    // getAudioEnergy() in reactRenderUtils.ts.
    const fb = frame.audio
    const fallbackEnergy = safe(fb.bass * 0.5 + fb.mid * 0.3 + fb.high * 0.2)

    if (frame.beatHit) s.beatHitEnv.trigger()

    return {
      sub:     s.sub.update(0,                  dt),
      bass:    s.bass.update(safe(fb.bass),      dt),
      lowMid:  s.lowMid.update(0,                dt),
      mid:     s.mid.update(safe(fb.mid),        dt),
      highMid: s.highMid.update(0,               dt),
      high:    s.high.update(safe(fb.high),      dt),
      air:     s.air.update(0,                   dt),

      kick:  s.kick.update(0,  dt),
      snare: s.snare.update(0, dt),
      hat:   s.hat.update(0,   dt),

      kickHit:     s.kickHitEnv.update(dt),
      snareHit:    s.snareHitEnv.update(dt),
      hatHit:      s.hatHitEnv.update(dt),
      beatHit:     s.beatHitEnv.update(dt),
      downbeatHit: s.downbeatHitEnv.update(dt),

      energy:           s.energy.update(fallbackEnergy, dt),
      spectralCentroid: s.spectralCentroid.update(0, dt),
      spectralFlux:     s.spectralFlux.update(0,     dt),
      spectralSpread:   s.spectralSpread.update(0,   dt),
      spectralFlatness: s.spectralFlatness.update(0, dt),
      tension:          s.tension.update(0,           dt),
      buildProgress:    s.buildProgress.update(0,     dt),
      dropImpact:       s.dropImpact.update(0,        dt),
    }
  }

  private _buildTimingFrame(
    frame:           ReactFrameContext,
    runtimeTimeSec:  number,
    runtimeDeltaSec: number,
    sectionChanged:  boolean,
  ): ShaderTimingUniformFrame {
    const mi = frame.musicIntelligence

    const time      = safePos(runtimeTimeSec)
    const deltaTime = safePos(runtimeDeltaSec)

    if (mi !== null) {
      const r = mi.rhythm
      const sec = mi.section

      // Smooth 0–1 bar phase: combines beat-in-bar index and beat sub-phase.
      // Formula: (beatInBar + beatPhase) / 4  — gives continuous 0→1 over 4 beats.
      const barPhase = safePhase((r.beatInBar + r.beatPhase) / 4)

      const progress = this._durationSec > 0
        ? Math.max(0, Math.min(1, frame.audioTime / this._durationSec))
        : 0

      return {
        time,
        deltaTime,
        playbackTime:     safePos(frame.audioTime),
        playbackProgress: progress,

        beatPhase:    safePhase(r.beatPhase),
        barPhase,
        phrasePhase:  safePhase(r.phrase8Progress),
        sectionPhase: safePhase(sec.progress),

        beatIndex: safeInt(r.beatIndex),
        barIndex:  safeInt(r.barIndex),

        sectionType:        encodeSectionType(sec.type),
        sectionStartPulse:  sectionChanged ? 1.0 : 0.0,
        sectionChangePulse: sectionChanged ? 1.0 : 0.0,
      }
    }

    // Fallback: use the basic BPM and beat info from the frame
    const fallbackProgress = this._durationSec > 0
      ? Math.max(0, Math.min(1, frame.audioTime / this._durationSec))
      : 0
    return {
      time,
      deltaTime,
      playbackTime:     safePos(frame.audioTime),
      playbackProgress: fallbackProgress,

      beatPhase:    safePhase(frame.beatPhase),
      barPhase:     safePhase(frame.beatPhase),  // no bar info; use beat phase as approximation
      phrasePhase:  0,
      sectionPhase: 0,

      beatIndex: 0,
      barIndex:  0,

      sectionType:        0,
      sectionStartPulse:  0,
      sectionChangePulse: 0,
    }
  }
}

// ── Invariant helpers ─────────────────────────────────────────────────────────
// All helpers guarantee the output is finite and within the documented range,
// so no NaN or Infinity can ever reach a GLSL uniform.

/** Clamp to 0–1; return 0 for non-finite. */
function safe(v: number): number {
  if (!isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Phase clamped to 0–1. */
function safePhase(v: number): number {
  if (!isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Non-negative finite number; 0 for non-finite or negative. */
function safePos(v: number): number {
  return isFinite(v) && v >= 0 ? v : 0
}

/** Non-negative integer as float; 0 for non-finite. */
function safeInt(v: number): number {
  return isFinite(v) && v >= 0 ? Math.floor(v) : 0
}
