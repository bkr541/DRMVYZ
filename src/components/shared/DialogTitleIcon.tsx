import { AppIcon, type AppIconKind } from './icons/AppIcon'

export type DialogTitleIconName = Extract<AppIconKind, 'edit' | 'play' | 'folder' | 'image' | 'plus' | 'copy'>

/** Dialog headings use the same approved artwork as their corresponding actions. */
export function DialogTitleIcon({ name }: { name: DialogTitleIconName }) {
  return <AppIcon kind={name} size={20} className="dlg-title-icon" />
}
