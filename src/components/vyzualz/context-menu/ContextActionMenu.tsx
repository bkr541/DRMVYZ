import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

const MENU_MARGIN = 12

export interface ContextActionMenuItem {
  id: string
  label: string
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
  dividerBefore?: boolean
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
      if (target && menuRef.current?.contains(target)) return
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
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal((
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
      {items.map(item => (
        <div key={item.id}>
          {item.dividerBefore && <span className="rv-show-director-context-menu__divider" role="separator" />}
          <button
            type="button"
            role="menuitem"
            className={item.danger ? 'rv-show-director-context-menu__danger' : undefined}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return
              item.onSelect()
              onClose()
            }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  ), document.body)
}
