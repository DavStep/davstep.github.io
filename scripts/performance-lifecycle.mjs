// Run after the timing pass; collected heaps never overlap frame measurements.
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TOWN_PLAYWRIGHT_PATH??`${homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const output=process.argv[2]??'/tmp/town-lifecycle',base=process.env.TOWN_URL??'http://127.0.0.1:5173';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.TOWN_BROWSER_CHANNEL??'chrome'});
const result={started:new Date().toISOString(),cycles:[],panels:[],soak:[],errors:[]};
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
  page.on('pageerror',e=>result.errors.push(String(e)));
  await page.goto(base+'/?playtest=1&profile=1');await page.waitForFunction(()=>!!window.__townDebug,{timeout:120000});
  const cdp=await context.newCDPSession(page);
  const order=['settlers','grove','workshop','roads','archive','river','observatory','market','windmill','walls'];
  for(let cycle=0;cycle<6;cycle++){
    await page.evaluate(()=>window.__townDebug.restart());
    for(const idea of order){
      await page.evaluate(idea=>{void window.__townDebug.choose(idea);},idea);
      await page.waitForTimeout(100);
      await page.evaluate(()=>window.__townDebug.skip());
    }
    await page.waitForTimeout(600);
    const state=await page.evaluate(()=>window.__townDebug.gameState());
    if(state.order.join()!==order.join()||!state.world.beacon)throw new Error('Restart/play/skip did not reach the deterministic beacon ending');
    await cdp.send('HeapProfiler.collectGarbage');
    const heap=await cdp.send('Runtime.getHeapUsage');
    const counts=await page.evaluate(()=>{
      const t=window.__townDebug.town;let nodes=0;t.scene.traverse(()=>nodes++);
      return {nodes,geometries:t.renderer.info.memory.geometries,textures:t.renderer.info.memory.textures,projectionObjects:t.planet.watched.size,depths:t.planet.depths.size};
    });
    result.cycles.push({cycle,heap,counts});console.log(JSON.stringify(result.cycles.at(-1)));
  }
  await page.reload();await page.waitForFunction(()=>!!window.__townDebug,{timeout:120000});
  result.reload=await page.evaluate(()=>({order:window.__townDebug.gameState().order,beacon:window.__townDebug.gameState().world.beacon}));
  if(result.reload.order.join()!==order.join()||!result.reload.beacon)throw new Error('Reload lost saved progress');
  for(let repeat=0;repeat<3;repeat++)for(const panel of ['work','about','contact','project-wizard']){
    const started=performance.now();
    await page.evaluate(panel=>document.querySelector(`[data-panel="${panel.startsWith('project-')?'work':panel}"]`).click(),panel);
    if(panel.startsWith('project-'))await page.locator(`[data-project-link="${panel.slice(8)}"]`).click();
    await page.waitForFunction(()=>document.querySelector('#content-panel')?.classList.contains('open'));
    const visible=await page.evaluate(()=>({view:document.querySelector('#content-panel')?.getAttribute('data-view'),title:document.querySelector('#panel-title')?.textContent}));
    result.panels.push({panel,repeat,automationCompletionMs:performance.now()-started,visible});
    await page.locator('#panel-close').click();await page.waitForTimeout(450);
  }
  const cover=await context.newPage();await cover.goto('about:blank');await cover.bringToFront();
  const hidden=await page.evaluate(()=>document.hidden);
  const before=await page.evaluate(()=>window.__townDebug.town.renderer.info.render.frame);await page.waitForTimeout(2000);
  const after=await page.evaluate(()=>window.__townDebug.town.renderer.info.render.frame);
  result.background={hidden,framesBefore:before,framesAfter:after,stopped:hidden&&after-before<=1};
  await cover.close();await page.bringToFront();
  if(!hidden)result.background.reason='Headless browser did not expose document.hidden; background verdict unverified';
  // A bounded 2-minute desktop diagnostic, not 30-minute phone acceptance.
  for(let sample=0;sample<12;sample++){
    await page.waitForTimeout(10000);
    result.soak.push(await page.evaluate(()=>({time:performance.now(),heap:performance.memory?.usedJSHeapSize??null,profile:{...document.body.dataset},memory:{...window.__townDebug.town.renderer.info.memory}})));
    await writeFile(output+'/lifecycle.json',JSON.stringify(result,null,2));
  }
  await cdp.send('HeapProfiler.collectGarbage');result.finalHeap=await cdp.send('Runtime.getHeapUsage');
  result.finalState=await page.evaluate(()=>window.__townDebug.gameState());await cdp.detach();
}finally{result.ended=new Date().toISOString();await writeFile(output+'/lifecycle.json',JSON.stringify(result,null,2));await browser.close();}
