import type { ReactSectionType } from '../../ReactTypes'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import type { ShaderSectionRule, TransitionDefinition, FeedbackClearTiming } from './shaderTransitionTypes'
import { DEFAULT_TRANSITION } from './shaderTransitionTypes'

// ── ShaderSectionAction ───────────────────────────────────────────────────────

export interface ShaderSectionAction {
  toSceneId:      string
  transition:     TransitionDefinition
  clearFeedback:  FeedbackClearTiming
  paramOverrides: Record<string, unknown>
}

// ── ShaderSectionChoreography ─────────────────────────────────────────────────

/**
 * Maps Music Intelligence section types to shader scene + transition actions.
 *
 * Only active when `enabled` is true.  Manual override (`overrideUntilNextSection`)
 * suppresses automatic choreography until the next section boundary.
 *
 * Call `onSectionChange(frame)` each frame to get the action for the new section,
 * or `null` if nothing should happen (disabled, overridden, no matching rule).
 */
export class ShaderSectionChoreography {
  private _enabled  = false
  private _rules:   ShaderSectionRule[] = []
  private _override = false
  private _lastSectionType: ReactSectionType | null | undefined = undefined
  private _currentSceneId: string | null = null

  // ── Configuration ─────────────────────────────────────────────────────────

  get enabled(): boolean { return this._enabled }
  set enabled(v: boolean) {
    this._enabled = v
    if (!v) this._override = false
  }

  get rules(): readonly ShaderSectionRule[] { return this._rules }

  /**
   * Replace the rule set.  Rules are matched in order; first match wins.
   * A rule with `sectionType: '*'` matches any section.
   */
  setRules(rules: ShaderSectionRule[]): void {
    this._rules = [...rules]
  }

  /**
   * Inform choreography which scene is currently displayed.
   * Used to avoid re-triggering a scene that's already active.
   */
  setCurrentScene(sceneId: string | null): void {
    this._currentSceneId = sceneId
  }

  // ── Manual override ───────────────────────────────────────────────────────

  /**
   * Temporarily disable automatic choreography until the next section boundary.
   * Useful when the user manually selects a scene while choreography is enabled.
   */
  overrideUntilNextSection(): void {
    if (this._enabled) this._override = true
  }

  get isOverridden(): boolean { return this._override }

  // ── Per-frame evaluation ──────────────────────────────────────────────────

  /**
   * Evaluate the current Music Intelligence frame.
   *
   * Returns a `ShaderSectionAction` when:
   *   - Choreography is enabled and not overridden.
   *   - The section type has changed since the last call.
   *   - A rule matches the new section type.
   *   - The matched scene differs from the currently displayed scene.
   *
   * Returns `null` in all other cases.
   *
   * Call once per frame; this method tracks section changes internally.
   */
  onFrame(frame: MusicIntelligenceFrame | null): ShaderSectionAction | null {
    const sectionType  = (frame?.section?.type ?? null) as ReactSectionType | null
    const changed      = sectionType !== this._lastSectionType && this._lastSectionType !== undefined
    const wasOverridden = this._override

    // Consume override on section boundary so the NEXT section change goes through.
    if (changed && this._override) {
      this._override = false
    }

    this._lastSectionType = sectionType

    if (!changed)       return null
    if (!this._enabled) return null
    if (wasOverridden)  return null  // blocked on this boundary; next will be free
    if (!sectionType)   return null

    return this._matchRule(sectionType)
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  /**
   * Reset section tracking.  Call on track change or playback stop.
   * Does not clear rules or the enabled flag.
   */
  reset(): void {
    this._lastSectionType = undefined
    this._override        = false
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _matchRule(sectionType: ReactSectionType): ShaderSectionAction | null {
    for (const rule of this._rules) {
      if (rule.sectionType !== '*' && rule.sectionType !== sectionType) continue

      // Skip if already on the target scene
      if (rule.toSceneId === this._currentSceneId) return null

      return {
        toSceneId:      rule.toSceneId,
        transition:     rule.transition ?? DEFAULT_TRANSITION,
        clearFeedback:  rule.clearFeedback ?? 'preserve',
        paramOverrides: rule.paramOverrides ?? {},
      }
    }
    return null
  }
}
