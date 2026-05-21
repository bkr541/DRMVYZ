export interface VzCueMarker {
  id: string
  label: string
  time: number
  type: 'intro' | 'verse' | 'build' | 'drop' | 'break' | 'outro' | 'custom'
  color?: string
}
