import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import './Dropdown.css'

const VIEWPORT_MARGIN = 12
const MENU_GAP = 10
const TYPEAHEAD_RESET_MS = 650
const MIN_AVAILABLE_MENU_HEIGHT = 120

export interface DropdownOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export type DropdownPlacement = 'auto' | 'above' | 'below'
export type DropdownSize = 'compact' | 'default' | 'large'

export interface DropdownProps {
  id?: string
  label?: ReactNode
  menuLabel?: ReactNode
  ariaLabel?: string
  ariaDescribedBy?: string
  value?: string | null
  defaultValue?: string | null
  options: readonly DropdownOption[]
  onChange?: (value: string, option: DropdownOption) => void
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  placeholder?: string
  emptyMessage?: string
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  placement?: DropdownPlacement
  menuWidth?: 'trigger' | number
  maxMenuHeight?: number
  size?: DropdownSize
  showDescriptions?: boolean
  name?: string
  className?: string
  triggerClassName?: string
  menuClassName?: string
}

interface MenuPosition {
  left: number
  top: number
  width: number
  maxHeight: number
  placement: 'above' | 'below'
}

function findFirstEnabled(options: readonly DropdownOption[]): number {
  return options.findIndex(option => !option.disabled)
}

function findLastEnabled(options: readonly DropdownOption[]): number {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index]?.disabled) return index
  }
  return -1
}

function findNextEnabled(
  options: readonly DropdownOption[],
  currentIndex: number,
  direction: 1 | -1,
): number {
  if (options.length === 0) return -1
  if (currentIndex < 0) {
    return direction === 1 ? findFirstEnabled(options) : findLastEnabled(options)
  }

  for (let offset = 1; offset <= options.length; offset += 1) {
    const index = (currentIndex + direction * offset + options.length) % options.length
    if (!options[index]?.disabled) return index
  }

  return -1
}

function selectedOrFirstEnabled(
  options: readonly DropdownOption[],
  value: string | null,
): number {
  const selectedIndex = value == null
    ? -1
    : options.findIndex(option => option.value === value && !option.disabled)
  return selectedIndex >= 0 ? selectedIndex : findFirstEnabled(options)
}

function normalizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '')
}

export function Dropdown({
  id,
  label,
  menuLabel,
  ariaLabel,
  ariaDescribedBy,
  value,
  defaultValue = null,
  options,
  onChange,
  disabled = false,
  required = false,
  invalid = false,
  placeholder = 'Select an option…',
  emptyMessage = 'No options available',
  open,
  defaultOpen = false,
  onOpenChange,
  placement = 'auto',
  menuWidth = 'trigger',
  maxMenuHeight = 420,
  size = 'default',
  showDescriptions = true,
  name,
  className = '',
  triggerClassName = '',
  menuClassName = '',
}: DropdownProps) {
  const generatedId = normalizeIdPart(useId())
  const baseId = id ?? `drm-dropdown-${generatedId}`
  const labelId = `${baseId}-label`
  const triggerId = `${baseId}-trigger`
  const listboxId = `${baseId}-listbox`
  const menuLabelId = `${baseId}-menu-label`

  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const typeaheadBufferRef = useRef('')
  const typeaheadTimerRef = useRef<number | null>(null)

  const valueIsControlled = value !== undefined
  const openIsControlled = open !== undefined
  const [internalValue, setInternalValue] = useState<string | null>(defaultValue)
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)

  const selectedValue = valueIsControlled ? value ?? null : internalValue
  const requestedOpen = openIsControlled ? Boolean(open) : internalOpen
  const isOpen = !disabled && requestedOpen
  const selectedOption = useMemo(
    () => options.find(option => option.value === selectedValue) ?? null,
    [options, selectedValue],
  )

  const setOpen = useCallback((nextOpen: boolean) => {
    if (disabled && nextOpen) return
    if (!openIsControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [disabled, onOpenChange, openIsControlled])

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false)
    setActiveIndex(-1)
    if (restoreFocus) triggerRef.current?.focus()
  }, [setOpen])

  const openMenu = useCallback((preferredIndex?: number) => {
    if (disabled || options.length === 0) return
    const nextIndex = preferredIndex ?? selectedOrFirstEnabled(options, selectedValue)
    setActiveIndex(nextIndex)
    setOpen(true)
  }, [disabled, options, selectedValue, setOpen])

  const chooseOption = useCallback((option: DropdownOption) => {
    if (disabled || option.disabled) return
    if (!valueIsControlled) setInternalValue(option.value)
    onChange?.(option.value, option)
    closeMenu(true)
  }, [closeMenu, disabled, onChange, valueIsControlled])

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu || typeof window === 'undefined') return

    const triggerRect = trigger.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const requestedWidth = menuWidth === 'trigger' ? triggerRect.width : menuWidth
    const width = Math.max(
      0,
      Math.min(requestedWidth, Math.max(0, viewportWidth - VIEWPORT_MARGIN * 2)),
    )
    const availableBelow = Math.max(
      0,
      viewportHeight - triggerRect.bottom - MENU_GAP - VIEWPORT_MARGIN,
    )
    const availableAbove = Math.max(0, triggerRect.top - MENU_GAP - VIEWPORT_MARGIN)
    const measuredHeight = Math.min(menuRect.height || maxMenuHeight, maxMenuHeight)

    let resolvedPlacement: 'above' | 'below'
    if (placement === 'above' || placement === 'below') {
      resolvedPlacement = placement
    } else {
      resolvedPlacement = availableBelow >= measuredHeight || availableBelow >= availableAbove
        ? 'below'
        : 'above'
    }

    const availableHeight = resolvedPlacement === 'below' ? availableBelow : availableAbove
    const maxHeight = Math.max(
      Math.min(MIN_AVAILABLE_MENU_HEIGHT, Math.max(availableBelow, availableAbove, 0)),
      Math.min(maxMenuHeight, availableHeight || maxMenuHeight),
    )
    const renderedHeight = Math.min(menuRect.height || maxHeight, maxHeight)
    const preferredLeft = triggerRect.left
    const left = Math.round(Math.max(
      VIEWPORT_MARGIN,
      Math.min(preferredLeft, viewportWidth - width - VIEWPORT_MARGIN),
    ))
    const top = resolvedPlacement === 'below'
      ? Math.round(Math.min(
        triggerRect.bottom + MENU_GAP,
        viewportHeight - renderedHeight - VIEWPORT_MARGIN,
      ))
      : Math.round(Math.max(
        VIEWPORT_MARGIN,
        triggerRect.top - MENU_GAP - renderedHeight,
      ))

    const nextPosition: MenuPosition = {
      left,
      top,
      width,
      maxHeight,
      placement: resolvedPlacement,
    }

    setMenuPosition(current => {
      if (
        current
        && current.left === nextPosition.left
        && current.top === nextPosition.top
        && current.width === nextPosition.width
        && current.maxHeight === nextPosition.maxHeight
        && current.placement === nextPosition.placement
      ) {
        return current
      }
      return nextPosition
    })
  }, [maxMenuHeight, menuWidth, placement])

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPosition(null)
      return
    }

    updateMenuPosition()
    const handleViewportChange = () => updateMenuPosition()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(handleViewportChange)
    if (triggerRef.current) resizeObserver?.observe(triggerRef.current)
    if (menuRef.current) resizeObserver?.observe(menuRef.current)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
      resizeObserver?.disconnect()
    }
  }, [isOpen, options.length, showDescriptions, updateMenuPosition])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null
      if (!target) return
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      closeMenu(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [closeMenu, isOpen])

  useEffect(() => {
    if (!disabled) return
    closeMenu(false)
  }, [closeMenu, disabled])

  useEffect(() => () => {
    if (typeaheadTimerRef.current != null) {
      window.clearTimeout(typeaheadTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setActiveIndex(current => {
      if (current >= 0 && options[current] && !options[current]?.disabled) return current
      return selectedOrFirstEnabled(options, selectedValue)
    })
  }, [isOpen, options, selectedValue])

  const handleTypeahead = useCallback((key: string) => {
    if (typeaheadTimerRef.current != null) {
      window.clearTimeout(typeaheadTimerRef.current)
    }

    typeaheadBufferRef.current += key.toLocaleLowerCase()
    typeaheadTimerRef.current = window.setTimeout(() => {
      typeaheadBufferRef.current = ''
      typeaheadTimerRef.current = null
    }, TYPEAHEAD_RESET_MS)

    const query = typeaheadBufferRef.current
    const startIndex = activeIndex >= 0 ? activeIndex : -1
    for (let offset = 1; offset <= options.length; offset += 1) {
      const index = (startIndex + offset + options.length) % options.length
      const option = options[index]
      if (!option || option.disabled) continue
      if (option.label.toLocaleLowerCase().startsWith(query)) {
        if (!isOpen) openMenu(index)
        else setActiveIndex(index)
        return
      }
    }
  }, [activeIndex, isOpen, openMenu, options])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isOpen) {
        openMenu()
      } else {
        setActiveIndex(current => findNextEnabled(options, current, 1))
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        openMenu(findLastEnabled(options))
      } else {
        setActiveIndex(current => findNextEnabled(options, current, -1))
      }
      return
    }

    if (event.key === 'Home' && isOpen) {
      event.preventDefault()
      setActiveIndex(findFirstEnabled(options))
      return
    }

    if (event.key === 'End' && isOpen) {
      event.preventDefault()
      setActiveIndex(findLastEnabled(options))
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!isOpen) {
        openMenu()
      } else {
        const option = options[activeIndex]
        if (option) chooseOption(option)
      }
      return
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      event.stopPropagation()
      closeMenu(true)
      return
    }

    if (event.key === 'Tab' && isOpen) {
      closeMenu(false)
      return
    }

    if (
      event.key.length === 1
      && !event.altKey
      && !event.ctrlKey
      && !event.metaKey
    ) {
      handleTypeahead(event.key)
    }
  }

  const activeOptionId = activeIndex >= 0 ? `${baseId}-option-${activeIndex}` : undefined
  const wrapperClassName = [
    'drm-dropdown',
    `drm-dropdown--${size}`,
    disabled ? 'drm-dropdown--disabled' : '',
    invalid ? 'drm-dropdown--invalid' : '',
    isOpen ? 'drm-dropdown--open' : '',
    className,
  ].filter(Boolean).join(' ')

  const triggerClassNames = ['drm-dropdown__trigger', triggerClassName]
    .filter(Boolean)
    .join(' ')
  const menuClassNames = ['drm-dropdown__menu', `drm-dropdown__menu--${size}`, menuClassName]
    .filter(Boolean)
    .join(' ')

  const menuStyle = menuPosition
    ? {
        left: menuPosition.left,
        top: menuPosition.top,
        width: menuPosition.width,
        maxHeight: menuPosition.maxHeight,
        visibility: 'visible',
      }
    : {
        left: 0,
        top: 0,
        width: menuWidth === 'trigger' ? undefined : menuWidth,
        maxHeight: maxMenuHeight,
        visibility: 'hidden',
      }

  return (
    <div className={wrapperClassName} data-open={isOpen ? 'true' : 'false'}>
      {label != null && (
        <span id={labelId} className="drm-dropdown__label">
          {label}
          {required && <span className="drm-dropdown__required" aria-hidden="true">*</span>}
        </span>
      )}

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={triggerClassNames}
        role="combobox"
        aria-label={ariaLabel}
        aria-labelledby={!ariaLabel && label != null ? labelId : undefined}
        aria-describedby={ariaDescribedBy}
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-activedescendant={isOpen ? activeOptionId : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => {
          if (isOpen) closeMenu(false)
          else openMenu()
        }}
        onKeyDown={handleKeyDown}
      >
        <span
          className={selectedOption ? 'drm-dropdown__value' : 'drm-dropdown__value drm-dropdown__value--placeholder'}
        >
          {selectedOption?.label ?? placeholder}
        </span>
        <svg
          className="drm-dropdown__chevron"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {name && <input type="hidden" name={name} value={selectedValue ?? ''} />}

      {isOpen && typeof document !== 'undefined' && createPortal((
        <div
          ref={menuRef}
          id={listboxId}
          className={menuClassNames}
          role="listbox"
          aria-labelledby={menuLabel != null ? menuLabelId : label != null ? labelId : undefined}
          aria-label={menuLabel == null && label == null ? ariaLabel ?? 'Options' : undefined}
          data-placement={menuPosition?.placement ?? 'below'}
          style={menuStyle as CSSProperties}
          onPointerDown={event => event.stopPropagation()}
        >
          {menuLabel != null && (
            <div className="drm-dropdown__menu-header">
              <span id={menuLabelId} className="drm-dropdown__menu-title">{menuLabel}</span>
            </div>
          )}

          <div className="drm-dropdown__options">
            {options.length === 0 ? (
              <div className="drm-dropdown__empty">{emptyMessage}</div>
            ) : options.map((option, index) => {
              const selected = option.value === selectedValue
              const active = index === activeIndex
              const optionClassName = [
                'drm-dropdown__option',
                selected ? 'drm-dropdown__option--selected' : '',
                active ? 'drm-dropdown__option--active' : '',
                option.disabled ? 'drm-dropdown__option--disabled' : '',
                showDescriptions && option.description ? 'drm-dropdown__option--described' : '',
              ].filter(Boolean).join(' ')

              return (
                <div
                  key={option.value}
                  id={`${baseId}-option-${index}`}
                  className={optionClassName}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={option.disabled || undefined}
                  onPointerMove={() => {
                    if (!option.disabled) setActiveIndex(index)
                  }}
                  onPointerDown={event => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                  onClick={() => chooseOption(option)}
                >
                  <span className="drm-dropdown__selection-indicator" aria-hidden="true">
                    {selected && <span className="drm-dropdown__selection-dot" />}
                  </span>
                  <span className="drm-dropdown__option-copy">
                    <span className="drm-dropdown__option-label">{option.label}</span>
                    {showDescriptions && option.description && (
                      <span className="drm-dropdown__option-description">{option.description}</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ), document.body)}
    </div>
  )
}
