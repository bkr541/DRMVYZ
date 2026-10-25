/** The five Layout Lab design views, selected by the A–E buttons at the bottom of the navigation column. */
export const LAYOUT_LAB_DESIGNS = [
  { id: 'design-01', letter: 'A' },
  { id: 'design-02', letter: 'B' },
  { id: 'design-03', letter: 'C' },
  { id: 'design-04', letter: 'D' },
  { id: 'design-05', letter: 'E' },
] as const

export type LayoutLabDesignId = typeof LAYOUT_LAB_DESIGNS[number]['id']
