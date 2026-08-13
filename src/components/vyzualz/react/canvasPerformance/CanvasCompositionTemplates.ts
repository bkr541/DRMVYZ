import {
  MAX_CANVAS_ACTIVE_VIDEO_DECODERS,
  MAX_CANVAS_FEEDBACK_PASSES,
  MAX_CANVAS_PERFORMANCE_LAYERS,
  type CanvasCompositionRichnessTier,
  type CanvasCompositionSlot,
  type CanvasCompositionTemplate,
  type CanvasCompositionTemplateId,
} from './CanvasPerformanceTypes'

const FULL_CROP = Object.freeze({ x: 0, y: 0, width: 1, height: 1 })

function slot(
  patch: Partial<CanvasCompositionSlot> & Pick<CanvasCompositionSlot, 'id' | 'role' | 'requiredMediaRoles'>,
): CanvasCompositionSlot {
  return {
    id: patch.id,
    role: patch.role,
    requiredMediaRoles: patch.requiredMediaRoles,
    richnessTier: patch.richnessTier ?? 0,
    fallbackMediaRoles: patch.fallbackMediaRoles ?? ['hero', 'background'],
    enabled: patch.enabled !== false,
    opacity: patch.opacity ?? 1,
    blendMode: patch.blendMode ?? 'source-over',
    x: patch.x ?? 0,
    y: patch.y ?? 0,
    scaleX: patch.scaleX ?? 1,
    scaleY: patch.scaleY ?? 1,
    rotation: patch.rotation ?? 0,
    crop: patch.crop ?? FULL_CROP,
    aspectBehavior: patch.aspectBehavior ?? 'cover',
    maskMode: patch.maskMode ?? null,
    zIndex: patch.zIndex ?? 0,
    mirrorX: patch.mirrorX ?? false,
    mirrorY: patch.mirrorY ?? false,
  }
}

function template(
  id: CanvasCompositionTemplateId,
  label: string,
  slots: readonly CanvasCompositionSlot[],
  feedbackPasses: 0 | 1 = 0,
): CanvasCompositionTemplate {
  const boundedSlots = slots.slice(0, MAX_CANVAS_PERFORMANCE_LAYERS)
  const maxRichnessTier = boundedSlots.reduce<CanvasCompositionRichnessTier>(
    (maximum, candidate) => Math.max(maximum, candidate.richnessTier) as CanvasCompositionRichnessTier,
    0,
  )
  return {
    id,
    label,
    slots: boundedSlots,
    maxLayers: Math.min(MAX_CANVAS_PERFORMANCE_LAYERS, boundedSlots.length),
    maxVideoDecoders: MAX_CANVAS_ACTIVE_VIDEO_DECODERS,
    feedbackPasses: Math.min(MAX_CANVAS_FEEDBACK_PASSES, feedbackPasses) as 0 | 1,
    coreSlotIds: boundedSlots.filter(candidate => candidate.richnessTier === 0).map(candidate => candidate.id),
    maxRichnessTier,
  }
}

/**
 * Tier 0 slots define each composition's silhouette. Tiers 1-4 add atmosphere,
 * texture, accents, masks, or feedback without replacing that silhouette.
 * This metadata is runtime-only and does not change persisted composition IDs.
 */
export const CANVAS_COMPOSITION_TEMPLATES: Readonly<Record<CanvasCompositionTemplateId, CanvasCompositionTemplate>> = {
  fullScreenHero: template('fullScreenHero', 'Full-screen Hero', [
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero', 'dropAsset', 'breakdownAsset'], maskMode: 'luma', zIndex: 10 }),
    slot({ id: 'background-support', role: 'background', requiredMediaRoles: ['background', 'hero'], richnessTier: 1, opacity: 0.68, scaleX: 1.08, scaleY: 1.08, zIndex: 0 }),
    slot({ id: 'texture-support', role: 'texture', requiredMediaRoles: ['texture', 'alternateHero'], richnessTier: 2, opacity: 0.3, blendMode: 'soft-light', zIndex: 20 }),
    slot({ id: 'accent-support', role: 'foregroundAccent', requiredMediaRoles: ['foregroundAccent', 'alternateHero'], richnessTier: 3, opacity: 0.5, blendMode: 'screen', scaleX: 0.72, scaleY: 0.72, aspectBehavior: 'contain', zIndex: 30 }),
    slot({ id: 'feedback-support', role: 'feedback', requiredMediaRoles: ['hero', 'texture'], richnessTier: 4, opacity: 0.2, blendMode: 'screen', scaleX: 0.9, scaleY: 0.9, zIndex: 15 }),
    slot({ id: 'mask-support', role: 'mask', requiredMediaRoles: ['mask', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 4, opacity: 0.14, blendMode: 'screen', zIndex: 40 }),
  ]),

  heroPlusTexture: template('heroPlusTexture', 'Hero + Texture', [
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero', 'alternateHero'], maskMode: 'luma', zIndex: 10 }),
    slot({ id: 'texture', role: 'texture', requiredMediaRoles: ['texture'], opacity: 0.34, blendMode: 'screen', zIndex: 20 }),
    slot({ id: 'background', role: 'background', requiredMediaRoles: ['background'], richnessTier: 1, opacity: 0.88, zIndex: 0 }),
    slot({ id: 'accent', role: 'foregroundAccent', requiredMediaRoles: ['foregroundAccent', 'alternateHero'], richnessTier: 2, opacity: 0.46, blendMode: 'screen', scaleX: 0.68, scaleY: 0.68, aspectBehavior: 'contain', zIndex: 30 }),
    slot({ id: 'feedback', role: 'feedback', requiredMediaRoles: ['hero', 'texture'], richnessTier: 3, opacity: 0.18, blendMode: 'lighter', scaleX: 0.86, scaleY: 0.86, zIndex: 15 }),
    slot({ id: 'mask', role: 'mask', requiredMediaRoles: ['mask', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 4, opacity: 0.14, blendMode: 'screen', zIndex: 40 }),
  ]),

  mirroredDualClip: template('mirroredDualClip', 'Mirrored Dual Clip', [
    slot({ id: 'hero-left', role: 'hero', requiredMediaRoles: ['hero'], x: -0.25, scaleX: 0.55, crop: { x: 0, y: 0, width: 0.5, height: 1 }, maskMode: 'luma', zIndex: 10 }),
    slot({ id: 'hero-right', role: 'foregroundAccent', requiredMediaRoles: ['alternateHero', 'hero'], x: 0.25, scaleX: 0.55, crop: { x: 0.5, y: 0, width: 0.5, height: 1 }, mirrorX: true, zIndex: 11 }),
    slot({ id: 'mirror-background', role: 'background', requiredMediaRoles: ['background', 'hero'], richnessTier: 1, opacity: 0.64, scaleX: 1.08, scaleY: 1.08, zIndex: 0 }),
    slot({ id: 'mirror-texture', role: 'texture', requiredMediaRoles: ['texture'], richnessTier: 2, opacity: 0.3, blendMode: 'soft-light', zIndex: 20 }),
    slot({ id: 'mirror-feedback', role: 'feedback', requiredMediaRoles: ['hero', 'texture'], richnessTier: 3, opacity: 0.2, blendMode: 'screen', scaleX: 0.9, scaleY: 0.9, zIndex: 15 }),
    slot({ id: 'mirror-mask', role: 'mask', requiredMediaRoles: ['mask', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 4, opacity: 0.14, blendMode: 'screen', zIndex: 40 }),
  ]),

  splitScreen: template('splitScreen', 'Split Screen', [
    slot({ id: 'left', role: 'hero', requiredMediaRoles: ['hero'], x: -0.25, scaleX: 0.52, crop: { x: 0, y: 0, width: 0.5, height: 1 }, maskMode: 'luma', zIndex: 10 }),
    slot({ id: 'right', role: 'foregroundAccent', requiredMediaRoles: ['alternateHero', 'hero'], x: 0.25, scaleX: 0.52, crop: { x: 0.5, y: 0, width: 0.5, height: 1 }, zIndex: 11 }),
    slot({ id: 'split-background', role: 'background', requiredMediaRoles: ['background', 'hero'], richnessTier: 1, opacity: 0.62, zIndex: 0 }),
    slot({ id: 'split-texture', role: 'texture', requiredMediaRoles: ['texture'], richnessTier: 2, opacity: 0.28, blendMode: 'screen', zIndex: 20 }),
    slot({ id: 'split-feedback', role: 'feedback', requiredMediaRoles: ['hero', 'texture'], richnessTier: 3, opacity: 0.17, blendMode: 'lighter', scaleX: 0.9, scaleY: 0.9, zIndex: 15 }),
    slot({ id: 'split-mask', role: 'mask', requiredMediaRoles: ['mask', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 4, opacity: 0.14, blendMode: 'screen', zIndex: 40 }),
  ]),

  fourPanelGrid: template('fourPanelGrid', 'Four-panel Grid', [
    slot({ id: 'panel-1', role: 'hero', requiredMediaRoles: ['hero'], x: -0.25, y: -0.25, scaleX: 0.5, scaleY: 0.5, crop: { x: 0, y: 0, width: 0.5, height: 0.5 }, maskMode: 'luma', zIndex: 10 }),
    slot({ id: 'panel-2', role: 'foregroundAccent', requiredMediaRoles: ['alternateHero', 'hero'], x: 0.25, y: -0.25, scaleX: 0.5, scaleY: 0.5, crop: { x: 0.5, y: 0, width: 0.5, height: 0.5 }, zIndex: 11 }),
    slot({ id: 'panel-3', role: 'texture', requiredMediaRoles: ['texture', 'alternateHero'], x: -0.25, y: 0.25, scaleX: 0.5, scaleY: 0.5, crop: { x: 0, y: 0.5, width: 0.5, height: 0.5 }, blendMode: 'screen', zIndex: 12 }),
    slot({ id: 'panel-4', role: 'background', requiredMediaRoles: ['background', 'hero'], x: 0.25, y: 0.25, scaleX: 0.5, scaleY: 0.5, crop: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }, zIndex: 9 }),
    slot({ id: 'grid-feedback', role: 'feedback', requiredMediaRoles: ['hero', 'texture'], richnessTier: 2, opacity: 0.2, blendMode: 'screen', scaleX: 0.88, scaleY: 0.88, zIndex: 15 }),
    slot({ id: 'grid-transition-overlay', role: 'transition', requiredMediaRoles: ['transition', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 3, opacity: 0.18, blendMode: 'lighter', zIndex: 25 }),
    slot({ id: 'grid-mask', role: 'mask', requiredMediaRoles: ['mask', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 4, opacity: 0.14, blendMode: 'screen', zIndex: 40 }),
  ]),

  centerHeroAtmosphericBorder: template('centerHeroAtmosphericBorder', 'Center Hero + Atmospheric Border', [
    slot({ id: 'border', role: 'background', requiredMediaRoles: ['background', 'texture'], opacity: 0.78, scaleX: 1.08, scaleY: 1.08, zIndex: 0 }),
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero', 'breakdownAsset'], scaleX: 0.78, scaleY: 0.78, aspectBehavior: 'contain', maskMode: 'luma', zIndex: 10 }),
    slot({ id: 'texture', role: 'texture', requiredMediaRoles: ['texture'], richnessTier: 1, opacity: 0.3, blendMode: 'screen', zIndex: 20 }),
    slot({ id: 'border-accent', role: 'foregroundAccent', requiredMediaRoles: ['foregroundAccent', 'alternateHero'], richnessTier: 2, opacity: 0.38, blendMode: 'screen', scaleX: 0.54, scaleY: 0.54, aspectBehavior: 'contain', zIndex: 30 }),
    slot({ id: 'border-feedback', role: 'feedback', requiredMediaRoles: ['hero', 'texture'], richnessTier: 3, opacity: 0.16, blendMode: 'lighter', scaleX: 0.9, scaleY: 0.9, zIndex: 15 }),
    slot({ id: 'border-mask', role: 'mask', requiredMediaRoles: ['mask', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 4, opacity: 0.14, blendMode: 'screen', zIndex: 40 }),
  ]),

  maskedHeroReveal: template('maskedHeroReveal', 'Masked Hero Reveal', [
    slot({ id: 'background', role: 'background', requiredMediaRoles: ['background'], opacity: 0.9, zIndex: 0 }),
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero', 'buildAsset'], maskMode: 'alpha', zIndex: 10 }),
    slot({ id: 'mask', role: 'mask', requiredMediaRoles: ['mask'], fallbackMediaRoles: ['foregroundAccent', 'texture'], opacity: 1, zIndex: 30 }),
    slot({ id: 'reveal-texture', role: 'texture', requiredMediaRoles: ['texture'], richnessTier: 1, opacity: 0.26, blendMode: 'soft-light', zIndex: 20 }),
    slot({ id: 'reveal-accent', role: 'foregroundAccent', requiredMediaRoles: ['foregroundAccent', 'alternateHero'], richnessTier: 2, opacity: 0.42, blendMode: 'screen', scaleX: 0.64, scaleY: 0.64, aspectBehavior: 'contain', zIndex: 25 }),
    slot({ id: 'reveal-feedback', role: 'feedback', requiredMediaRoles: ['hero', 'texture'], richnessTier: 3, opacity: 0.16, blendMode: 'screen', scaleX: 0.9, scaleY: 0.9, zIndex: 15 }),
    slot({ id: 'reveal-transition', role: 'transition', requiredMediaRoles: ['transition', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 4, opacity: 0.15, blendMode: 'lighter', zIndex: 35 }),
  ]),

  foregroundAccentOverBackground: template('foregroundAccentOverBackground', 'Foreground Accent over Background', [
    slot({ id: 'background', role: 'background', requiredMediaRoles: ['background', 'hero'], zIndex: 0 }),
    slot({ id: 'accent', role: 'foregroundAccent', requiredMediaRoles: ['foregroundAccent', 'alternateHero'], aspectBehavior: 'contain', scaleX: 0.68, scaleY: 0.68, blendMode: 'screen', maskMode: 'luma', zIndex: 20 }),
    slot({ id: 'accent-hero-support', role: 'hero', requiredMediaRoles: ['hero'], richnessTier: 1, opacity: 0.46, blendMode: 'soft-light', scaleX: 0.9, scaleY: 0.9, zIndex: 10 }),
    slot({ id: 'accent-texture', role: 'texture', requiredMediaRoles: ['texture'], richnessTier: 2, opacity: 0.24, blendMode: 'screen', zIndex: 25 }),
    slot({ id: 'accent-feedback', role: 'feedback', requiredMediaRoles: ['hero', 'texture'], richnessTier: 3, opacity: 0.16, blendMode: 'lighter', scaleX: 0.88, scaleY: 0.88, zIndex: 15 }),
    slot({ id: 'accent-mask', role: 'mask', requiredMediaRoles: ['mask', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 4, opacity: 0.14, blendMode: 'screen', zIndex: 40 }),
  ]),

  videoWall: template('videoWall', 'Video Wall', [
    slot({ id: 'wall-bg', role: 'background', requiredMediaRoles: ['background'], opacity: 0.72, zIndex: 0 }),
    slot({ id: 'wall-hero', role: 'hero', requiredMediaRoles: ['dropAsset', 'hero'], scaleX: 0.66, scaleY: 0.66, maskMode: 'luma', zIndex: 10 }),
    slot({ id: 'wall-left', role: 'foregroundAccent', requiredMediaRoles: ['alternateHero', 'hero'], x: -0.35, scaleX: 0.32, scaleY: 0.68, opacity: 0.78, zIndex: 11 }),
    slot({ id: 'wall-right', role: 'texture', requiredMediaRoles: ['texture', 'alternateHero'], x: 0.35, scaleX: 0.32, scaleY: 0.68, opacity: 0.66, blendMode: 'screen', zIndex: 12 }),
    slot({ id: 'wall-feedback', role: 'feedback', requiredMediaRoles: ['hero', 'texture'], richnessTier: 2, opacity: 0.18, blendMode: 'screen', scaleX: 0.9, scaleY: 0.9, zIndex: 15 }),
    slot({ id: 'wall-transition', role: 'transition', requiredMediaRoles: ['transition', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 3, opacity: 0.15, blendMode: 'lighter', zIndex: 25 }),
    slot({ id: 'wall-mask', role: 'mask', requiredMediaRoles: ['mask', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 4, opacity: 0.14, blendMode: 'screen', zIndex: 40 }),
  ]),

  echoTunnel: template('echoTunnel', 'Echo Tunnel', [
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero', 'dropAsset'], maskMode: 'luma', zIndex: 10 }),
    slot({ id: 'echo-a', role: 'feedback', requiredMediaRoles: ['hero'], scaleX: 0.82, scaleY: 0.82, opacity: 0.34, blendMode: 'screen', zIndex: 11 }),
    slot({ id: 'echo-b', role: 'texture', requiredMediaRoles: ['texture', 'hero'], scaleX: 0.64, scaleY: 0.64, opacity: 0.22, blendMode: 'lighter', zIndex: 12 }),
    slot({ id: 'echo-background', role: 'background', requiredMediaRoles: ['background', 'hero'], richnessTier: 1, opacity: 0.58, scaleX: 1.1, scaleY: 1.1, zIndex: 0 }),
    slot({ id: 'echo-accent', role: 'foregroundAccent', requiredMediaRoles: ['foregroundAccent', 'alternateHero'], richnessTier: 2, opacity: 0.34, blendMode: 'screen', scaleX: 0.5, scaleY: 0.5, aspectBehavior: 'contain', zIndex: 20 }),
    slot({ id: 'echo-transition', role: 'transition', requiredMediaRoles: ['transition', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 3, opacity: 0.14, blendMode: 'lighter', zIndex: 25 }),
    slot({ id: 'echo-mask', role: 'mask', requiredMediaRoles: ['mask', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 4, opacity: 0.14, blendMode: 'screen', zIndex: 40 }),
  ], 1),

  layeredLumaCollage: template('layeredLumaCollage', 'Layered Luma Collage', [
    slot({ id: 'background', role: 'background', requiredMediaRoles: ['background'], opacity: 0.88, zIndex: 0 }),
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero', 'breakdownAsset'], blendMode: 'screen', maskMode: 'luma', zIndex: 10 }),
    slot({ id: 'texture', role: 'texture', requiredMediaRoles: ['texture'], opacity: 0.42, blendMode: 'soft-light', maskMode: 'luma', zIndex: 20 }),
    slot({ id: 'accent', role: 'foregroundAccent', requiredMediaRoles: ['foregroundAccent'], richnessTier: 1, opacity: 0.56, blendMode: 'lighter', aspectBehavior: 'contain', zIndex: 30 }),
    slot({ id: 'luma-feedback', role: 'feedback', requiredMediaRoles: ['hero', 'texture'], richnessTier: 2, opacity: 0.2, blendMode: 'screen', scaleX: 0.9, scaleY: 0.9, zIndex: 15 }),
    slot({ id: 'luma-transition', role: 'transition', requiredMediaRoles: ['transition', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 3, opacity: 0.16, blendMode: 'lighter', zIndex: 25 }),
    slot({ id: 'luma-mask', role: 'mask', requiredMediaRoles: ['mask', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 4, opacity: 0.14, blendMode: 'screen', zIndex: 40 }),
  ]),

  pictureInPictureAccent: template('pictureInPictureAccent', 'Picture-in-picture Accent', [
    slot({ id: 'background', role: 'background', requiredMediaRoles: ['background', 'hero'], zIndex: 0 }),
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero'], scaleX: 0.72, scaleY: 0.72, x: -0.08, maskMode: 'luma', zIndex: 10 }),
    slot({ id: 'pip', role: 'foregroundAccent', requiredMediaRoles: ['foregroundAccent', 'alternateHero'], scaleX: 0.3, scaleY: 0.3, x: 0.32, y: 0.3, aspectBehavior: 'contain', blendMode: 'screen', zIndex: 20 }),
    slot({ id: 'pip-texture', role: 'texture', requiredMediaRoles: ['texture'], richnessTier: 1, opacity: 0.24, blendMode: 'soft-light', zIndex: 25 }),
    slot({ id: 'pip-feedback', role: 'feedback', requiredMediaRoles: ['hero', 'texture'], richnessTier: 2, opacity: 0.16, blendMode: 'screen', scaleX: 0.9, scaleY: 0.9, zIndex: 15 }),
    slot({ id: 'pip-transition', role: 'transition', requiredMediaRoles: ['transition', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 3, opacity: 0.14, blendMode: 'lighter', zIndex: 27 }),
    slot({ id: 'pip-mask', role: 'mask', requiredMediaRoles: ['mask', 'texture'], fallbackMediaRoles: ['texture', 'foregroundAccent'], richnessTier: 4, opacity: 0.14, blendMode: 'screen', zIndex: 40 }),
  ]),
}

export const CANVAS_COMPOSITION_TEMPLATE_OPTIONS = Object.values(CANVAS_COMPOSITION_TEMPLATES).map(template => ({
  value: template.id,
  label: template.label,
}))

export function getCanvasCompositionTemplate(id: CanvasCompositionTemplateId): CanvasCompositionTemplate {
  return CANVAS_COMPOSITION_TEMPLATES[id]
}
