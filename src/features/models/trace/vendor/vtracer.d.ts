export function initialize(bytes: BufferSource): Promise<void>
export function vectorize_rgba(data: Uint8Array, width: number, height: number, options: {
  clustering: 'bw'; mode: 'polygon' | 'spline'; filterSpeckle: number; binaryThreshold: number;
  cornerThreshold: number; lengthThreshold: number; maxIterations: number; spliceThreshold: number; pathPrecision: number;
}): string
