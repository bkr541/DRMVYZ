/**
 * Controls Auto Performance cannot move continuously, by preset slug and parameter id, each with the reason. Everything else numeric in Master Controls,
 * Design and Effects is driven (see Cinema2AutoCoverage). Keep this short: a control belongs here only when moving it live would rebuild the scene
 * every frame, or the module reads it in a way a transient contribution cannot reach. Each is a module change waiting to be made, not a decision
 * that the music should not move it.
 */
const REBUILDS_LAYOUT = 'The module rebuilds the text layout whenever this changes, so a value that moves every frame would re-lay out the glyphs every frame.'
const REBUILDS_STRUCTURE = 'The module rebuilds the rod structure whenever this changes, so a value that moves every frame would rebuild the geometry every frame.'
const BLOCK_GEOMETRY = 'The module rebuilds the block layout whenever this changes and treats a change as a manual edit, which ends Auto Performance\'s takeover; it needs a pose-level modulation first.'

const MAPPED_BY_RULE = 'The preset maps this saved value to its targets through a choreography rule, so it has no property of its own to add to; it needs a binding first.'

const NEVER_ZOOMS = 'Open Decks never zooms or turns: its only camera movement is the slight left and right sway authored in the preset.'

export const CINEMA2_AUTO_COVERAGE_EXEMPT: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  spectrum: Object.freeze({
    'spectrum-reactivity': 'User-owned alignment, media presentation or modulation authority.',
    'spectrum-arena-radius': 'User-owned alignment, media presentation or modulation authority.',
    'spectrum-display-height': 'User-owned alignment, media presentation or modulation authority.',
    'spectrum-bay-gap': 'User-owned alignment, media presentation or modulation authority.',
    'spectrum-media-scale': 'User-owned alignment, media presentation or modulation authority.',
    'spectrum-media-x': 'User-owned alignment, media presentation or modulation authority.',
    'spectrum-media-y': 'User-owned alignment, media presentation or modulation authority.',
    'spectrum-media-rotation': 'User-owned alignment, media presentation or modulation authority.',
    'spectrum-media-opacity': 'User-owned alignment, media presentation or modulation authority.',
    'spectrum-media-brightness': 'User-owned alignment, media presentation or modulation authority.',
    'spectrum-transition': 'User-owned alignment, media presentation or modulation authority.',
  }),
  fracture: Object.freeze({
    'fracture-reactivity': 'User-owned physical geometry, presentation or modulation authority.',
    'fracture-crack-width': 'User-owned physical geometry, presentation or modulation authority.',
    'fracture-shard-thickness': 'User-owned physical geometry, presentation or modulation authority.',
    'fracture-reassembly-time': 'User-owned physical geometry, presentation or modulation authority.',
    'fracture-media-scale': 'User-owned physical geometry, presentation or modulation authority.',
    'fracture-media-x': 'User-owned physical geometry, presentation or modulation authority.',
    'fracture-media-y': 'User-owned physical geometry, presentation or modulation authority.',
    'fracture-media-rotation': 'User-owned physical geometry, presentation or modulation authority.',
    'fracture-media-opacity': 'User-owned physical geometry, presentation or modulation authority.',
    'fracture-media-brightness': 'User-owned physical geometry, presentation or modulation authority.',
    'fracture-transition': 'User-owned physical geometry, presentation or modulation authority.',
  }),
  refraction: Object.freeze({
    'refraction-reactivity': 'User-owned media presentation, physical alignment or modulation authority.',
    'refraction-prism-depth': 'User-owned media presentation, physical alignment or modulation authority.',
    'refraction-bevel': 'User-owned media presentation, physical alignment or modulation authority.',
    'refraction-spacing': 'User-owned media presentation, physical alignment or modulation authority.',
    'refraction-media-scale': 'User-owned media presentation, physical alignment or modulation authority.',
    'refraction-media-x': 'User-owned media presentation, physical alignment or modulation authority.',
    'refraction-media-y': 'User-owned media presentation, physical alignment or modulation authority.',
    'refraction-media-rotation': 'User-owned media presentation, physical alignment or modulation authority.',
    'refraction-media-opacity': 'User-owned media presentation, physical alignment or modulation authority.',
    'refraction-media-brightness': 'User-owned media presentation, physical alignment or modulation authority.',
    'refraction-transition': 'User-owned media presentation, physical alignment or modulation authority.',
  }),
  mosaic: Object.freeze({
    'mosaic-reactivity': 'User-owned media presentation, physical alignment or modulation authority.',
    'mosaic-gap': 'User-owned media presentation, physical alignment or modulation authority.',
    'mosaic-thickness': 'User-owned media presentation, physical alignment or modulation authority.',
    'mosaic-frame-width': 'User-owned media presentation, physical alignment or modulation authority.',
    'mosaic-media-scale': 'User-owned media presentation, physical alignment or modulation authority.',
    'mosaic-media-x': 'User-owned media presentation, physical alignment or modulation authority.',
    'mosaic-media-y': 'User-owned media presentation, physical alignment or modulation authority.',
    'mosaic-media-rotation': 'User-owned media presentation, physical alignment or modulation authority.',
    'mosaic-media-opacity': 'User-owned media presentation, physical alignment or modulation authority.',
    'mosaic-media-brightness': 'User-owned media presentation, physical alignment or modulation authority.',
    'mosaic-transition': 'User-owned media presentation, physical alignment or modulation authority.',
  }),
  colossus: Object.freeze({
    'colossus-reactivity': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'colossus-model-scale': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'colossus-model-x': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'colossus-model-y': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'colossus-model-z': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'colossus-model-yaw': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'colossus-model-pitch': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'colossus-model-roll': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
  }),
  exoskeleton: Object.freeze({
    'exoskeleton-reactivity': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'exoskeleton-model-scale': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'exoskeleton-model-x': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'exoskeleton-model-y': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'exoskeleton-model-z': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'exoskeleton-model-yaw': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'exoskeleton-model-pitch': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'exoskeleton-model-roll': 'User-owned fit, alignment or modulation authority; never changed by Auto Performance.',
    'exoskeleton-shell-clearance': 'Authored shell fit and separation; never modulated.',
    'exoskeleton-plate-thickness': 'Authored shell fit and separation; never modulated.',
    'exoskeleton-seam-gap': 'Authored shell fit and separation; never modulated.',
    'exoskeleton-front-aperture': 'Authored shell fit and separation; never modulated.',
  }),
  allstar: Object.freeze({
    'allstar-tunnel-width': 'Changing the physical corridor radius during a recycled segment pass breaks the fixed architectural framing.',
    'allstar-tunnel-depth': 'Changing segment spacing changes the recycling period and causes a discontinuous spatial jump.',
    'allstar-frame-thickness': 'Fixed architectural rib dimensions are authored geometry.',
    'allstar-structural-detail': 'Crosses the threshold for recruiting additional structural parts.',
    'allstar-surface-roughness': 'Authored material finish must remain constant.',
    'allstar-geometry-layers': 'Discrete capacity; live count changes can pop in or remove depth layers.',
    'allstar-geometric-separation': 'Changing the recycling period jumps the independent outlines in depth.',
    'allstar-geometry-thickness': 'Fixed physical thickness of the authored light bars.',
    'allstar-reactivity': 'User-owned strength of the shared choreography, not an automation target.',
  }),
  purity: Object.freeze({
    'purity-tunnel-width': 'Changing the physical corridor width during a recycled segment pass breaks fixed architectural framing.',
    'purity-tunnel-depth': 'Changing segment spacing changes the recycling period and causes a discontinuous spatial jump.',
    'purity-frame-thickness': 'Fixed architectural rib dimensions are authored geometry.',
    'purity-reactivity': 'User-owned strength of the shared choreography, not an automation target.',
  }),
  blockshift: Object.freeze({
    'blockshift-block-size': BLOCK_GEOMETRY, 'blockshift-spread': BLOCK_GEOMETRY, 'blockshift-depth': BLOCK_GEOMETRY, 'blockshift-rotation-range': BLOCK_GEOMETRY,
  }),
  'say-it': Object.freeze({ 'say-it-tracking': REBUILDS_LAYOUT, 'say-it-line-spacing': REBUILDS_LAYOUT, 'say-it-glyph-scale': REBUILDS_LAYOUT }),
  orbital: Object.freeze({ 'orbital-tracking': REBUILDS_LAYOUT, 'orbital-line-spacing': REBUILDS_LAYOUT, 'orbital-glyph-scale': REBUILDS_LAYOUT }),
  submerge: Object.freeze({ 'submerge-tracking': REBUILDS_LAYOUT, 'submerge-line-spacing': REBUILDS_LAYOUT, 'submerge-glyph-scale': REBUILDS_LAYOUT }),
  'neon-forest': Object.freeze({ 'neon-forest-light-strength': MAPPED_BY_RULE, 'neon-forest-fog-density': MAPPED_BY_RULE }),
  psylo: Object.freeze({ 'psylo-light-strength': MAPPED_BY_RULE, 'psylo-fog-density': MAPPED_BY_RULE }),
  'atl-hoe': Object.freeze({ 'atl-hoe-city-atmosphere': MAPPED_BY_RULE }),
  'open-decks': Object.freeze({ 'open-decks-distance': NEVER_ZOOMS, 'open-decks-heading': NEVER_ZOOMS, 'open-decks-elevation': NEVER_ZOOMS }),
  canopy: Object.freeze({
    'canopy-row-spacing': REBUILDS_STRUCTURE, 'canopy-column-spacing': REBUILDS_STRUCTURE, 'canopy-rod-length': REBUILDS_STRUCTURE, 'canopy-length-variation': REBUILDS_STRUCTURE,
  }),
})
