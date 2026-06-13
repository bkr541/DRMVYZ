import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  gridCellToNormalized,
  viewPxToNearestGridCell,
  viewPxToGridTarget,
  viewPxToStageTarget,
  originToViewPx,
  targetToViewPx,
  stageToViewFraction,
  outputRectInView,
} from './laserDmxBeamMatrixCoordinates'
import type {
  LaserDmxMatrixBeam,
  LaserDmxReactionGroup,
  LaserDmxMatrixTarget,
} from './ReactTypes'
import { LASER_DMX_MATRIX_COLUMNS, LASER_DMX_MATRIX_ROWS, LASER_DMX_MATRIX_MAX_BEAMS } from './ReactTypes'

// ── Types ─────────────────────────────────────────────────────────────────────

type EditorMode = 'select' | 'chooseOrigin' | 'chooseTarget'

interface DragState {
  beamId: string
  handle: 'origin' | 'target'
  previewTarget: LaserDmxMatrixTarget | null
  previewOrigin: { column: number; row: number; z: number } | null
}

interface HoverCell { column: number; row: number }

// ── Colour helpers ────────────────────────────────────────────────────────────

function beamColor(
  beam: LaserDmxMatrixBeam,
  groups: LaserDmxReactionGroup[],
  opacity = 1,
): string {
  if (beam.useGroupColor && beam.groupId) {
    const g = groups.find(grp => grp.id === beam.groupId)
    if (g?.colorOverrideEnabled) {
      return `rgba(${g.color.red},${g.color.green},${g.color.blue},${g.color.alpha * opacity})`
    }
  }
  return `rgba(${beam.color.red},${beam.color.green},${beam.color.blue},${beam.color.alpha * opacity})`
}

// ── Main overlay component ───────────────────────────────────────────────────

export function LaserDmxBeamMatrixEditorOverlay() {
  const {
    laserDmxBeamMatrix,
    addLaserDmxMatrixBeam,
    updateLaserDmxMatrixBeam,
    selectLaserDmxMatrixBeam,
    clearLaserDmxMatrixSelection,
    removeSelectedLaserDmxMatrixBeams,
  } = useReactStore(useShallow(s => ({
    laserDmxBeamMatrix:                s.laserDmxBeamMatrix,
    addLaserDmxMatrixBeam:             s.addLaserDmxMatrixBeam,
    updateLaserDmxMatrixBeam:          s.updateLaserDmxMatrixBeam,
    selectLaserDmxMatrixBeam:          s.selectLaserDmxMatrixBeam,
    clearLaserDmxMatrixSelection:      s.clearLaserDmxMatrixSelection,
    removeSelectedLaserDmxMatrixBeams: s.removeSelectedLaserDmxMatrixBeams,
  })))

  const { beams, groups, selectedBeamIds, editor } = laserDmxBeamMatrix
  const { guidesVisible, snapEnabled, overscanAmount } = editor

  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize]           = useState({ w: 0, h: 0 })
  const [editorMode, setEditorMode] = useState<EditorMode>('select')
  const [pendingOrigin, setPendingOrigin] = useState<{ column: number; row: number } | null>(null)
  const [hoverCell, setHoverCell] = useState<HoverCell | null>(null)
  const [drag, setDrag]           = useState<DragState | null>(null)

  // Track overlay dimensions
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const ro = new ResizeObserver(entries => {
      const e = entries[0]
      if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(svg)
    return () => ro.disconnect()
  }, [])

  const { w, h } = size
  const atLimit = beams.length >= LASER_DMX_MATRIX_MAX_BEAMS

  // ── Pointer helpers ───────────────────────────────────────────────────────

  function pointerPosInSvg(e: React.PointerEvent<SVGSVGElement>): { px: number; py: number } {
    const rect = svgRef.current!.getBoundingClientRect()
    return { px: e.clientX - rect.left, py: e.clientY - rect.top }
  }

  // ── Keyboard handling ─────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return

    if (e.key === 'Escape') {
      if (editorMode !== 'select') {
        setEditorMode('select')
        setPendingOrigin(null)
      } else {
        clearLaserDmxMatrixSelection()
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedBeamIds.length > 0 && editorMode === 'select') {
        removeSelectedLaserDmxMatrixBeams()
      }
    }
  }, [editorMode, selectedBeamIds, clearLaserDmxMatrixSelection, removeSelectedLaserDmxMatrixBeams])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ── SVG pointer events ────────────────────────────────────────────────────

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (w === 0 || h === 0) return
    const { px, py } = pointerPosInSvg(e)
    const cell = viewPxToNearestGridCell(px, py, w, h, overscanAmount)
    setHoverCell(cell)

    if (drag && e.buttons & 1) {
      if (drag.handle === 'origin') {
        const newOrigin = snapEnabled
          ? viewPxToNearestGridCell(px, py, w, h, overscanAmount)
          : viewPxToNearestGridCell(px, py, w, h, overscanAmount)
        setDrag(d => d ? { ...d, previewOrigin: { ...newOrigin, z: 0 } } : null)
      } else {
        const beam = beams.find(b => b.id === drag.beamId)
        if (!beam) return
        const newTarget = beam.target.kind === 'stage'
          ? viewPxToStageTarget(px, py, w, h, overscanAmount, beam.target.z)
          : viewPxToGridTarget(px, py, w, h, overscanAmount, beam.target.z)
        setDrag(d => d ? { ...d, previewTarget: newTarget } : null)
      }
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag || !(e.buttons === 0)) return
    const { px, py } = pointerPosInSvg(e)
    const beam = beams.find(b => b.id === drag.beamId)
    if (beam) {
      if (drag.handle === 'origin') {
        const nc = viewPxToNearestGridCell(px, py, w, h, overscanAmount)
        updateLaserDmxMatrixBeam(drag.beamId, { origin: { ...beam.origin, column: nc.column, row: nc.row } })
      } else {
        const nt = beam.target.kind === 'stage'
          ? viewPxToStageTarget(px, py, w, h, overscanAmount, beam.target.z)
          : viewPxToGridTarget(px, py, w, h, overscanAmount, beam.target.z)
        updateLaserDmxMatrixBeam(drag.beamId, { target: nt })
      }
    }
    setDrag(null)
  }

  function onPointerLeave() {
    setHoverCell(null)
  }

  // ── Click handling ─────────────────────────────────────────────────────────

  function onSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (drag) return
    if (w === 0 || h === 0) return
    const { px, py } = { px: e.clientX - svgRef.current!.getBoundingClientRect().left, py: e.clientY - svgRef.current!.getBoundingClientRect().top }

    if (editorMode === 'chooseOrigin') {
      if (atLimit) return
      const cell = viewPxToNearestGridCell(px, py, w, h, overscanAmount)
      setPendingOrigin(cell)
      setEditorMode('chooseTarget')
      return
    }

    if (editorMode === 'chooseTarget') {
      if (!pendingOrigin || atLimit) {
        setEditorMode('select')
        setPendingOrigin(null)
        return
      }
      const target = viewPxToGridTarget(px, py, w, h, overscanAmount)
      addLaserDmxMatrixBeam({
        origin: { column: pendingOrigin.column, row: pendingOrigin.row, z: 0 },
        target,
      })
      setEditorMode('select')
      setPendingOrigin(null)
      return
    }

    // select mode — click empty space clears selection
    clearLaserDmxMatrixSelection()
  }

  function onBeamClick(e: React.MouseEvent, beamId: string) {
    e.stopPropagation()
    if (editorMode !== 'select') return
    selectLaserDmxMatrixBeam(beamId, e.shiftKey || e.metaKey || e.ctrlKey)
  }

  function onHandlePointerDown(e: React.PointerEvent, beamId: string, handle: 'origin' | 'target') {
    e.stopPropagation()
    if (editorMode !== 'select') return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ beamId, handle, previewTarget: null, previewOrigin: null })
  }

  // ── Coordinate computations ───────────────────────────────────────────────

  const outputRect = useMemo(() => {
    if (w === 0 || h === 0) return null
    const r = outputRectInView(overscanAmount)
    return {
      x: r.left * w,
      y: r.top  * h,
      width:  (r.right  - r.left) * w,
      height: (r.bottom - r.top)  * h,
    }
  }, [w, h, overscanAmount])

  // Grid guide lines
  const guideLines = useMemo(() => {
    if (!guidesVisible || w === 0 || h === 0) return []
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
    for (let col = 1; col <= LASER_DMX_MATRIX_COLUMNS; col++) {
      const { x } = gridCellToNormalized(col, 1)
      const { fx } = stageToViewFraction(x + 0.5 / LASER_DMX_MATRIX_COLUMNS, 0, overscanAmount)
      const lineX = fx * w
      lines.push({ x1: lineX, y1: 0, x2: lineX, y2: h })
    }
    for (let row = 1; row <= LASER_DMX_MATRIX_ROWS; row++) {
      const { y } = gridCellToNormalized(1, row)
      const { fy } = stageToViewFraction(0, y + 0.5 / LASER_DMX_MATRIX_ROWS, overscanAmount)
      const lineY = fy * h
      lines.push({ x1: 0, y1: lineY, x2: w, y2: lineY })
    }
    return lines
  }, [guidesVisible, w, h, overscanAmount])

  // ── Computed beam positions (merge drag preview) ──────────────────────────

  const beamPositions = useMemo(() => {
    if (w === 0 || h === 0) return []
    return beams.map(b => {
      const isBeingDragged = drag?.beamId === b.id

      let originCol = b.origin.column
      let originRow = b.origin.row
      if (isBeingDragged && drag.handle === 'origin' && drag.previewOrigin) {
        originCol = drag.previewOrigin.column
        originRow = drag.previewOrigin.row
      }

      const effectiveTarget: LaserDmxMatrixTarget =
        isBeingDragged && drag.handle === 'target' && drag.previewTarget
          ? drag.previewTarget
          : b.target

      const { px: ox, py: oy } = originToViewPx(originCol, originRow, w, h, overscanAmount)
      const { px: tx, py: ty } = targetToViewPx(effectiveTarget, w, h, overscanAmount)
      const selected = selectedBeamIds.includes(b.id)
      const color = beamColor(b, groups)
      return { b, ox, oy, tx, ty, selected, color }
    })
  }, [beams, groups, selectedBeamIds, drag, w, h, overscanAmount])

  // ── Hover cell display position ───────────────────────────────────────────

  const hoverPos = useMemo(() => {
    if (!hoverCell || w === 0 || h === 0) return null
    const { px, py } = originToViewPx(hoverCell.column, hoverCell.row, w, h, overscanAmount)
    return { px, py }
  }, [hoverCell, w, h, overscanAmount])

  // ── Instruction text ──────────────────────────────────────────────────────

  let instructionText: string | null = null
  if (editorMode === 'chooseOrigin') {
    instructionText = atLimit
      ? `Beam limit (${LASER_DMX_MATRIX_MAX_BEAMS}) reached — delete beams first`
      : 'Click a grid cell to place the beam origin   [Esc = cancel]'
  } else if (editorMode === 'chooseTarget') {
    instructionText = 'Click a grid cell to place the beam target   [Esc = cancel]'
  }

  const HANDLE_R = 6
  const BEAM_STROKE = 1.5

  return (
    <div
      className="rv-bm-editor-overlay"
      data-mode={editorMode}
      role="region"
      aria-label="Beam Matrix editor overlay"
    >
      {/* Creation toolbar */}
      <div className="rv-bm-editor-toolbar">
        {editorMode === 'select' ? (
          <button
            type="button"
            className="rv-bm-editor-btn"
            disabled={atLimit}
            title={atLimit ? `Beam limit reached` : 'Add a beam — click origin then target in the grid'}
            aria-label="Add beam"
            onClick={() => setEditorMode('chooseOrigin')}
          >
            + Add Beam
          </button>
        ) : (
          <button
            type="button"
            className="rv-bm-editor-btn rv-bm-editor-btn--cancel"
            aria-label="Cancel beam creation"
            onClick={() => { setEditorMode('select'); setPendingOrigin(null) }}
          >
            Cancel
          </button>
        )}
        {instructionText && (
          <span className="rv-bm-editor-instruction">{instructionText}</span>
        )}
        <span className="rv-bm-editor-count">{beams.length} / {LASER_DMX_MATRIX_MAX_BEAMS}</span>
      </div>

      {/* SVG interaction layer */}
      <svg
        ref={svgRef}
        className="rv-bm-editor-svg"
        style={{ cursor: editorMode === 'select' ? 'default' : 'crosshair' }}
        onClick={onSvgClick}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        aria-hidden="true"
      >
        {/* Output boundary */}
        {outputRect && overscanAmount > 0 && (
          <rect
            className="rv-bm-editor-output-rect"
            x={outputRect.x}
            y={outputRect.y}
            width={outputRect.width}
            height={outputRect.height}
            fill="none"
            stroke="rgba(74,199,219,0.2)"
            strokeWidth={1}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        )}

        {/* Guide lines */}
        <g className="rv-bm-guides" pointerEvents="none">
          {guideLines.map((l, i) => (
            <line
              key={i}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="rgba(74,199,219,0.07)"
              strokeWidth={0.5}
            />
          ))}
        </g>

        {/* Hover cell indicator */}
        {hoverPos && editorMode !== 'select' && (
          <circle
            cx={hoverPos.px}
            cy={hoverPos.py}
            r={9}
            fill="rgba(74,199,219,0.25)"
            stroke="rgba(74,199,219,0.7)"
            strokeWidth={1}
            pointerEvents="none"
          />
        )}

        {/* Pending origin during chooseTarget */}
        {pendingOrigin && w > 0 && (
          (() => {
            const { px, py } = originToViewPx(pendingOrigin.column, pendingOrigin.row, w, h, overscanAmount)
            return (
              <circle
                cx={px} cy={py} r={HANDLE_R + 2}
                fill="rgba(74,199,219,0.5)"
                stroke="#4ac7db"
                strokeWidth={1.5}
                pointerEvents="none"
              />
            )
          })()
        )}

        {/* Beams */}
        {beamPositions.map(({ b, ox, oy, tx, ty, selected, color }) => (
          <g key={b.id}>
            {/* Beam line (wider hit area) */}
            <line
              x1={ox} y1={oy} x2={tx} y2={ty}
              stroke="transparent"
              strokeWidth={12}
              onClick={e => onBeamClick(e, b.id)}
              style={{ cursor: editorMode === 'select' ? 'pointer' : 'inherit' }}
            />
            <line
              x1={ox} y1={oy} x2={tx} y2={ty}
              stroke={selected ? '#ffffff' : color}
              strokeWidth={selected ? BEAM_STROKE + 1 : BEAM_STROKE}
              opacity={b.enabled ? 1 : 0.3}
              pointerEvents="none"
            />

            {/* Origin handle */}
            <circle
              cx={ox} cy={oy} r={HANDLE_R}
              fill={selected ? '#4ac7db' : color}
              stroke={selected ? '#ffffff' : 'rgba(6,13,16,0.6)'}
              strokeWidth={1.5}
              opacity={b.enabled ? 1 : 0.3}
              style={{ cursor: selected ? 'grab' : 'pointer' }}
              onClick={e => onBeamClick(e, b.id)}
              onPointerDown={e => selected && onHandlePointerDown(e, b.id, 'origin')}
            />

            {/* Target handle */}
            <circle
              cx={tx} cy={ty} r={HANDLE_R - 1}
              fill="transparent"
              stroke={selected ? '#4ac7db' : color}
              strokeWidth={2}
              opacity={b.enabled ? 1 : 0.3}
              style={{ cursor: selected ? 'grab' : 'pointer' }}
              onClick={e => onBeamClick(e, b.id)}
              onPointerDown={e => selected && onHandlePointerDown(e, b.id, 'target')}
            />
          </g>
        ))}

        {/* Selection highlight rings */}
        {beamPositions.filter(bp => bp.selected).map(({ b, ox, oy }) => (
          <circle
            key={`sel-${b.id}`}
            cx={ox} cy={oy} r={HANDLE_R + 4}
            fill="none"
            stroke="rgba(74,199,219,0.4)"
            strokeWidth={1}
            pointerEvents="none"
          />
        ))}
      </svg>
    </div>
  )
}
