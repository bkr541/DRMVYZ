import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight01Icon } from 'hugeicons-react'

const MENU_MARGIN = 12
// Delay before a hover-opened submenu closes, so moving the pointer from the
// trigger row toward the flyout panel doesn't race the mouseleave.
const SUBMENU_CLOSE_DELAY_MS = 220

export interface ContextActionMenuItem {
  id: string
  label: string
  /** Ignored when `submenu` is set — that row opens the flyout instead of acting directly. */
  onSelect?: () => void
  disabled?: boolean
  danger?: boolean
  dividerBefore?: boolean
  /** When present, hovering (or clicking) this row opens a flyout panel to
   * the side showing this content, instead of invoking `onSelect`. Nest
   * another `ContextMenuItemsList` inside it for a further cascading level. */
  submenu?: ReactNode
}

interface ContextActionMenuProps {
  x: number
  y: number
  ariaLabel: string
  header?: {
    title: string
    subtitle?: string | null
  }
  items: readonly ContextActionMenuItem[]
  onClose: () => void
  className?: string
}

function clampMenu(element: HTMLElement, point: { x: number; y: number }) {
  if (typeof window === 'undefined') return point
  const rect = element.getBoundingClientRect()
  return {
    x: Math.round(Math.max(MENU_MARGIN, Math.min(window.innerWidth - rect.width - MENU_MARGIN, point.x))),
    y: Math.round(Math.max(MENU_MARGIN, Math.min(window.innerHeight - rect.height - MENU_MARGIN, point.y))),
  }
}

/** Lets a cascading tree of portaled flyout panels register their DOM roots
 * so the top-level menu's outside-pointerdown-closes-everything check treats
 * clicks inside any nested panel as "inside", not just the main menu box. */
interface MenuRootRegistry {
  registerRoot: (element: HTMLElement) => () => void
  isInside: (target: Node) => boolean
}
const MenuRootRegistryContext = createContext<MenuRootRegistry | null>(null)

export function ContextActionMenu({
  x,
  y,
  ariaLabel,
  header,
  items,
  onClose,
  className = '',
}: ContextActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x, y })

  const extraRoots = useRef<Set<HTMLElement>>(new Set())
  const registry = useRef<MenuRootRegistry>({
    registerRoot: element => {
      extraRoots.current.add(element)
      return () => { extraRoots.current.delete(element) }
    },
    isInside: target => {
      if (menuRef.current?.contains(target)) return true
      for (const root of extraRoots.current) if (root.contains(target)) return true
      return false
    },
  }).current

  useLayoutEffect(() => {
    if (!menuRef.current) return
    const next = clampMenu(menuRef.current, { x, y })
    setPosition(current => current.x === next.x && current.y === next.y ? current : next)
  }, [x, y])

  useEffect(() => {
    const menu = menuRef.current
    const first = menu?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')
    first?.focus()

    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null
      if (target && registry.isInside(target)) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)') ?? [])]
      if (buttons.length === 0) return
      event.preventDefault()
      const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : event.key === 'ArrowDown'
            ? (currentIndex + 1 + buttons.length) % buttons.length
            : (currentIndex - 1 + buttons.length) % buttons.length
      buttons[nextIndex]?.focus()
    }
    window.addEventListener('pointerdown', closeOnPointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', closeOnPointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, registry])

  if (typeof document === 'undefined') return null

  return createPortal((
    <MenuRootRegistryContext.Provider value={registry}>
      <div
        ref={menuRef}
        className={`rv-show-director-context-menu vz-app-context-menu ${className}`.trim()}
        style={{ left: position.x, top: position.y } as CSSProperties}
        role="menu"
        aria-label={ariaLabel}
        onPointerDown={event => event.stopPropagation()}
      >
        {header && (
          <div className="vz-waveform-context-menu__meta vz-app-context-menu__meta">
            <strong>{header.title}</strong>
            {header.subtitle && <span>{header.subtitle}</span>}
          </div>
        )}
        {header && <span className="rv-show-director-context-menu__divider" role="separator" />}
        <ContextMenuItemsList items={items} onSelect={onClose} />
      </div>
    </MenuRootRegistryContext.Provider>
  ), document.body)
}

/** The item-row renderer, factored out so a submenu's flyout content can
 * nest another list of rows (including further submenus) using the exact
 * same rendering and hover-cascade behavior as the top-level menu. */
export function ContextMenuItemsList({
  items,
  onSelect,
}: {
  items: readonly ContextActionMenuItem[]
  /** Called after a plain (non-submenu) item's onSelect fires — the top-level
   * menu passes its own onClose here so picking a leaf action closes the
   * whole cascade; nested panels with their own dismissal (e.g. a picker
   * that calls a supplied onDone) can omit this. */
  onSelect?: () => void
}) {
  return (
    <>
      {items.map(item => (
        <div key={item.id}>
          {item.dividerBefore && <span className="rv-show-director-context-menu__divider" role="separator" />}
          {item.submenu ? (
            <SubmenuRow item={item} />
          ) : (
            <button
              type="button"
              role="menuitem"
              className={item.danger ? 'rv-show-director-context-menu__danger' : undefined}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                item.onSelect?.()
                onSelect?.()
              }}
            >
              {item.label}
            </button>
          )}
        </div>
      ))}
    </>
  )
}

function SubmenuRow({ item }: { item: ContextActionMenuItem }) {
  const registry = useContext(MenuRootRegistryContext)
  const [open, setOpen] = useState(false)
  const rowRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)

  const openNow = () => {
    window.clearTimeout(closeTimer.current)
    if (!item.disabled) setOpen(true)
  }
  const closeSoon = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), SUBMENU_CLOSE_DELAY_MS)
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  return (
    <div onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <button
        type="button"
        role="menuitem"
        ref={rowRef}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={item.disabled}
        className="vz-app-context-menu__submenu-trigger"
        onClick={openNow}
      >
        <span>{item.label}</span>
        <ArrowRight01Icon size={12} color="currentColor" />
      </button>
      {open && (
        <SubmenuFlyout anchorRef={rowRef} registry={registry} onMouseEnter={openNow} onMouseLeave={closeSoon}>
          {item.submenu}
        </SubmenuFlyout>
      )}
    </div>
  )
}

function SubmenuFlyout({
  anchorRef,
  registry,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  anchorRef: RefObject<HTMLButtonElement>
  registry: MenuRootRegistry | null
  onMouseEnter: () => void
  onMouseLeave: () => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return
    const anchorRect = anchor.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const preferredX = anchorRect.right - 2
    const fitsRight = preferredX + panelRect.width + MENU_MARGIN <= window.innerWidth
    const x = fitsRight ? preferredX : Math.max(MENU_MARGIN, anchorRect.left - panelRect.width + 2)
    const y = Math.round(Math.max(MENU_MARGIN, Math.min(window.innerHeight - panelRect.height - MENU_MARGIN, anchorRect.top - 6)))
    setPosition({ x: Math.round(x), y })
  }, [anchorRef])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel || !registry) return
    return registry.registerRoot(panel)
  }, [registry])

  if (typeof document === 'undefined') return null

  return createPortal((
    <div
      ref={panelRef}
      className="vz-app-context-menu vz-app-context-menu--submenu"
      style={{ left: position?.x ?? -9999, top: position?.y ?? -9999, visibility: position ? 'visible' : 'hidden' } as CSSProperties}
      role="menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={event => event.stopPropagation()}
    >
      {children}
    </div>
  ), document.body)
}
