import { AuthPage } from './AuthPage'
import './mobileAuthPreview.css'

/**
 * The real sign-in screen for the Mobile Preview's production mockup. It is the actual component, styled by the actual CSS, but inert:
 * submitting is swallowed before the form handlers run, so previewing the screen can never sign anyone in, out, or up.
 */
export function MobileAuthPreviewScreen() {
  return <div className="mobile-auth-preview" onSubmitCapture={event => { event.preventDefault(); event.stopPropagation() }}>
    <AuthPage onAuth={() => {}} />
  </div>
}
