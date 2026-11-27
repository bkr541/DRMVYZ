/** Spatial choreography in bounded physical coordinates, independent of camera
 * projection and placement order. Compress only the remote wing coordinates
 * into the program domain; nearby cabinets retain local timing differences. */
export function everywhereSpatialPosition(item: Readonly<{x:number;y:number;z:number}>) {
  const x=15*Math.tanh(item.x/15), y=8*Math.tanh(item.y/8)
  const depth=(item.z-2.25)*.30
  return {x,y,depth,radius:Math.hypot(x,y*.87,depth)}
}
