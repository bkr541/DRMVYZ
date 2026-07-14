import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { BeatMarkerMI } from '../../../features/musicIntelligence/types'
import {
  buildWaveformCueRequest,
  formatCueBeatReference,
  type WaveformCueCreateRequest,
} from '../../../features/timeline/waveformCuePoint'
import type { VzCueMarker } from '../../../types/cue'

const CONTEXT_MENU_MARGIN = 12

export interface CuePointContextMenuTarget {
  x: number
  y: number
  authoredTimeSec: number
  cueMarker: VzCueMarker | null
  cueEditable: boolean
}

interface CuePointContextMenuProps extends CuePointContextMenuTarget {
  beatGrid?: readonly BeatMarkerMI[] | null
  onClose: () => void
  onSeek: (timeSec: number) => void
  onCreateCuePoint?: (request: WaveformCueCreateRequest) => void
  onUpdateCuePoint?: (id: string, patch: Partial<Omit<VzCueMarker, 'id'>>) => void
  onDeleteCuePoint?: (id: string) => void
  ariaLabel?: string
}

export function formatCuePointContextTime(timeSec: number): string {
  const totalMs = Math.max(0, Math.round(timeSec * 1000))
  const minutes = Math.floor(totalMs / 60_000)
  const seconds = Math.floor((totalMs % 60_000) / 1000)
  const milliseconds = totalMs % 1000
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

function clampContextMenu(
  element: HTMLElement,
  point: { x: number; y: number },
): { x: number; y: number } {
  if (typeof window === 'undefined') return point
  const rect = element.getBoundingClientRect()
  const maxX = Math.max(CONTEXT_MENU_MARGIN, window.innerWidth - rect.width - CONTEXT_MENU_MARGIN)
  const maxY = Math.max(CONTEXT_MENU_MARGIN, window.innerHeight - rect.height - CONTEXT_MENU_MARGIN)
  return {
    x: Math.round(Math.max(CONTEXT_MENU_MARGIN, Math.min(maxX, point.x))),
    y: Math.round(Math.max(CONTEXT_MENU_MARGIN, Math.min(maxY, point.y))),
  }
}

export function CuePointContextMenu({
  x,
  y,
  authoredTimeSec,
  cueMarker,
  cueEditable,
  beatGrid = null,
  onClose,
  onSeek,
  onCreateCuePoint,
  onUpdateCuePoint,
  onDeleteCuePoint,
  ariaLabel = 'Cue point menu',
}: CuePointContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x, y })
  const request = buildWaveformCueRequest(authoredTimeSec, beatGrid, false)

  useLayoutEffect(() => {
    if (!menuRef.current) return
    const next = clampContextMenu(menuRef.current, { x, y })
    setPosition(current => current.x === next.x && current.y === next.y ? current : next)
  }, [x, y])

  useEffect(() => {
    const closeOnPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('.vz-waveform-context-menu')) return
      onClose()
    }
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', closeOnPointerDown)
    window.addEventListener('keydown', closeOnKeyDown)
    return () => {
      window.removeEventListener('pointerdown', closeOnPointerDown)
      window.removeEventListener('keydown', closeOnKeyDown)
    }
  }, [onClose])

  const createCue = (snapToBeat: boolean) => {
    if (!onCreateCuePoint) return
    onCreateCuePoint(buildWaveformCueRequest(authoredTimeSec, beatGrid, snapToBeat))
    onClose()
  }

  const jumpToCue = () => {
    if (!cueMarker) return
    onSeek(cueMarker.time)
    onClose()
  }

  const updateContextCue = (snapToBeat: boolean) => {
    if (!cueMarker || !cueEditable || !onUpdateCuePoint) return
    const next = buildWaveformCueRequest(authoredTimeSec, beatGrid, snapToBeat)
    onUpdateCuePoint(cueMarker.id, {
      time: next.timeSec,
      authoredTime: next.authoredTimeSec,
      beatIndex: next.beat?.beatIndex,
      barIndex: next.beat?.barIndex,
      beatInBar: next.beat?.beatInBar,
      beatTime: next.beat?.beatTimeSec,
      beatOffsetSec: next.beat?.offsetSec,
      snappedToBeat: next.snappedToBeat,
    })
    onClose()
  }

  const renameContextCue = () => {
    if (!cueMarker || !cueEditable || !onUpdateCuePoint || typeof window === 'undefined') return
    const nextLabel = window.prompt('Cue point name', cueMarker.label)?.trim()
    if (!nextLabel || nextLabel === cueMarker.label) return
    onUpdateCuePoint(cueMarker.id, { label: nextLabel.slice(0, 48) })
    onClose()
  }

  const deleteContextCue = () => {
    if (!cueMarker || !cueEditable || !onDeleteCuePoint) return
    onDeleteCuePoint(cueMarker.id)
    onClose()
  }

  if (typeof document === 'undefined') return null

  return createPortal((
    <div
      ref={menuRef}
      className="rv-show-director-context-menu vz-waveform-context-menu"
      style={{ left: position.x, top: position.y } as CSSProperties}
      role="menu"
      aria-label={ariaLabel}
      onPointerDown={event => event.stopPropagation()}
    >
      <div className="vz-waveform-context-menu__meta">
        <strong>{cueMarker?.label ?? formatCuePointContextTime(authoredTimeSec)}</strong>
        <span>
          {cueMarker
            ? `${formatCuePointContextTime(cueMarker.time)} · ${formatCueBeatReference(request.beat) ?? 'No beat grid available'}`
            : formatCueBeatReference(request.beat) ?? 'No beat grid available'}
        </span>
        {cueMarker && (
          <em>{cueEditable ? 'Editable cue point' : `${cueMarker.source ?? 'Imported'} cue · read only`}</em>
        )}
      </div>
      <span className="rv-show-director-context-menu__divider" role="separator" />
      {cueMarker && (
        <>
          <button type="button" role="menuitem" onClick={jumpToCue}>Jump to Cue</button>
          {cueEditable && onUpdateCuePoint && (
            <>
              <button type="button" role="menuitem" onClick={renameContextCue}>Rename Cue…</button>
              <button type="button" role="menuitem" onClick={() => updateContextCue(false)}>Move Cue Here</button>
              <button type="button" role="menuitem" disabled={!request.beat} onClick={() => updateContextCue(true)}>Snap Cue to Nearest Beat</button>
            </>
          )}
          {cueEditable && onDeleteCuePoint && (
            <button
              type="button"
              role="menuitem"
              className="rv-show-director-context-menu__danger"
              onClick={deleteContextCue}
            >
              Delete Cue Point
            </button>
          )}
          {onCreateCuePoint && <span className="rv-show-director-context-menu__divider" role="separator" />}
        </>
      )}
      {onCreateCuePoint && (
        <>
          <button type="button" role="menuitem" onClick={() => createCue(false)}>
            {cueMarker ? 'Set New Cue Point Here' : 'Set Cue Point Here'}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!request.beat}
            onClick={() => createCue(true)}
          >
            {cueMarker ? 'Set New Cue on Nearest Beat' : 'Set Cue on Nearest Beat'}
          </button>
        </>
      )}
    </div>
  ), document.body)
}
