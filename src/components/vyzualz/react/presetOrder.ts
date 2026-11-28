/**
 * Every engine's Presets tab lists its presets alphabetically by the name shown on the card: case and accents ignored, numbers in number
 * order ("Pulse 2" before "Pulse 10"). Presets with the same name keep their shipped order.
 */
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

export function comparePresetNames(a: string, b: string): number {
  return collator.compare(a.trim(), b.trim())
}

export function sortPresetsByName<T>(items: readonly T[], nameOf: (item: T) => string): T[] {
  return items
    .map((item, index) => ({ item, index, name: nameOf(item) }))
    .sort((a, b) => comparePresetNames(a.name, b.name) || a.index - b.index)
    .map(entry => entry.item)
}
