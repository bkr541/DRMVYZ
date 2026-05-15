import { useRef, useState } from 'react'
import { ModuleInstance, ModuleWidth, ModuleHeight } from '../types'

interface Props {
  module: ModuleInstance
  primaryColor: string
  showBorders: boolean
  onWidthChange: (w: ModuleWidth) => void
  onHeightChange: (h: ModuleHeight) => void
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDrop: () => void
  editMode: boolean
  children: React.ReactNode
}

const WIDTHS: ModuleWidth[] = ['sm', 'md', 'lg', 'xl']
const HEIGHTS: ModuleHeight[] = ['compact', 'normal', 'tall']
const W_LABELS: Record<ModuleWidth, string> = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' }
const H_LABELS: Record<ModuleHeight, string> = { compact: 'C', normal: 'N', tall: 'T' }

export function ModuleContainer({
  module, primaryColor, showBorders,
  onWidthChange, onHeightChange, onToggle,
  onMoveUp, onMoveDown,
  onDragStart, onDragOver, onDrop,
  editMode, children,
}: Props) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={`module-container module-w-${module.width} module-h-${module.height} ${showBorders ? 'with-border' : ''} ${dragOver ? 'drag-over' : ''}`}
      style={{ '--mod-color': primaryColor } as React.CSSProperties}
      draggable={editMode}
      onDragStart={() => onDragStart(module.id)}
      onDragOver={e => { e.preventDefault(); setDragOver(true); onDragOver(module.id) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={() => { setDragOver(false); onDrop() }}
    >
      <div className={`module-header ${editMode ? 'edit-mode' : ''}`}>
        {editMode && <span className="drag-handle" title="Drag to reorder">⠿</span>}
        <span className="module-label">{module.label}</span>
        {editMode && (
          <div className="module-controls">
            <div className="size-btns">
              {WIDTHS.map(w => (
                <button
                  key={w}
                  className={`sz-btn ${module.width === w ? 'active' : ''}`}
                  onClick={() => onWidthChange(w)}
                  title={`Width: ${w}`}
                  style={module.width === w ? { color: primaryColor } : undefined}
                >W:{W_LABELS[w]}</button>
              ))}
            </div>
            <div className="size-btns">
              {HEIGHTS.map(h => (
                <button
                  key={h}
                  className={`sz-btn ${module.height === h ? 'active' : ''}`}
                  onClick={() => onHeightChange(h)}
                  title={`Height: ${h}`}
                  style={module.height === h ? { color: primaryColor } : undefined}
                >H:{H_LABELS[h]}</button>
              ))}
            </div>
            <button className="sz-btn" onClick={onMoveUp} title="Move up">↑</button>
            <button className="sz-btn" onClick={onMoveDown} title="Move down">↓</button>
            <button className="sz-btn toggle-btn" onClick={onToggle} title="Disable">×</button>
          </div>
        )}
      </div>
      <div className="module-body">{children}</div>
    </div>
  )
}
