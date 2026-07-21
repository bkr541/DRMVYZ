function stableSerialize(value: unknown, seen: Set<object>): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'undefined': return 'undefined'
    case 'boolean': return value ? 'true' : 'false'
    case 'string': return JSON.stringify(value)
    case 'number': {
      if (Number.isNaN(value)) return 'number:NaN'
      if (value === Number.POSITIVE_INFINITY) return 'number:Infinity'
      if (value === Number.NEGATIVE_INFINITY) return 'number:-Infinity'
      if (Object.is(value, -0)) return 'number:-0'
      return `number:${value}`
    }
    case 'bigint': return `bigint:${value.toString()}`
    case 'symbol': return `symbol:${String(value.description ?? '')}`
    case 'function': return `function:${value.name}`
    default: break
  }

  const object = value as object
  if (seen.has(object)) throw new Error('Visual simulation structural configs must not contain circular references.')
  seen.add(object)
  try {
    if (Array.isArray(value)) return `[${value.map(item => stableSerialize(item, seen)).join(',')}]`
    if (value instanceof DataView) {
      const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      return `DataView[${Array.from(bytes).join(',')}]`
    }
    if (ArrayBuffer.isView(value)) {
      const typed = value as unknown as { length: number; [index: number]: unknown; constructor: { name: string } }
      const items: string[] = []
      for (let index = 0; index < typed.length; index += 1) items.push(stableSerialize(typed[index], seen))
      return `${typed.constructor.name}[${items.join(',')}]`
    }
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableSerialize(record[key], seen)}`).join(',')}}`
  } finally {
    seen.delete(object)
  }
}

/** Stable, order-independent signature for structural simulation configuration. */
export function createVisualSimulationStructuralSignature(value: unknown): string {
  return stableSerialize(value, new Set<object>())
}
