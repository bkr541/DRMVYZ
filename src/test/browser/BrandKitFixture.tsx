import { createRoot } from 'react-dom/client'
import '../../styles.css'
import '../../styles/appearance.css'
import '../../styles/typography.css'
import '../../styles/tabRows.css'
import '../../styles/reactView.css'
import { BrandKitStudies } from '../../components/vyzualz/react/layoutLab/BrandKitStudies'

// The Brand Kit page on its own, with the app's real stylesheets and fonts, for looking at it (the app itself sits behind a sign-in).
document.documentElement.style.overflow = 'auto'; document.body.style.overflow = 'auto'
const rootElement = document.querySelector<HTMLElement>('#root')!
rootElement.style.height = 'auto'; rootElement.style.overflow = 'visible'
createRoot(rootElement).render(<BrandKitStudies />)
