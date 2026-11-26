import { useCallback, useRef, useState, type ReactNode } from 'react'
import { AppIcon } from '../../shared/icons/AppIcon'
import { ContextActionMenu, type ContextActionMenuItem } from '../context-menu/ContextActionMenu'
import { Collapsible } from './ReactControlRows'
import { IconChipButton } from './controls/IconChipButton'

/** Presentation only: the owning runtime/parameter adapter supplies allowed actions. */
export function Cinema2ActiveSource({ name, type, preview, status, error, actions = [], children }: {
  name: string; type: string; preview?: ReactNode; status?: string; error?: string | null
  actions?: readonly ContextActionMenuItem[]; children?: ReactNode
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState<{ x: number; y: number } | null>(null)
  const close = useCallback(() => { setOpen(null); trigger.current?.focus() }, [])
  return <Collapsible label="Active Source" icon={<AppIcon kind="layers" size={15} />} onOpenChange={expanded => { if (!expanded) setOpen(null) }}>
    <div className="rv-cinema2-active-source" data-cinema2-active-source>
      <div className="rv-cinema2-active-source-row">
        <span className="rv-cinema2-active-source-preview" aria-hidden="true">{preview ?? <AppIcon kind="layers" size={23} />}</span>
        <div className="rv-cinema2-active-source-copy"><strong title={name}>{name}</strong><span>{type}</span></div>
        {!!actions.length && <IconChipButton ref={trigger} aria-label="Source actions" aria-haspopup="menu" aria-expanded={!!open}
          onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setOpen(current => current ? null : { x: rect.left, y: rect.bottom + 4 }) }}>•••</IconChipButton>}
      </div>
      {status && <div className="rv-ctrl-info" role="status">{status}</div>}
      {error && <div className="rv-ctrl-info" role="alert">{error}</div>}
      {children}
      {open && !!actions.length && <ContextActionMenu {...open} ariaLabel="Active source actions" items={actions} onClose={close} />}
    </div>
  </Collapsible>
}

export function Cinema2SourceThumbnail({ url }: { url?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null)
  return url && failed !== url ? <img src={url} alt="" decoding="async" onError={() => setFailed(url)} /> : <AppIcon kind="layers" size={23} />
}
