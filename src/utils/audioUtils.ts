export function getFilenameWithoutExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '')
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}
