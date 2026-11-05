import { useId } from 'react'
import { ENGINE_BLUEPRINT_STROKE_WIDTH } from './blueprintDrawing'
import type { ReactEngineId } from './ReactTypes'

function HeadlinerArtwork() {
  const id = useId()
  const silhouette = `${id}-dj`
  const backdrop = `${id}-color`
  const dots = `${id}-dots`
  const scanlines = `${id}-scanlines`
  const cdj = `${id}-cdj`

  return (
    <svg viewBox="0 0 220 90" preserveAspectRatio="xMaxYMid slice" focusable="false">
      <defs>
        <path id={silhouette} d="M45 30C42 20 48 9 58 6c12-5 25 0 30 10 2 4 2 9 1 14l7 10c1 2 0 4-3 4h-5l-1 7c-1 4-5 6-12 5l-2 6c13 2 22 9 28 19l11-3 9 3v7l-21 8-12-6 3 16H30l5-19c-8 5-20 8-25 1-4-6 2-16 8-24l14-20 4-14-1-9c0-2 2-3 4-1l4 9 4-7 4 2-1 15-7 9-9 22 16-12 5-10c-6-6-9-12-10-18Z" />
        <linearGradient id={backdrop}>
          <stop stopColor="#101026" />
          <stop offset=".45" stopColor="#6029a9" />
          <stop offset="1" stopColor="#f64f9a" />
        </linearGradient>
        <pattern id={dots} width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.05" fill="#caffee" />
        </pattern>
        <pattern id={scanlines} width="4" height="3" patternUnits="userSpaceOnUse">
          <rect width="4" height="1" fill="#ffb5d9" />
        </pattern>
        <g id={cdj}>
          <path d="M7 0h38l8 25H0Z" fill="#171b25" stroke="#69788a" strokeWidth=".7" />
          <path d="M0 25h53v5H0Z" fill="#080b11" />
          <rect x="18" y="2" width="18" height="5" rx=".7" fill="#59c9d3" />
          <path d="M20 4h6m2 0h6" stroke="#0a2c3b" strokeWidth=".8" />
          <ellipse cx="27" cy="16" rx="13" ry="7" fill="#090c14" stroke="#d2d8e2" strokeWidth="1.6" />
          <ellipse cx="27" cy="16" rx="8.5" ry="4.5" fill="#303947" stroke="#8f9eae" strokeWidth=".7" />
          <ellipse cx="27" cy="16" rx="2.5" ry="1.4" fill="#a4b5c3" />
          <path d="M46 9v12" stroke="#788799" strokeWidth="1.1" />
          <path d="M44 15h4" stroke="#eef4ff" strokeWidth="1.6" />
          <circle cx="8" cy="20" r="2.1" fill="#75dcad" />
          <circle cx="8" cy="13" r="1.7" fill="#d5aa57" />
          <path d="M16 25h5m3 0h5m3 0h5" stroke="#d2d8e2" strokeWidth="1.2" />
        </g>
      </defs>
      <rect width="220" height="90" fill={`url(#${backdrop})`} />
      <path d="M108 90 174 0h46v28l-57 62Z" fill="#f78bb7" opacity=".27" />
      <g transform="translate(116 -7)">
        <use href={`#${silhouette}`} fill="#37d9db" />
        <use href={`#${silhouette}`} fill={`url(#${dots})`} opacity=".65" />
      </g>
      <g transform="translate(87 -3)">
        <use href={`#${silhouette}`} fill="#e42f86" />
        <use href={`#${silhouette}`} fill={`url(#${scanlines})`} opacity=".56" />
      </g>
      <g transform="translate(42 -6) scale(.86)">
        <use href={`#${silhouette}`} fill="#0a0915" />
        <path d="M47 31c-4-12 2-23 13-25 7-2 14 0 19 4" fill="none" stroke="#f4ecff" strokeWidth="2" strokeLinecap="round" />
        <rect x="44" y="28" width="8" height="12" rx="3" transform="rotate(-12 48 34)" fill="#f4ecff" />
        <path d="M48 39c2 14 21 17 16 32-3 9 1 14 7 18" fill="none" stroke="#f4ecff" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      <path d="M62 61h142l16 29H47Z" fill="#060913" />
      <use href={`#${cdj}`} transform="translate(55 61)" />
      <use href={`#${cdj}`} transform="translate(162 61)" />
      <path d="M116 61h37l6 29h-49Z" fill="#202530" stroke="#69788a" strokeWidth=".7" />
      <g fill="#b8c8d2">
        <circle cx="124" cy="66" r="1.4" /><circle cx="135" cy="66" r="1.4" /><circle cx="146" cy="66" r="1.4" />
        <circle cx="123" cy="71" r="1.4" /><circle cx="135" cy="71" r="1.4" /><circle cx="147" cy="71" r="1.4" />
      </g>
      <path d="M122 76v7m13-7v7m13-7v7m-27 3h29" stroke="#788799" strokeWidth=".8" />
      <path d="M119 79h6m7-2h6m7 4h6m-17 3v4" stroke="#e9f2ff" strokeWidth="1.5" />
      <path d="M155 63 148 61 143 63 140 68Q142 71 147 69l4-3 5 1Z" fill="#0a0915" />
    </svg>
  )
}

/** Engine-specific technical illustrations, drawn in the Cinema blueprint's scale. */
export function ReactEngineBlueprint({ engineId }: { engineId: ReactEngineId }) {
  if (engineId === 'headliner') return <HeadlinerArtwork />

  return (
    <svg viewBox="0 0 140 150" fill="none" focusable="false">
      <g stroke="currentColor" strokeWidth={ENGINE_BLUEPRINT_STROKE_WIDTH}>
        {engineId === 'oscilloscope' && <>
          {/* A phase portrait suspended in an oscilloscope's calibration cage. */}
          <path d="M70 8 138 46 138 112 70 150 2 112 2 46Z" fill="currentColor" fillOpacity=".025" />
          <path d="M2 46 70 84 138 46M70 84V150M70 8V84M2 112 70 74 138 112" opacity=".25" />
          <ellipse cx="70" cy="72" rx="61" ry="44" transform="rotate(-28 70 72)" opacity=".4" />
          <path d="M12 80C24 6 114 137 128 64C116 0 28 149 12 80Z" fill="currentColor" fillOpacity=".045" />
          <path d="M17 84C29 10 119 141 133 68C121 4 33 153 17 84Z" opacity=".45" />
          <path d="M22 88C34 14 124 145 138 72C126 8 38 157 22 88Z" opacity=".2" />
          <path d="M12 80 22 88M35 40 45 48M70 72 80 80M107 101 117 109M128 64 138 72" opacity=".45" />
          <path d="M6 72H134M70 14V134M18 108 122 36" strokeDasharray="3 4" opacity=".3" />
          <path d="M28 69V75M49 69V75M91 69V75M112 69V75M67 30H73M67 114H73" opacity=".5" />
          <circle cx="70" cy="72" r="2.5" fill="currentColor" fillOpacity=".2" />
        </>}
        {engineId === 'canvas' && <>
          {/* Exploded image planes with registration marks and projection lines. */}
          <path d="M4 83 88 55 138 89 54 117ZM4 89 54 123 138 95M4 83V89M54 117V123M138 89V95" opacity=".3" />
          <path d="M4 61 88 33 138 67 54 95Z" fill="currentColor" fillOpacity=".035" />
          <path d="M4 67 54 101 138 73M4 61V67M54 95V101M138 67V73" opacity=".5" />
          <path d="M4 39 88 11 138 45 54 73Z" fill="currentColor" fillOpacity=".065" />
          <path d="M4 45 54 79 138 51M4 39V45M54 73V79M138 45V51" />
          <path d="M22 40 85 19 119 43 56 64Z" opacity=".6" />
          <path d="M29 43 40 39 52 48 74 29 110 44M53 35 60 32 65 36 58 39Z" opacity=".5" />
          <path d="M4 39V107M88 11V79M138 45V113M54 73V141" strokeDasharray="3 4" opacity=".3" />
          <path d="M13 24 13 18 24 14M108 14 118 21 118 27M18 113 28 120 38 117M108 113 119 109 119 103" opacity=".45" />
          <path d="M19 130 54 142 123 119M54 138V146" opacity=".2" />
        </>}
        {engineId === 'laserDmx' && <>
          {/* A measured light frustum projected from a gimballed optical assembly. */}
          <path d="M8 10 132 10 114 38 26 38Z" fill="currentColor" fillOpacity=".045" />
          <path d="M8 10 70 100 132 10M26 38 70 100 114 38M39 10 70 100 101 10M70 10V100" opacity=".7" />
          <path d="M19 26H121M35 52H105M48 72H92" opacity=".25" />
          <path d="M8 10 8 2M132 10V2M3 5H137M70 2V18" strokeDasharray="3 3" opacity=".35" />
          <ellipse cx="70" cy="99" rx="20" ry="9" fill="currentColor" fillOpacity=".08" />
          <ellipse cx="70" cy="99" rx="12" ry="5" />
          <path d="M50 99V111C50 123 90 123 90 111V99M58 106V115M82 106V115" opacity=".7" />
          <path d="M40 94V120L70 137 100 120V94M40 94 47 90M100 94 93 90M40 120 70 104 100 120" opacity=".55" />
          <path d="M70 137V148M44 145 70 131 96 145 70 159Z" opacity=".3" />
          <path d="M18 50 18 110M14 55H22M14 105H22M118 50V110M114 55H122M114 105H122" opacity=".2" />
        </>}
        {engineId === 'pixGrid' && <>
          {/* An isometric addressable lattice with individual pixels lifted out. */}
          <path d="M70 12 138 50 70 88 2 50Z" fill="currentColor" fillOpacity=".035" />
          <path d="M2 50V69L70 107 138 69V50M70 88V107" />
          <path d="M19 40.5 87 78.5M36 31 104 69M53 21.5 121 59.5M19 59.5 87 21.5M36 69 104 31M53 78.5 121 40.5" opacity=".45" />
          <path d="M36 31V12L53 2.5 70 12V31L53 40.5Z" fill="currentColor" fillOpacity=".065" />
          <path d="M36 12 53 21.5 70 12M53 21.5V40.5" />
          <path d="M70 69V50L87 40.5 104 50V69L87 78.5Z" fill="currentColor" fillOpacity=".1" />
          <path d="M70 50 87 59.5 104 50M87 59.5V78.5" />
          <path d="M104 50V31L121 21.5 138 31V50L121 59.5Z" fill="currentColor" fillOpacity=".04" />
          <path d="M104 31 121 40.5 138 31M121 40.5V59.5" />
          <path d="M2 88 70 126 138 88M2 107 70 145 138 107M2 69V107M70 107V145M138 69V107" strokeDasharray="3 4" opacity=".3" />
          <path d="M19 78.5V83M36 88V92.5M53 97.5V102M87 97.5V102M104 88V92.5M121 78.5V83" opacity=".5" />
        </>}
      </g>
    </svg>
  )
}
