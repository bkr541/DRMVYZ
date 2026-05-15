export function getFilenameWithoutExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '')
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// Returns a normalized [0..1] RMS amplitude from a time-domain float32 array
export function calcRMS(buffer: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i]
  }
  return Math.sqrt(sum / buffer.length)
}

// Returns peak value in [0..1] from a byte frequency array
export function calcPeak(buffer: Uint8Array): number {
  let max = 0
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] > max) max = buffer[i]
  }
  return max / 255
}

// Smooth value toward target using exponential decay
export function smooth(current: number, target: number, factor: number): number {
  return current + (target - current) * factor
}
