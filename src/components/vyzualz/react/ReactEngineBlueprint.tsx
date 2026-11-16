import { useId } from 'react'
import { ENGINE_BLUEPRINT_STROKE_WIDTH } from './blueprintDrawing'
import type { ReactEngineId } from './ReactTypes'

function HeadlinerArtwork() {
  const id = useId()
  const lit = `${id}-lit`
  const glow = `${id}-glow`
  const stage = `${id}-stage`
  const ghost = `${id}-ghost`
  const body = `${id}-body`

  /* Drawn in the 1672x941 reference frame, then fitted into the card's 220x90 art box. */
  return (
    <svg viewBox="0 0 220 90" preserveAspectRatio="xMaxYMid slice" focusable="false">
      <defs>
        <filter id={glow} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <radialGradient id={stage} cx="50%" cy="80%" r="60%">
          <stop stopColor="#0b3a44" stopOpacity=".55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <g id={lit} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Rim light on the centre DJ: headphones, left shoulder + arm, right shoulder. */}
          <g stroke="#19e3ec" strokeWidth="7">
            <path d="M742 262C738 225 770 205 810 205C845 205 872 225 880 250" />
            <path d="M766 342C720 360 680 390 650 440C625 490 600 540 585 565L520 640L430 700" />
            <path d="M890 312C940 318 985 335 1012 365C1040 420 1060 480 1082 560L1100 650" />
            <path d="M275 748H1390M275 748L410 722M1250 722L1390 748" />
          </g>
          <g stroke="#67f7ff" strokeWidth="3">
            <path d="M750 300C752 350 790 400 830 408C860 410 882 370 890 330" />
            <path d="M715 590V725M985 530L992 700" />
            <path d="M740 300C730 270 715 275 720 295M880 240C892 236 898 250 888 260" />
            <path d="M418 706L475 660L540 660M1055 660L1140 652M1100 665L1060 690" />
            <path d="M400 733H1260" />
          </g>
          {/* Decks: mixer on the left, turntable on the right. */}
          <g stroke="#2aa9b4" strokeWidth="3" opacity=".7">
            <path d="M420 722V702H600L680 712V726H430Z" />
            <ellipse cx="1090" cy="696" rx="125" ry="12" />
            <path d="M965 706H1380" />
          </g>
        </g>
        <g id={ghost} fill="none" stroke="#1f9aa5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {/* One dim DJ centred on x=0: headphones, shoulders, forward arm. */}
          <path d="M-70 380C-70 335-37 310 0 310C38 310 63 340 63 385" />
          <path d="M-127 440C-102 415-67 412-47 412M58 412C98 418 133 440 146 500" />
          <path d="M-127 440C-162 500-182 560-192 600C-172 640-132 650-122 690L-212 695L-262 720" />
          <path d="M146 500C160 560 150 620 120 655" />
        </g>
        <path id={body} fill="#000" d="M742 262C738 225 770 205 810 205C845 205 872 225 880 250L890 312C940 318 985 335 1012 365C1040 420 1060 480 1100 725H715L715 590L585 565C600 540 625 490 650 440C680 390 720 360 766 342L750 300Z" />
      </defs>
      <rect width="220" height="90" fill="#000" />
      <g transform="translate(-14.5 5) scale(.15) translate(0 -195)">
        <ellipse cx="830" cy="640" rx="900" ry="260" fill={`url(#${stage})`} />
        <g opacity="0.35">
          <g transform="translate(190 0)">
            <use href={`#${ghost}`} transform="scale(1 1)" />
          </g>
        </g>
        <g opacity="0.35">
          <g transform="translate(1470 0)">
            <use href={`#${ghost}`} transform="scale(-1 1)" />
          </g>
        </g>
        <g opacity="0.7">
          <g transform="translate(500 0)">
            <use href={`#${ghost}`} transform="scale(1 1)" />
          </g>
        </g>
        <g opacity="0.7">
          <g transform="translate(1160 0)">
            <use href={`#${ghost}`} transform="scale(-1 1)" />
          </g>
        </g>
        <g transform="translate(-533 0)">
          <use href={`#${body}`} />
          <use href={`#${lit}`} filter={`url(#${glow})`} opacity=".7" />
          <use href={`#${lit}`} />
        </g>
      </g>
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
