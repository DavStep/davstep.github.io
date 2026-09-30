import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(`${homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const base=process.env.TOWN_URL||'http://127.0.0.1:5173';
const output=process.argv[2]||'/tmp/hero-interaction-review';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const view=page=>page.evaluate(()=>({position:window.__townDebug.town.camera.position.toArray(),up:window.__townDebug.town.camera.up.toArray(),frame:window.__townDebug.town.renderer.info.render.frame}));
const changed=(a,b)=>a.position.some((v,i)=>Math.abs(v-b.position[i])>.1)||a.up.some((v,i)=>Math.abs(v-b.up[i])>.001);
async function waitForChange(page,before){
  await page.waitForFunction(before=>{
    const camera=window.__townDebug.town.camera;
    return camera.position.toArray().some((v,i)=>Math.abs(v-before.position[i])>.1)||camera.up.toArray().some((v,i)=>Math.abs(v-before.up[i])>.001);
  },before);
}
try{
  for(const [name,width,height] of [['desktop',1440,900],['phone',390,844],['small',320,700]]){
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce',colorScheme:'dark'}),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(base);await page.waitForFunction(()=>document.querySelector('#hero-world-view').dataset.live==='true',null,{timeout:90000});
    await page.locator('.hero-world-controls').waitFor();
    const initial=await view(page),save=await page.evaluate(()=>JSON.stringify(window.__townDebug.gameSave));
    await page.locator('#hero-world-view').scrollIntoViewIfNeeded();
    const bounds=await page.locator('#town-canvas').boundingBox();
    const x=name==='desktop'?bounds.x+bounds.width*.7:bounds.x+bounds.width*.6;
    const y=name==='desktop'?bounds.y+bounds.height*.4:bounds.y+bounds.height-151;
    assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,{x,y}),'town-canvas',`${name}: globe is blocked`);
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+55,y,{steps:8});await page.mouse.up();
    await waitForChange(page,initial);
    assert.equal(await page.evaluate(()=>document.querySelector('#hero-world-view').dataset.dragging),undefined);
    const horizontal=await view(page);
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+35,{steps:6});await page.mouse.up();
    await waitForChange(page,horizontal);
    assert.ok(!await page.locator('#town-experience').isVisible(),'Dragging opened the game');
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__townDebug.gameSave)),save,'Dragging changed saved choices');
    await page.locator('#hero-world-view').focus();
    let before=await view(page);await page.keyboard.press('ArrowLeft');await waitForChange(page,before);
    before=await view(page);await page.keyboard.press('ArrowUp');await waitForChange(page,before);
    await page.keyboard.press('Home');await page.waitForTimeout(180);
    assert.ok(!changed(initial,await view(page)),'Home did not restore the initial view');
    before=await view(page);await page.locator('[data-hero-rotate="right"]').click();await waitForChange(page,before);
    const manual=await view(page);await page.waitForTimeout(250);
    assert.equal((await view(page)).frame,manual.frame,'Reduced motion keeps rendering after interaction');
    await page.screenshot({path:`${output}/${name}-rotated.png`});
    await page.locator('.hero-world-entry').click();await page.locator('body.game-playing').waitFor();
    const gameCamera=await view(page);
    const gameBounds=await page.locator('#town-canvas').boundingBox();
    await page.mouse.move(gameBounds.width*.75,gameBounds.height*.4);await page.mouse.down();
    await page.mouse.move(gameBounds.width*.75+60,gameBounds.height*.4+30,{steps:8});await page.mouse.up();await waitForChange(page,gameCamera);
    await page.locator('#brand').click();await page.waitForTimeout(180);
    assert.ok(!changed(manual,await view(page)),'Returning to the portfolio lost its orbit');
    await page.mouse.move(x,y);const camera=await view(page),zoomScroll=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,-380);await page.waitForTimeout(300);
    const radius=c=>Math.hypot(...c.position);
    assert.ok(radius(await view(page))<radius(camera)*.8,'Wheel did not zoom in');
    assert.equal(await page.evaluate(()=>scrollY),zoomScroll,'Zoom scrolled the page');
    await page.locator('[data-hero-zoom="out"]').click();await page.waitForTimeout(180);
    assert.ok(radius(await view(page))>radius(camera)*.8,'Zoom-out control did not pull back');
    await page.locator('#hero-world-view').focus();await page.keyboard.press('Home');await page.waitForTimeout(180);
    assert.ok(!changed(initial,await view(page)),'Reset did not restore zoom and rotation');
    assert.deepEqual(errors,[]);await page.close();
    console.log(`${name}: two-axis drag, keyboard, reset, saved progress, game transition, and zoom passed`);
  }
  {
  const motion=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
  await motion.goto(base);await motion.waitForFunction(()=>document.querySelector('#hero-world-view').dataset.live==='true',null,{timeout:90000});
  await motion.locator('[data-hero-motion]').click();await motion.waitForTimeout(150);
  const paused=await view(motion);await motion.waitForTimeout(250);
  assert.equal((await view(motion)).frame,paused.frame,'Pause did not stop rendering');
  await motion.locator('[data-hero-rotate="right"]').click();await waitForChange(motion,paused);
  const rotated=await view(motion);await motion.waitForTimeout(250);
  assert.equal((await view(motion)).frame,rotated.frame,'Paused rotation kept rendering');
  await motion.locator('[data-hero-motion]').click();await motion.waitForTimeout(250);
  assert.ok((await view(motion)).frame>rotated.frame,'Resume did not restart motion');
  await motion.close();console.log('Pause, rotate while paused, and resume passed');
  }
  const touch=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  await touch.goto(base);await touch.waitForFunction(()=>document.querySelector('#hero-world-view').dataset.live==='true',null,{timeout:90000});
  await touch.locator('#hero-world-view').scrollIntoViewIfNeeded();
  const bounds=await touch.locator('#town-canvas').boundingBox();
  const session=await touch.context().newCDPSession(touch),x=bounds.x+90,y=bounds.y+bounds.height-149;
  async function swipe(dx,dy){
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=8;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/8,y:y+dy*i/8}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  const before=await view(touch);await swipe(90,0);await waitForChange(touch,before);
  const after=await view(touch),scrollBefore=await touch.evaluate(()=>scrollY);await swipe(0,-110);await touch.waitForTimeout(300);
  assert.ok(await touch.evaluate(()=>scrollY)>scrollBefore+30,'Vertical touch gesture did not scroll');
  assert.ok(!changed(after,await view(touch)),'Vertical scroll rotated the planet');
  assert.equal(await touch.evaluate(()=>document.querySelector('#hero-world-view').dataset.dragging),undefined);
  await touch.locator('#hero-world-view').scrollIntoViewIfNeeded();await touch.waitForTimeout(180);
  const radiusBefore=Math.hypot(...(await view(touch)).position);
  const touchBounds=await touch.locator('#town-canvas').boundingBox(),py=touchBounds.y+touchBounds.height-155,px=touchBounds.x+150;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:px-25,y:py},{id:2,x:px+25,y:py}]});
  for(let i=1;i<=8;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:px-25-i*5,y:py},{id:2,x:px+25+i*5,y:py}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.waitForTimeout(180);
  assert.ok(Math.hypot(...(await view(touch)).position)<radiusBefore*.8,'Touch pinch did not zoom the globe');
  assert.equal(await touch.evaluate(()=>visualViewport.scale),1,'Pinch zoomed the page');
  await touch.close();console.log('Real touch gestures: horizontal rotation and vertical page scrolling passed');
  const momentumPage=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
  await momentumPage.goto(base);await momentumPage.waitForFunction(()=>document.querySelector('#hero-world-view').dataset.live==='true',null,{timeout:90000});
  const box=await momentumPage.locator('#town-canvas').boundingBox(),mx=box.x+box.width*.7,my=box.y+box.height*.4;
  await momentumPage.mouse.move(mx,my);await momentumPage.mouse.down();await momentumPage.mouse.move(mx+65,my+25,{steps:8});await momentumPage.mouse.up();
  await momentumPage.waitForTimeout(100);const release=await view(momentumPage);await momentumPage.waitForTimeout(250);
  assert.ok(changed(release,await view(momentumPage)),'Rotation stopped after release');
  await momentumPage.waitForTimeout(2000);const slow=await view(momentumPage);await momentumPage.waitForTimeout(400);
  assert.ok(changed(slow,await view(momentumPage)),'Slow rotation did not continue after coasting');
  await momentumPage.emulateMedia({reducedMotion:'reduce'});await momentumPage.locator('[data-hero-motion]').waitFor({state:'hidden'});await momentumPage.waitForTimeout(100);
  const reducedFrame=(await view(momentumPage)).frame;await momentumPage.waitForTimeout(250);
  assert.equal((await view(momentumPage)).frame,reducedFrame,'Changing the browser motion preference did not stop rendering');
  await momentumPage.emulateMedia({reducedMotion:'no-preference'});await momentumPage.locator('[data-hero-motion]').waitFor();await momentumPage.waitForTimeout(200);
  assert.ok((await view(momentumPage)).frame>reducedFrame,'Changing the browser motion preference did not resume rendering');
  await momentumPage.close();console.log('Normal motion: drag momentum, slow spin, and browser motion preference changes passed');
}finally{await browser.close();}
