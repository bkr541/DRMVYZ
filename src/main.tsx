import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './styles/analyzer.css'
import './styles/reference.css'
import './styles/vyzualz.css'
import './styles/mediaUploadModal.css'
import './styles/mediaPreviewModal.css'
import './styles/lyricManagerModal.css'
import './styles/lyricManager.css'
import './styles/mediaManager.css'
import './styles/addCueModal.css'
import './styles/appearance.css'
import { bootstrapAppearanceTheme } from './features/appearance/appearanceStore'

bootstrapAppearanceTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
