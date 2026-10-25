export const LAYOUT_LAB_DESIGNS = [
  { value: 'design-01', label: 'Design One' },
  { value: 'design-02', label: 'Design Two' },
  { value: 'design-03', label: 'Design Three' },
  { value: 'design-04', label: 'Design Four' },
  { value: 'design-05', label: 'Design Five' },
] as const

export type LayoutLabDesignId = typeof LAYOUT_LAB_DESIGNS[number]['value']
