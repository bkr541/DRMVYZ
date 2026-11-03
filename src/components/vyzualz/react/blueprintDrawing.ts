/** The Engine dropdown's drawing weight and standard display scale. */
export const ENGINE_BLUEPRINT_STROKE_WIDTH = 0.8
export const ENGINE_BLUEPRINT_DISPLAY_SCALE = 170 / 150

/** Keep composed thumbnail strokes at the Engine dropdown's visible weight,
 * independent of the thumbnail's responsive viewBox scale. */
export const PRESET_BLUEPRINT_STROKE_WIDTH = ENGINE_BLUEPRINT_STROKE_WIDTH * ENGINE_BLUEPRINT_DISPLAY_SCALE
