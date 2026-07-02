import type { ReactFrameContext } from '../../renderers/reactRenderUtils'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import type { ShaderProgram } from '../runtime/ShaderProgram'
import type { ShaderSpectrumTexture } from './ShaderSpectrumTexture'
import type { ShaderWaveformTexture } from './ShaderWaveformTexture'
import { AudioSmootherSet } from './ShaderAudioSmoothing'
import {
  type ShaderAudioUniformFrame,
  type ShaderMusicUniformFrame,
  type ShaderTimingUniformFrame,
  NEUTRAL_AUDIO_FRAME,
  NEUTRAL_MUSIC_FRAME,
  NEUTRAL_TIMING_FRAME,
  encodeChord,
  encodeMelodyContour,
  encodeMode,
  encodeMood,
  encodePitchClass,
  encodeSectionSource,
  encodeSectionType,
  encodeTexture,
} from './shaderAudioTypes'
import { SPECTRUM_BIN_COUNT } from './ShaderSpectrumTexture'
import { WAVEFORM_SAMPLE_COUNT } from './ShaderWaveformTexture'
import { getShaderReservedTextureUnits } from '../runtime/shaderTextureUnits'

// ── ShaderAudioBridge ─────────────────────────────────────────────────────────
//
// Converts the canonical MusicIntelligenceFrame into safe GLSL scalar frames.
// Existing compact uniforms remain stable while the extended frame exposes the
// complete MI vocabulary, confidence gates, and availability gates.

export class ShaderAudioBridge {
  private readonly _smoothers = new AudioSmootherSet()

  private _audioFrame: ShaderAudioUniformFrame = { ...NEUTRAL_AUDIO_FRAME }
  private _timingFrame: ShaderTimingUniformFrame = { ...NEUTRAL_TIMING_FRAME }
  private _musicFrame: ShaderMusicUniformFrame = { ...NEUTRAL_MUSIC_FRAME }

  private _lastTrackId: string | null = null
  private _lastSectionStartSec = -1
  private _durationSec = 0

  get audioFrame(): ShaderAudioUniformFrame {
    return this._audioFrame
  }
  get timingFrame(): ShaderTimingUniformFrame {
    return this._timingFrame
  }
  get musicFrame(): ShaderMusicUniformFrame {
    return this._musicFrame
  }

  update(
    frame: ReactFrameContext,
    runtimeTimeSec: number,
    runtimeDeltaSec: number,
    durationSec?: number,
  ): void {
    this._durationSec = durationSec ?? 0
    const dt = Math.max(0, runtimeDeltaSec)
    const mi = frame.musicIntelligence
    // Older persisted analyses and several compatibility callers can provide a
    // structurally partial MI frame. Treat missing layers as unavailable rather
    // than letting one newly-added layer take the Shader runtime down.
    const partialMi = mi as Partial<MusicIntelligenceFrame> | null

    const currentTrackId = partialMi?.trackId ?? partialMi?.sourceId ?? null
    if (currentTrackId !== this._lastTrackId) {
      this._smoothers.resetAll()
      this._lastTrackId = currentTrackId
      this._lastSectionStartSec = -1
    }

    const resolved = frame.resolvedSection ?? null
    const sectionStartSec = resolved?.startSec ?? partialMi?.section?.startSec ?? -1
    const sectionChanged = sectionStartSec !== this._lastSectionStartSec
    if (sectionChanged) this._lastSectionStartSec = sectionStartSec

    this._audioFrame = this._buildAudioFrame(frame, dt, mi)
    this._timingFrame = this._buildTimingFrame(
      frame,
      runtimeTimeSec,
      runtimeDeltaSec,
      sectionChanged,
      resolved,
    )
    this._musicFrame = this._buildMusicFrame(mi)
  }

  /**
   * Upload all optional Shader ENGINE uniforms. Missing GLSL uniforms are
   * intentionally ignored by ShaderProgram, so old and small shaders remain
   * fully compatible.
   */
  applyToProgram(
    program: ShaderProgram,
    gl: WebGL2RenderingContext,
    spectrumTex?: ShaderSpectrumTexture | null,
    waveformTex?: ShaderWaveformTexture | null,
  ): void {
    const a = this._audioFrame
    const t = this._timingFrame
    const m = this._musicFrame

    // Runtime and playback
    program.setFloat('uTime', t.time)
    program.setFloat('uDeltaTime', t.deltaTime)
    program.setFloat('uPlaybackTime', t.playbackTime)
    program.setFloat('uPlaybackProgress', t.playbackProgress)

    // Normalized bands
    program.setFloat('uSub', a.sub)
    program.setFloat('uBass', a.bass)
    program.setFloat('uLowMid', a.lowMid)
    program.setFloat('uMid', a.mid)
    program.setFloat('uHighMid', a.highMid)
    program.setFloat('uHigh', a.high)
    program.setFloat('uAir', a.air)

    // Raw bands and amplitude
    program.setFloat('uRawSub', m.rawSub)
    program.setFloat('uRawBass', m.rawBass)
    program.setFloat('uRawLowMid', m.rawLowMid)
    program.setFloat('uRawMid', m.rawMid)
    program.setFloat('uRawHigh', m.rawHigh)
    program.setFloat('uRawAir', m.rawAir)
    program.setFloat('uVolume', m.volume)
    program.setFloat('uRms', m.rms)
    program.setFloat('uPeak', m.peak)
    program.setFloat('uCrestFactor', m.crestFactor)

    // Percussion and transient events
    program.setFloat('uKick', a.kick)
    program.setFloat('uSnare', a.snare)
    program.setFloat('uHat', a.hat)
    program.setFloat('uKickHit', a.kickHit)
    program.setFloat('uSnareHit', a.snareHit)
    program.setFloat('uHatHit', a.hatHit)
    program.setFloat('uBeatHit', a.beatHit)
    program.setFloat('uDownbeatHit', a.downbeatHit)
    program.setFloat('uTransient', m.transient)
    program.setFloat('uTransientConfidence', m.transientConfidence)

    // Musical grid. The index and section values were previously calculated
    // but omitted from this upload path.
    program.setFloat('uBpm', m.bpm)
    program.setFloat('uBpmConfidence', m.bpmConfidence)
    program.setFloat('uBeatPhase', t.beatPhase)
    program.setFloat('uBarPhase', t.barPhase)
    program.setFloat('uPhrasePhase', t.phrasePhase)
    program.setFloat('uPhrase4Progress', t.phrase4Progress)
    program.setFloat('uPhrase8Progress', t.phrase8Progress)
    program.setFloat('uPhrase16Progress', t.phrase16Progress)
    program.setFloat('uPhrase32Progress', t.phrase32Progress)
    program.setFloat('uPhrase4Hit', t.phrase4Hit)
    program.setFloat('uPhrase8Hit', t.phrase8Hit)
    program.setFloat('uPhrase16Hit', t.phrase16Hit)
    program.setFloat('uPhrase32Hit', t.phrase32Hit)
    program.setFloat('uSectionPhase', t.sectionPhase)
    program.setFloat('uSectionProgress', t.sectionPhase)
    program.setFloat('uBeatIndex', t.beatIndex)
    program.setFloat('uBeatInBar', t.beatInBar)
    program.setFloat('uBarIndex', t.barIndex)
    program.setFloat('uSectionType', t.sectionType)
    program.setFloat('uSectionStartPulse', t.sectionStartPulse)
    program.setFloat('uSectionChangePulse', t.sectionChangePulse)

    // Energy and timbre
    program.setFloat('uEnergy', a.energy)
    program.setFloat('uEnergyShort', m.energyShort)
    program.setFloat('uEnergyShortTerm', m.energyShort)
    program.setFloat('uEnergyLong', m.energyLong)
    program.setFloat('uEnergyLongTerm', m.energyLong)
    program.setFloat('uEnergyDelta', m.energyDelta)
    program.setFloat('uEnergyPercentile', m.energyPercentile)
    program.setFloat('uTrackEnergy', m.trackEnergy)
    program.setFloat('uTension', a.tension)
    program.setFloat('uBuildProgress', a.buildProgress)
    program.setFloat('uDropImpact', a.dropImpact)
    program.setFloat('uComplexity', m.complexity)
    program.setFloat('uSpectralCentroid', a.spectralCentroid)
    program.setFloat('uSpectralFlux', a.spectralFlux)
    program.setFloat('uSpectralSpread', a.spectralSpread)
    program.setFloat('uSpectralRolloff', m.spectralRolloff)
    program.setFloat('uSpectralFlatness', a.spectralFlatness)

    // Section intelligence
    program.setFloat('uSectionIntensity', m.sectionIntensity)
    program.setFloat('uSectionConfidence', m.sectionConfidence)
    program.setFloat('uSectionSource', m.sectionSource)

    // Harmonic intelligence
    program.setFloat('uKey', m.keyCode)
    program.setFloat('uKeyCode', m.keyCode)
    program.setFloat('uMode', m.modeCode)
    program.setFloat('uModeCode', m.modeCode)
    program.setFloat('uKeyConfidence', m.keyConfidence)
    program.setFloat('uChord', m.chordCode)
    program.setFloat('uChordCode', m.chordCode)
    program.setFloat('uChordConfidence', m.chordConfidence)
    program.setFloat('uChordChangeHit', m.chordChangeHit)
    program.setFloat('uRootNote', m.rootNoteCode)
    program.setFloat('uRootNoteCode', m.rootNoteCode)
    program.setFloat('uPitchHz', m.pitchHz)
    program.setFloat('uDominantPitch', m.pitchHz)
    program.setFloat('uPitchNormalized', m.pitchNormalized)
    program.setFloat('uMelodyHeight', m.pitchNormalized)
    program.setFloat('uMelodyContour', m.melodyContourCode)
    program.setFloat('uMelodyContourCode', m.melodyContourCode)

    // Stem intelligence
    program.setFloat('uVocalEnergy', m.vocalEnergy)
    program.setFloat('uDrumEnergy', m.drumEnergy)
    program.setFloat('uBassStemEnergy', m.bassStemEnergy)
    program.setFloat('uInstrumentEnergy', m.instrumentEnergy)
    program.setFloat('uOtherStemEnergy', m.otherStemEnergy)
    program.setFloat('uVocalActivity', m.vocalActivity)
    program.setFloat('uDrumStemTransient', m.drumStemTransient)
    program.setFloat('uBassStemTransient', m.bassStemTransient)

    // Timed lyrics
    program.setFloat('uLyricActivity', m.lyricActivity)
    program.setFloat('uLyricLineProgress', m.lyricLineProgress)
    program.setFloat('uLyricWordProgress', m.lyricWordProgress)
    program.setFloat('uLyricWordHit', m.lyricWordHit)
    program.setFloat('uLyricLineEnter', m.lyricLineEnter)
    program.setFloat('uLyricLineExit', m.lyricLineExit)
    program.setFloat('uLyricGap', m.lyricGap)
    program.setFloat('uLyricPhraseConfidence', m.lyricPhraseConfidence)

    // Semantic intelligence
    program.setFloat('uBuildConfidence', m.buildConfidence)
    program.setFloat('uDropConfidence', m.dropConfidence)
    program.setFloat('uFakeoutConfidence', m.fakeoutConfidence)
    program.setFloat('uVocalHookConfidence', m.vocalHookConfidence)
    program.setFloat('uMood', m.moodCode)
    program.setFloat('uMoodCode', m.moodCode)
    program.setFloat('uTexture', m.textureCode)
    program.setFloat('uTextureCode', m.textureCode)

    // Availability and confidence gates
    program.setFloat('uHasLiveBands', m.hasLiveBands)
    program.setFloat('uHasRhythmEvents', m.hasRhythmEvents)
    program.setFloat('uHasBeatGrid', m.hasBeatGrid)
    program.setFloat('uHasSections', m.hasSections)
    program.setFloat('uHasTrackEnergyCurve', m.hasTrackEnergyCurve)
    program.setFloat('uHasStems', m.hasStems)
    program.setFloat('uHasLyrics', m.hasLyrics)
    program.setFloat('uHasHarmonics', m.hasHarmonics)
    program.setFloat('uHasSemantics', m.hasSemantics)
    program.setFloat('uOverallConfidence', m.overallConfidence)
    program.setFloat('uRhythmConfidence', m.rhythmConfidence)
    program.setFloat('uHarmonicConfidence', m.harmonicConfidence)

    const units = getShaderReservedTextureUnits(gl)
    if (spectrumTex) {
      gl.activeTexture(gl.TEXTURE0 + units.spectrum)
      gl.bindTexture(gl.TEXTURE_2D, spectrumTex.texture)
      program.setSampler('uSpectrumTexture', units.spectrum)
      program.setInt('uSpectrumBinCount', SPECTRUM_BIN_COUNT)
      program.setFloat('uSpectrumAvailable', 1)
    } else {
      program.setFloat('uSpectrumAvailable', 0)
    }

    if (waveformTex) {
      gl.activeTexture(gl.TEXTURE0 + units.waveform)
      gl.bindTexture(gl.TEXTURE_2D, waveformTex.texture)
      program.setSampler('uWaveformTexture', units.waveform)
      program.setInt('uWaveformSampleCount', WAVEFORM_SAMPLE_COUNT)
      program.setFloat('uWaveformAvailable', 1)
    } else {
      program.setFloat('uWaveformAvailable', 0)
    }
  }

  private _buildAudioFrame(
    frame: ReactFrameContext,
    dt: number,
    mi: MusicIntelligenceFrame | null,
  ): ShaderAudioUniformFrame {
    const s = this._smoothers

    const partialMi = mi as Partial<MusicIntelligenceFrame> | null
    if (partialMi?.bands && partialMi.rhythm && partialMi.energy) {
      const b = partialMi.bands
      const r = partialMi.rhythm
      const e = partialMi.energy

      if (r.kickHit) s.kickHitEnv.trigger()
      if (r.snareHit) s.snareHitEnv.trigger()
      if (r.hatHit) s.hatHitEnv.trigger()
      if (r.beatHit) s.beatHitEnv.trigger()
      if (r.downbeatHit) s.downbeatHitEnv.trigger()

      return {
        sub: s.sub.update(safe01(b.normalizedSub), dt),
        bass: s.bass.update(safe01(b.normalizedBass), dt),
        lowMid: s.lowMid.update(safe01(b.normalizedLowMid), dt),
        mid: s.mid.update(safe01(b.normalizedMid), dt),
        highMid: s.highMid.update(safe01((b.normalizedMid + b.normalizedHigh) * 0.5), dt),
        high: s.high.update(safe01(b.normalizedHigh), dt),
        air: s.air.update(safe01(b.normalizedAir), dt),
        kick: s.kick.update(safe01(r.kickStrength), dt),
        snare: s.snare.update(safe01(r.snareStrength), dt),
        hat: s.hat.update(safe01(r.hatStrength), dt),
        kickHit: s.kickHitEnv.update(dt),
        snareHit: s.snareHitEnv.update(dt),
        hatHit: s.hatHitEnv.update(dt),
        beatHit: s.beatHitEnv.update(dt),
        downbeatHit: s.downbeatHitEnv.update(dt),
        energy: s.energy.update(safe01(e.instant), dt),
        spectralCentroid: s.spectralCentroid.update(safe01(e.spectralCentroid), dt),
        spectralFlux: s.spectralFlux.update(safe01(e.spectralFlux), dt),
        spectralSpread: s.spectralSpread.update(safe01(e.spectralSpread), dt),
        spectralFlatness: s.spectralFlatness.update(safe01(e.spectralFlatness), dt),
        tension: s.tension.update(safe01(e.tension), dt),
        buildProgress: s.buildProgress.update(safe01(e.buildProgress), dt),
        dropImpact: s.dropImpact.update(safe01(e.dropImpact), dt),
      }
    }

    const fb = frame.audio
    const fallbackEnergy = safe01(fb.bass * 0.5 + fb.mid * 0.3 + fb.high * 0.2)
    if (frame.beatHit) s.beatHitEnv.trigger()

    return {
      sub: s.sub.update(0, dt),
      bass: s.bass.update(safe01(fb.bass), dt),
      lowMid: s.lowMid.update(0, dt),
      mid: s.mid.update(safe01(fb.mid), dt),
      highMid: s.highMid.update(0, dt),
      high: s.high.update(safe01(fb.high), dt),
      air: s.air.update(0, dt),
      kick: s.kick.update(0, dt),
      snare: s.snare.update(0, dt),
      hat: s.hat.update(0, dt),
      kickHit: s.kickHitEnv.update(dt),
      snareHit: s.snareHitEnv.update(dt),
      hatHit: s.hatHitEnv.update(dt),
      beatHit: s.beatHitEnv.update(dt),
      downbeatHit: s.downbeatHitEnv.update(dt),
      energy: s.energy.update(fallbackEnergy, dt),
      spectralCentroid: s.spectralCentroid.update(0, dt),
      spectralFlux: s.spectralFlux.update(0, dt),
      spectralSpread: s.spectralSpread.update(0, dt),
      spectralFlatness: s.spectralFlatness.update(0, dt),
      tension: s.tension.update(0, dt),
      buildProgress: s.buildProgress.update(0, dt),
      dropImpact: s.dropImpact.update(0, dt),
    }
  }

  private _buildTimingFrame(
    frame: ReactFrameContext,
    runtimeTimeSec: number,
    runtimeDeltaSec: number,
    sectionChanged: boolean,
    resolved: ReactFrameContext['resolvedSection'],
  ): ShaderTimingUniformFrame {
    const mi = frame.musicIntelligence as Partial<MusicIntelligenceFrame> | null
    const time = safePos(runtimeTimeSec)
    const deltaTime = safePos(runtimeDeltaSec)
    const sectionType = resolved?.type ?? mi?.section?.type ?? null
    const sectionProgress =
      resolved != null && resolved.progress >= 0 ? resolved.progress : (mi?.section?.progress ?? 0)
    const playbackProgress = this._durationSec > 0 ? safe01(frame.audioTime / this._durationSec) : 0

    if (mi?.rhythm) {
      const r = mi.rhythm
      const phrase8 = safe01(r.phrase8Progress)
      return {
        time,
        deltaTime,
        playbackTime: safePos(frame.audioTime),
        playbackProgress,
        beatPhase: safe01(r.beatPhase),
        barPhase: safe01((r.beatInBar + r.beatPhase) / 4),
        phrasePhase: phrase8,
        phrase4Progress: safe01(r.phrase4Progress),
        phrase8Progress: phrase8,
        phrase16Progress: safe01(r.phrase16Progress),
        phrase32Progress: safe01(r.phrase32Progress),
        sectionPhase: safe01(sectionProgress),
        beatIndex: safeInt(r.beatIndex),
        beatInBar: safeInt(r.beatInBar),
        barIndex: safeInt(r.barIndex),
        phrase4Hit: r.phrase4Hit ? 1 : 0,
        phrase8Hit: r.phrase8Hit ? 1 : 0,
        phrase16Hit: r.phrase16Hit ? 1 : 0,
        phrase32Hit: r.phrase32Hit ? 1 : 0,
        sectionType: encodeSectionType(sectionType as Parameters<typeof encodeSectionType>[0]),
        sectionStartPulse: sectionChanged ? 1 : 0,
        sectionChangePulse: sectionChanged ? 1 : 0,
      }
    }

    return {
      time,
      deltaTime,
      playbackTime: safePos(frame.audioTime),
      playbackProgress,
      beatPhase: safe01(frame.beatPhase),
      barPhase: safe01(frame.beatPhase),
      phrasePhase: 0,
      phrase4Progress: 0,
      phrase8Progress: 0,
      phrase16Progress: 0,
      phrase32Progress: 0,
      sectionPhase: safe01(sectionProgress),
      beatIndex: 0,
      beatInBar: 0,
      barIndex: 0,
      phrase4Hit: 0,
      phrase8Hit: 0,
      phrase16Hit: 0,
      phrase32Hit: 0,
      sectionType: encodeSectionType(sectionType as Parameters<typeof encodeSectionType>[0]),
      sectionStartPulse: sectionChanged ? 1 : 0,
      sectionChangePulse: sectionChanged ? 1 : 0,
    }
  }

  private _buildMusicFrame(mi: MusicIntelligenceFrame | null): ShaderMusicUniformFrame {
    if (!mi) return { ...NEUTRAL_MUSIC_FRAME }

    const partialMi = mi as Partial<MusicIntelligenceFrame>
    const b = partialMi.bands
    const r = partialMi.rhythm
    const e = partialMi.energy
    if (!b || !r || !e) return { ...NEUTRAL_MUSIC_FRAME }

    const section = partialMi.section
    const harmonic = partialMi.harmonic
    const stems = partialMi.stems
    const lyrics = partialMi.lyrics
    const semantics = partialMi.semantics
    const capabilities = partialMi.capabilities
    const confidence = partialMi.confidence
    const pitchHz = safePos(harmonic?.pitchHz ?? 0)

    const hasHarmonics =
      harmonic != null &&
      (harmonic.key !== null ||
        harmonic.chord !== null ||
        harmonic.pitchHz !== null ||
        safe01(confidence?.harmonic) > 0)
    const hasSemantics =
      semantics != null &&
      (semantics.mood !== null ||
        semantics.texture !== null ||
        safe01(semantics.buildConfidence) > 0 ||
        safe01(semantics.dropConfidence) > 0 ||
        safe01(semantics.fakeoutConfidence) > 0 ||
        safe01(semantics.vocalHookConfidence) > 0)

    return {
      rawSub: safe01(b.sub),
      rawBass: safe01(b.bass),
      rawLowMid: safe01(b.lowMid),
      rawMid: safe01(b.mid),
      rawHigh: safe01(b.high),
      rawAir: safe01(b.air),
      volume: safe01(b.volume),
      rms: safe01(e.rms),
      peak: safe01(e.peak),
      crestFactor: safe01((e.crestFactor ?? 0) / 20),
      bpm: safePos(r.bpm),
      bpmConfidence: safe01(r.bpmConfidence),
      transient: safe01(r.transient),
      transientConfidence: safe01(r.transientConfidence),
      energyShort: safe01(e.shortTerm),
      energyLong: safe01(e.longTerm),
      energyDelta: safeSigned(e.delta),
      energyPercentile: safe01(e.percentile),
      complexity: safe01(e.complexity),
      spectralRolloff: safe01(e.spectralRolloff),
      trackEnergy: safe01(e.trackCurve ?? 0),
      sectionIntensity: safe01(section?.intensity),
      sectionConfidence: safe01(section?.confidence),
      sectionSource: encodeSectionSource(section?.source),
      keyCode: encodePitchClass(harmonic?.key),
      modeCode: encodeMode(harmonic?.mode ?? null),
      keyConfidence: safe01(harmonic?.keyConfidence),
      chordCode: encodeChord(harmonic?.chord),
      chordConfidence: safe01(harmonic?.chordConfidence),
      chordChangeHit: harmonic?.chordChanged ? 1 : 0,
      rootNoteCode: encodePitchClass(harmonic?.rootNote ?? harmonic?.note),
      pitchHz,
      pitchNormalized: safe01((pitchHz - 50) / 1950),
      melodyContourCode: encodeMelodyContour(harmonic?.melodyContour ?? null),
      vocalEnergy: safe01(stems?.vocalEnergy ?? stems?.vocals),
      drumEnergy: safe01(stems?.drumEnergy ?? stems?.drums),
      bassStemEnergy: safe01(stems?.bassStemEnergy ?? stems?.bass),
      instrumentEnergy: safe01(stems?.instrumentEnergy ?? stems?.instruments),
      otherStemEnergy: safe01(stems?.otherStemEnergy ?? stems?.other),
      vocalActivity: safe01(Math.max(stems?.vocalActivity ?? 0, lyrics?.vocalActivity ?? 0)),
      drumStemTransient: stems?.drumTransient ? 1 : 0,
      bassStemTransient: stems?.bassStemTransient ? 1 : 0,
      lyricActivity: safe01(lyrics?.vocalActivity),
      lyricLineProgress: safe01(lyrics?.lyricLineProgress),
      lyricWordProgress: safe01(lyrics?.wordProgress ?? 0),
      lyricWordHit: lyrics?.wordHit ? 1 : 0,
      lyricLineEnter: lyrics?.lineEnter ? 1 : 0,
      lyricLineExit: lyrics?.lineExit ? 1 : 0,
      lyricGap: lyrics?.isGap ? 1 : 0,
      lyricPhraseConfidence: safe01(lyrics?.phraseConfidence),
      buildConfidence: safe01(semantics?.buildConfidence),
      dropConfidence: safe01(semantics?.dropConfidence),
      fakeoutConfidence: safe01(semantics?.fakeoutConfidence),
      vocalHookConfidence: safe01(semantics?.vocalHookConfidence),
      moodCode: encodeMood(semantics?.mood ?? null),
      textureCode: encodeTexture(semantics?.texture ?? null),
      hasLiveBands: capabilities?.liveBands ? 1 : 0,
      hasRhythmEvents: capabilities?.rhythmEvents ? 1 : 0,
      hasBeatGrid: capabilities?.beatGrid ? 1 : 0,
      hasSections: capabilities?.sections ? 1 : 0,
      hasTrackEnergyCurve: capabilities?.trackEnergyCurve ? 1 : 0,
      hasStems: capabilities?.stemCurves ? 1 : 0,
      hasLyrics: capabilities?.lyrics ? 1 : 0,
      hasHarmonics: hasHarmonics ? 1 : 0,
      hasSemantics: hasSemantics ? 1 : 0,
      overallConfidence: safe01(confidence?.overall),
      rhythmConfidence: safe01(confidence?.rhythm),
      harmonicConfidence: safe01(confidence?.harmonic),
    }
  }
}

function safe01(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function safeSigned(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return value < -1 ? -1 : value > 1 ? 1 : value
}

function safePos(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function safeInt(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}
