import type { PixGridCellPoint } from './PixGridAuthoring'

export interface PixGridCanvasSampleRect {
  x: number
  y: number
  width: number
  height: number
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(Number.isFinite(value) ? value : min)))
}

export function resolvePixGridCanvasSampleRect(
  canvas: HTMLCanvasElement,
  point: PixGridCellPoint,
  matrixWidth: number,
  matrixHeight: number,
): PixGridCanvasSampleRect | null {
  if (canvas.width <= 0 || canvas.height <= 0 || matrixWidth <= 0 || matrixHeight <= 0) return null
  const cellX = clampInteger(point.x, 0, matrixWidth - 1)
  const cellY = clampInteger(point.y, 0, matrixHeight - 1)
  const x0 = clampInteger(cellX / matrixWidth * canvas.width, 0, canvas.width - 1)
  const y0 = clampInteger(cellY / matrixHeight * canvas.height, 0, canvas.height - 1)
  const x1 = Math.max(x0 + 1, Math.min(canvas.width, Math.ceil((cellX + 1) / matrixWidth * canvas.width)))
  const y1 = Math.max(y0 + 1, Math.min(canvas.height, Math.ceil((cellY + 1) / matrixHeight * canvas.height)))
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

export function samplePixGridCanvasColor(
  source: HTMLCanvasElement | null,
  point: PixGridCellPoint,
  matrixWidth: number,
  matrixHeight: number,
  sampleCanvas: HTMLCanvasElement,
): string | null {
  if (!source) return null
  const sampleRect = resolvePixGridCanvasSampleRect(source, point, matrixWidth, matrixHeight)
  if (!sampleRect) return null
  sampleCanvas.width = 1
  sampleCanvas.height = 1
  const context = sampleCanvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  try {
    context.clearRect(0, 0, 1, 1)
    context.drawImage(
      source,
      sampleRect.x,
      sampleRect.y,
      sampleRect.width,
      sampleRect.height,
      0,
      0,
      1,
      1,
    )
    const pixel = context.getImageData(0, 0, 1, 1).data
    return `#${[pixel[0], pixel[1], pixel[2]].map(value => value.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return null
  }
}
