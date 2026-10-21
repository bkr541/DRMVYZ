import { AppIcon, type AppIconProps } from '../../../shared/icons/AppIcon'

export type { AppIconDrawing, AppIconKind } from '../../../shared/icons/AppIcon'

/** The review sheet uses the exact production renderer at its larger preview size. */
export function AppIconGlyph({ size = 36, ...props }: AppIconProps) {
  return <AppIcon {...props} size={size} signalClassName="llai-signal" />
}
