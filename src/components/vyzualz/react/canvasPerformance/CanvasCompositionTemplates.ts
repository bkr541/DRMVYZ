import {
  MAX_CANVAS_ACTIVE_VIDEO_DECODERS,
  MAX_CANVAS_FEEDBACK_PASSES,
  MAX_CANVAS_PERFORMANCE_LAYERS,
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
  return {
    id,
    label,
    slots: slots.slice(0, MAX_CANVAS_PERFORMANCE_LAYERS),
    maxLayers: Math.min(MAX_CANVAS_PERFORMANCE_LAYERS, slots.length),
    maxVideoDecoders: MAX_CANVAS_ACTIVE_VIDEO_DECODERS,
    feedbackPasses: Math.min(MAX_CANVAS_FEEDBACK_PASSES, feedbackPasses) as 0 | 1,
  }
}

export const CANVAS_COMPOSITION_TEMPLATES: Readonly<Record<CanvasCompositionTemplateId, CanvasCompositionTemplate>> = {
  fullScreenHero: template('fullScreenHero', 'Full-screen Hero', [
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero', 'dropAsset', 'breakdownAsset'], zIndex: 10 }),
  ]),

  heroPlusTexture: template('heroPlusTexture', 'Hero + Texture', [
    slot({ id: 'background', role: 'background', requiredMediaRoles: ['background'], opacity: 0.88, zIndex: 0 }),
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero', 'alternateHero'], zIndex: 10 }),
    slot({ id: 'texture', role: 'texture', requiredMediaRoles: ['texture'], opacity: 0.34, blendMode: 'screen', zIndex: 20 }),
  ]),

  mirroredDualClip: template('mirroredDualClip', 'Mirrored Dual Clip', [
    slot({ id: 'hero-left', role: 'hero', requiredMediaRoles: ['hero'], x: -0.25, scaleX: 0.55, crop: { x: 0, y: 0, width: 0.5, height: 1 }, zIndex: 10 }),
    slot({ id: 'hero-right', role: 'foregroundAccent', requiredMediaRoles: ['alternateHero', 'hero'], x: 0.25, scaleX: 0.55, crop: { x: 0.5, y: 0, width: 0.5, height: 1 }, mirrorX: true, zIndex: 11 }),
  ]),

  splitScreen: template('splitScreen', 'Split Screen', [
    slot({ id: 'left', role: 'hero', requiredMediaRoles: ['hero'], x: -0.25, scaleX: 0.52, crop: { x: 0, y: 0, width: 0.5, height: 1 }, zIndex: 10 }),
    slot({ id: 'right', role: 'foregroundAccent', requiredMediaRoles: ['alternateHero', 'hero'], x: 0.25, scaleX: 0.52, crop: { x: 0.5, y: 0, width: 0.5, height: 1 }, zIndex: 11 }),
  ]),

  fourPanelGrid: template('fourPanelGrid', 'Four-panel Grid', [
    slot({ id: 'panel-1', role: 'hero', requiredMediaRoles: ['hero'], x: -0.25, y: -0.25, scaleX: 0.5, scaleY: 0.5, crop: { x: 0, y: 0, width: 0.5, height: 0.5 }, zIndex: 10 }),
    slot({ id: 'panel-2', role: 'foregroundAccent', requiredMediaRoles: ['alternateHero', 'hero'], x: 0.25, y: -0.25, scaleX: 0.5, scaleY: 0.5, crop: { x: 0.5, y: 0, width: 0.5, height: 0.5 }, zIndex: 11 }),
    slot({ id: 'panel-3', role: 'texture', requiredMediaRoles: ['texture', 'alternateHero'], x: -0.25, y: 0.25, scaleX: 0.5, scaleY: 0.5, crop: { x: 0, y: 0.5, width: 0.5, height: 0.5 }, blendMode: 'screen', zIndex: 12 }),
    slot({ id: 'panel-4', role: 'background', requiredMediaRoles: ['background', 'hero'], x: 0.25, y: 0.25, scaleX: 0.5, scaleY: 0.5, crop: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }, zIndex: 9 }),
  ]),

  centerHeroAtmosphericBorder: template('centerHeroAtmosphericBorder', 'Center Hero + Atmospheric Border', [
    slot({ id: 'border', role: 'background', requiredMediaRoles: ['background', 'texture'], opacity: 0.78, scaleX: 1.08, scaleY: 1.08, zIndex: 0 }),
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero', 'breakdownAsset'], scaleX: 0.78, scaleY: 0.78, aspectBehavior: 'contain', zIndex: 10 }),
    slot({ id: 'texture', role: 'texture', requiredMediaRoles: ['texture'], opacity: 0.3, blendMode: 'screen', zIndex: 20 }),
  ]),

  maskedHeroReveal: template('maskedHeroReveal', 'Masked Hero Reveal', [
    slot({ id: 'background', role: 'background', requiredMediaRoles: ['background'], opacity: 0.9, zIndex: 0 }),
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero', 'buildAsset'], maskMode: 'alpha', zIndex: 10 }),
    slot({ id: 'mask', role: 'mask', requiredMediaRoles: ['mask'], fallbackMediaRoles: ['foregroundAccent', 'texture'], opacity: 1, zIndex: 30 }),
  ]),

  foregroundAccentOverBackground: template('foregroundAccentOverBackground', 'Foreground Accent over Background', [
    slot({ id: 'background', role: 'background', requiredMediaRoles: ['background', 'hero'], zIndex: 0 }),
    slot({ id: 'accent', role: 'foregroundAccent', requiredMediaRoles: ['foregroundAccent', 'alternateHero'], aspectBehavior: 'contain', scaleX: 0.68, scaleY: 0.68, blendMode: 'screen', zIndex: 20 }),
  ]),

  videoWall: template('videoWall', 'Video Wall', [
    slot({ id: 'wall-bg', role: 'background', requiredMediaRoles: ['background'], opacity: 0.72, zIndex: 0 }),
    slot({ id: 'wall-hero', role: 'hero', requiredMediaRoles: ['dropAsset', 'hero'], scaleX: 0.66, scaleY: 0.66, zIndex: 10 }),
    slot({ id: 'wall-left', role: 'foregroundAccent', requiredMediaRoles: ['alternateHero', 'hero'], x: -0.35, scaleX: 0.32, scaleY: 0.68, opacity: 0.78, zIndex: 11 }),
    slot({ id: 'wall-right', role: 'texture', requiredMediaRoles: ['texture', 'alternateHero'], x: 0.35, scaleX: 0.32, scaleY: 0.68, opacity: 0.66, blendMode: 'screen', zIndex: 12 }),
  ]),

  echoTunnel: template('echoTunnel', 'Echo Tunnel', [
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero', 'dropAsset'], zIndex: 10 }),
    slot({ id: 'echo-a', role: 'feedback', requiredMediaRoles: ['hero'], scaleX: 0.82, scaleY: 0.82, opacity: 0.34, blendMode: 'screen', zIndex: 11 }),
    slot({ id: 'echo-b', role: 'texture', requiredMediaRoles: ['texture', 'hero'], scaleX: 0.64, scaleY: 0.64, opacity: 0.22, blendMode: 'lighter', zIndex: 12 }),
  ], 1),

  layeredLumaCollage: template('layeredLumaCollage', 'Layered Luma Collage', [
    slot({ id: 'background', role: 'background', requiredMediaRoles: ['background'], opacity: 0.88, zIndex: 0 }),
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero', 'breakdownAsset'], blendMode: 'screen', zIndex: 10 }),
    slot({ id: 'texture', role: 'texture', requiredMediaRoles: ['texture'], opacity: 0.42, blendMode: 'soft-light', maskMode: 'luma', zIndex: 20 }),
    slot({ id: 'accent', role: 'foregroundAccent', requiredMediaRoles: ['foregroundAccent'], opacity: 0.56, blendMode: 'lighter', aspectBehavior: 'contain', zIndex: 30 }),
  ]),

  pictureInPictureAccent: template('pictureInPictureAccent', 'Picture-in-picture Accent', [
    slot({ id: 'background', role: 'background', requiredMediaRoles: ['background', 'hero'], zIndex: 0 }),
    slot({ id: 'hero', role: 'hero', requiredMediaRoles: ['hero'], scaleX: 0.72, scaleY: 0.72, x: -0.08, zIndex: 10 }),
    slot({ id: 'pip', role: 'foregroundAccent', requiredMediaRoles: ['foregroundAccent', 'alternateHero'], scaleX: 0.3, scaleY: 0.3, x: 0.32, y: 0.3, aspectBehavior: 'contain', blendMode: 'screen', zIndex: 20 }),
  ]),
}

export const CANVAS_COMPOSITION_TEMPLATE_OPTIONS = Object.values(CANVAS_COMPOSITION_TEMPLATES).map(template => ({
  value: template.id,
  label: template.label,
}))

export function getCanvasCompositionTemplate(id: CanvasCompositionTemplateId): CanvasCompositionTemplate {
  return CANVAS_COMPOSITION_TEMPLATES[id]
}
