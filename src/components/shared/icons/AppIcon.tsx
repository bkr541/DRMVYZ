import type { SVGProps } from 'react'
import './appIcon.css'

/** Original 32px artwork: 1.5px round strokes, subdued structural lines and cyan functional details. */
const DRAWINGS = {
  brand: ['M8 25q-7-1-5-8 1-4 6-4 0-9 9-9 6 0 8 8 7 0 6 7 0 6-7 6Z', 'M16 10q1 5 6 6-5 1-6 6-1-5-6-6 5-1 6-6Z'],
  rekordbox: ['M16 2 29 9v14l-13 7L3 23V9Z', 'M9 22V10h8a4 4 0 0 1 0 8H9M17 18l7 6'],
  navReact: ['M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26M16 8a8 8 0 1 0 0 16 8 8 0 1 0 0-16M16 14a2 2 0 1 0 0 4 2 2 0 1 0 0-4', 'M16 3v6M23 12l2 1M24 20l-2 1'],
  navPreset: ['M4 17v11h18M7 11v11h18M11 4h18v12H11Z', 'M15 8h10M18 6v4M15 12h6'],
  navShow: ['M4 20 16 26l12-6M4 25l12 6 12-6M4 4h24M8 5v5h5V5M20 5v5h5V5', 'M8 13 5 20M12 13l4 7M20 13l-3 7M24 13l3 7'],
  navLyrics: ['M3 4h26v19H3ZM7 8h18M7 12h12M7 27h3M15 27h3M23 27h3', 'M7 17h18M7 20h12'],
  navMedia: ['M3 15v14h19M7 10v14h19M11 4h18v14H11Z', 'M17 8l6 3-6 3Z'],
  play: ['M8 5 27 16 8 27Z', 'M13 11 22 16 13 21Z'],
  pause: ['M8 5h5v22H8ZM20 5h5v22h-5Z', 'M10.5 10v12M22.5 10v12'],
  previous: ['M6 6v20M26 6 11 16l15 10Z', 'M6 10v12'],
  next: ['M26 6v20M6 6l15 10L6 26Z', 'M26 10v12'],
  volume: ['M5 12h6l7-6v20l-7-6H5Z', 'M22 11q5 5 0 10M25 7q9 9 0 18'],
  plus: ['M5 11V6h5M22 6h5v5M27 22v5h-5M10 27H5v-5', 'M16 10v12M10 16h12'],
  minus: ['M5 11V6h5M22 6h5v5M27 22v5h-5M10 27H5v-5', 'M10 16h12'],
  close: ['M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26', 'M11 11l10 10M21 11 11 21'],
  delete: ['M7 10h18l-1.5 17h-15ZM5 7h22M12 7V4h8v3', 'M13 13v10M19 13v10'],
  edit: ['M5 25v-6L21 3l7 7-16 16-7 1ZM18 6l7 7', 'M8 21l3 3M17 28h11'],
  open: ['M18 4h10v10M28 4 14 18', 'M13 6H5v22h22v-9'],
  copy: ['M5 22V4h17M10 9h17v19H10Z', 'M15 15h7M15 20h7'],
  save: ['M5 4h19l4 4v20H5ZM10 4v9h13V4M10 28V18h13v10', 'M18 6v4M14 22h5'],
  saveActive: ['M5 4h18l4 4v20H5ZM10 4v9h12V4M10 28V18h12v10', 'M23 15l2 2 4-5M14 22h4'],
  folder: ['M4 9h10l3 3h11v15H4ZM4 9V5h10l3 4h9v3', 'M9 18h13M9 22h8'],
  folderAdd: ['M4 9h10l3 3h11v15H4ZM4 9V5h10l3 4h9v3', 'M16 16v8M12 20h8'],
  file: ['M7 3h12l7 7v19H7ZM19 3v8h7', 'M12 17h9M12 22h6'],
  fileAdd: ['M7 3h12l7 7v19H7ZM19 3v8h7', 'M16 15v10M11 20h10'],
  fileImport: ['M7 3h12l7 7v19H7ZM19 3v8h7', 'M3 19h15M14 15l4 4-4 4'],
  image: ['M4 7h24v20H4ZM4 22l8-8 6 7 4-4 6 6', 'M21 11a2 2 0 1 0 0 4 2 2 0 1 0 0-4'],
  imageAdd: ['M4 8h17v19H4ZM4 22l7-7 9 10', 'M25 3v10M20 8h10'],
  search: ['M14 4a10 10 0 1 0 0 20 10 10 0 1 0 0-20', 'M21 21l8 8M10 8q4-2 7 0'],
  grid: ['M4 5h10v10H4ZM19 5h10v10H19ZM4 20h10v10H4Z', 'M19 20h10v10H19ZM22 23h4v4h-4Z'],
  list: ['M11 8h17M11 16h12M11 24h17', 'M5 8h1M5 16h1M5 24h1'],
  layers: ['M4 11 16 5l12 6-12 6ZM4 17l12 6 12-6', 'M4 23l12 6 12-6'],
  star: ['M16 3l4 8 9 2-6 6 1 10-8-5-8 5 1-10-6-6 9-2Z', 'M16 9l2 5 5 1'],
  starOff: ['M16 3l4 8 9 2-6 6 1 10-8-5-8 5 1-10-6-6 9-2Z', 'M4 4l24 24'],
  eye: ['M3 16Q16-2 29 16 16 34 3 16Z', 'M16 11a5 5 0 1 0 0 10 5 5 0 1 0 0-10'],
  eyeOff: ['M3 16Q16-2 29 16 16 34 3 16Z', 'M4 4l24 24M13 13l6 6'],
  info: ['M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26', 'M16 14v9M16 9v.5'],
  warning: ['M16 4 30 28H2Z', 'M16 12v7M16 23v1'],
  check: ['M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26', 'M9 16l5 5 10-11'],
  off: ['M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26', 'M12 16h8'],
  loading: ['M16 3a13 13 0 0 0 0 26', 'M16 3a13 13 0 0 1 13 13M25 5l3 4M29 20l-2 5'],
  bell: ['M7 22V13a9 9 0 0 1 18 0v9l3 3H4ZM13 28h6', 'M16 3V1M11 14q0-5 5-5'],
  settings: ['M12 4h8l1 4 4 1 3 6-3 3 1 5-6 4-4-2-4 2-6-4 1-5-3-3 3-6 4-1Z', 'M16 11a5 5 0 1 0 0 10 5 5 0 1 0 0-10'],
  sliders: ['M5 8h22M5 16h22M5 24h22', 'M11 5v6M22 13v6M14 21v6'],
  music: ['M12 23V8l15-4v16M12 12l15-4', 'M8 21a4 3 0 1 0 0 6 4 3 0 1 0 0-6M23 18a4 3 0 1 0 0 6 4 3 0 1 0 0-6'],
  mic: ['M11 6a5 5 0 0 1 10 0v11a5 5 0 0 1-10 0ZM6 15v2a10 10 0 0 0 20 0v-2M16 27v4M11 31h10', 'M14 7h4M14 11h4'],
  user: ['M16 4a6 6 0 1 0 0 12 6 6 0 1 0 0-12M5 29v-3a11 8 0 0 1 22 0v3', 'M11 23q5-4 10 0'],
  mail: ['M4 7h24v20H4ZM4 8l12 10L28 8', 'M4 27l8-9M28 27l-8-9'],
  lock: ['M8 14h16v15H8ZM11 14V8a5 5 0 0 1 10 0v6', 'M16 20v4'],
  unlock: ['M8 14h16v15H8ZM11 14V8a5 5 0 0 1 10 0', 'M16 20v4'],
  download: ['M5 20v8h22v-8', 'M16 3v18M10 15l6 6 6-6'],
  upload: ['M5 20v8h22v-8', 'M16 22V4M10 10l6-6 6 6'],
  wand: ['M5 26 21 10l5 5L10 31ZM18 13l5 5', 'M8 3v6M5 6h6M25 2v5M22.5 4.5h5M27 23v5M24.5 25.5h5'],
  text: ['M5 6h22M5 6v5M27 6v5M16 6v22M11 28h10', 'M22 18h7M25.5 15v14'],
  lyrics: ['M5 6h22M5 12h15M5 18h22M5 24h11', 'M22 22v7M19 25.5h6'],
  more: ['M7 16a1 1 0 1 0 0 .1M16 16a1 1 0 1 0 0 .1', 'M25 16a1 1 0 1 0 0 .1'],
  moreVertical: ['M16 7a1 1 0 1 0 .1 0M16 16a1 1 0 1 0 .1 0', 'M16 25a1 1 0 1 0 .1 0'],
  crop: ['M8 3v21h21M3 8h21v21', 'M13 13h6v6h-6'],
  rotateLeft: ['M6 12a11 11 0 1 1 0 11M6 12V5M6 12h7', 'M13 13h8v8h-8Z'],
  rotateRight: ['M26 12a11 11 0 1 0 0 11M26 12V5M26 12h-7', 'M11 13h8v8h-8Z'],
  left: ['M28 16H4', 'M13 7l-9 9 9 9'],
  right: ['M4 16h24', 'M19 7l9 9-9 9'],
  up: ['M16 28V4', 'M7 13l9-9 9 9'],
  down: ['M16 4v24', 'M7 19l9 9 9-9'],
  chevronDown: ['M5 8h22', 'M7 15l9 9 9-9'],
  chevronRight: ['M8 5v22', 'M15 7l9 9-9 9'],
  chevronUp: ['M5 25h22', 'M7 18l9-9 9 9'],
  undo: ['M7 11h11a10 10 0 0 1 0 20', 'M13 4l-7 7 7 7'],
  redo: ['M25 11H14a10 10 0 0 0 0 20', 'M19 4l7 7-7 7'],
  split: ['M16 3v26M5 8h7v16H5M27 8h-7v16h7', 'M3 16h9M20 16h9'],
  scissors: ['M9 18a4 4 0 1 0 0 8 4 4 0 1 0 0-8M23 18a4 4 0 1 0 0 8 4 4 0 1 0 0-8', 'M11 19 25 3M21 19 7 3'],
  alignStart: ['M5 4v24M11 9h17M11 16h12M11 23h17', 'M5 16h9M11 13l3 3-3 3'],
  alignEnd: ['M27 4v24M4 9h17M9 16h12M4 23h17', 'M27 16h-9M21 13l-3 3 3 3'],
  move: ['M16 3v26M3 16h26', 'M12 7l4-4 4 4M12 25l4 4 4-4M7 12l-4 4 4 4M25 12l4 4-4 4'],
  center: ['M16 3v26M3 16h7M22 16h7', 'M12 12h8v8h-8Z'],
  expand: ['M4 11V4h7M21 4h7v7M28 21v7h-7M11 28H4v-7', 'M10 10l-6-6M22 10l6-6M10 22l-6 6M22 22l6 6'],
  collapse: ['M4 4l8 8M28 4l-8 8M4 28l8-8M28 28l-8-8', 'M5 12h7V5M20 5v7h7M5 20h7v7M20 27v-7h7'],
  monitor: ['M4 5h24v18H4ZM16 23v6M10 29h12', 'M8 10h16M8 14h10'],
  cast: ['M4 12V5h24v19H17M4 18a10 10 0 0 1 10 10', 'M4 23a5 5 0 0 1 5 5M4 28h.1'],
  window: ['M4 6h24v21H4ZM4 12h24', 'M8 9h.1M12 9h.1M9 17h14'],
  borderless: ['M4 11V5h6M22 5h6v6M28 21v6h-6M10 27H4v-6', 'M9 11h14v10H9Z'],
  ratio16x9: ['M3 8h26v16H3Z', 'M7 14v-2h5M25 18v2h-5'],
  ratio16x10: ['M3 7h26v18H3Z', 'M7 13v-2h5M25 19v2h-5'],
  ratio4x3: ['M4 7h24v18H4Z', 'M8 13v-2h5M24 19v2h-5'],
  ratio3x2: ['M4 8h24v16H4Z', 'M8 14v-2h5M24 18v2h-5'],
  ratio1x1: ['M5 5h22v22H5Z', 'M9 11V9h5M23 21v2h-5'],
  ratio9x16: ['M9 3h14v26H9Z', 'M12 10V7h4M20 22v3h-4'],
  devices: ['M6 4h19v16H6ZM12 24h8M16 20v4M22 15h8v14h-8Z', 'M9 8h13M25 25h2'],
  people: ['M11 5a4 4 0 1 0 0 8 4 4 0 1 0 0-8M3 27v-4a8 8 0 0 1 16 0v4', 'M23 8a3 3 0 1 0 0 6 3 3 0 1 0 0-6M23 19a6 6 0 0 1 6 6v2'],
  power: ['M9 6a12 12 0 1 0 14 0', 'M16 2v13'],
  blackout: ['M4 6h24v20H4Z', 'M5 27 27 5M8 10h8'],
  record: ['M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26', 'M16 10a6 6 0 1 0 0 12 6 6 0 1 0 0-12'],
  stop: ['M4 4h24v24H4Z', 'M10 10h12v12H10Z'],
  camera: ['M4 10h6l3-5h8l3 5h5v18H4Z', 'M16 13a6 6 0 1 0 0 12 6 6 0 1 0 0-12'],
  cpu: ['M7 7h18v18H7ZM3 10h4M3 16h4M3 22h4M25 10h4M25 16h4M25 22h4M10 3v4M16 3v4M22 3v4M10 25v4M16 25v4M22 25v4', 'M12 12h8v8h-8Z'],
  waveform: ['M3 16h4M25 16h4M8 27h16', 'M8 16l3-9 5 18 5-18 3 9'],
  bars: ['M4 28h24M7 16v8M13 10v14M19 5v19M25 13v11', 'M7 20v4M13 18v6M19 15v9M25 20v4'],
  rhythm: ['M4 26h24M7 23l5-18h8l5 18M10 10h12', 'M16 23 25 8M13 23h6'],
  energy: ['M6 28h20M5 7h5M23 7h4', 'M18 3 8 18h8l-2 11 11-16h-8Z'],
  tree: ['M6 4v23M6 10h9M6 23h9M20 6h8v8h-8', 'M20 19h8v8h-8M15 10h5M15 23h5'],
  timeline: ['M4 6h24v21H4ZM4 12h24M10 3v6M22 3v6', 'M9 18h5M18 18h5M9 23h8'],
  tag: ['M3 6h13l13 13-10 10L3 13Z', 'M9 10h.1M15 17l5 5'],
  playlist: ['M5 6h22M5 13h17M5 20h10M5 27h10', 'M23 18v11M19 24l4 5 4-5'],
  cue: ['M9 29V4l17 7-17 7', 'M4 27h24M13 9l6 2-6 2'],
  sync: ['M6 12a11 11 0 0 1 19-4M26 20A11 11 0 0 1 7 24', 'M25 3v6h-6M7 29v-6h6'],
  tap: ['M8 25h16M5 29h22M9 21l-2-7a2 2 0 0 1 4-1l1 3V5a2 2 0 0 1 4 0v10l3-3 6 6v7', 'M20 3v4M24 6l3-2'],
  font: ['M5 27 14 5h4l9 22M9 18h14', 'M3 28h8M21 28h8'],
  shader: ['M16 3 29 10v13l-13 7L3 23V10ZM3 10l13 7 13-7M16 17v13', 'M10 13l6-3 6 3M16 4v6'],
  cinema: ['M4 8 16 2l12 6v16l-12 6-12-6ZM4 8l12 7 12-7M16 15v15', 'M12 10l5-3 5 3-5 3Z'],
  canvas: ['M4 12h19v17H4ZM8 7h19v17M12 3h18v17', 'M10 24l4-6 5 6M24 7h2'],
  pixGrid: ['M4 5h24v22H4ZM4 12h24M4 20h24M12 5v22M20 5v22', 'M12 12h8v8h-8Z'],
  headliner: ['M5 27h22M8 23v-4a8 6 0 0 1 16 0v4M16 4a5 5 0 1 0 0 10 5 5 0 1 0 0-10', 'M6 12v5M26 12v5M5 9a11 11 0 0 1 22 0'],
  scope: ['M4 6h24v20H4ZM10 30h12M16 26v4', 'M6 17h4l3-7 5 12 3-8 2 3h3'],
  shape: ['M16 3 28 10v13l-12 7L4 23V10Z', 'M16 11a5 5 0 1 0 0 10 5 5 0 1 0 0-10'],
  svg: ['M7 3h12l7 7v19H7ZM19 3v7h7', 'M10 23q3-12 7-5t7-4'],
  orbit: ['M16 10a6 6 0 1 0 0 12 6 6 0 1 0 0-12M3 20Q3 9 21 8t8 7Q29 25 11 25T3 20Z', 'M20 5h.1M7 25h.1'],
  mirror: ['M4 5h10v23H4ZM19 5h10v23H19', 'M14 9l5 3M14 16l5 3M14 23l5 3'],
  constellation: ['M6 21 14 6l13 11-7 11Z', 'M6 19a2 2 0 1 0 0 4 2 2 0 1 0 0-4M14 4a2 2 0 1 0 0 4 2 2 0 1 0 0-4M27 15a2 2 0 1 0 0 4 2 2 0 1 0 0-4M20 26a2 2 0 1 0 0 4 2 2 0 1 0 0-4'],
  corridor: ['M3 4h26v25H3ZM8 9h16v15H8ZM3 4l10 10M29 4 19 14M3 29l10-10M29 29 19 19', 'M13 14h6v5h-6Z'],
  storm: ['M4 13q0-6 7-6 3-7 9-1 8-1 9 7M5 25h6M23 25h5', 'M19 10 11 20h7l-3 10 10-14h-7Z'],
  laser: ['M7 22h18v7H7ZM11 22v-4h10v4', 'M16 18 4 3M16 18 10 2M16 18V2M16 18 22 2M16 18 28 3'],
  movingHead: ['M8 22V12h16v10M11 22h10M9 29h14M16 22v7M12 8h8v10h-8Z', 'M12 8 5 2M20 8l7-6M16 8V1'],
  ledBar: ['M3 12h26v10H3ZM8 22v6M24 22v6', 'M7 15v4M13 15v4M19 15v4M25 15v4'],
  ledTube: ['M12 3h8v26h-8ZM12 7h8M12 25h8', 'M16 10v12'],
  strobe: ['M4 18h24v10H4ZM9 22h14', 'M8 13 5 8M16 12V4M24 13l3-5'],
  blinder: ['M3 8h26v18H3Z', 'M10 11a3 3 0 1 0 0 6 3 3 0 1 0 0-6M22 11a3 3 0 1 0 0 6 3 3 0 1 0 0-6M10 19h.1M22 19h.1'],
  wash: ['M9 18h14v9H9ZM16 27v3', 'M9 18 4 5M23 18l5-13M12 18 10 3M20 18l2-15M16 18V2'],
  videoWall: ['M3 5h26v22H3ZM3 16h26M12 5v22M21 5v22', 'M14 9h5v4h-5M23 19h4v5h-4'],
  haze: ['M3 23h13v6H3ZM7 18h5v5', 'M9 15q-5-6 2-7t9-3M16 19q-3-7 4-7t9-4M22 25q-4-6 2-7t5-3'],
  co2: ['M10 23h12v6H10ZM13 17h6v6', 'M13 17Q3 9 6 3M16 17V2M19 17Q29 9 26 3'],
  particles: ['M4 26 16 30l12-4M5 21l11 4 11-4', 'M7 6h.1M16 3h.1M25 9h.1M11 14h.1M22 18h.1'],
  texture: ['M4 5h24v23H4ZM4 14l9-9M4 23 22 5M9 28 28 9M18 28l10-10', 'M22 28l6-6M4 9l4-4'],
  fx: ['M4 6h24v22H4Z', 'M9 23V12h6M9 17h5M19 13l6 10M25 13l-6 10'],
  route: ['M5 8h7v16h8M5 5v6M20 21h8v6h-8', 'M12 16h11M20 13l3 3-3 3'],
  checklist: ['M12 7h16M12 16h16M12 25h16', 'M3 6l2 2 3-4M3 15l2 2 3-4M3 24l2 2 3-4'],
  apple: ['M21 8q-5-3-8 0Q4 4 4 15q0 11 7 14l5-2 5 2q5-2 7-8-7-3-2-11Z', 'M16 6q0-5 7-5 0 5-7 5Z'],
  windows: ['M3 5l11-2v12H3ZM3 18h11v12L3 28Z', 'M18 3l12-2v14H18ZM18 18h12v13l-12-1Z'],
  google: ['M26 8a13 13 0 1 0 1 17', 'M29 16H17M29 16v9h-7'],
  pointer: ['M6 3 27 18l-10 2-5 9Z', 'M17 20l6 9'],
  gridSnap: ['M4 8h24M4 16h24M4 24h24M8 4v24M16 4v24M24 4v24', 'M13 13h6v6h-6'],
  cameraFocus: ['M4 11V4h7M21 4h7v7M28 21v7h-7M11 28H4v-7', 'M16 10a6 6 0 1 0 0 12 6 6 0 1 0 0-12M16 7v3M16 22v3'],
} as const

export type AppIconDrawing = keyof typeof DRAWINGS
export type AppIconKind = AppIconDrawing

export interface AppIconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  kind: AppIconKind
  size?: number | string
  /** Allows existing activity animations to target the approved signal artwork. */
  signalClassName?: string
}

/** Shared production renderer for the artwork approved in Layout Lab Cinema 2.0. */
export function AppIcon({ kind, size = 18, className, signalClassName, style, ...props }: AppIconProps) {
  const [structure, signal] = DRAWINGS[kind]
  return (
    <svg
      {...props}
      className={`app-icon${className ? ` ${className}` : ''}`}
      data-app-icon={kind}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ ...style, fill: 'none', strokeWidth: 1.5 }}
    >
      <path d={structure} opacity={0.7} />
      <path d={signal} className={`app-icon__signal${signalClassName ? ` ${signalClassName}` : ''}`} />
    </svg>
  )
}
