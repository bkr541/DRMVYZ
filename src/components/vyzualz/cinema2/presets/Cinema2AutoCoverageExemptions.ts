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
