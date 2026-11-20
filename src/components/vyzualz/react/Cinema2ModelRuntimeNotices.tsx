import { useEffect, useState } from 'react'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'
import { isCinema2UserModelPreparationDiagnostic } from '../cinema2/model/Cinema2UserModelPreviewPatterns'
import { DrawerNotice } from '../shared/DrawerNotice'

type ModelNotice = { code: string; message: string }

/** One stage-owned copy of each live model diagnostic, independent of the selected workspace tabs. */
export function Cinema2ModelRuntimeNotices({ runtime }: { runtime: Cinema2Runtime | null }) {
  const [snapshot, setSnapshot] = useState<{ runtime: Cinema2Runtime; notices: ModelNotice[] } | null>(null)
  useEffect(() => {
    if (!runtime) return
    const update = () => {
      const unique = new Map<string, ModelNotice>()
      for (const module of runtime.getModuleRuntimeSnapshot().modules) for (const diagnostic of module.diagnostics) {
        if (!diagnostic.code.startsWith('CINEMA2_USER_MODEL_') || diagnostic.code === 'CINEMA2_USER_MODEL_LOADING') continue
        unique.set(JSON.stringify([diagnostic.code, diagnostic.message]), { code: diagnostic.code, message: diagnostic.message })
      }
      const notices = [...unique.values()]
      setSnapshot(previous => previous?.runtime === runtime && JSON.stringify(previous.notices) === JSON.stringify(notices) ? previous : { runtime, notices })
    }
    update()
    const timer = setInterval(update, 500)
    return () => clearInterval(timer)
  }, [runtime])
  return <>{snapshot?.runtime === runtime && snapshot?.notices.map(notice => (
    <DrawerNotice key={JSON.stringify([notice.code, notice.message])} tone="warning" role="alert" title={isCinema2UserModelPreparationDiagnostic(notice.code) ? 'Model effect preparation' : 'The model could not be shown'}>
      {notice.message}
    </DrawerNotice>
  ))}</>
}
