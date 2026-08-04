import type { ReactElement } from 'react'
import type { ReactEngineId } from './ReactTypes'

// Line-art replacement icons for the Engine dropdown (trigger + menu). Shader
// Pads and Cinematic Worlds keep their catalog glyphs; only the four engines
// below have dedicated artwork. Paths inherit color via currentColor so they
// pick up the surrounding cyan theme instead of being baked-in black.

function SoundDrawingIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.5,24.4516s18.03-28.3092,39-.4319"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M43.5,24.02c-18.2922,43.0749-20.713-43.0106-39,.4319C15.25-10.38,17.1445,36.5921,23.6978,36.6353,31.8565,36.6891,33.0475-10.558,43.5,24.02Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CanvasIcon() {
  return (
    <svg viewBox="0 0 192 192" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M67.63 35.2h56.75v121.6H67.63zM51.41 136.53H39.25V55.47h12.16m88.16 81.06h13.18V55.47h-13.18"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26.08 67.63H20v56.74h6.08m139.84-56.74H172v56.74h-6.08"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LaserDmxIcon() {
  return (
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="currentColor"
        d="M55.25 16.53l28.844 52.876 8.125 38.75-35.314-5.53-38.625-13.97v19.875l39.94 14.44 17.31 16.905-42.78 43.406 52-8.843 18.906 56.782-8.687 102.81-13.47 32.19-11.406-6.97-51.813-64.188v29.75l37.564 46.563L65.97 389.53 18 416.564l49.344 6.406-22 42.467 40.53-18.218 16.69 43.092 8.75-41.812 42.936 15.438-18.406-35.782 63.97 1.313-56-31.314L158 388.062l73.938-19.437 36.812-.156-46.03 72.75 77.25-41.5 33.124 91.874 22.812-83.813 56.22 54.19-13.22-82.564 53.375-2.562-45.936-37.906 81.406-53.594-86.813 4.562-14.187-89.5-39.844 80.25-44.594-64.844-22.062-98.468 84.625-18.72-15.938 26.095 38.188-13.032 10.188 45.75 24.78-36.407 39.438 18.44-14.405-36.532 38.594-10.47-43.564-19 20.406-33.874L422.22 51.47l-29.314-32.282-3.97 39.874-46.186-9.28 24.844 29.124-91.406 20.22-18.5-82.595H238.53l19.407 86.626-13.75 3.063-59.343 2 33-88.064-56.594 59.22L139.03 22l-11.905 65.97-23.47-21.69-27.124-49.75H55.25zM262 121.376l22.938 102.438-2.47 69.843-93.5-16.75 66.532 53.25-46.906 25.25-59.844 15.75-26.063-.25-9.187-34.156 9.813-116.125 15.5-32.875 39.343 33.438-5.062-45.25 58.625 16.812-42.94-41.656 56.126-25.938 17.094-3.78z"
      />
    </svg>
  )
}

function PixGridIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="10" y="26" width="4" height="3" />
        <rect x="7" y="4" width="3" height="3" transform="matrix(6.123234e-17 -1 1 6.123234e-17 3 14)" />
        <rect x="22" y="4" width="3" height="3" transform="matrix(6.123234e-17 -1 1 6.123234e-17 18 29)" />
        <rect x="18" y="26" width="4" height="3" />
        <polygon points="28,17 28,14 25,14 25,11 22,11 22,7 19,7 19,11 13,11 13,7 10,7 10,11 7,11 7,14 4,14 4,17 1,17 1,20 1,26 4,26 4,20 7,20 7,26 10,26 10,23 11,23 21,23 22,23 22,26 25,26 25,20 28,20 28,26 31,26 31,20 31,17 " />
        <rect x="10" y="16" width="3" height="3" />
        <rect x="19" y="16" width="3" height="3" />
      </g>
    </svg>
  )
}

const REACT_ENGINE_ICON_COMPONENTS: Partial<Record<ReactEngineId, () => ReactElement>> = {
  oscilloscope: SoundDrawingIcon,
  canvas: CanvasIcon,
  laserDmx: LaserDmxIcon,
  pixGrid: PixGridIcon,
}

export function getReactEngineIconComponent(engineId: ReactEngineId): (() => ReactElement) | null {
  return REACT_ENGINE_ICON_COMPONENTS[engineId] ?? null
}
