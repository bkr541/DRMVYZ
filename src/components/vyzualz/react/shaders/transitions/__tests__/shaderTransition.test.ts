// Tests for Shader engine transitions — pure logic only (no WebGL).
// Covers: transition types, start triggers, progress/easing, feedback timing,
// section choreography, manual override, and all safety scenarios.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  applyEasing,
  ALL_TRANSITION_TYPES,
  ALL_START_TRIGGERS,
  DEFAULT_TRANSITION,
  IDLE_TRANSITION,
  type TransitionDefinition,
  type MusicIntelligenceFrame,
} from '../shaderTransitionTypes'
import { ShaderTransitionController } from '../ShaderTransitionController'
import { ShaderSectionChoreography } from '../ShaderSectionChoreography'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDef(overrides: Partial<TransitionDefinition> = {}): TransitionDefinition {
  return { ...DEFAULT_TRANSITION, ...overrides }
}

type PartialMIFrame = Partial<{
  rhythm: Partial<MusicIntelligenceFrame['rhythm']>
  section: Partial<MusicIntelligenceFrame['section']>
  energy: MusicIntelligenceFrame['energy']
  harmonic: MusicIntelligenceFrame['harmonic']
  bands: MusicIntelligenceFrame['bands']
}>

function makeFrame(opts: PartialMIFrame = {}): MusicIntelligenceFrame {
  return {
    timeSec:    0,
    frameId:    1,
    sampleRate: 44100,
    sourceId:   null,
    trackId:    null,
    rhythm: {
      bpm:           120,
      beatHit:       false,
      beatIndex:     0,
      beatInBar:     0,
      barIndex:      0,
      downbeatHit:   false,
      phrase4Hit:    false,
      phrase8Hit:    false,
      phrase16Hit:   false,
      phrase32Hit:   false,
      confidence:    1,
      ...(opts.rhythm ?? {}),
    },
    section: {
      type:       'verse',
      label:      'Verse',
      startSec:   0,
      endSec:     30,
      progress:   0,
      intensity:  0.5,
      confidence: 1,
      source:     'detected',
      ...(opts.section ?? {}),
    },
    energy: opts.energy   ?? { rms: 0, peakDb: -60, crestFactor: 1, dropImpact: 0, buildProgress: 0, energyBand: 'low' },
    harmonic: opts.harmonic ?? { key: null, mode: null, keyConfidence: 0, chord: null, chordConfidence: 0, chordChanged: false, rootNote: null, pitchHz: null },
    bands: opts.bands     ?? { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0 },
    stems:    {} as MusicIntelligenceFrame['stems'],
    lyrics:   {} as MusicIntelligenceFrame['lyrics'],
    semantics: {} as MusicIntelligenceFrame['semantics'],
    raw:      { freqData: null, timeDomainData: null },
    confidence: { overall: 1, rhythm: 1, harmonic: 1, section: 1 },
  } as unknown as MusicIntelligenceFrame
}

// ── A. Transition type coverage ───────────────────────────────────────────────

describe('A. Transition types', () => {
  it('has exactly 10 types', () => {
    expect(ALL_TRANSITION_TYPES).toHaveLength(10)
  })

  it('includes all required types', () => {
    const required = [
      'crossfade', 'luma-dissolve', 'noise-dissolve', 'radial-wipe', 'pixel-scatter',
      'rgb-split-dissolve', 'liquid-melt', 'zoom-tunnel', 'feedback-collapse', 'flash-cut',
    ]
    for (const t of required) {
      expect(ALL_TRANSITION_TYPES).toContain(t)
    }
  })
})

// ── B. applyEasing ────────────────────────────────────────────────────────────

describe('B. applyEasing', () => {
  it('linear: identity in [0,1]', () => {
    expect(applyEasing(0, 'linear')).toBe(0)
    expect(applyEasing(0.5, 'linear')).toBe(0.5)
    expect(applyEasing(1, 'linear')).toBe(1)
  })

  it('clamps values outside [0,1]', () => {
    expect(applyEasing(-0.5, 'linear')).toBe(0)
    expect(applyEasing(1.5, 'linear')).toBe(1)
  })

  it('ease-in is monotone and slower at start', () => {
    const mid = applyEasing(0.5, 'ease-in')
    expect(mid).toBeLessThan(0.5)
    expect(applyEasing(0, 'ease-in')).toBe(0)
    expect(applyEasing(1, 'ease-in')).toBe(1)
  })

  it('ease-out is monotone and faster at start', () => {
    const mid = applyEasing(0.5, 'ease-out')
    expect(mid).toBeGreaterThan(0.5)
    expect(applyEasing(0, 'ease-out')).toBe(0)
    expect(applyEasing(1, 'ease-out')).toBe(1)
  })

  it('ease-in-out is symmetric around 0.5', () => {
    expect(applyEasing(0, 'ease-in-out')).toBeCloseTo(0)
    expect(applyEasing(0.5, 'ease-in-out')).toBeCloseTo(0.5)
    expect(applyEasing(1, 'ease-in-out')).toBeCloseTo(1)
    const t1 = applyEasing(0.25, 'ease-in-out')
    const t2 = applyEasing(0.75, 'ease-in-out')
    expect(t1 + t2).toBeCloseTo(1)
  })

  it('cubic (smoothstep) clamps to [0,1] and is S-shaped', () => {
    expect(applyEasing(0, 'cubic')).toBe(0)
    expect(applyEasing(1, 'cubic')).toBe(1)
    expect(applyEasing(0.5, 'cubic')).toBeCloseTo(0.5)
  })
})

// ── C. Default/idle state ─────────────────────────────────────────────────────

describe('C. Default and idle transition state', () => {
  it('IDLE_TRANSITION has idle phase', () => {
    expect(IDLE_TRANSITION.phase).toBe('idle')
    expect(IDLE_TRANSITION.progressRaw).toBe(0)
    expect(IDLE_TRANSITION.progressEased).toBe(0)
    expect(IDLE_TRANSITION.elapsedMs).toBe(0)
  })

  it('DEFAULT_TRANSITION has required fields', () => {
    expect(DEFAULT_TRANSITION.type).toBe('crossfade')
    expect(DEFAULT_TRANSITION.durationMs).toBeGreaterThan(0)
    expect(DEFAULT_TRANSITION.easing).toBe('ease-in-out')
    expect(DEFAULT_TRANSITION.startTrigger).toBe('immediate')
  })
})

// ── D. Start triggers — immediate ─────────────────────────────────────────────

describe('D. Start trigger: immediate', () => {
  it('starts active on the very first tick', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('scene-a')
    ctrl.requestTransition('scene-b', makeDef({ startTrigger: 'immediate' }))
    const result = ctrl.tick(16, null)
    expect(result.phase).toBe('active')
    expect(result.shouldRenderDual).toBe(true)
    expect(result.triggerFired).toBe(false) // already active when tick runs; no waiting→active this frame
  })
})

// ── E. Start triggers — music timing ─────────────────────────────────────────

describe('E. Start triggers: music-timed', () => {
  let ctrl: ShaderTransitionController

  beforeEach(() => {
    ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('scene-a')
  })

  it('next-beat fires on beatHit', () => {
    ctrl.requestTransition('scene-b', makeDef({ startTrigger: 'next-beat', durationMs: 600 }))
    // First tick: no beat
    let r = ctrl.tick(16, makeFrame({ rhythm: { beatHit: false, beatIndex: 0 } }))
    expect(r.phase).toBe('waiting')

    // Second tick: beat fires
    r = ctrl.tick(16, makeFrame({ rhythm: { beatHit: true, beatIndex: 1 } }))
    expect(r.triggerFired).toBe(true)
    expect(r.phase).toBe('active')
  })

  it('next-downbeat fires on downbeatHit', () => {
    ctrl.requestTransition('scene-b', makeDef({ startTrigger: 'next-downbeat', durationMs: 600 }))
    let r = ctrl.tick(16, makeFrame({ rhythm: { downbeatHit: false } }))
    expect(r.phase).toBe('waiting')
    r = ctrl.tick(16, makeFrame({ rhythm: { downbeatHit: true } }))
    expect(r.triggerFired).toBe(true)
  })

  it('next-bar fires when barIndex increments', () => {
    // Establish bar baseline BEFORE requesting the transition
    ctrl.tick(16, makeFrame({ rhythm: { barIndex: 1 } }))
    ctrl.requestTransition('scene-b', makeDef({ startTrigger: 'next-bar', durationMs: 600 }))
    let r = ctrl.tick(16, makeFrame({ rhythm: { barIndex: 1 } }))  // same bar — waiting
    expect(r.phase).toBe('waiting')
    r = ctrl.tick(16, makeFrame({ rhythm: { barIndex: 2 } }))       // new bar — fires
    expect(r.triggerFired).toBe(true)
  })

  it('next-phrase fires on phrase16Hit rising edge', () => {
    ctrl.requestTransition('scene-b', makeDef({ startTrigger: 'next-phrase', durationMs: 600 }))
    ctrl.tick(16, makeFrame({ rhythm: { phrase16Hit: false } }))
    let r = ctrl.tick(16, makeFrame({ rhythm: { phrase16Hit: false } }))
    expect(r.phase).toBe('waiting')
    r = ctrl.tick(16, makeFrame({ rhythm: { phrase16Hit: true } }))
    expect(r.triggerFired).toBe(true)
  })

  it('next-section fires when section.type changes', () => {
    // Establish section baseline BEFORE requesting the transition
    ctrl.tick(16, makeFrame({ section: { type: 'verse' } }))
    ctrl.requestTransition('scene-b', makeDef({ startTrigger: 'next-section', durationMs: 600 }))
    let r = ctrl.tick(16, makeFrame({ section: { type: 'verse' } }))  // same section — waiting
    expect(r.phase).toBe('waiting')
    r = ctrl.tick(16, makeFrame({ section: { type: 'drop' } }))        // new section — fires
    expect(r.triggerFired).toBe(true)
  })
})

// ── F. Progress and easing ────────────────────────────────────────────────────

describe('F. Progress advancement and easing', () => {
  it('progress advances from 0 to 1 over durationMs', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 100, easing: 'linear' }))

    const r1 = ctrl.tick(50, null) // 50ms = 50%
    expect(r1.progress).toBeCloseTo(0.5, 2)

    const r2 = ctrl.tick(50, null) // 100ms = done
    expect(r2.justCompleted).toBe(true)
  })

  it('deltaMs is clamped to 100ms max', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 200, easing: 'linear' }))

    // 5000ms spike should be clamped to 100ms → 50% max per frame
    const r = ctrl.tick(5000, null)
    expect(r.progress).toBeCloseTo(0.5, 2)
  })

  it('progress is clamped to [0, 1]', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 1, easing: 'linear' }))
    const r = ctrl.tick(16, null)
    expect(r.progress).toBeGreaterThanOrEqual(0)
    expect(r.progress).toBeLessThanOrEqual(1)
  })

  it('ease-in easing makes mid-progress less than 0.5 at 50% raw', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 200, easing: 'ease-in' }))
    const r = ctrl.tick(100, null) // 50% raw
    expect(r.progress).toBeLessThan(0.5)
  })
})

// ── G. Feedback timing ────────────────────────────────────────────────────────

describe('G. Feedback clear timing', () => {
  it('at-start: feedbackClearNow fires when trigger fires', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({
      startTrigger: 'next-beat',
      durationMs: 600,
      clearFeedback: 'at-start',
    }))
    const r = ctrl.tick(16, makeFrame({ rhythm: { beatHit: true, beatIndex: 1 } }))
    expect(r.triggerFired).toBe(true)
    expect(r.feedbackClearNow).toBe('at-start')
  })

  it('at-midpoint: feedbackClearNow fires once at ≥50% eased progress', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({
      startTrigger: 'immediate',
      durationMs: 200,
      easing: 'linear',
      clearFeedback: 'at-midpoint',
    }))
    const r1 = ctrl.tick(80, null) // 40% — no clear yet
    expect(r1.feedbackClearNow).toBeNull()
    const r2 = ctrl.tick(30, null) // 55% — fires
    expect(r2.feedbackClearNow).toBe('at-midpoint')
    const r3 = ctrl.tick(30, null) // 70% — does NOT fire again
    expect(r3.feedbackClearNow).toBeNull()
  })

  it('at-completion: feedbackClearNow fires on the completion tick', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({
      startTrigger: 'immediate',
      durationMs: 50,
      easing: 'linear',
      clearFeedback: 'at-completion',
    }))
    ctrl.tick(40, null)
    const r = ctrl.tick(20, null) // completes
    expect(r.justCompleted).toBe(true)
    expect(r.feedbackClearNow).toBe('at-completion')
  })

  it('preserve: feedbackClearNow is always null', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 50, clearFeedback: 'preserve' }))
    const r1 = ctrl.tick(30, null)
    const r2 = ctrl.tick(30, null)
    expect(r1.feedbackClearNow).toBeNull()
    expect(r2.feedbackClearNow).toBeNull()
  })
})

// ── H. Safety: transition completion ─────────────────────────────────────────

describe('H. Transition completion', () => {
  it('currentSceneId updates to toSceneId on completion', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 50 }))
    expect(ctrl.currentSceneId).toBe('a')
    ctrl.tick(30, null)
    ctrl.tick(30, null) // completes
    expect(ctrl.currentSceneId).toBe('b')
  })

  it('phase returns to idle after completion', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 10 }))
    ctrl.tick(20, null) // completes and clears to idle in same tick
    expect(ctrl.phase).toBe('idle')
  })
})

// ── I. Safety: edge cases ─────────────────────────────────────────────────────

describe('I. Transition safety edge cases', () => {
  it('re-selecting the active scene is a no-op when idle', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('a')
    expect(ctrl.phase).toBe('idle')
  })

  it('scene switch during active transition aborts old and starts new', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 1000 }))
    ctrl.tick(200, null) // 20% in

    // Interrupt with a new transition
    ctrl.requestTransition('c', makeDef({ startTrigger: 'immediate', durationMs: 600 }))
    const r = ctrl.tick(16, null)
    expect(r.toSceneId).toBe('c')
    expect(r.fromSceneId).toBe('a') // from was 'a', never committed 'b'
    expect(r.phase).toBe('active')
  })

  it('compile failure aborts transition and surfaces error', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 600 }))
    ctrl.reportIncomingCompileFailure('GLSL error: syntax error')
    expect(ctrl.phase).toBe('idle')
    expect(ctrl.compileError).toBe('GLSL error: syntax error')
    expect(ctrl.currentSceneId).toBe('a')
  })

  it('context loss aborts transition', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 600 }))
    ctrl.tick(100, null)
    ctrl.onContextLost()
    expect(ctrl.phase).toBe('idle')
  })

  it('track change aborts transition and resets timing', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'next-beat', durationMs: 600 }))
    ctrl.onTrackChange()
    expect(ctrl.phase).toBe('idle')
  })

  it('playback stop aborts waiting but not active transition', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')

    // Waiting → stopped
    ctrl.requestTransition('b', makeDef({ startTrigger: 'next-beat', durationMs: 600 }))
    expect(ctrl.phase).toBe('waiting')
    ctrl.onPlaybackStop()
    expect(ctrl.phase).toBe('idle')

    // Active → not stopped
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 600 }))
    ctrl.tick(50, null)
    expect(ctrl.phase).toBe('active')
    ctrl.onPlaybackStop()
    expect(ctrl.phase).toBe('active')
  })

  it('abort mid-flight >50% snaps to incoming scene', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 100, easing: 'linear' }))
    ctrl.tick(60, null) // 60% through
    ctrl.onContextLost() // abort
    expect(ctrl.currentSceneId).toBe('b')
  })

  it('abort mid-flight <50% keeps outgoing scene', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 100, easing: 'linear' }))
    ctrl.tick(30, null) // 30% through
    ctrl.onContextLost()
    expect(ctrl.currentSceneId).toBe('a')
  })

  it('resize during transition does not abort it', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 600 }))
    ctrl.tick(100, null)
    ctrl.onResize(1920, 1080) // no-op on state
    expect(ctrl.phase).toBe('active')
  })
})

// ── J. Section choreography ───────────────────────────────────────────────────

describe('J. ShaderSectionChoreography', () => {
  let choreo: ShaderSectionChoreography

  beforeEach(() => {
    choreo = new ShaderSectionChoreography()
    choreo.setCurrentScene('scene-a')
    choreo.setRules([
      { sectionType: 'drop',    toSceneId: 'scene-drop',  transition: DEFAULT_TRANSITION },
      { sectionType: 'verse',   toSceneId: 'scene-verse', transition: DEFAULT_TRANSITION },
      { sectionType: 'intro',   toSceneId: 'scene-intro', transition: DEFAULT_TRANSITION },
      { sectionType: '*',       toSceneId: 'scene-any',   transition: DEFAULT_TRANSITION },
    ])
  })

  it('returns null when disabled', () => {
    choreo.enabled = false
    const result = choreo.onFrame(makeFrame({ section: { type: 'drop' } }))
    expect(result).toBeNull()
  })

  it('matches the correct rule for a section type', () => {
    choreo.enabled = true
    choreo.onFrame(makeFrame({ section: { type: 'verse' } })) // establish baseline
    const result = choreo.onFrame(makeFrame({ section: { type: 'drop' } }))
    expect(result?.toSceneId).toBe('scene-drop')
  })

  it('wildcard rule matches when no specific rule applies', () => {
    choreo.enabled = true
    choreo.setRules([{ sectionType: '*', toSceneId: 'scene-any', transition: DEFAULT_TRANSITION }])
    choreo.onFrame(makeFrame({ section: { type: 'verse' } }))
    const result = choreo.onFrame(makeFrame({ section: { type: 'bridge' } }))
    expect(result?.toSceneId).toBe('scene-any')
  })

  it('returns null when already on the target scene', () => {
    choreo.enabled = true
    choreo.setCurrentScene('scene-drop')
    choreo.onFrame(makeFrame({ section: { type: 'verse' } }))
    const result = choreo.onFrame(makeFrame({ section: { type: 'drop' } }))
    expect(result).toBeNull()
  })

  it('returns null when section has not changed', () => {
    choreo.enabled = true
    choreo.onFrame(makeFrame({ section: { type: 'verse' } })) // baseline
    choreo.onFrame(makeFrame({ section: { type: 'drop' } }))  // change fires
    const result = choreo.onFrame(makeFrame({ section: { type: 'drop' } })) // same — no fire
    expect(result).toBeNull()
  })

  it('clearFeedback flag included in action when rule has it', () => {
    choreo.enabled = true
    choreo.setRules([
      { sectionType: 'drop', toSceneId: 'scene-drop', transition: DEFAULT_TRANSITION, clearFeedback: 'at-start' },
    ])
    choreo.onFrame(makeFrame({ section: { type: 'verse' } }))
    const result = choreo.onFrame(makeFrame({ section: { type: 'drop' } }))
    expect(result?.clearFeedback).toBe(true)
  })

  it('paramOverrides passed through to action', () => {
    choreo.enabled = true
    choreo.setRules([
      { sectionType: 'drop', toSceneId: 'scene-drop', transition: DEFAULT_TRANSITION, paramOverrides: { speed: 2.0 } },
    ])
    choreo.onFrame(makeFrame({ section: { type: 'verse' } }))
    const result = choreo.onFrame(makeFrame({ section: { type: 'drop' } }))
    expect(result?.paramOverrides).toEqual({ speed: 2.0 })
  })
})

// ── K. Manual override ────────────────────────────────────────────────────────

describe('K. Manual override of choreography', () => {
  it('overrideUntilNextSection suppresses automatic rule until section changes', () => {
    const choreo = new ShaderSectionChoreography()
    choreo.enabled = true
    choreo.setCurrentScene('scene-a')
    choreo.setRules([{ sectionType: 'drop', toSceneId: 'scene-drop', transition: DEFAULT_TRANSITION }])
    choreo.onFrame(makeFrame({ section: { type: 'verse' } })) // baseline

    // User manually selected a scene — suppress until next section
    choreo.overrideUntilNextSection()
    const r1 = choreo.onFrame(makeFrame({ section: { type: 'drop' } })) // overridden
    expect(r1).toBeNull()
    expect(choreo.isOverridden).toBe(false) // cleared on boundary

    // Next section change should fire normally (override was consumed)
    choreo.setRules([{ sectionType: 'breakdown', toSceneId: 'scene-breakdown', transition: DEFAULT_TRANSITION }])
    choreo.setCurrentScene('scene-a')
    const r2 = choreo.onFrame(makeFrame({ section: { type: 'breakdown' } }))
    expect(choreo.isOverridden).toBe(false)
    expect(r2?.toSceneId).toBe('scene-breakdown') // fires normally now
  })

  it('disabling choreography clears override', () => {
    const choreo = new ShaderSectionChoreography()
    choreo.enabled = true
    choreo.overrideUntilNextSection()
    expect(choreo.isOverridden).toBe(true)
    choreo.enabled = false
    expect(choreo.isOverridden).toBe(false)
  })

  it('reset clears section tracking and override', () => {
    const choreo = new ShaderSectionChoreography()
    choreo.enabled = true
    choreo.overrideUntilNextSection()
    choreo.reset()
    expect(choreo.isOverridden).toBe(false)
  })
})

// ── L. shouldRenderDual flag ──────────────────────────────────────────────────

describe('L. shouldRenderDual', () => {
  it('is true only during active phase', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'next-beat', durationMs: 600 }))

    // waiting — not dual
    const rWait = ctrl.tick(16, makeFrame({ rhythm: { beatHit: false } }))
    expect(rWait.shouldRenderDual).toBe(false)

    // active — dual
    const rActive = ctrl.tick(16, makeFrame({ rhythm: { beatHit: true, beatIndex: 1 } }))
    expect(rActive.shouldRenderDual).toBe(true)
  })

  it('is false after completion', () => {
    const ctrl = new ShaderTransitionController()
    ctrl.setActiveScene('a')
    ctrl.requestTransition('b', makeDef({ startTrigger: 'immediate', durationMs: 10 }))
    ctrl.tick(20, null) // completes in one tick
    const r = ctrl.tick(16, null)
    expect(r.shouldRenderDual).toBe(false)
    expect(r.phase).toBe('idle')
  })
})

// ── M. All start triggers covered ────────────────────────────────────────────

describe('M. All 6 start triggers present', () => {
  it('ALL_START_TRIGGERS has 6 entries', () => {
    expect(ALL_START_TRIGGERS).toHaveLength(6)
    expect(ALL_START_TRIGGERS).toContain('immediate')
    expect(ALL_START_TRIGGERS).toContain('next-beat')
    expect(ALL_START_TRIGGERS).toContain('next-downbeat')
    expect(ALL_START_TRIGGERS).toContain('next-bar')
    expect(ALL_START_TRIGGERS).toContain('next-phrase')
    expect(ALL_START_TRIGGERS).toContain('next-section')
  })
})
