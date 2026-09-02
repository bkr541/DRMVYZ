import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { DreamVizTextInput } from '../../vyzualz/react/controls/DreamVizTextInput'
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
  group?: string
  style?: CSSProperties
}

export type DropdownPlacement = 'auto' | 'above' | 'below'
export type DropdownSize = 'dense' | 'compact' | 'default' | 'large'

export interface DropdownProps {
  id?: string
  triggerId?: string
  label?: ReactNode
  eyebrow?: ReactNode
  menuLabel?: ReactNode
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  title?: string
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
  searchable?: boolean
  searchValue?: string
  defaultSearchValue?: string
  onSearchChange?: (value: string) => void
  clearSearchOnSelect?: boolean
}

interface MenuPosition {
  left: number
  top: number
  width: number
  maxHeight: number
  placement: 'above' | 'below'
}

interface DropdownOptionRun {
  group: string | null
  startIndex: number
  options: DropdownOption[]
}

function buildOptionRuns(options: readonly DropdownOption[]): DropdownOptionRun[] {
  const runs: DropdownOptionRun[] = []

  options.forEach((option, index) => {
    const group = option.group ?? null
    const current = runs[runs.length - 1]
    if (!current || current.group !== group) {
      runs.push({ group, startIndex: index, options: [option] })
      return
    }
    current.options.push(option)
  })

  return runs
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
  triggerId: requestedTriggerId,
  label,
  eyebrow,
  menuLabel,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  title,
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
  searchable = false,
  searchValue,
  defaultSearchValue = '',
  onSearchChange,
  clearSearchOnSelect = true,
}: DropdownProps) {
  const generatedId = normalizeIdPart(useId())
  const baseId = id ?? `drm-dropdown-${generatedId}`
  const labelId = `${baseId}-label`
  const triggerId = requestedTriggerId ?? `${baseId}-trigger`
  const listboxId = `${baseId}-listbox`
  const menuLabelId = `${baseId}-menu-label`

  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchTriggerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const typeaheadBufferRef = useRef('')
  const typeaheadTimerRef = useRef<number | null>(null)

  const valueIsControlled = value !== undefined
  const openIsControlled = open !== undefined
  const [internalValue, setInternalValue] = useState<string | null>(defaultValue)
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const [internalSearchValue, setInternalSearchValue] = useState(defaultSearchValue)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)

  const selectedValue = valueIsControlled ? value ?? null : internalValue
  const requestedOpen = openIsControlled ? Boolean(open) : internalOpen
  const isOpen = !disabled && requestedOpen
  const searchIsControlled = searchValue !== undefined
  const resolvedSearchValue = searchIsControlled ? searchValue : internalSearchValue
  const selectedOption = useMemo(
    () => options.find(option => option.value === selectedValue) ?? null,
    [options, selectedValue],
  )
  const hasVisibleOptionDescriptions = showDescriptions
    && options.some(option => Boolean(option.description))

  const setOpen = useCallback((nextOpen: boolean) => {
    if (disabled && nextOpen) return
    if (!openIsControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [disabled, onOpenChange, openIsControlled])

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false)
    setActiveIndex(-1)
    if (restoreFocus) {
      if (searchable) searchInputRef.current?.focus()
      else triggerRef.current?.focus()
    }
  }, [searchable, setOpen])

  const openMenu = useCallback((preferredIndex?: number) => {
    if (disabled || options.length === 0) return
    const nextIndex = preferredIndex ?? selectedOrFirstEnabled(options, selectedValue)
    setActiveIndex(nextIndex)
    setOpen(true)
  }, [disabled, options, selectedValue, setOpen])

  const chooseOption = useCallback((option: DropdownOption) => {
    if (disabled || option.disabled) return
    const valueChanged = option.value !== selectedValue
    if (valueChanged) {
      if (!valueIsControlled) setInternalValue(option.value)
      onChange?.(option.value, option)
    }
    if (searchable && clearSearchOnSelect) {
      if (!searchIsControlled) setInternalSearchValue('')
      onSearchChange?.('')
    }
    closeMenu(true)
  }, [clearSearchOnSelect, closeMenu, disabled, onChange, onSearchChange, searchable, searchIsControlled, selectedValue, valueIsControlled])

  const updateMenuPosition = useCallback(() => {
    const trigger = searchable ? searchTriggerRef.current : triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    // Use the trigger's own window rather than the bare global — when this
    // component is portaled into a foreign window (Layout Lab opens in a
    // real popup window via window.open), the global `window` is still the
    // opener's, and its innerWidth/innerHeight would size the menu for the
    // wrong viewport entirely.
    const ownerWindow = trigger.ownerDocument.defaultView
    if (!ownerWindow) return

    const triggerRect = trigger.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()
    const viewportWidth = ownerWindow.innerWidth
    const viewportHeight = ownerWindow.innerHeight
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
  }, [maxMenuHeight, menuWidth, placement, searchable])

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPosition(null)
      return
    }

    const trigger = searchable ? searchTriggerRef.current : triggerRef.current
    const ownerWindow = trigger?.ownerDocument.defaultView
    if (!ownerWindow) return

    updateMenuPosition()
    const handleViewportChange = () => updateMenuPosition()
    // Bound to the trigger's own window, not the bare global — see the
    // ownerWindow note in updateMenuPosition above.
    ownerWindow.addEventListener('resize', handleViewportChange)
    ownerWindow.addEventListener('scroll', handleViewportChange, true)

    const resizeObserver = typeof ownerWindow.ResizeObserver === 'undefined'
      ? null
      : new ownerWindow.ResizeObserver(handleViewportChange)
    if (searchable && searchTriggerRef.current) resizeObserver?.observe(searchTriggerRef.current)
    if (!searchable && triggerRef.current) resizeObserver?.observe(triggerRef.current)
    if (menuRef.current) resizeObserver?.observe(menuRef.current)

    return () => {
      ownerWindow.removeEventListener('resize', handleViewportChange)
      ownerWindow.removeEventListener('scroll', handleViewportChange, true)
      resizeObserver?.disconnect()
    }
  }, [isOpen, options.length, searchable, showDescriptions, updateMenuPosition])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null
      if (!target) return
      if (
        triggerRef.current?.contains(target)
        || searchTriggerRef.current?.contains(target)
        || menuRef.current?.contains(target)
      ) return
      closeMenu(false)
    }

    // Listen on the trigger's own document — a foreign-window portal (see
    // ownerWindow note above) never receives pointer events from a
    // document-level listener bound to the wrong window's document.
    const ownerDocument = (searchable ? searchTriggerRef.current : triggerRef.current)?.ownerDocument ?? document
    ownerDocument.addEventListener('pointerdown', handlePointerDown)
    return () => ownerDocument.removeEventListener('pointerdown', handlePointerDown)
  }, [closeMenu, isOpen, searchable])

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

  const setSearch = useCallback((nextValue: string) => {
    if (!searchIsControlled) setInternalSearchValue(nextValue)
    onSearchChange?.(nextValue)
  }, [onSearchChange, searchIsControlled])

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

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
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

    if (event.key === 'Enter' || (!searchable && event.key === ' ')) {
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
      !searchable
      && event.key.length === 1
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
  const menuClassNames = [
    'drm-dropdown__menu',
    `drm-dropdown__menu--${size}`,
    hasVisibleOptionDescriptions
      ? 'drm-dropdown__menu--described-options'
      : 'drm-dropdown__menu--plain-options',
    menuClassName,
  ]
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
  const optionRuns = useMemo(() => buildOptionRuns(options), [options])
  // Portal into the trigger's own document, not the bare global `document`
  // — when this component renders inside a foreign window (Layout Lab opens
  // in a real popup via window.open), the global reference is still the
  // opener window's document, so the menu would render invisibly there
  // instead of in the window the user is actually looking at.
  const portalDocument = (searchable ? searchTriggerRef.current : triggerRef.current)?.ownerDocument
    ?? (typeof document === 'undefined' ? null : document)

  const renderOption = (option: DropdownOption, index: number) => {
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
        key={`${option.value}-${index}`}
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
          <span className="drm-dropdown__option-label" style={option.style}>{option.label}</span>
          {showDescriptions && option.description && (
            <span className="drm-dropdown__option-description">{option.description}</span>
          )}
        </span>
      </div>
    )
  }

  return (
    <div className={wrapperClassName} data-open={isOpen ? 'true' : 'false'}>
      {label != null && (
        <span id={labelId} className="drm-dropdown__label">
          {label}
          {required && <span className="drm-dropdown__required" aria-hidden="true">*</span>}
        </span>
      )}

      {searchable ? (
        <div ref={searchTriggerRef} className={`${triggerClassNames} drm-dropdown__search-trigger`}>
          {eyebrow != null && <span className="drm-dropdown__eyebrow">{eyebrow}</span>}
          <DreamVizTextInput
            ref={searchInputRef}
            id={triggerId}
            type="text"
            className="drm-dropdown__search-input"
            role="combobox"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy ?? (!ariaLabel && label != null ? labelId : undefined)}
            aria-describedby={ariaDescribedBy}
            aria-controls={listboxId}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-activedescendant={isOpen ? activeOptionId : undefined}
            aria-required={required || undefined}
            aria-invalid={invalid || undefined}
            autoComplete="off"
            disabled={disabled}
            placeholder={placeholder}
            title={title}
            value={resolvedSearchValue}
            onChange={event => {
              setSearch(event.target.value)
              if (!isOpen) setOpen(true)
            }}
            onFocus={() => {
              if (!isOpen && options.length > 0) openMenu()
            }}
            onClick={() => {
              if (!isOpen && options.length > 0) openMenu()
            }}
            onKeyDown={handleKeyDown}
          />
          <svg
            className="drm-dropdown__chevron"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      ) : (
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          className={triggerClassNames}
          role="combobox"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy ?? (!ariaLabel && label != null ? labelId : undefined)}
          aria-describedby={ariaDescribedBy}
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-activedescendant={isOpen ? activeOptionId : undefined}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          title={title}
          onClick={() => {
            if (isOpen) closeMenu(false)
            else openMenu()
          }}
          onKeyDown={handleKeyDown}
        >
          {eyebrow != null && <span className="drm-dropdown__eyebrow">{eyebrow}</span>}
          <span
            className={selectedOption ? 'drm-dropdown__value' : 'drm-dropdown__value drm-dropdown__value--placeholder'}
            style={selectedOption?.style}
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
      )}

      {name && <input type="hidden" name={name} value={selectedValue ?? ''} />}

      {isOpen && portalDocument && createPortal((
        <div
          ref={menuRef}
          id={listboxId}
          className={menuClassNames}
          role="listbox"
          aria-labelledby={menuLabel != null ? menuLabelId : label != null ? labelId : ariaLabelledBy}
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
            ) : optionRuns.map((run, runIndex) => {
              if (run.group == null) {
                return (
                  <Fragment key={`ungrouped-${run.startIndex}`}>
                    {run.options.map((option, offset) => renderOption(option, run.startIndex + offset))}
                  </Fragment>
                )
              }

              const groupLabelId = `${baseId}-group-${runIndex}-label`
              return (
                <div
                  key={`${run.group}-${run.startIndex}`}
                  className="drm-dropdown__group"
                  role="group"
                  aria-labelledby={groupLabelId}
                >
                  <div id={groupLabelId} className="drm-dropdown__group-label">
                    {run.group}
                  </div>
                  {run.options.map((option, offset) => renderOption(option, run.startIndex + offset))}
                </div>
              )
            })}
          </div>
        </div>
      ), portalDocument.body)}
    </div>
  )
}

interface NativeOptionElementProps {
  value?: string | number
  label?: string
  disabled?: boolean
  style?: CSSProperties
  children?: ReactNode
}

interface NativeOptGroupElementProps {
  label?: string
  disabled?: boolean
  children?: ReactNode
}

function dropdownNodeText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(dropdownNodeText).join('')
  if (isValidElement(node)) {
    return dropdownNodeText((node as ReactElement<{ children?: ReactNode }>).props.children)
  }
  return String(node)
}

function dropdownOptionsFromNativeChildren(
  children: ReactNode,
  inheritedGroup?: string,
  inheritedDisabled = false,
): DropdownOption[] {
  const options: DropdownOption[] = []

  Children.forEach(children, child => {
    if (!isValidElement(child)) return

    if (child.type === Fragment) {
      options.push(...dropdownOptionsFromNativeChildren(
        (child as ReactElement<{ children?: ReactNode }>).props.children,
        inheritedGroup,
        inheritedDisabled,
      ))
      return
    }

    if (child.type === 'optgroup') {
      const props = (child as ReactElement<NativeOptGroupElementProps>).props
      options.push(...dropdownOptionsFromNativeChildren(
        props.children,
        props.label ?? inheritedGroup,
        inheritedDisabled || Boolean(props.disabled),
      ))
      return
    }

    if (child.type !== 'option') return
    const props = (child as ReactElement<NativeOptionElementProps>).props
    const label = props.label ?? dropdownNodeText(props.children)
    options.push({
      value: String(props.value ?? label),
      label,
      disabled: inheritedDisabled || Boolean(props.disabled),
      group: inheritedGroup,
      style: props.style,
    })
  })

  return options
}

function normalizeNativeSelectValue(
  value: string | number | readonly string[] | undefined,
): string | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) return value[0] == null ? undefined : String(value[0])
  return String(value)
}

function humanizeDropdownId(id?: string): string | undefined {
  if (!id) return undefined
  const text = id
    .replace(/[-_]+/g, ' ')
    .replace(/\b(select|selector|dropdown|input|field)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return undefined
  return text.replace(/\b\w/g, letter => letter.toUpperCase())
}

function cleanInferredDropdownLabel(value: string | null | undefined): string | undefined {
  const cleaned = value
    ?.replace(/\(optional\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned || cleaned.length > 80) return undefined
  return cleaned
}

function inferDropdownLabelFromDom(triggerId: string, ariaLabelledBy?: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  if (ariaLabelledBy) {
    const labelledText = ariaLabelledBy
      .split(/\s+/)
      .map(id => document.getElementById(id)?.textContent ?? '')
      .join(' ')
    const cleaned = cleanInferredDropdownLabel(labelledText)
    if (cleaned) return cleaned
  }

  const trigger = document.getElementById(triggerId)
  if (!trigger) return undefined
  const root = trigger.closest('.drm-dropdown')
  const associatedLabel = Array.from(document.querySelectorAll<HTMLLabelElement>('label[for]'))
    .find(label => label.htmlFor === triggerId)
  const associatedText = cleanInferredDropdownLabel(associatedLabel?.textContent)
  if (associatedText) return associatedText

  const wrappingLabel = trigger.closest('label')
  if (wrappingLabel) {
    const clone = wrappingLabel.cloneNode(true) as HTMLElement
    clone.querySelector('.drm-dropdown')?.remove()
    const wrappingText = cleanInferredDropdownLabel(clone.textContent)
    if (wrappingText) return wrappingText
  }

  let ancestor = root?.parentElement ?? null
  for (let depth = 0; ancestor && depth < 3; depth += 1, ancestor = ancestor.parentElement) {
    const candidate = Array.from(ancestor.children).find(element => {
      if (element === root || element.contains(root)) return false
      return element.tagName === 'LABEL'
        || element.className.toString().toLocaleLowerCase().includes('label')
    })
    const candidateText = cleanInferredDropdownLabel(candidate?.textContent)
    if (candidateText) return candidateText
  }

  return undefined
}

export interface DropdownSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'multiple' | 'size'
> {
  dropdownSize?: DropdownSize
  menuLabel?: ReactNode
  menuWidth?: 'trigger' | number
  maxMenuHeight?: number
  placement?: DropdownPlacement
  placeholder?: string
  showDescriptions?: boolean
}

/**
 * Migration adapter for native selects. It accepts the existing <option> and
 * <optgroup> children while rendering the shared DRMVYZ Dropdown UI.
 */
export function DropdownSelect({
  children,
  value,
  defaultValue,
  onChange,
  className = '',
  id,
  disabled = false,
  required = false,
  name,
  title,
  dropdownSize = 'dense',
  menuLabel,
  menuWidth = 'trigger',
  maxMenuHeight,
  placement,
  placeholder = 'Select an option…',
  showDescriptions = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: DropdownSelectProps) {
  const generatedId = normalizeIdPart(useId())
  const resolvedId = id ?? `drm-native-dropdown-${generatedId}`
  const options = useMemo(() => dropdownOptionsFromNativeChildren(children), [children])
  const [inferredMenuLabel, setInferredMenuLabel] = useState<string>()
  const normalizedValue = normalizeNativeSelectValue(value)
  const normalizedDefaultValue = normalizeNativeSelectValue(defaultValue)
  const fallbackDefault = normalizedDefaultValue ?? (value === undefined ? options[0]?.value : undefined)
  const explicitMenuLabel = menuLabel ?? ariaLabel
  const conciseTitle = typeof title === 'string' && title.length <= 40 ? title : undefined
  const fallbackMenuLabel = conciseTitle ?? humanizeDropdownId(id)

  useLayoutEffect(() => {
    if (explicitMenuLabel != null) return
    setInferredMenuLabel(inferDropdownLabelFromDom(resolvedId, ariaLabelledBy))
  }, [ariaLabelledBy, explicitMenuLabel, resolvedId])

  const emitNativeChange = useCallback((nextValue: string) => {
    if (!onChange) return
    const target = {
      value: nextValue,
      id: resolvedId,
      name: name ?? '',
      disabled,
    } as HTMLSelectElement
    const event = {
      target,
      currentTarget: target,
      type: 'change',
      bubbles: true,
      cancelable: false,
      defaultPrevented: false,
      eventPhase: 3,
      isTrusted: false,
      nativeEvent: typeof Event === 'undefined' ? undefined : new Event('change'),
      preventDefault: () => undefined,
      isDefaultPrevented: () => false,
      stopPropagation: () => undefined,
      isPropagationStopped: () => false,
      persist: () => undefined,
      timeStamp: Date.now(),
    } as ChangeEvent<HTMLSelectElement>
    onChange(event)
  }, [disabled, name, onChange, resolvedId])

  return (
    <Dropdown
      id={`${resolvedId}-dropdown`}
      triggerId={resolvedId}
      value={normalizedValue}
      defaultValue={fallbackDefault}
      options={options}
      onChange={emitNativeChange}
      disabled={disabled}
      required={required}
      invalid={ariaInvalid === true || ariaInvalid === 'true'}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      ariaLabelledBy={ariaLabelledBy}
      ariaDescribedBy={ariaDescribedBy}
      title={title}
      menuLabel={explicitMenuLabel ?? inferredMenuLabel ?? fallbackMenuLabel}
      menuWidth={menuWidth}
      maxMenuHeight={maxMenuHeight}
      placement={placement}
      size={dropdownSize}
      showDescriptions={showDescriptions}
      name={name}
      className={['drm-dropdown-select', className].filter(Boolean).join(' ')}
      triggerClassName={className}
    />
  )
}
