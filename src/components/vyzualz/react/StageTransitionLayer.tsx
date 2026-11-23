import { useLayoutEffect, useRef } from 'react'
import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import { getPerformancePressure } from '../../../lib/performancePressure'
import { resolvePresetTransition, type PresetTransitionStyle } from '../../../lib/presetTransitions'
import { resolveTransitionDurationMs } from '../../../lib/stageTransition'
import { useVisualStore } from '../../../stores/visualStore'
import { StageTransitionController } from './StageTransitionController'
import './StageTransitionLayer.css'

export interface StageTransitionTempoHints {
  /** The loaded track's tempo, if any. */
  trackBpm: number | null
  /** The audio is live input (no track), so only the live analysis's own confidence can be trusted. */
  liveInput: boolean
}

/**
 * Blends between what was on stage and what is on stage now, when Settings > System Settings > Transitions is on (docs/preset-transitions.md).
 * `identity` is the engine plus its selected preset (useStageIdentity); any change to it starts a transition, wherever the change came from. The blend is drawn on a canvas
 * over the stage, and `onActiveCanvasChange` hands that canvas to the cast while it runs so the audience sees the same blend as the operator.
 */
export function StageTransitionLayer({ sourceCanvas, identity, onActiveCanvasChange, getTempoHints }: {
  sourceCanvas: HTMLCanvasElement | null
  identity: string
  onActiveCanvasChange: (canvas: HTMLCanvasElement | null) => void
  getTempoHints: () => StageTransitionTempoHints
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const controllerRef = useRef<StageTransitionController | null>(null)
  const onActiveRef = useRef(onActiveCanvasChange)
  onActiveRef.current = onActiveCanvasChange
  const tempoHintsRef = useRef(getTempoHints)
  tempoHintsRef.current = getTempoHints
  const previousStyleRef = useRef<PresetTransitionStyle | null>(null)
  const previousIdentityRef = useRef(identity)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const controller = new StageTransitionController(canvas, { onActiveCanvas: value => onActiveRef.current(value) })
    controllerRef.current = controller
    controller.setEnabled(useVisualStore.getState().transitionsEnabled)
    controller.setSource(sourceCanvas)
    const unsubscribe = useVisualStore.subscribe((state, previous) => {
      if (state.transitionsEnabled !== previous.transitionsEnabled) controller.setEnabled(state.transitionsEnabled)
    })
    return () => { unsubscribe(); controller.dispose(); controllerRef.current = null }
    // The source is kept current by the effect below; the controller itself is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => { controllerRef.current?.setSource(sourceCanvas) }, [sourceCanvas])

  // A change of what is on stage. This is a layout effect on purpose: it runs in the commit that carries the change, before the old preset's renderer is torn down.
  useLayoutEffect(() => {
    if (previousIdentityRef.current === identity) return
    previousIdentityRef.current = identity
    const controller = controllerRef.current
    const { transitionsEnabled, transitionStyle } = useVisualStore.getState()
    if (!controller || !transitionsEnabled) return
    // Overloaded machine: a blend is extra work, and a clean cut is better than a stuttering one.
    if (getPerformancePressure() >= 2) return
    let style = resolvePresetTransition({ enabled: transitionsEnabled, choice: transitionStyle, previous: previousStyleRef.current })
    if (!style) return
    // Reduced motion: a plain dissolve, with no flash, push or sweep.
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) style = 'dissolve'
    const rhythm = AudioFeatureBus.getFrame().rhythm
    const hints = tempoHintsRef.current()
    const durationMs = resolveTransitionDurationMs(style, { bpm: rhythm.bpm, confidence: rhythm.bpmConfidence, source: rhythm.bpmSource, liveInput: hints.liveInput, trackBpm: hints.trackBpm })
    if (controller.trigger(style, durationMs)) previousStyleRef.current = style
  }, [identity])

  return <canvas ref={canvasRef} className="rv-stage-transition" data-stage-transition aria-hidden="true" />
}
