import { AppIcon, type AppIconProps } from '../../../components/shared/icons/AppIcon'

// Tight artwork bounds, rather than the padded 32px source canvases. With
// preserveAspectRatio's default centering, each drawing's longest edge is 12px.
const ARTWORK_BOUNDS = {
  lyrics: '2 6 28 20',
  save: '4 4 24 24',
  saveActive: '5 2 25 28',
  plus: '8 8 16 16',
  undo: '4 5 24 21',
  redo: '4 5 24 21',
  alignStart: '4 2 24 28',
  alignEnd: '4 2 24 28',
  move: '2 2 28 28',
  copy: '2 2 28 28',
  scissors: '3 3 26.048 26',
  left: '4 6 24 20',
  right: '4 6 24 20',
  delete: '4 2 24 28',
  bars: '2 4 28 26',
  list: '4 6 24 20',
} as const

type Props = Omit<AppIconProps, 'kind' | 'size' | 'viewBox'> & { kind: keyof typeof ARTWORK_BOUNDS }

/** Outputs only the SVG: no DOM wrapper around the header artwork. */
export function LyricHeaderIcon({ kind, ...props }: Props) {
  return <AppIcon {...props} kind={kind} size={12} viewBox={ARTWORK_BOUNDS[kind]} />
}
