import { ENGINE_BLUEPRINT_STROKE_WIDTH } from './blueprintDrawing'
import type { ReactEngineId } from './ReactTypes'

/** Engine-specific technical illustrations, drawn in the Cinema blueprint's scale. */
export function ReactEngineBlueprint({ engineId }: { engineId: ReactEngineId }) {
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
        {engineId === 'headliner' && <>
          {/* A faceted performer study inside a spatial capture volume. */}
          <path d="M70 5 125 36 125 113 70 145 15 113 15 36Z" opacity=".35" />
          <ellipse cx="70" cy="72" rx="68" ry="34" transform="rotate(-30 70 72)" opacity=".35" />
          <path d="M70 16 95 28 103 54 91 82 70 97 49 82 37 54 45 28Z" fill="currentColor" fillOpacity=".045" />
          <path d="M45 28 70 39 95 28M37 54 57 50 70 39 83 50 103 54M49 82 60 67 70 74 80 67 91 82M70 16V39M70 39V74M60 67 57 50M80 67 83 50M49 82 70 86 91 82M70 86V97" opacity=".65" />
          <path d="M43 55 55 58 62 55M78 55 85 58 97 55M63 78 70 80 77 78" opacity=".55" />
          <path d="M49 82V105L19 120 3 150M91 82V105L121 120 137 150M49 105 70 117 91 105M19 120 70 143 121 120M70 97V117M70 117V153" opacity=".65" />
          <path d="M15 36 70 68 125 36M70 5V145M15 113 125 49M15 49 125 113" strokeDasharray="3 4" opacity=".2" />
          <path d="M6 28V18H19M121 18H134V28M6 115V125H19M121 125H134V115" opacity=".4" />
        </>}
      </g>
    </svg>
  )
}
