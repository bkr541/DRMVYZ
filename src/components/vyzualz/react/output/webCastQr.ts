/** ISO QR byte mode, version 5-L, mask 0. Fixed version fits the canonical HTTPS token URL
 * (up to 106 UTF-8 bytes). One Reed–Solomon block: 108 data + 26 parity codewords.
 * Local generation keeps the session token away from third-party QR services. */
export function webCastQrPath(text: string): string {
  const bytes = new TextEncoder().encode(text)
  if (bytes.length > 106) throw new Error('Cast link is too long for the QR code')
  const bits: number[] = []
  const append = (v: number, n: number) => { for (let i=n-1;i>=0;i--) bits.push((v>>>i)&1) }
  append(4,4); append(bytes.length,8); bytes.forEach(b=>append(b,8))
  append(0,Math.min(4,864-bits.length)); while(bits.length%8) bits.push(0)
  const data: number[]=[]
  for(let i=0;i<bits.length;i+=8) data.push(bits.slice(i,i+8).reduce((v,b)=>(v<<1)|b,0))
  for(let i=0;data.length<108;i++) data.push(i%2?17:236)
  const mul=(a:number,b:number)=>{let p=0;while(b){if(b&1)p^=a;a=(a<<1)^((a&128)?0x11d:0);b>>>=1}return p}
  let generator=[1], root=1
  for(let i=0;i<26;i++){const next=Array(generator.length+1).fill(0) as number[];generator.forEach((g,j)=>{next[j]^=g;next[j+1]^=mul(g,root)});generator=next;root=mul(root,2)}
  const rem=[...data,...Array(26).fill(0)] as number[]
  for(let i=0;i<108;i++){const lead=rem[i];generator.forEach((g,j)=>{rem[i+j]^=mul(g,lead)})}
  const words=[...data,...rem.slice(108)], size=37
  const matrix=Array.from({length:size},()=>Array<number>(size).fill(-1))
  const put=(x:number,y:number,v:number)=>{if(x>=0&&y>=0&&x<size&&y<size)matrix[y][x]=v}
  for(const [cx,cy] of [[3,3],[33,3],[3,33]]) for(let y=-4;y<=4;y++)for(let x=-4;x<=4;x++){const d=Math.max(Math.abs(x),Math.abs(y));put(cx+x,cy+y,d!==2&&d!==4?1:0)}
  for(let i=8;i<size-8;i++){put(i,6,1-i%2);put(6,i,1-i%2)}
  for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++)put(30+x,30+y,Math.max(Math.abs(x),Math.abs(y))!==1?1:0)
  // L / mask 0 format bits, BCH encoded and XOR-masked (0x77c4).
  const format=0x77c4, bit=(i:number)=>(format>>>i)&1
  for(let i=0;i<6;i++)put(8,i,bit(i));put(8,7,bit(6));put(8,8,bit(7));put(7,8,bit(8))
  for(let i=9;i<15;i++)put(14-i,8,bit(i))
  for(let i=0;i<8;i++)put(size-1-i,8,bit(i))
  for(let i=8;i<15;i++)put(8,size-15+i,bit(i));put(8,size-8,1)
  let index=0,up=true
  for(let right=size-1;right>=1;right-=2){if(right===6)right--;for(let i=0;i<size;i++){const y=up?size-1-i:i;for(let dx=0;dx<2;dx++){const x=right-dx;if(matrix[y][x]!==-1)continue;const value=index<words.length*8?(words[index>>>3]>>>(7-index%8))&1:0;put(x,y,value^((x+y)%2===0?1:0));index++}}up=!up}
  return matrix.flatMap((row,y)=>row.map((v,x)=>v===1?`M${x+4} ${y+4}h1v1h-1z`:'' )).join('')
}
