import { useEffect } from 'react'
import { useDeveloperAccess } from '../../../lib/developerAccess'
import { subscribeDeveloperLogNotices } from '../../../lib/developerLogNotices'
import { getNativeDiagnosticsBridge } from '../../../native/diagnosticsBridge'

/** One subscription for the signed-in application, independent of the active workspace. */
export function DeveloperLogNotices() {
  const allowed = useDeveloperAccess()
  useEffect(() => subscribeDeveloperLogNotices(allowed, getNativeDiagnosticsBridge()), [allowed])
  return null
}
