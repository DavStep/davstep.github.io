import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(`${homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const base=process.env.TOWN_URL||'http://127.0.0.1:5173';
const output=process.argv[2]||'/tmp/theme-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const backgrounds={light:'rgb(245, 245, 245)',dark:'rgb(24, 24, 24)'};
async function expectTheme(page,theme){
  await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),backgrounds[theme]);
  assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).colorScheme),theme);
}
try{
  for(const [name,width,height] of [['desktop',1440,900],['tablet',820,1000],['phone',390,844],['small',320,700]]){
    const page=await browser.newPage({viewport:{width,height},colorScheme:'dark',reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(base);await expectTheme(page,'dark');
    assert.equal(await page.locator('#theme-select').inputValue(),'system');
    await page.waitForFunction(()=>document.querySelector('#hero-world-view').dataset.live==='true',null,{timeout:90000});
    await page.evaluate(()=>document.fonts.ready);
    for(const theme of ['dark','light']){
      await page.locator('#theme-select').selectOption(theme);await expectTheme(page,theme);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}: overflow`);
      await page.screenshot({path:`${output}/${name}-${theme}.png`});
    }
    assert.deepEqual(errors,[]);await page.close();
    console.log(`${name}: both appearances, live hero, and responsive layout passed`);
  }
  const page=await browser.newPage({colorScheme:'light',reducedMotion:'reduce'});
  await page.goto(base);await expectTheme(page,'light');
  await page.emulateMedia({colorScheme:'dark'});await expectTheme(page,'dark');
  await page.locator('#theme-select').selectOption('light');
  await page.reload();await expectTheme(page,'light');
  assert.equal(await page.locator('#theme-select').inputValue(),'light');
  await page.emulateMedia({colorScheme:'dark'});await expectTheme(page,'light');
  await page.locator('#theme-select').selectOption('system');await expectTheme(page,'dark');
  assert.equal(await page.evaluate(()=>localStorage.getItem('davstep.appearance')),null);
  await page.emulateMedia({colorScheme:'light'});await expectTheme(page,'light');
  // The same palette must survive the town's asynchronously loaded styles.
  await page.locator('.hero-world-entry').click();await page.locator('body.game-playing').waitFor({timeout:90000});
  await page.locator('.chrome [data-panel="work"]').click();await page.locator('#content-panel.open').waitFor();
  for(const theme of ['light','dark']){
    await page.emulateMedia({colorScheme:theme});
    await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
    assert.equal(await page.locator('#panel-body').evaluate(el=>getComputedStyle(el).backgroundColor),backgrounds[theme]);
    assert.equal(await page.locator('.game-hud').evaluate(el=>getComputedStyle(el).backgroundColor),backgrounds[theme]);
    for(const section of ['work','about','contact']){
      await page.locator(`.panel-tab[data-panel="${section}"]`).click();
      await page.screenshot({path:`${output}/game-${section}-${theme}.png`});
    }
  }
  await page.keyboard.press('Escape');await page.locator('#brand').click();await expectTheme(page,'dark');
  await page.close();
  console.log('System changes, persisted override, reset, and game panel themes passed');
  // First paint is themed even before the application module executes.
  const early=await browser.newPage({colorScheme:'dark'});
  await early.route('**/src/portfolio.ts',route=>route.abort());
  await early.goto(base);await expectTheme(early,'dark');await early.close();
  for(const fallback of ['no-preference','unsupported','blocked-storage']){
    const fallbackPage=await browser.newPage({colorScheme:'dark'});
    if(fallback==='blocked-storage')await fallbackPage.addInitScript(()=>{
      Storage.prototype.getItem=()=>{throw new Error('Storage blocked');};
      Storage.prototype.setItem=()=>{throw new Error('Storage blocked');};
      Storage.prototype.removeItem=()=>{throw new Error('Storage blocked');};
    });
    else await fallbackPage.addInitScript(fallback=>{
      if(fallback==='unsupported'){window.matchMedia=undefined;return;}
      const original=window.matchMedia.bind(window);
      window.matchMedia=query=>query.includes('prefers-color-scheme')?{matches:false,media:query,addEventListener(){},removeEventListener(){}}:original(query);
    },fallback);
    await fallbackPage.route('**/src/town/main.ts',route=>route.abort());
    await fallbackPage.goto(base);await expectTheme(fallbackPage,'dark');
    await fallbackPage.locator('#theme-select').selectOption('light');await expectTheme(fallbackPage,'light');
    await fallbackPage.close();
  }
  console.log('First paint, dark fallback, and storage-unavailable controls passed');
}finally{await browser.close();}
