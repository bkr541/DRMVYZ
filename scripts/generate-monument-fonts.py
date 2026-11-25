"""Generate bounded local glyph outlines for MONUMENT. No runtime font downloads.
Anton is OFL (scripts/cinema2-assets/sources/anton/OFL.txt); STAGELESS is repo branding.
Run from repository root with Python fonttools installed.
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from fontTools.pens.areaPen import AreaPen

class Outline(BasePen):
    def __init__(self, glyphs, units):
        super().__init__(glyphs); self.units=units; self.commands=[]
    def emit(self, op, *points): self.commands.append([op, *[round(v/self.units,5) for point in points for v in point]])
    def _moveTo(self,p): self.emit('m',p)
    def _lineTo(self,p): self.emit('l',p)
    def _qCurveToOne(self,p,q): self.emit('q',p,q)
    def _curveToOne(self,p,q,r): self.emit('c',p,q,r)
    def _closePath(self): self.emit('z')
    def _endPath(self): self.emit('z')

fonts={}
for name,path in [('anton','scripts/cinema2-assets/sources/anton/Anton-Regular.ttf'),('stageless','src/assets/fonts/STAGELESS_Sans-Bold.otf')]:
    font=TTFont(path); glyphs=font.getGlyphSet(); cmap=font.getBestCmap(); units=font['head'].unitsPerEm
    pen=AreaPen(glyphs); glyphs[cmap[ord('H')]].draw(pen)
    data={}
    for cp in list(range(32,256))+[0x2013,0x2014,0x2018,0x2019,0x201c,0x201d,0x2026]:
        if cp not in cmap: continue
        glyph=glyphs[cmap[cp]]; outline=Outline(glyphs,units); glyph.draw(outline)
        data[chr(cp)]={'advance':round(glyph.width/units,5),'commands':outline.commands}
    fonts[name]={'ccw':pen.value>0,'glyphs':data}
Path('src/components/vyzualz/cinema2/modules/monument/MonumentFonts.generated.json').write_text(json.dumps(fonts,separators=(',',':'),ensure_ascii=True)+'\n')
