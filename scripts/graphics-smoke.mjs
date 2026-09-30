import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
const require=createRequire(import.meta.url);
const {chromium}=require(`${homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const output=process.argv[2]??'/tmp/town-graphics',base=process.env.TOWN_URL??'http://127.0.0.1:5173';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.addInitScript(()=>localStorage.setItem('davstep.choice-planet.v3.playtest',JSON.stringify({version:3,started:true,order:['settlers','grove','workshop','roads','archive','river','observatory','market','windmill','walls'],bestMax:0,bestScore:0,secretFound:false})));
  await page.goto(base+'/?playtest=1&profile=1');await page.waitForFunction(()=>!!window.__townDebug,{timeout:120000});await page.waitForTimeout(4000);
  const river=await page.evaluate(()=>{const mesh=window.__townDebug.town.scene.getObjectByName('Flowing mill river');return {visible:mesh?.parent.visible,vertices:mesh?.geometry.drawRange.count};});
  if(!river.visible||!(river.vertices>0))throw new Error('Restored river is not rendering');
  await page.evaluate(()=>{
   window.__labelWrites=0;window.__labelObserver=new MutationObserver(records=>window.__labelWrites+=records.length);
   window.__labelObserver.observe(document.querySelector('#world-labels'),{subtree:true,attributes:true,attributeFilter:['style']});
  });await page.waitForTimeout(2000);
  const stableLabelWrites=await page.evaluate(()=>{window.__labelObserver.disconnect();return window.__labelWrites;});
  const panels=[];
  await page.locator('.chrome [data-panel="work"]').click();
  for(const panel of ['work','about','contact']){
   await page.locator(`.panel-rail [data-panel="${panel}"]`).click();await page.waitForFunction(()=>document.querySelector('#content-panel').classList.contains('open'));
   panels.push(await page.locator('#panel-title').textContent());
  }
  await page.locator('#panel-close').click();await page.waitForTimeout(450);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{
   const t=window.__townDebug.town,render=t.render;t.render=function(snapshot,roaming){
    return render.call(this,{...snapshot,weather:window.__weather??'clear',dayFraction:window.__dayFraction??.19},roaming);
   };
  });
  const lighting=[];
  for(const [name,weather,dayFraction] of [['day','clear',.19],['overcast','cloudy',.19],['night','clear',.8]]){
   await page.evaluate(({weather,dayFraction})=>{window.__weather=weather;window.__dayFraction=dayFraction;},{weather,dayFraction});await page.waitForTimeout(400);
   lighting.push(await page.evaluate(()=>{const t=window.__townDebug.town;return {sun:t.sun.intensity,fill:t.fill.intensity,shadow:t.sun.shadow.intensity,exposure:t.renderer.toneMappingExposure};}));
   await page.screenshot({path:`${output}/${mobile?'mobile':'desktop'}-${name}.png`});
  }
  if(!(lighting[1].sun<lighting[0].sun&&lighting[2].sun<lighting[0].sun*.4))throw new Error('Weather/moonlight did not modulate rendering');
  if(!mobile){
   await page.evaluate(async()=>{
    window.__weather='clear';window.__dayFraction=.19;
    const {planetPoint}=await import('/src/town/planet-layout.ts'),{terrainHeight}=await import('/src/town/environment.ts');
    const t=window.__townDebug.town,render=t.render;
    const target=planetPoint(46,terrainHeight(46,-20)+.2,-20),position=planetPoint(58,terrainHeight(58,-4)+28,-4);
    t.render=function(...args){this.camera.position.copy(position);this.camera.clearViewOffset();this.camera.lookAt(target);return render.apply(this,args);};
    document.querySelector('#world-labels').style.visibility='hidden';document.querySelector('#game-hud')?.style.setProperty('visibility','hidden');
   });await page.waitForTimeout(500);await page.screenshot({path:`${output}/river-detail.png`});
  }
  results.push({mobile,river,stableLabelWrites,panels,lighting,errors});if(errors.length)throw new Error(errors.join('\n'));
  await context.close();
 }
}finally{await writeFile(`${output}/graphics-smoke.json`,JSON.stringify(results,null,2));await browser.close();}
