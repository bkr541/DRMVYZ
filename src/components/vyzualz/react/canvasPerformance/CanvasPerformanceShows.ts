import type {
  SharedPerformanceProgram,
  SharedPerformanceProgramScene,
} from '../../../../features/performanceCore'
import type { ReactSectionType } from '../../../../features/musicIntelligence/types'
import type {
  CanvasCompositionTemplateId,
  CanvasEffectRecipeId,
  CanvasLayerRole,
  CanvasPerformanceAction,
  CanvasPerformanceShowId,
  CanvasFracturesOverrideProfile,
  CanvasTransitionId,
} from './CanvasPerformanceTypes'

export interface CanvasPerformanceShowDefinition {
  id: CanvasPerformanceShowId
  label: string
  description: string
  visualPhilosophy: string
  program: SharedPerformanceProgram<CanvasPerformanceAction>
  fallbackSceneId: string
}

type SectionRecipe = {
  sectionTypes: readonly ReactSectionType[]
  composition: CanvasCompositionTemplateId
  effect: CanvasEffectRecipeId
  transitions: readonly CanvasTransitionId[]
  recruit: readonly CanvasLayerRole[]
  entry?: readonly CanvasPerformanceAction[]
  body?: readonly CanvasPerformanceAction[]
  exit?: readonly CanvasPerformanceAction[]
  motifs?: readonly (readonly CanvasPerformanceAction[])[]
  recruitments?: readonly (readonly CanvasPerformanceAction[])[]
  evolutions?: readonly (readonly CanvasPerformanceAction[])[]
  priority?: number
  minConfidence?: number
  fractures?: CanvasFracturesOverrideProfile
}

const composition = (templateId: CanvasCompositionTemplateId): CanvasPerformanceAction => ({ type: 'composition', templateId })
const effect = (recipeId: CanvasEffectRecipeId): CanvasPerformanceAction => ({ type: 'effectRecipe', recipeId })
const transitions = (...transitionIds: CanvasTransitionId[]): CanvasPerformanceAction => ({ type: 'transition', transitionIds })
const recruit = (...roles: CanvasLayerRole[]): CanvasPerformanceAction => ({ type: 'recruit', roles })
const retire = (...roles: CanvasLayerRole[]): CanvasPerformanceAction => ({ type: 'retire', roles })
const hold = (enabled: boolean): CanvasPerformanceAction => ({ type: 'frameHold', enabled })
const advance = (...roles: CanvasLayerRole[]): CanvasPerformanceAction => ({ type: 'advanceMedia', roles })
const boost = (amount: number): CanvasPerformanceAction => ({ type: 'effectBoost', amount })
const fractures = (profile: CanvasFracturesOverrideProfile): CanvasPerformanceAction => ({
  type: 'specializedRenderer',
  kind: 'fractures',
  profile,
})
const treatment = (
  roles: readonly CanvasLayerRole[],
  patch: Omit<Extract<CanvasPerformanceAction, { type: 'layerTreatment' }>['treatment'], 'roles'>,
): CanvasPerformanceAction => ({ type: 'layerTreatment', treatment: { roles, ...patch } })

function scene(id: string, recipe: SectionRecipe): SharedPerformanceProgramScene<CanvasPerformanceAction> {
  return {
    id,
    sectionTypes: recipe.sectionTypes,
    priority: recipe.priority,
    minConfidence: recipe.minConfidence,
    actions: [
      composition(recipe.composition),
      effect(recipe.effect),
      { type: 'transition', transitionIds: recipe.transitions },
      { type: 'recruit', roles: recipe.recruit },
      ...(recipe.fractures ? [fractures(recipe.fractures)] : []),
    ],
    entryActions: recipe.entry,
    bodyActions: recipe.body,
    exitActions: recipe.exit,
    fourBarActions: recipe.motifs,
    eightBarRecruitment: recipe.recruitments ? [[], ...recipe.recruitments] : undefined,
    sixteenBarEvolution: recipe.evolutions ? [[], ...recipe.evolutions] : undefined,
  }
}

function eventActions(style: 'cinematic' | 'glitch' | 'dream' | 'impact' | 'luma'):
SharedPerformanceProgramScene<CanvasPerformanceAction>['eventActions'] {
  switch (style) {
    case 'glitch':
      return {
        kick: [treatment(['hero'], { scaleMultiplier: 1.045 }), boost(0.08)],
        snare: [treatment(['foregroundAccent'], { offsetX: 0.045, rotationOffset: 1.4 }), advance('foregroundAccent')],
        hat: [treatment(['texture'], { opacityMultiplier: 1.18, offsetY: -0.012 }), boost(0.03)],
        downbeat: [advance('hero'), treatment(['hero', 'foregroundAccent'], { scaleMultiplier: 1.02 })],
        semanticMoment: [advance('texture', 'foregroundAccent'), transitions('frameTear', 'sliceDisplacement')],
      }
    case 'dream':
      return {
        kick: [treatment(['hero'], { scaleMultiplier: 1.022 })],
        snare: [treatment(['feedback', 'texture'], { opacityMultiplier: 1.12, offsetX: 0.018 })],
        hat: [treatment(['texture'], { rotationOffset: 0.35, opacityMultiplier: 1.06 })],
        downbeat: [treatment(['hero', 'feedback'], { scaleMultiplier: 1.012 })],
        semanticMoment: [boost(0.12), treatment(['foregroundAccent'], { opacityMultiplier: 1.2 })],
      }
    case 'impact':
      return {
        kick: [treatment(['hero'], { scaleMultiplier: 1.06 }), boost(0.12)],
        snare: [treatment(['hero'], { offsetX: 0.025 }), advance('hero')],
        hat: [treatment(['foregroundAccent'], { opacityMultiplier: 1.12 })],
        downbeat: [advance('hero'), transitions('hardCut', 'strobeCut')],
        semanticMoment: [advance('hero'), boost(0.15)],
      }
    case 'luma':
      return {
        kick: [treatment(['hero'], { scaleMultiplier: 1.028 })],
        snare: [treatment(['texture'], { opacityMultiplier: 1.16, offsetX: 0.016 })],
        hat: [treatment(['foregroundAccent'], { opacityMultiplier: 1.08 })],
        downbeat: [treatment(['hero', 'texture'], { scaleMultiplier: 1.012 })],
        semanticMoment: [advance('texture'), boost(0.1)],
      }
    default:
      return {
        kick: [treatment(['hero'], { scaleMultiplier: 1.04 }), boost(0.08)],
        snare: [treatment(['foregroundAccent'], { offsetX: 0.02, opacityMultiplier: 1.08 })],
        hat: [treatment(['texture'], { opacityMultiplier: 1.08 })],
        downbeat: [advance('hero'), treatment(['hero'], { scaleMultiplier: 1.018 })],
        semanticMoment: [boost(0.1), advance('foregroundAccent')],
      }
  }
}

function withEvents(
  scenes: readonly SharedPerformanceProgramScene<CanvasPerformanceAction>[],
  style: 'cinematic' | 'glitch' | 'dream' | 'impact' | 'luma',
): SharedPerformanceProgramScene<CanvasPerformanceAction>[] {
  const events = eventActions(style)
  return scenes.map(candidate => ({ ...candidate, eventActions: events }))
}

const cinematicScenes = withEvents([
  scene('cinematic-intro-negative-space', {
    sectionTypes: ['intro'], composition: 'centerHeroAtmosphericBorder', effect: 'dreamBreakdown',
    transitions: ['crossfade', 'lumaDissolve'], recruit: ['background', 'hero'],
    body: [treatment(['hero'], { scaleMultiplier: 0.94 })],
    recruitments: [[recruit('texture')]],
  }),
  scene('cinematic-verse-editor', {
    sectionTypes: ['verse', 'unknown'], composition: 'fullScreenHero', effect: 'none',
    transitions: ['crossfade', 'additiveDissolve'], recruit: ['hero'],
    motifs: [[treatment(['hero'], { offsetX: -0.015 })], [treatment(['hero'], { offsetX: 0.015 })]],
    recruitments: [[recruit('foregroundAccent')]],
  }),
  scene('cinematic-build-compression', {
    sectionTypes: ['build'], composition: 'heroPlusTexture', effect: 'bassImpact',
    transitions: ['lumaDissolve', 'additiveDissolve', 'zoomThrough'], recruit: ['background', 'hero', 'texture'],
    body: [treatment(['hero'], { cropInset: 0.02, scaleMultiplier: 1.02 })],
    motifs: [[treatment(['hero'], { cropInset: 0.025 })], [treatment(['texture'], { opacityMultiplier: 1.12 })]],
    evolutions: [[composition('maskedHeroReveal')]],
  }),
  scene('cinematic-predrop-focus', {
    sectionTypes: ['preDrop'], composition: 'maskedHeroReveal', effect: 'preDropVacuum',
    transitions: ['frameHoldRelease', 'hardCut'], recruit: ['hero', 'mask'],
    entry: [retire('texture', 'foregroundAccent'), treatment(['hero'], { scaleMultiplier: 0.9, cropInset: 0.06 })],
    exit: [hold(true)],
  }),
  scene('cinematic-drop-editor', {
    sectionTypes: ['drop'], composition: 'videoWall', effect: 'bassImpact',
    transitions: ['hardCut', 'displacementBurst', 'sliceDisplacement'], recruit: ['background', 'hero', 'foregroundAccent'],
    entry: [hold(false), advance('hero')],
    motifs: [[composition('fullScreenHero')], [composition('videoWall')], [composition('splitScreen')], [composition('videoWall')]],
    recruitments: [[recruit('texture')]],
    evolutions: [[composition('fourPanelGrid'), effect('dropFracture')]],
  }),
  {
    ...scene('cinematic-drop-two-expanded', {
      sectionTypes: ['drop'], composition: 'fourPanelGrid', effect: 'dropFracture',
      transitions: ['displacementBurst', 'sliceDisplacement', 'strobeCut'], recruit: ['background', 'hero', 'foregroundAccent', 'texture'],
      entry: [advance('hero', 'foregroundAccent')], evolutions: [[composition('videoWall')]], priority: 20,
    }),
    dropOccurrence: { minOccurrence: 2 },
  },
  scene('cinematic-breakdown-release', {
    sectionTypes: ['breakdown', 'bridge'], composition: 'layeredLumaCollage', effect: 'dreamBreakdown',
    transitions: ['lumaDissolve', 'additiveDissolve', 'crossfade'], recruit: ['background', 'hero', 'texture'],
    body: [treatment(['hero'], { scaleMultiplier: 0.96 })], recruitments: [[recruit('foregroundAccent')]],
  }),
  scene('cinematic-outro-retirement', {
    sectionTypes: ['outro'], composition: 'fullScreenHero', effect: 'dreamBreakdown',
    transitions: ['crossfade', 'dipToBlack'], recruit: ['hero'],
    body: [retire('texture', 'foregroundAccent', 'feedback')], exit: [hold(true)],
  }),
], 'cinematic')

const glitchScenes = withEvents([
  scene('glitch-intro-panels', { sectionTypes: ['intro'], composition: 'splitScreen', effect: 'phraseEcho', transitions: ['alphaDissolve', 'slide'], recruit: ['hero', 'foregroundAccent'], recruitments: [[recruit('texture')]] }),
  scene('glitch-verse-collage', {
    sectionTypes: ['verse', 'unknown'], composition: 'fourPanelGrid', effect: 'phraseEcho',
    transitions: ['frameTear', 'slide', 'rgbSplit'], recruit: ['background', 'hero', 'foregroundAccent', 'texture'],
    motifs: [[advance('foregroundAccent')], [advance('texture')], [composition('splitScreen')], [composition('fourPanelGrid')]],
  }),
  scene('glitch-build-escalator', {
    sectionTypes: ['build'], composition: 'fourPanelGrid', effect: 'dropFracture', transitions: ['frameTear', 'sliceDisplacement', 'zoomThrough'],
    recruit: ['background', 'hero', 'foregroundAccent', 'texture'], body: [treatment(['texture'], { opacityMultiplier: 1.18 })],
    motifs: [[advance('foregroundAccent')], [advance('texture')], [boost(0.08)]], evolutions: [[composition('videoWall')]],
  }),
  scene('glitch-predrop-collapse', {
    sectionTypes: ['preDrop'], composition: 'pictureInPictureAccent', effect: 'preDropVacuum', transitions: ['frameHoldRelease', 'frameTear'],
    recruit: ['hero', 'foregroundAccent'], entry: [retire('background', 'texture'), hold(true), treatment(['hero'], { scaleMultiplier: 0.84, cropInset: 0.08 })],
  }),
  scene('glitch-drop-reactor', {
    sectionTypes: ['drop'], composition: 'fourPanelGrid', effect: 'dropFracture', transitions: ['frameTear', 'sliceDisplacement', 'rgbSplit', 'strobeCut'],
    recruit: ['background', 'hero', 'foregroundAccent', 'texture'], entry: [hold(false), advance('hero', 'foregroundAccent')],
    motifs: [[advance('foregroundAccent')], [composition('videoWall')], [advance('texture')], [composition('fourPanelGrid')]],
    recruitments: [[recruit('feedback')]], evolutions: [[composition('videoWall'), boost(0.12)]],
  }),
  {
    ...scene('glitch-drop-two-inversion', {
      sectionTypes: ['drop'], composition: 'mirroredDualClip', effect: 'dropFracture', transitions: ['rgbSplit', 'frameTear', 'strobeCut'],
      recruit: ['hero', 'foregroundAccent', 'texture'], entry: [advance('hero', 'foregroundAccent', 'texture')], priority: 20,
      motifs: [[composition('mirroredDualClip')], [composition('fourPanelGrid')]], evolutions: [[composition('videoWall')]],
    }), dropOccurrence: { minOccurrence: 2 },
  },
  scene('glitch-breakdown-decompress', { sectionTypes: ['breakdown', 'bridge'], composition: 'echoTunnel', effect: 'phraseEcho', transitions: ['feedbackSmear', 'lumaDissolve'], recruit: ['hero', 'texture', 'feedback'], body: [treatment(['feedback'], { opacityMultiplier: 1.16 })] }),
  scene('glitch-outro-deconstruct', { sectionTypes: ['outro'], composition: 'splitScreen', effect: 'phraseEcho', transitions: ['alphaDissolve', 'dipToBlack'], recruit: ['hero', 'foregroundAccent'], body: [retire('texture', 'feedback')] }),
], 'glitch')

const dreamScenes = withEvents([
  scene('dream-intro-depth', { sectionTypes: ['intro'], composition: 'echoTunnel', effect: 'dreamBreakdown', transitions: ['lumaDissolve', 'zoomThrough'], recruit: ['hero', 'feedback'], recruitments: [[recruit('texture')]] }),
  scene('dream-verse-orbit', { sectionTypes: ['verse', 'unknown'], composition: 'centerHeroAtmosphericBorder', effect: 'phraseEcho', transitions: ['crossfade', 'lumaDissolve'], recruit: ['background', 'hero'], motifs: [[treatment(['hero'], { offsetX: -0.012 })], [treatment(['hero'], { offsetX: 0.012 })]], recruitments: [[recruit('texture')]] }),
  scene('dream-build-tunnel', { sectionTypes: ['build'], composition: 'echoTunnel', effect: 'dreamBreakdown', transitions: ['zoomThrough', 'tunnelWipe', 'feedbackSmear'], recruit: ['hero', 'feedback', 'texture'], body: [treatment(['hero'], { scaleMultiplier: 1.03, cropInset: 0.018 })], motifs: [[boost(0.04)], [treatment(['feedback'], { opacityMultiplier: 1.12 })]], evolutions: [[composition('layeredLumaCollage')]] }),
  scene('dream-predrop-vacuum', { sectionTypes: ['preDrop'], composition: 'centerHeroAtmosphericBorder', effect: 'preDropVacuum', transitions: ['frameHoldRelease', 'tunnelWipe'], recruit: ['background', 'hero'], entry: [retire('texture', 'feedback'), hold(true), treatment(['hero'], { scaleMultiplier: 0.82, cropInset: 0.1 })] }),
  scene('dream-drop-expansion', { sectionTypes: ['drop'], composition: 'echoTunnel', effect: 'bassImpact', transitions: ['zoomThrough', 'displacementBurst', 'tunnelWipe'], recruit: ['hero', 'feedback', 'texture'], entry: [hold(false), advance('hero')], motifs: [[treatment(['feedback'], { scaleMultiplier: 0.96 })], [composition('layeredLumaCollage')], [composition('echoTunnel')]], recruitments: [[recruit('foregroundAccent')]], evolutions: [[composition('videoWall'), effect('dropFracture')]] }),
  {
    ...scene('dream-drop-two-cathedral', { sectionTypes: ['drop'], composition: 'layeredLumaCollage', effect: 'dropFracture', transitions: ['zoomThrough', 'feedbackSmear', 'displacementBurst'], recruit: ['background', 'hero', 'texture', 'foregroundAccent'], entry: [advance('hero', 'texture')], priority: 20, evolutions: [[composition('echoTunnel')]] }), dropOccurrence: { minOccurrence: 2 },
  },
  scene('dream-breakdown-float', { sectionTypes: ['breakdown', 'bridge'], composition: 'echoTunnel', effect: 'dreamBreakdown', transitions: ['lumaDissolve', 'feedbackSmear'], recruit: ['hero', 'feedback', 'texture'], body: [treatment(['hero'], { scaleMultiplier: 0.92 })], recruitments: [[recruit('foregroundAccent')]] }),
  scene('dream-outro-vanish', { sectionTypes: ['outro'], composition: 'centerHeroAtmosphericBorder', effect: 'dreamBreakdown', transitions: ['lumaDissolve', 'dipToBlack'], recruit: ['background', 'hero'], body: [retire('texture', 'foregroundAccent', 'feedback')], exit: [hold(true)] }),
], 'dream')

const impactScenes = withEvents([
  scene('impact-intro-armed', { sectionTypes: ['intro'], composition: 'fullScreenHero', effect: 'none', transitions: ['hardCut', 'crossfade'], recruit: ['hero'] }),
  scene('impact-verse-clean', { sectionTypes: ['verse', 'unknown'], composition: 'fullScreenHero', effect: 'none', transitions: ['hardCut', 'crossfade'], recruit: ['hero'], motifs: [[advance('hero')], []] }),
  scene('impact-build-countdown', { sectionTypes: ['build'], composition: 'splitScreen', effect: 'bassImpact', transitions: ['hardCut', 'push', 'zoomThrough'], recruit: ['hero', 'foregroundAccent'], body: [treatment(['hero'], { cropInset: 0.025 })], motifs: [[advance('foregroundAccent')], [boost(0.06)]], evolutions: [[composition('videoWall')]] }),
  scene('impact-predrop-dead-stop', { sectionTypes: ['preDrop'], composition: 'fullScreenHero', effect: 'preDropVacuum', transitions: ['frameHoldRelease', 'hardCut'], recruit: ['hero'], entry: [retire('background', 'texture', 'foregroundAccent'), hold(true), treatment(['hero'], { scaleMultiplier: 0.86, cropInset: 0.08 })] }),
  scene('impact-drop-cut-system', { sectionTypes: ['drop'], composition: 'fullScreenHero', effect: 'bassImpact', transitions: ['hardCut', 'strobeCut', 'displacementBurst'], recruit: ['hero'], entry: [hold(false), advance('hero')], motifs: [[advance('hero')], [composition('splitScreen')], [composition('fullScreenHero')], [advance('hero')]], recruitments: [[recruit('foregroundAccent')]], evolutions: [[composition('videoWall'), effect('dropFracture')]] }),
  {
    ...scene('impact-drop-two-crossfire', { sectionTypes: ['drop'], composition: 'splitScreen', effect: 'dropFracture', transitions: ['hardCut', 'strobeCut', 'sliceDisplacement'], recruit: ['hero', 'foregroundAccent'], entry: [advance('hero', 'foregroundAccent')], priority: 20, motifs: [[advance('hero')], [composition('mirroredDualClip')]] }), dropOccurrence: { minOccurrence: 2 },
  },
  scene('impact-breakdown-reset', { sectionTypes: ['breakdown', 'bridge'], composition: 'fullScreenHero', effect: 'dreamBreakdown', transitions: ['crossfade', 'lumaDissolve'], recruit: ['hero'], body: [treatment(['hero'], { scaleMultiplier: 0.96 })] }),
  scene('impact-outro-final-frame', { sectionTypes: ['outro'], composition: 'fullScreenHero', effect: 'none', transitions: ['crossfade', 'dipToBlack'], recruit: ['hero'], exit: [hold(true)] }),
], 'impact')

const lumaScenes = withEvents([
  scene('luma-intro-texture-bed', { sectionTypes: ['intro'], composition: 'layeredLumaCollage', effect: 'dreamBreakdown', transitions: ['lumaDissolve', 'alphaDissolve'], recruit: ['background', 'hero', 'texture'] }),
  scene('luma-verse-organic', { sectionTypes: ['verse', 'unknown'], composition: 'heroPlusTexture', effect: 'phraseEcho', transitions: ['lumaDissolve', 'additiveDissolve'], recruit: ['background', 'hero', 'texture'], motifs: [[treatment(['texture'], { opacityMultiplier: 0.9 })], [treatment(['texture'], { opacityMultiplier: 1.12 })]], recruitments: [[recruit('foregroundAccent')]] }),
  scene('luma-build-weave', { sectionTypes: ['build'], composition: 'layeredLumaCollage', effect: 'bassImpact', transitions: ['lumaDissolve', 'maskExpansion', 'additiveDissolve'], recruit: ['background', 'hero', 'texture', 'foregroundAccent'], body: [treatment(['hero'], { cropInset: 0.02 }), treatment(['texture'], { opacityMultiplier: 1.14 })], evolutions: [[composition('maskedHeroReveal')]] }),
  scene('luma-predrop-mask-close', { sectionTypes: ['preDrop'], composition: 'maskedHeroReveal', effect: 'preDropVacuum', transitions: ['maskExpansion', 'frameHoldRelease'], recruit: ['background', 'hero', 'mask'], entry: [retire('texture', 'foregroundAccent'), hold(true), treatment(['hero'], { scaleMultiplier: 0.88, cropInset: 0.07 })] }),
  scene('luma-drop-bloom', { sectionTypes: ['drop'], composition: 'layeredLumaCollage', effect: 'bassImpact', transitions: ['lumaDissolve', 'displacementBurst', 'maskExpansion'], recruit: ['background', 'hero', 'texture', 'foregroundAccent'], entry: [hold(false), advance('hero')], motifs: [[treatment(['texture'], { opacityMultiplier: 1.18 })], [composition('videoWall')], [composition('layeredLumaCollage')]], recruitments: [[recruit('mask')]], evolutions: [[composition('fourPanelGrid'), effect('dropFracture')]] }),
  {
    ...scene('luma-drop-two-rewoven', { sectionTypes: ['drop'], composition: 'maskedHeroReveal', effect: 'dropFracture', transitions: ['maskExpansion', 'lumaDissolve', 'displacementBurst'], recruit: ['background', 'hero', 'mask', 'texture'], entry: [advance('hero', 'texture')], priority: 20, evolutions: [[composition('layeredLumaCollage')]] }), dropOccurrence: { minOccurrence: 2 },
  },
  scene('luma-breakdown-palette-arc', { sectionTypes: ['breakdown', 'bridge'], composition: 'layeredLumaCollage', effect: 'dreamBreakdown', transitions: ['lumaDissolve', 'additiveDissolve'], recruit: ['background', 'hero', 'texture'], body: [treatment(['texture'], { opacityMultiplier: 0.92 })], recruitments: [[recruit('foregroundAccent')]] }),
  scene('luma-outro-opacity-retirement', { sectionTypes: ['outro'], composition: 'heroPlusTexture', effect: 'dreamBreakdown', transitions: ['lumaDissolve', 'dipToBlack'], recruit: ['background', 'hero'], body: [retire('foregroundAccent', 'mask')], exit: [retire('texture'), hold(true)] }),
], 'luma')

const fracturesScenes = [
  scene('fractures-intro-stable-anchor', {
    sectionTypes: ['intro'], composition: 'fullScreenHero', effect: 'none', transitions: ['crossfade'], recruit: ['hero'],
    fractures: {
      values: {
        fractureAnchorMode: 'alwaysVisible', fractureIntensity: 0.22, fractureComposition: 0.18,
        fractureFocusProtection: 0.86, fracturePlacementMode: 'balanced', fractureTopologyInterval: '8bars',
        fractureLayoutInterval: '4bars', fractureTransitionMode: 'staggeredAssembly', fractureMotionAmount: 0.12,
        fractureEffectsIntensity: 0.12, fractureAudioResponse: 0.24, fractureBassMotion: 0.18,
        fractureTransientGlitch: 0.08, fractureStructuralResponse: 0.2, fractureGlowAmount: 0.12,
        fractureGlitchAmount: 0.05, fractureDuplicationAmount: 0.02,
        fractureEffectRoleWeights: { clean: 0.62, glow: 0.12, outline: 0.12, glitch: 0.03, luma: 0.05, displacement: 0.03, texture: 0.03 },
      },
    },
  }),
  scene('fractures-verse-editorial-motion', {
    sectionTypes: ['verse', 'unknown'], composition: 'fullScreenHero', effect: 'none', transitions: ['crossfade'], recruit: ['hero'],
    fractures: {
      values: {
        fractureAnchorMode: 'reactive', fractureIntensity: 0.38, fractureComposition: 0.34,
        fractureFocusProtection: 0.74, fracturePlacementMode: 'balanced', fractureTopologyInterval: '8bars',
        fractureLayoutInterval: '2bars', fractureTransitionMode: 'staggeredAssembly', fractureMotionAmount: 0.28,
        fractureEffectsIntensity: 0.25, fractureAudioResponse: 0.4, fractureBassMotion: 0.34,
        fractureTransientGlitch: 0.22, fractureStructuralResponse: 0.4, fractureGlowAmount: 0.2,
        fractureGlitchAmount: 0.16, fractureDuplicationAmount: 0.08,
      },
    },
  }),
  scene('fractures-build-separation', {
    sectionTypes: ['build'], composition: 'fullScreenHero', effect: 'none', transitions: ['zoomThrough'], recruit: ['hero'],
    fractures: {
      values: {
        fractureAnchorMode: 'reactive', fractureIntensity: 0.42, fractureComposition: 0.42,
        fractureFocusProtection: 0.72, fracturePlacementMode: 'offscreenSpill', fractureTopologyInterval: '4bars',
        fractureLayoutInterval: 'bar', fractureTransitionMode: 'staggeredAssembly', fractureMotionAmount: 0.38,
        fractureEffectsIntensity: 0.32, fractureAudioResponse: 0.5, fractureBassMotion: 0.42,
        fractureTransientGlitch: 0.3, fractureStructuralResponse: 0.52, fractureGlowAmount: 0.28,
        fractureGlitchAmount: 0.22, fractureDuplicationAmount: 0.1,
      },
      ramp: {
        fractureIntensity: 0.24, fractureComposition: 0.2, fractureMotionAmount: 0.28,
        fractureEffectsIntensity: 0.25, fractureAudioResponse: 0.18, fractureBassMotion: 0.2,
        fractureTransientGlitch: 0.28, fractureStructuralResponse: 0.3,
      },
    },
  }),
  scene('fractures-predrop-topology-prep', {
    sectionTypes: ['preDrop'], composition: 'fullScreenHero', effect: 'none', transitions: ['frameHoldRelease'], recruit: ['hero'],
    fractures: {
      values: {
        fractureAnchorMode: 'reactive', fractureIntensity: 0.7, fractureComposition: 0.62,
        fractureFocusProtection: 0.68, fracturePlacementMode: 'anchorCover', fractureTopologyInterval: 'bar',
        fractureLayoutInterval: 'bar', fractureTransitionMode: 'zoomInOut', fractureMotionAmount: 0.72,
        fractureEffectsIntensity: 0.62, fractureAudioResponse: 0.68, fractureBassMotion: 0.58,
        fractureTransientGlitch: 0.74, fractureStructuralResponse: 0.82, fractureGlowAmount: 0.54,
        fractureGlitchAmount: 0.64, fractureDuplicationAmount: 0.28,
      },
    },
  }),
  scene('fractures-drop-impact', {
    sectionTypes: ['drop'], composition: 'fullScreenHero', effect: 'none', transitions: ['hardCut'], recruit: ['hero'],
    fractures: {
      values: {
        fractureAnchorMode: 'fullyFragmented', fractureIntensity: 0.9, fractureComposition: 0.84,
        fractureFocusProtection: 0.5, fracturePlacementMode: 'randomMix', fractureTopologyInterval: '4bars',
        fractureLayoutInterval: 'bar', fractureTransitionMode: 'hardGlitchCut', fractureMotionAmount: 0.86,
        fractureEffectsIntensity: 0.88, fractureAudioResponse: 0.86, fractureBassMotion: 0.82,
        fractureTransientGlitch: 0.9, fractureStructuralResponse: 0.88, fractureGlowAmount: 0.78,
        fractureGlitchAmount: 0.86, fractureDuplicationAmount: 0.46,
        fractureEffectRoleWeights: { clean: 0.12, glow: 0.2, outline: 0.12, glitch: 0.24, luma: 0.08, displacement: 0.16, texture: 0.08 },
      },
    },
  }),
  {
    ...scene('fractures-drop-two-reconstruction', {
      sectionTypes: ['drop'], composition: 'fullScreenHero', effect: 'none', transitions: ['displacementBurst'], recruit: ['hero'], priority: 20,
      fractures: {
        values: {
          fractureAnchorMode: 'reactive', fractureIntensity: 0.96, fractureComposition: 0.92,
          fractureFocusProtection: 0.44, fracturePlacementMode: 'heavyOverlap', fractureTopologyInterval: '2bars',
          fractureLayoutInterval: 'bar', fractureTransitionMode: 'zoomInOut', fractureMotionAmount: 0.92,
          fractureEffectsIntensity: 0.94, fractureAudioResponse: 0.9, fractureBassMotion: 0.88,
          fractureTransientGlitch: 0.94, fractureStructuralResponse: 0.94, fractureGlowAmount: 0.82,
          fractureGlitchAmount: 0.92, fractureDuplicationAmount: 0.56,
          fractureEffectRoleWeights: { clean: 0.08, glow: 0.22, outline: 0.1, glitch: 0.26, luma: 0.06, displacement: 0.2, texture: 0.08 },
        },
      },
    }),
    dropOccurrence: { minOccurrence: 2 },
  },
  scene('fractures-breakdown-readable', {
    sectionTypes: ['breakdown', 'bridge'], composition: 'fullScreenHero', effect: 'none', transitions: ['lumaDissolve'], recruit: ['hero'],
    fractures: {
      values: {
        fractureAnchorMode: 'alwaysVisible', fractureIntensity: 0.3, fractureComposition: 0.24,
        fractureFocusProtection: 0.9, fracturePlacementMode: 'balanced', fractureTopologyInterval: '16bars',
        fractureLayoutInterval: '4bars', fractureTransitionMode: 'staggeredAssembly', fractureMotionAmount: 0.14,
        fractureEffectsIntensity: 0.18, fractureAudioResponse: 0.3, fractureBassMotion: 0.2,
        fractureTransientGlitch: 0.1, fractureStructuralResponse: 0.24, fractureGlowAmount: 0.22,
        fractureGlitchAmount: 0.06, fractureDuplicationAmount: 0.04,
        fractureEffectRoleWeights: { clean: 0.58, glow: 0.15, outline: 0.12, glitch: 0.03, luma: 0.06, displacement: 0.03, texture: 0.03 },
      },
    },
  }),
  scene('fractures-outro-reassembly', {
    sectionTypes: ['outro'], composition: 'fullScreenHero', effect: 'none', transitions: ['dipToBlack'], recruit: ['hero'],
    fractures: {
      values: {
        fractureAnchorMode: 'alwaysVisible', fractureIntensity: 0.18, fractureComposition: 0.12,
        fractureFocusProtection: 0.94, fracturePlacementMode: 'balanced', fractureTopologyInterval: '16bars',
        fractureLayoutInterval: '4bars', fractureTransitionMode: 'staggeredAssembly', fractureMotionAmount: 0.08,
        fractureEffectsIntensity: 0.08, fractureAudioResponse: 0.2, fractureBassMotion: 0.1,
        fractureTransientGlitch: 0.04, fractureStructuralResponse: 0.14, fractureGlowAmount: 0.08,
        fractureGlitchAmount: 0.03, fractureDuplicationAmount: 0, fractureReturnToAnchor: true,
      },
    },
  }),
]

function show(
  id: CanvasPerformanceShowId,
  label: string,
  description: string,
  visualPhilosophy: string,
  scenes: readonly SharedPerformanceProgramScene<CanvasPerformanceAction>[],
  fallbackSceneId: string,
): CanvasPerformanceShowDefinition {
  return {
    id,
    label,
    description,
    visualPhilosophy,
    fallbackSceneId,
    program: {
      id,
      metadata: { name: label, description, engine: 'canvas', version: 1, authoringRevision: 'patch-5' },
      fallbackOrder: ['unknown', 'verse', 'intro', 'breakdown', 'drop'],
      fallbackSceneId,
      scenes,
    },
  }
}

export const CANVAS_PERFORMANCE_SHOWS: readonly CanvasPerformanceShowDefinition[] = [
  show('canvas-cinematic-bass-editor', 'Cinematic Bass Editor', 'Readable hero footage, clean phrase-aware editing, cinematic breakdowns, and bounded impact cuts.', 'Editorial clarity with deliberate negative space and controlled layer growth.', cinematicScenes, 'cinematic-verse-editor'),
  show('canvas-glitch-collage-reactor', 'Glitch Collage Reactor', 'Multi-panel rhythmic collage with snare slices, hat texture, and phrase-scaled glitch escalation.', 'Dense panel choreography that stays quantized and legible.', glitchScenes, 'glitch-verse-collage'),
  show('canvas-dreamstate-media-tunnel', 'Dreamstate Media Tunnel', 'Layered depth, echo-tunnel compositions, atmospheric builds, and expansive drops.', 'Continuous depth travel with soft feedback and cinematic breathing room.', dreamScenes, 'dream-verse-orbit'),
  show('canvas-impact-cut-system', 'Impact Cut System', 'Precise hard cuts, strong kick and snare separation, restrained effects, and aggressive drop editing.', 'Editorial percussion with minimal processing between musical events.', impactScenes, 'impact-verse-clean'),
  show('canvas-layered-luma-journey', 'Layered Luma Journey', 'Luma masks, texture blending, organic transitions, and long-form repeated-section evolution.', 'Slow-blooming compositing where masks and textures carry the narrative.', lumaScenes, 'luma-verse-organic'),
  show('canvas-fractures-performance', 'Fractures Performance', 'Section-aware Fractures choreography that preserves one logical Canvas layer and the preset’s local audio response.', 'Authored macro direction outside, deterministic fragment planning inside.', fracturesScenes, 'fractures-verse-editorial-motion'),
]

export const CANVAS_PERFORMANCE_SHOW_BY_ID = Object.fromEntries(
  CANVAS_PERFORMANCE_SHOWS.map(definition => [definition.id, definition]),
) as Readonly<Record<CanvasPerformanceShowId, CanvasPerformanceShowDefinition>>

export const CANVAS_PERFORMANCE_SHOW_OPTIONS = CANVAS_PERFORMANCE_SHOWS.map(definition => ({
  value: definition.id,
  label: definition.label,
}))

export function getCanvasPerformanceShow(id: string | null | undefined): CanvasPerformanceShowDefinition {
  return CANVAS_PERFORMANCE_SHOW_BY_ID[id as CanvasPerformanceShowId]
    ?? CANVAS_PERFORMANCE_SHOW_BY_ID['canvas-cinematic-bass-editor']
}
