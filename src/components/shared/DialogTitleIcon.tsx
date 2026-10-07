/**
 * Icon shown left of a dialog's heading, in the style of the Media Upload header: 20px, brand cyan. Dialog headers carry this icon
 * and the heading text only — no supporting line.
 */
const PATHS = {
  edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4',
  play: 'M8 5v14l11-7z',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  plus: 'M12 5v14M5 12h14',
  copy: 'M9 9h10v11H9zM5 15V4h10',
} as const

export type DialogTitleIconName = keyof typeof PATHS

export function DialogTitleIcon({ name }: { name: DialogTitleIconName }) {
  return (
    <svg
      className="dlg-title-icon"
      viewBox="0 0 24 24"
      fill={name === 'play' ? 'currentColor' : 'none'}
      stroke={name === 'play' ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
