import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>localStorage.setItem('davstep.choice-planet.v3',JSON.stringify({version:3,started:true,order:['settlers','grove','workshop','roads','archive','river','observatory','market','windmill','walls'],bestMax:0,bestScore:0,secretFound:false})));
  const start=Date.now();await page.goto('http://127.0.0.1:5176/?profile=1');await page.waitForFunction(()=>document.body.classList.contains('town-ready'),{timeout:120000});await page.waitForTimeout(1500);
  const state=await page.evaluate(()=>({debug:!!window.__townDebug,canvasVisible:!document.querySelector('#town-canvas').hidden,fallbackHidden:document.querySelector('#fallback').hidden,summary:document.querySelector('#game-summary').textContent,profile:{...document.body.dataset}}));
  await page.locator('[data-panel="work"]').first().click();await page.waitForFunction(()=>document.querySelector('#content-panel').classList.contains('open'));state.panel=await page.locator('#panel-title').textContent();await page.locator('#panel-close').click();
  results.push({mobile,readyMs:Date.now()-start,state,errors});
  if(state.debug||!state.canvasVisible||!state.fallbackHidden||!state.summary.includes('Beacon')||errors.length)throw new Error('Production initialization failed');
  await context.close();
 }
}finally{await writeFile('/tmp/town-graphics/production-smoke.json',JSON.stringify(results,null,2));await browser.close();}
