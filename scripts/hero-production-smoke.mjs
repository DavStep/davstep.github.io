import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const runtime=`${homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`;
const {chromium}=require(`${runtime}/playwright`);
const {PNG}=require(`${runtime}/pngjs`);
function changed(a,b) {
  const first=PNG.sync.read(a),second=PNG.sync.read(b);
  if(first.width!==second.width||first.height!==second.height)return true;
  let pixels=0;
  for(let i=0;i<first.data.length;i+=4) {
    if([0,1,2].some(channel=>Math.abs(first.data[i+channel]-second.data[i+channel])>8))pixels++;
  }
  // GPU antialiasing can vary at a few edges even without a new scene frame.
  return pixels>first.width*first.height*.001;
}
const base=process.env.TOWN_URL||'http://127.0.0.1:4173';
const output=process.argv[2]||'/tmp/hero-production-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
  for(const [name,width,height] of [['desktop',1440,900],['tablet',820,1000],['phone',390,844],['small',320,700]]) {
    for(const theme of ['light','dark']) {
      const page=await browser.newPage({viewport:{width,height},colorScheme:theme,reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',error=>errors.push(String(error)));
      await page.goto(base);
      await page.waitForFunction(()=>document.querySelector('#hero-world-view').dataset.live==='true',null,{timeout:90000});
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(500); // Let the initial poster fade finish before comparing frames.
      const copy=await page.locator('.hero-copy').boundingBox();
      const world=await page.locator('#hero-world-view').boundingBox();
      if(width>760)assert.ok(world.x>=copy.x+copy.width,`${name}: planet overlaps the text`);
      else assert.ok(world.y>=copy.y+copy.height,`${name}: planet must be below the text`);
      await page.locator('#hero-world-view').scrollIntoViewIfNeeded();
      const canvas=page.locator('#town-canvas');
      const bounds=await canvas.boundingBox();
      // Every visible part of the planet belongs to the canvas, including its left edge.
      for(const fraction of [.2,.5,.8]) {
        const point={x:bounds.x+bounds.width*fraction,y:bounds.y+bounds.height*.45};
        assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,point),'town-canvas',`${name}: text blocks dragging`);
      }
      const saved=await page.evaluate(()=>localStorage.getItem('davstep.choice-planet.v3'));
      const still=await canvas.screenshot();
      await page.waitForTimeout(250);
      assert.ok(!changed(still,await canvas.screenshot()),`${name}: reduced motion animates`);
      await page.locator('[data-hero-rotate="right"]').click();
      assert.ok(changed(still,await canvas.screenshot()),`${name}: rotate button does not render`);
      await page.locator('#hero-world-view').focus();
      const beforeKey=await canvas.screenshot();await page.keyboard.press('ArrowUp');
      assert.ok(changed(beforeKey,await canvas.screenshot()),`${name}: keyboard does not rotate`);
      const beforeDrag=await canvas.screenshot();
      const x=bounds.x+bounds.width*.35,y=bounds.y+bounds.height*.45;
      await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+45,y+20,{steps:8});await page.mouse.up();
      assert.ok(changed(beforeDrag,await canvas.screenshot()),`${name}: dragging does not rotate`);
      assert.equal(await page.evaluate(()=>localStorage.getItem('davstep.choice-planet.v3')),saved,'Hero changed saved progress');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
      // Browser resizing must restore the desktop column after a phone layout.
      if(name==='desktop') {
        await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
        await page.setViewportSize({width,height});await page.waitForTimeout(150);
        const resizedCopy=await page.locator('.hero-copy').boundingBox(),resizedWorld=await page.locator('#hero-world-view').boundingBox();
        assert.ok(resizedWorld.x>=resizedCopy.x+resizedCopy.width,'Resize lost the right column');
      }
      await page.screenshot({path:`${output}/${name}-${theme}.png`});
      await page.emulateMedia({reducedMotion:'no-preference'});
      const motion=page.locator('[data-hero-motion]');await motion.waitFor();
      const spinning=await canvas.screenshot();await page.waitForTimeout(600);
      assert.ok(changed(spinning,await canvas.screenshot()),`${name}: planet does not animate`);
      await motion.click();await page.waitForTimeout(200);
      const paused=await canvas.screenshot();await page.waitForTimeout(250);
      assert.ok(!changed(paused,await canvas.screenshot()),`${name}: pause does not stop motion`);
      await page.locator('[data-hero-rotate="left"]').click();
      assert.ok(changed(paused,await canvas.screenshot()),`${name}: paused planet cannot rotate`);
      await motion.click();const resumed=await canvas.screenshot();await page.waitForTimeout(500);
      assert.ok(changed(resumed,await canvas.screenshot()),`${name}: resume does not animate`);
      assert.deepEqual(errors,[]);await page.close();
      console.log(`${name} ${theme}: placement, unobstructed drag, buttons, keyboard, reduced motion, animation, pause/resume passed`);
    }
  }
} finally {await browser.close();}
