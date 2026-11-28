import { Vector2 } from 'three'
import { validateContourRings } from './extractContours'
import { ModelGenerationError } from './modelQualityBudget'
type Ring = [number, number][]
const scope = self as unknown as { onmessage: ((event: MessageEvent<{ outer: Ring; holes: Ring[] }[]>) => void) | null; postMessage(value: unknown): void }
scope.onmessage = ({ data }) => {
  try {
    const decode = (ring: Ring) => ring.map(([x, y]) => new Vector2(x, y))
    scope.postMessage({ result: validateContourRings(data.map(ring => ({ outer: decode(ring.outer), holes: ring.holes.map(decode) }))) })
  } catch (error) {
    scope.postMessage({ code: error instanceof ModelGenerationError ? error.code : 'invalid_contour', error: error instanceof Error ? error.message : 'Contour validation failed.' })
  }
}
