import { createReadStream, statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/** The owner-supplied restricted model is for local review only; never enters public/ or dist/. */
export function arcAngelPreviewPlugin(): Plugin {
  return { name:'stageless-arc-angel-local-review',apply:'serve',configureServer(server){
    const file=resolve(server.config.root,'.asset-sources/arc-angel/angel.glb')
    server.middlewares.use('/__stageless_arc_angel/angel.glb',(req,res,next)=>{
      if(req.url!=='/'&&req.url!==''&&req.url?.[0]!=='?'){next();return}
      const address=req.socket.remoteAddress
      if(address!=='127.0.0.1'&&address!=='::1'&&address!=='::ffff:127.0.0.1'){res.statusCode=403;res.end('Local review only');return}
      if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end();return}
      try{
        const info=statSync(file);if(!info.isFile())throw new Error('Missing local asset')
        res.setHeader('Content-Type','model/gltf-binary');res.setHeader('Content-Length',info.size);res.setHeader('Cache-Control','no-store');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('X-Content-Type-Options','nosniff')
        if(req.method==='HEAD'){res.end();return}
        const stream=createReadStream(file);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res)
      }catch{res.statusCode=404;res.end('ARC ANGEL local review model missing; apply the complete binary patch.')}
    })
  }}
}
