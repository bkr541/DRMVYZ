/** The Layout Lab design views, selected by the A–I and K buttons (a 2 × 5 grid) at the bottom of the navigation column. */
export const LAYOUT_LAB_DESIGNS = [
  { id: 'design-01', letter: 'A' },
  { id: 'design-02', letter: 'B' },
  { id: 'design-03', letter: 'C' },
  { id: 'design-04', letter: 'D' },
  { id: 'design-05', letter: 'E' },
  { id: 'design-06', letter: 'F' },
  { id: 'design-07', letter: 'G' },
  { id: 'design-08', letter: 'H' },
  { id: 'design-09', letter: 'I' },
  { id: 'design-10', letter: 'K' },
] as const

export type LayoutLabDesignId = typeof LAYOUT_LAB_DESIGNS[number]['id']
