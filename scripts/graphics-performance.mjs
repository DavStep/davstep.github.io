// Local graphics/performance comparison, with unmodified runtime frame limits.
// Usage: node scripts/graphics-performance.mjs OUTPUT LABEL URL
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TOWN_PLAYWRIGHT_PATH??`${homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const [output='/tmp/town-graphics',label='current',base='http://127.0.0.1:5173']=process.argv.slice(2);
const sampleMs=Number(process.env.TOWN_SAMPLE_MS??5000);
const fixtures={opening:[],beacon:['settlers','grove','workshop','roads','archive','river','observatory','market','windmill','walls'],damage:['settlers','grove','workshop','river','walls','market','windmill','observatory','roads','archive']};
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const results={label,base,sampleMs,browser:browser.version(),staticCompare:!!process.env.TOWN_STATIC_COMPARE,shadowCompare:!!process.env.TOWN_SHADOW_COMPARE,sessions:[]};
const percentile=(v,p)=>v.length?[...v].sort((a,b)=>a-b)[Math.min(v.length-1,Math.ceil(v.length*p)-1)]:null;
const stats=v=>({n:v.length,p50:percentile(v,.5),p95:percentile(v,.95),p99:percentile(v,.99),mean:v.length?v.reduce((a,b)=>a+b,0)/v.length:null});
try{
 for(const mobile of [false,true])for(const [fixture,order] of Object.entries(fixtures)){
  if(process.env.TOWN_FIXTURE&&process.env.TOWN_FIXTURE!==fixture)continue;
  if(process.env.TOWN_LAYOUT&&process.env.TOWN_LAYOUT!==(mobile?'mobile':'desktop'))continue;
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.addInitScript(order=>{
   localStorage.setItem('davstep.choice-planet.v3.playtest',JSON.stringify({version:3,started:true,order,bestMax:0,bestScore:0,secretFound:false}));
   const raf=window.requestAnimationFrame;
   window.__graphicsPerf={active:false,frames:[],intervals:[],gpu:[],spans:{},last:null};
   window.requestAnimationFrame=callback=>raf.call(window,now=>{
    const probe=window.__graphicsPerf,t=window.__townDebug?.town,before=t?.renderer.info.render.frame,start=performance.now();
    callback(now);
    if(probe.active&&callback.name==='frame'&&t?.renderer.info.render.frame!==before){
     probe.frames.push(performance.now()-start);
     if(probe.last!==null)probe.intervals.push(now-probe.last);probe.last=now;
    }
   });
  },order);
  const boot=Date.now();await page.goto(base+'/?playtest=1&profile=1');
  await page.waitForFunction(()=>!!window.__townDebug,{timeout:120000});
  const readyMs=Date.now()-boot;
  const identity=await page.evaluate(()=>{
   const d=window.__townDebug,t=d.town,p=window.__graphicsPerf,gl=t.renderer.getContext();
   const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
   const wrap=(owner,key,label)=>{const fn=owner[key];owner[key]=function(...args){const start=performance.now();try{return fn.apply(this,args);}finally{if(p.active)(p.spans[label]??=[]).push(performance.now()-start);}};};
   wrap(t,'render','scene');wrap(t.planet,'sync','projection');wrap(t.planetLandscape,'render','landscape');wrap(d.scenery,'update','scenery');
   const render=t.renderer.render,pending=[];
   t.renderer.render=function(...args){
    while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
     const q=pending.shift();if(!gl.getParameter(ext.GPU_DISJOINT_EXT)&&q.collect&&p.active)p.gpu.push(gl.getQueryParameter(q.query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q.query);
    }
    const query=ext&&p.active&&pending.length<12?gl.createQuery():null,start=performance.now();
    if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
    try{return render.apply(this,args);}finally{
     if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,collect:p.active});}
     if(p.active)(p.spans.submission??=[]).push(performance.now()-start);
    }
   };
   return {mobile:t.mobile,buffer:[t.renderer.domElement.width,t.renderer.domElement.height],dpr:t.renderer.getPixelRatio(),gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),gpuTimer:!!ext,state:d.gameState()};
  });
  if(identity.state.order.join()!==order.join())throw new Error('Restored fixture mismatch');
  if(fixture==='beacon'&&!identity.state.world.beacon)throw new Error('Beacon fixture mismatch');
  if(fixture==='damage'&&identity.state.world.volcano!=='overflowed')throw new Error('Damage fixture mismatch');
  // Freeze decorative animation for the focused shadow A/B so cloud growth,
  // water and vegetation motion cannot change coverage between controls.
  if(process.env.TOWN_SHADOW_COMPARE&&process.env.TOWN_STATIC_COMPARE)await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForTimeout(4000);
  const controls=process.env.TOWN_SHADOW_COMPARE?[4096,4096,4096,2048,2048,4096,4096,2048]:[null,null,null];
  for(const [repeat,shadowResolution] of controls.entries()){
   if(shadowResolution){
    await page.evaluate(async resolution=>{
     const {configurePlanetShadows}=await import('/src/town/planet-lighting.ts');
     const t=window.__townDebug.town;configurePlanetShadows(t.sun,t.mobile,85,resolution);
    },shadowResolution);
    await page.waitForTimeout(500);
   }
   await page.evaluate(()=>Object.assign(window.__graphicsPerf,{active:true,frames:[],intervals:[],gpu:[],spans:{},last:null}));
   await page.waitForTimeout(sampleMs);
   const sample=await page.evaluate(()=>{
    const p=window.__graphicsPerf;p.active=false;const t=window.__townDebug.town;
    return {frames:p.frames,intervals:p.intervals,gpu:p.gpu,spans:p.spans,render:{...t.renderer.info.render},memory:{...t.renderer.info.memory}};
   });
   const summary=Object.fromEntries(Object.entries({frameCPU:sample.frames,intervals:sample.intervals,gpu:sample.gpu,...sample.spans}).map(([k,v])=>[k,stats(v)]));
   results.sessions.push({mobile,fixture,repeat,shadowResolution,readyMs,identity,summary,sample,errors:[...errors]});
   console.log(JSON.stringify({label,mobile,fixture,repeat,shadowResolution,cpu95:summary.frameCPU.p95,interval95:summary.intervals.p95,gpu95:summary.gpu.p95,render:sample.render,errors:errors.length}));
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(500);
  await page.evaluate(()=>{window.__graphicsNow=performance.now;performance.now=()=>60000;});await page.waitForTimeout(350);
  await page.screenshot({path:`${output}/${label}-${mobile?'mobile':'desktop'}-${fixture}.png`});
  if(!mobile&&fixture==='beacon'){
   await page.mouse.move(720,320);await page.mouse.wheel(0,-4200);await page.waitForTimeout(1000);
   await page.screenshot({path:`${output}/${label}-desktop-close.png`});
   if(process.env.TOWN_SHADOW_COMPARE){
    for(const resolution of [4096,2048]){
     await page.evaluate(async resolution=>{
      const {configurePlanetShadows}=await import('/src/town/planet-lighting.ts');
      const t=window.__townDebug.town;configurePlanetShadows(t.sun,t.mobile,85,resolution);
     },resolution);await page.waitForTimeout(350);
     await page.screenshot({path:`${output}/${label}-shadow-${resolution}.png`});
    }
   }
  }
  await page.evaluate(()=>{performance.now=window.__graphicsNow;});
  if(process.env.TOWN_CPU_PROFILE&&!mobile&&fixture==='beacon'){
   await page.emulateMedia({reducedMotion:'no-preference'});
   const cdp=await context.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');await page.waitForTimeout(5000);
   const profile=await cdp.send('Profiler.stop');await writeFile(`${output}/${label}.cpuprofile`,JSON.stringify(profile.profile));await cdp.detach();
  }
  await context.close();await writeFile(`${output}/${label}.json`,JSON.stringify(results,null,2));
 }
}finally{await writeFile(`${output}/${label}.json`,JSON.stringify(results,null,2));await browser.close();}
