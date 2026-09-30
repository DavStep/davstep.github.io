// Alternating local browser controls; no production instrumentation changes.
// Run: node scripts/performance-pass.mjs <output directory>
// Optional: TOWN_PLAYWRIGHT_PATH, TOWN_URL, TOWN_BROWSER_CHANNEL, TOWN_SAMPLE_MS,
// TOWN_FIXTURE, TOWN_LAYOUT, TOWN_WARMUP_MS.
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TOWN_PLAYWRIGHT_PATH??`${homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const output=process.argv[2]??'/tmp/town-performance';
const base=process.env.TOWN_URL??'http://127.0.0.1:5173';
const windowMs=Number(process.env.TOWN_SAMPLE_MS??5000);
const controlModule='/docs/performance-results/2026-09-30-town-optimization/evidence/projection-before.ts';
const fixtures={opening:[],beacon:['settlers','grove','workshop','roads','archive','river','observatory','market','windmill','walls'],damage:['settlers','grove','workshop','river','walls','market','windmill','observatory','roads','archive']};
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.TOWN_BROWSER_CHANNEL??'chrome'});
const results={started:new Date().toISOString(),base,windowMs,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),patchHash:createHash('sha256').update(execFileSync('git',['diff'])).digest('hex'),browser:browser.version(),controlModule,fixtures,sessions:[],visuals:[]};
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*p)-1)]:null;
try{
  for(const mobile of [false,true])for(const [fixture,order] of Object.entries(fixtures)){
    if(process.env.TOWN_FIXTURE&&process.env.TOWN_FIXTURE!==fixture)continue;
    if(process.env.TOWN_LAYOUT&&process.env.TOWN_LAYOUT!==(mobile?'mobile':'desktop'))continue;
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.addInitScript(order=>{
      localStorage.setItem('davstep.choice-planet.v3.playtest',JSON.stringify({version:3,started:true,order,bestMax:0,bestScore:0,secretFound:false}));
      const raf=window.requestAnimationFrame;
      window.__perf={active:false,frames:[],intervals:[],spans:{},last:null,control:'after'};
      window.requestAnimationFrame=callback=>raf.call(window,now=>{
        const probe=window.__perf,start=performance.now();callback(now);
        if(probe.active&&callback.name==='frame'){
          const duration=performance.now()-start;
          if(duration>.15){probe.frames.push(duration);if(probe.last!==null)probe.intervals.push(now-probe.last);probe.last=now;}
        }
      });
    },order);
    const navStart=Date.now();await page.goto(base+'/?playtest=1&profile=1');
    await page.waitForFunction(()=>!!window.__townDebug,{timeout:120000});const readyMs=Date.now()-navStart;
    const identity=await page.evaluate(async controlModule=>{
      const {PlanetProjection}=await import(controlModule);
      const d=window.__townDebug,t=d.town,probe=window.__perf;
      probe.baselineSync=PlanetProjection.prototype.sync;probe.optimizedSync=t.planet.sync;
      probe.configure=control=>{
        probe.control=control;
        for(const branch of [t.land,t.environment.group])if(control==='before')t.scene.add(branch);else branch.removeFromParent();
        t.planet.sync(t.scene);
      };
      const wrap=(owner,key,label)=>{const fn=owner?.[key];if(!fn)return;owner[key]=function(...args){const start=performance.now();try{return fn.apply(this,args);}finally{if(probe.active)(probe.spans[label]??=[]).push(performance.now()-start);}};};
      t.planet.sync=function(scene){const start=performance.now();try{return (probe.control==='before'?probe.baselineSync:probe.optimizedSync).call(this,scene);}finally{if(probe.active)(probe.spans.projection??=[]).push(performance.now()-start);}};
      wrap(t,'render','scene');wrap(t.renderer,'render','submission');wrap(t.planetLandscape,'render','landscape');wrap(d.scenery,'update','scenery');
      const gl=t.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');let nodes=0;t.scene.traverse(()=>nodes++);
      return {mobile:t.mobile,buffer:[t.renderer.domElement.width,t.renderer.domElement.height],dpr:t.renderer.getPixelRatio(),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),nodes,state:d.gameState(),userAgent:navigator.userAgent};
    },controlModule);
    if(identity.state.order.join()!==order.join())throw new Error(`Invalid restored fixture: ${fixture}`);
    if(fixture==='beacon'&&!identity.state.world.beacon)throw new Error('Beacon fixture did not reach its ending');
    if(fixture==='damage'&&(identity.state.world.dragon!=='departed'||identity.state.world.volcano!=='overflowed'))throw new Error('Damaged fixture is not damaged');
    await page.waitForTimeout(Number(process.env.TOWN_WARMUP_MS??4000));
    // Adjacent A/A windows estimate variability; then alternate AB/BA/AB.
    const controls=['before','before','before','after','after','before','before','after'];
    for(const [sequence,control] of controls.entries()){
      await page.evaluate(control=>window.__perf.configure(control),control);await page.waitForTimeout(350);
      await page.evaluate(()=>Object.assign(window.__perf,{active:true,frames:[],intervals:[],spans:{},last:null}));
      await page.waitForTimeout(windowMs);
      const sample=await page.evaluate(()=>{
        const probe=window.__perf;probe.active=false;const t=window.__townDebug.town;
        return {frames:probe.frames,intervals:probe.intervals,spans:probe.spans,render:{...t.renderer.info.render},memory:{...t.renderer.info.memory},heap:performance.memory?.usedJSHeapSize??null};
      });
      const summary=Object.fromEntries(Object.entries({frameCPU:sample.frames,renderIntervals:sample.intervals,...sample.spans}).map(([key,values])=>[key,{n:values.length,p50:percentile(values,.5),p95:percentile(values,.95),p99:percentile(values,.99),mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null}]));
      results.sessions.push({mobile,fixture,sequence,control,role:sequence<2?'AA':'AB',identity,readyMs,sample,summary,errors:[...errors]});
      console.log(JSON.stringify({mobile,fixture,sequence,control,cpu95:summary.frameCPU.p95,projectionMean:summary.projection.mean,interval95:summary.renderIntervals.p95,render:sample.render}));
      await writeFile(output+'/metrics.json',JSON.stringify(results,null,2));
    }
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(1000);
    await page.evaluate(()=>{window.__perf.now=performance.now;performance.now=()=>60000;});
    for(const control of ['before','after']){
      await page.evaluate(control=>window.__perf.configure(control),control);await page.waitForTimeout(300);
      const path=`${output}/${mobile?'mobile':'desktop'}-${fixture}-${control}.png`;await page.screenshot({path});results.visuals.push({mobile,fixture,control,path});
    }
    await page.evaluate(()=>{performance.now=window.__perf.now;});await page.emulateMedia({reducedMotion:'no-preference'});
    if(!mobile&&fixture==='beacon'){
      const cdp=await context.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');await page.waitForTimeout(5000);const profile=await cdp.send('Profiler.stop');await writeFile(output+'/beacon-after.cpuprofile',JSON.stringify(profile.profile));await cdp.detach();
    }
    await context.close();
  }
}finally{results.ended=new Date().toISOString();await writeFile(output+'/metrics.json',JSON.stringify(results,null,2));await browser.close();}
