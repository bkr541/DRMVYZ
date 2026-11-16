import { AppIcon } from '../../shared/icons/AppIcon'
import { switchView } from './mobileDevice'

/** Remote: a mockup for now. Controlling a desktop from the phone is a later phase. */
export function MobileRemotePage() {
  return <div className="mpm-panel-content mobile-remote" data-mockup="true">
    <div className="mobile-remote-card">
      <AppIcon kind="cast" size={28} />
      <h2>Control your desktop</h2>
      <p>Switch presets and fire pads on your computer from this phone. This screen is a preview; remote control is not available yet.</p>
    </div>
    <ul className="mobile-remote-list" aria-label="Your desktops (preview)">
      <li data-state="online"><span className="mobile-remote-dot" aria-hidden="true" /><div><strong>Studio Mac</strong><small>Online · Cinema 2.0 · Afterhours</small></div><button type="button" disabled>Connect</button></li>
      <li data-state="offline"><span className="mobile-remote-dot" aria-hidden="true" /><div><strong>Laptop</strong><small>Offline · last seen yesterday</small></div><button type="button" disabled>Connect</button></li>
    </ul>
    <button type="button" className="mobile-link-button" onClick={() => switchView('desktop')}>Use desktop version</button>
  </div>
}
