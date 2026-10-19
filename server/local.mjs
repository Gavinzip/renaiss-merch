import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadLocalEnv} from './env-loader.mjs';

// The pilot's local entry point uses the same asynchronous PostgreSQL handler
// as Vercel. The archived SQLite server is not a selectable runtime fallback.
export async function createLocalServer() {
  loadLocalEnv();
  if(process.env.MERCH_RUNTIME_CONFIG){const values=JSON.parse(await readFile(process.env.MERCH_RUNTIME_CONFIG,'utf8'));for(const [key,value] of Object.entries(values))process.env[key]??=String(value);}
  if(process.env.MERCH_DATABASE_DRIVER!=='postgres')throw new Error('postgres_driver_required');
  const [{default:api},{serveStatic},{sendHttpError},{getStorefrontMode},{createLocalSurfOperatorHandler}]=await Promise.all([
    import('../api/index.mjs'),import('./static.mjs'),import('./http.mjs'),import('./storefront-mode.mjs'),import('./surf-draw/local-operator.mjs'),
  ]);
  const bridge=createLocalSurfOperatorHandler();
  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(process.env.MERCH_LOCAL_OPERATOR_BRIDGE==='true'&&await bridge(req,res,url))return;
      if(url.pathname==='/healthz'||url.pathname==='/local-draw-operator'||/^\/(api|auth)\//.test(url.pathname))return await api(req,res);
      if(url.pathname==='/v1.2'||url.pathname.startsWith('/v1.2/')){res.writeHead(308,{Location:'/'+url.search+url.hash,'Cache-Control':'no-store'});res.end();return;}
      await serveStatic(req,res,{storefrontMode:getStorefrontMode()});
    }catch(error){sendHttpError(res,error);}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const server=await createLocalServer();
  if(process.argv.includes('--build'))await new Promise((resolve,reject)=>{const child=spawn('npm',['run','build:pilot'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:process.env,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('local_build_failed')));});
  const port=Number(process.env.PORT||8080),host=process.env.HOST||'127.0.0.1';server.listen(port,host,()=>console.log(`Merch PostgreSQL preview http://${host}:${port}`));
}
