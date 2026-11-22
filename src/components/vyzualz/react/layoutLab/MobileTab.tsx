import { MobileControllerStudies } from './MobileControllerStudies'
import { MobileStudies } from './MobileStudies'

/** The Mobile tab: the controller-mode studies first, then the three layout options. */
export function MobileTab() {
  return <MobileStudies><MobileControllerStudies /></MobileStudies>
}
