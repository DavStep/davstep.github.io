import * as THREE from 'three';
import { TownScene } from './scene';
import { Residents } from './residents';
import { RoamController } from './navigation';
import { buildColliders, isBlocked, type Collider } from './collision';
import { terrainHeight } from './environment';
import { MILESTONES, TOWN_SAVE_KEY, parseSave, milestoneRecap, townAt, MINUTE, type TownSnapshot } from './model';
import { PROJECTS, PROJECT_BY_KEY, type ProjectKey } from './projects';
import './style.css';
import './style-2.css';
import './style-3.css';

const $ = <T extends HTMLElement>(selector:string) => document.querySelector(selector) as T;
const canvas=$<HTMLCanvasElement>('#town-canvas');
const labels=$<HTMLDivElement>('#world-labels');
const panel=$<HTMLElement>('#content-panel');
const backdrop=$<HTMLDivElement>('#panel-backdrop');
const panelBody=$<HTMLDivElement>('#panel-body');
const panelTitleId='panel-title';
const panelKicker=$<HTMLSpanElement>('#panel-kicker');
const closeButton=$<HTMLButtonElement>('#panel-close');
const toast=$<HTMLDivElement>('#toast');
const intro=$<HTMLElement>('#intro');
const fallback=$<HTMLDivElement>('#fallback');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const profile=import.meta.env.DEV||new URLSearchParams(location.search).has('profile');
if(profile&&'PerformanceObserver'in window){
  let layoutShift=0;
  for(const type of ['largest-contentful-paint','layout-shift','event'] as const){
    if(!PerformanceObserver.supportedEntryTypes.includes(type))continue;
    try{
      new PerformanceObserver(list=>{for(const entry of list.getEntries()){
        if(type==='largest-contentful-paint')document.body.dataset.lcpMs=entry.startTime.toFixed(0);
        else if(type==='layout-shift'&&!(entry as PerformanceEntry & {hadRecentInput?:boolean}).hadRecentInput){layoutShift+=(entry as PerformanceEntry & {value:number}).value;document.body.dataset.cls=layoutShift.toFixed(3);}
        else if(type==='event'&&entry.duration>Number(document.body.dataset.interactionMs||0))document.body.dataset.interactionMs=entry.duration.toFixed(0);
      }}).observe({type,buffered:true} as PerformanceObserverInit);
    }catch{}
  }
}
const save=(()=>{try{return parseSave(localStorage.getItem(TOWN_SAVE_KEY),Date.now());}catch{return parseSave(null,Date.now());}})();
const ageParam=profile?new URLSearchParams(location.search).get('age'):null;
const previewAge=ageParam===null?NaN:Number(ageParam);
const previewStarted=Date.now();
const townNow=()=>Number.isFinite(previewAge)&&previewAge>=0?save.createdAt+previewAge*MINUTE+(Date.now()-previewStarted):Date.now();
const recap=milestoneRecap(save,Date.now());
function persist(){save.lastSeenAt=Date.now();save.elapsedFloorMs=Math.max(save.elapsedFloorMs,save.lastSeenAt-save.createdAt);save.eventCursor=Math.floor(save.elapsedFloorMs/MINUTE);try{localStorage.setItem(TOWN_SAVE_KEY,JSON.stringify(save));}catch{}}
let snapshot:TownSnapshot=townAt(save,townNow());
let rainPreview=false;
const weatherSnapshot=():TownSnapshot=>rainPreview?{...snapshot,weather:'rain'}:snapshot;
let town:TownScene|null=null,residents:Residents|null=null;
let colliders:Collider[]=[],roaming=false;
const roam=new RoamController();
const heldKeys=new Set<string>();
const walkButton=$<HTMLButtonElement>('#control-walk');
const walkHint=$<HTMLDivElement>('#walk-hint');
const joystick=$<HTMLDivElement>('#joystick');
const joystickStick=$<HTMLDivElement>('#joystick-stick');
let joystickInput={x:0,z:0};
let target=new THREE.Vector3(0,0,0),desiredTarget=target.clone();
let azimuth=.72,elevation=1.05,distance=154,desiredAzimuth=azimuth,desiredElevation=elevation,desiredDistance=distance;
const touchControls=matchMedia('(pointer: coarse), (max-width: 700px)');
const roamStartPosition=new THREE.Vector3(),roamStartLook=new THREE.Vector3(),roamEye=new THREE.Vector3(),roamLook=new THREE.Vector3();
let roamTransition=1;
let pointerStart:{x:number;y:number;time:number}|null=null;
let lastPointer:{x:number;y:number}|null=null;
const pointers=new Map<number,{x:number;y:number}>();
let pinchDistance=0,dragged=false,lastFrame=0,lastModel=0,frameSamples:number[]=[],pixelRatio=1;
let activePanel:string|null=null,lastFocus:HTMLElement|null=null,toastTimer=0;
const labelButtons=new Map<ProjectKey,HTMLButtonElement>();

function announce(text:string){toast.textContent=text;toast.hidden=false;clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>toast.hidden=true,5500);}
function saveNow(){persist();}
window.addEventListener('pagehide',saveNow);
document.addEventListener('visibilitychange',()=>{if(document.hidden){heldKeys.clear();saveNow();}else {snapshot=townAt(save,townNow());town?.update(weatherSnapshot());lastFrame=0;}});
window.setInterval(persist,15000);
function setIntroHidden(value:boolean){intro.classList.toggle('dismissed',value);}
$('#intro-hide').addEventListener('click',()=>setIntroHidden(true));
$('#intro-work').addEventListener('click',()=>openPanel('work'));
$('#open-work-mobile').addEventListener('click',()=>openPanel('work'));
$('#brand').addEventListener('click',()=>{closePanel();if(roaming)leaveRoam();else recenter();setIntroHidden(false);});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-panel]'))button.addEventListener('click',()=>openPanel(button.dataset.panel!));

function projectMarkup(key:ProjectKey):string{
  const p=PROJECT_BY_KEY[key];
  return `<div class="project-panel"><div class="project-visual"><img src="${p.image}" alt="Art from ${p.title}" loading="eager" /><span class="visual-caption">✦ &nbsp; ${p.landmark.toUpperCase()}</span></div><div class="panel-copy"><div class="landmark-name">PROJECT LANDMARK / ${p.landmark}</div><h2 id="${panelTitleId}">${p.title}</h2><p class="lead">${p.description}</p><p class="contribution">${p.contribution}</p>${p.url?`<a class="panel-action" href="${p.url}" target="_blank" rel="noopener noreferrer">Explore ${p.title} <span>↗</span></a>`:'<span class="development-note">In development · more to show soon</span>'}<div class="panel-endmark">DAV STEPANYAN <span>✦</span> SELECTED WORK</div></div></div>`;
}
function editorialArt(symbol:string,heading:string,sub:string){return `<div class="editorial-art" aria-hidden="true"><div class="art-grid"></div><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="art-symbol">${symbol}</div><div class="art-caption"><span>✦ &nbsp; THE LIVING TOWN</span><strong>${heading}</strong><small>${sub}</small></div></div>`;}
function workMarkup():string{return `<div class="editorial-panel">${editorialArt('⌂','THE ARCHIVE','01 — FIVE PROJECTS')}<div class="panel-copy"><div class="landmark-name">FIVE PLACES TO EXPLORE</div><h2 id="${panelTitleId}">Selected work</h2><p class="lead">Games, playful systems, and experiments. Each project has a place in the town.</p><div class="work-list">${PROJECTS.map((p,i)=>`<button type="button" data-project-link="${p.key}"><span class="work-index">0${i+1}</span><span><strong>${p.title}</strong><small>${p.kicker}</small></span><span class="work-arrow">↗</span></button>`).join('')}</div></div></div>`;}
function aboutMarkup():string{return `<div class="editorial-panel">${editorialArt('✦','THE BUILDER','02 — ABOUT')}<div class="panel-copy"><div class="landmark-name">THE PERSON BEHIND THE WORLD</div><h2 id="${panelTitleId}">Hi, I'm Dav.</h2><p class="lead">I make worlds that won't sit still.</p><p>I'm a game developer in Yerevan, Armenia. At Rockbite Games I've worked across gameplay, economies, progression, and the small details that make systems feel alive. I enjoy both writing the code and watching what players actually do with it.</p><p>After hours, I keep building: browser games, creative tools, and a co-op mining adventure. This town is another place to try ideas and let them grow.</p><div class="about-facts"><div><small>ROLE</small><strong>Lead Code Wizard</strong></div><div><small>BASE</small><strong>Yerevan, Armenia</strong></div><div><small>CURRENTLY BUILDING</small><strong>Drunk Dwarves</strong></div></div></div></div>`;}
function contactMarkup():string{return `<div class="editorial-panel">${editorialArt('✉','THE TOWN POST','03 — CONTACT')}<div class="panel-copy"><div class="landmark-name">THE TOWN POST</div><h2 id="${panelTitleId}">Let's make something alive.</h2><p class="lead">Have a game idea, a system to untangle, or just want to compare notes?</p><a class="panel-action" href="mailto:davitstepanyan99@gmail.com">Send me an email <span>↗</span></a><div class="contact-links"><a href="https://github.com/DavStep" target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href="https://anilist.co/user/DevStep" target="_blank" rel="noopener noreferrer">AniList ↗</a><a href="https://steamcommunity.com/id/stepdev/" target="_blank" rel="noopener noreferrer">Steam ↗</a><button type="button" id="copy-discord">Copy Discord: step_dev ↗</button></div></div></div>`;}
function validPanel(id:string|null):string|null{return id&&(id==='work'||id==='about'||id==='contact'||id.startsWith('project-')&&PROJECTS.some(p=>`project-${p.key}`===id))?id:null;}
function openPanel(id:string,updateHistory=true){
  const valid=validPanel(id);if(!valid)return;
  if(activePanel===valid)return;
  if(roaming)leaveRoam(false);
  if(!activePanel)lastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  activePanel=valid;
  panel.dataset.view=valid.startsWith('project-')?'project':valid;
  panel.querySelectorAll<HTMLButtonElement>('.panel-tab').forEach(button=>button.setAttribute('aria-current',String(button.dataset.panel===valid)));
  panelKicker.textContent=valid.startsWith('project-')?PROJECT_BY_KEY[valid.slice(8) as ProjectKey].kicker:valid==='work'?'THE TOWN ARCHIVE':valid==='about'?'ABOUT DAV':'GET IN TOUCH';
  panelBody.innerHTML=valid.startsWith('project-')?projectMarkup(valid.slice(8) as ProjectKey):valid==='work'?workMarkup():valid==='about'?aboutMarkup():contactMarkup();
  panel.hidden=false;backdrop.hidden=false;$('.chrome').inert=true;$('.town-ui').inert=true;fallback.inert=true;
  requestAnimationFrame(()=>{panel.classList.add('open');backdrop.classList.add('open');closeButton.focus();});
  document.body.classList.add('panel-open');
  if(valid.startsWith('project-')){
    const p=snapshot.plots.find(q=>q.project===valid.slice(8));
    if(p&&town){desiredTarget.set(p.x,0,p.z);desiredDistance=Math.min(desiredDistance,88);setIntroHidden(true);}
  }
  if(updateHistory)history.pushState({panel:valid},'',`#${valid}`);
  panelBody.querySelectorAll<HTMLButtonElement>('[data-project-link]').forEach(button=>button.addEventListener('click',()=>openPanel(`project-${button.dataset.projectLink}`)));
  panelBody.querySelector<HTMLButtonElement>('#copy-discord')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText('step_dev');announce('Discord name copied.');}catch{announce('Discord: step_dev');}});
}
function closePanel(updateHistory=true){
  if(!activePanel)return;
  activePanel=null;$('.chrome').inert=false;$('.town-ui').inert=false;fallback.inert=false;panel.classList.remove('open');backdrop.classList.remove('open');document.body.classList.remove('panel-open');
  window.setTimeout(()=>{if(!activePanel){panel.hidden=true;backdrop.hidden=true;panelBody.innerHTML='';}},reduced.matches?0:350);
  if(updateHistory)history.pushState({panel:null},'',location.pathname+location.search);
  lastFocus?.focus();
}
closeButton.addEventListener('click',()=>closePanel());backdrop.addEventListener('click',()=>closePanel());
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&activePanel){e.preventDefault();closePanel();return;}
  if(e.key==='Escape'&&roaming){e.preventDefault();leaveRoam();return;}
  if(!activePanel&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){
    e.preventDefault();if(!roaming)enterRoam();heldKeys.add(e.code);
  }
  if(roaming&&(e.code==='ShiftLeft'||e.code==='ShiftRight'))heldKeys.add(e.code);
  if(e.key==='Tab'&&activePanel){const items=[...panel.querySelectorAll<HTMLElement>('button,a[href]')].filter(el=>!el.hasAttribute('disabled'));if(!items.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  if(!activePanel&&e.key==='+'||!activePanel&&e.key==='=')zoom(-12);
  if(!activePanel&&e.key==='-')zoom(12);
});
document.addEventListener('keyup',e=>heldKeys.delete(e.code));
window.addEventListener('blur',()=>heldKeys.clear());
window.addEventListener('popstate',()=>{const id=validPanel(location.hash.slice(1));if(id)openPanel(id,false);else closePanel(false);});

function recenter(){desiredTarget.set(0,0,0);desiredDistance=154;desiredAzimuth=.72;desiredElevation=1.05;}
function enterRoam(){
  if(!town)return;
  const focused={x:desiredTarget.x,z:desiredTarget.z};
  const eastRoad={x:28,z:-1.5};
  const candidates=Math.hypot(focused.x,focused.z)>8?[focused,eastRoad,{x:0,z:28},{x:40,z:0}]:[eastRoad,{x:0,z:28},{x:40,z:0}];
  const spawn=candidates.find(p=>!isBlocked(p.x,p.z,colliders,.9));
  if(spawn){roam.setPosition(spawn);if(spawn!==focused)desiredAzimuth=spawn.x>20?0:Math.PI/2;}
  roaming=true;document.body.classList.add('roaming');setIntroHidden(true);
  roamStartPosition.copy(town.camera.position);roamStartLook.copy(target);roamTransition=0;
  desiredElevation=1.52;
  walkButton.textContent='Overview';walkButton.setAttribute('aria-label','Return to town overview');walkButton.setAttribute('aria-pressed','true');
  walkHint.textContent=touchControls.matches?'Use the pad to move · drag the world to look · Overview to exit':'WASD / arrows to move · Shift to move faster · Drag to look · Esc for overview';
  walkHint.hidden=false;joystick.hidden=!touchControls.matches;
}
function leaveRoam(recenterTown=true){
  roaming=false;document.body.classList.remove('roaming');roam.stop();heldKeys.clear();joystickInput={x:0,z:0};joystickStick.style.transform='translate(0,0)';
  walkButton.textContent='Roam';walkButton.setAttribute('aria-label','Roam through town');walkButton.setAttribute('aria-pressed','false');
  walkHint.hidden=true;joystick.hidden=true;
  if(town){target.copy(town.camera.position);distance=0;town.camera.fov=43;town.camera.updateProjectionMatrix();}
  desiredElevation=1.05;
  if(recenterTown)recenter();else {desiredTarget.set(roam.position.x,0,roam.position.z);desiredDistance=72;}
}
function zoom(delta:number){
  if(roaming&&town){town.camera.fov=THREE.MathUtils.clamp(town.camera.fov+delta*.4,35,65);town.camera.updateProjectionMatrix();return;}
  desiredDistance=THREE.MathUtils.clamp(desiredDistance+delta,52,220);
}
walkButton.addEventListener('click',()=>roaming?leaveRoam():enterRoam());
$('#control-recenter').addEventListener('click',()=>{if(roaming)leaveRoam();else recenter();});
$('#control-zoom-in').addEventListener('click',()=>zoom(-14));
$('#control-zoom-out').addEventListener('click',()=>zoom(14));
const settings=$<HTMLDivElement>('#settings-panel'),settingsButton=$<HTMLButtonElement>('#control-settings');
settingsButton.addEventListener('click',()=>{settings.hidden=!settings.hidden;settingsButton.setAttribute('aria-expanded',String(!settings.hidden));});
const weatherPreviewButton=$<HTMLButtonElement>('#weather-preview');
weatherPreviewButton.addEventListener('click',()=>{
  rainPreview=!rainPreview;
  weatherPreviewButton.setAttribute('aria-pressed',String(rainPreview));
  weatherPreviewButton.innerHTML=rainPreview?'Return to live weather <span aria-hidden="true">↗</span>':'Make it rain <span aria-hidden="true">↗</span>';
  town?.update(weatherSnapshot());updateReadouts();
});
function moveStick(event:PointerEvent){
  const rect=joystick.getBoundingClientRect(),radius=rect.width*.34;
  const dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2),length=Math.max(1,Math.hypot(dx,dy));
  const factor=Math.min(1,radius/length),x=dx*factor,z=dy*factor;
  joystickInput={x:x/radius,z:-z/radius};joystickStick.style.transform=`translate(${x}px,${z}px)`;
}
joystick.addEventListener('pointerdown',e=>{joystick.setPointerCapture(e.pointerId);moveStick(e);});
joystick.addEventListener('pointermove',e=>{if(joystick.hasPointerCapture(e.pointerId))moveStick(e);});
for(const type of ['pointerup','pointercancel'] as const)joystick.addEventListener(type,()=>{joystickInput={x:0,z:0};joystickStick.style.transform='translate(0,0)';});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY*.025);},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(activePanel)return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pointerStart={x:e.clientX,y:e.clientY,time:performance.now()};lastPointer={x:e.clientX,y:e.clientY};dragged=false;});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||activePanel)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const p=[...pointers.values()];const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinchDistance)zoom((pinchDistance-d)*.18);pinchDistance=d;dragged=true;return;}
  if(!lastPointer)return;
  const dx=e.clientX-lastPointer.x,dy=e.clientY-lastPointer.y;
  if(pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5)dragged=true;
  if(dragged){
    desiredAzimuth+=(roaming?dx:-dx)*.006;
    desiredElevation=THREE.MathUtils.clamp(desiredElevation+(roaming?-dy:dy)*.005,roaming?.75:.38,roaming?2.15:1.42);
    setIntroHidden(true);
  }
  lastPointer={x:e.clientX,y:e.clientY};
});
canvas.addEventListener('pointerup',e=>{
  pointers.delete(e.pointerId);if(pointers.size<2)pinchDistance=0;
  if(!dragged&&town&&!activePanel){const ndc=new THREE.Vector2(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight*2-1));const ray=new THREE.Raycaster();ray.setFromCamera(ndc,town.camera);let best:ProjectKey|null=null,near=Infinity;for(const [key,box] of town.pickBoxes){const hit=ray.ray.intersectBox(box,new THREE.Vector3());if(hit){const d=hit.distanceTo(town.camera.position);if(d<near){best=key;near=d;}}}if(best)openPanel(`project-${best}`);else setIntroHidden(true);}
  pointerStart=null;lastPointer=null;
});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);pointerStart=null;lastPointer=null;pinchDistance=0;});

for(const p of PROJECTS){const button=document.createElement('button');button.className='world-label';button.type='button';button.innerHTML=`<span class="label-spark">✦</span><span>${p.title}</span>`;button.setAttribute('aria-label',`Explore ${p.title}`);button.addEventListener('click',()=>openPanel(`project-${p.key}`));labels.appendChild(button);labelButtons.set(p.key,button);}
const projected=new THREE.Vector3();
function positionLabels(){
  if(!town)return;
  const introRect=intro.classList.contains('dismissed')?null:intro.getBoundingClientRect();
  for(const p of snapshot.plots){
    if(!p.project)continue;
    const button=labelButtons.get(p.project)!;
    projected.set(p.x,Math.max(3.5,2.6+p.stage*.62),p.z).project(town.camera);
    const x=(projected.x*.5+.5)*innerWidth,y=(-projected.y*.5+.5)*innerHeight;
    const behindIntro=introRect&&x>introRect.left-80&&x<introRect.right+80&&y>introRect.top-32&&y<introRect.bottom+32;
    const nearby=!roaming||Math.hypot(roam.position.x-p.x,roam.position.z-p.z)<42;
    const visible=nearby&&!behindIntro&&projected.z<1&&projected.z>-1&&projected.x>-(town.mobile?.86:1.02)&&projected.x<(town.mobile?.86:1.02)&&projected.y>-1.08&&projected.y<1.08;
    button.style.display=visible?'flex':'none';button.style.left=`${x}px`;button.style.top=`${y}px`;
  }
}
function updateReadouts(){
  $<HTMLElement>('#season-readout').textContent=snapshot.season.toUpperCase();
  $<HTMLElement>('#weather-readout').textContent=rainPreview?'RAIN · PREVIEW':snapshot.weather.toUpperCase();
  $<HTMLElement>('#age-readout').textContent=snapshot.elapsed<MINUTE?'< 1 MIN':`${Math.floor(snapshot.elapsed/MINUTE)} MIN`;
  $<HTMLElement>('#building-readout').textContent=String(snapshot.buildings);
  const event=[...MILESTONES].reverse().find(m=>snapshot.elapsed>=m.at);
  $<HTMLElement>('#status-text').textContent=event?.label??'The settlement is waking up.';
  document.body.dataset.weather=rainPreview?'rain':snapshot.weather;
  document.body.dataset.season=snapshot.season;
}
function stepCamera(dt:number){
  if(!town)return;
  const k=reduced.matches?1:1-Math.exp(-dt*8);
  azimuth+=(desiredAzimuth-azimuth)*k;elevation+=(desiredElevation-elevation)*k;
  if(roaming){
    const position=roam.position,eye=terrainHeight(position.x,position.z)+2.35;
    roamEye.set(position.x,eye,position.z);
    roamLook.set(position.x-Math.cos(azimuth)*Math.sin(elevation)*10,eye-Math.cos(elevation)*10,position.z-Math.sin(azimuth)*Math.sin(elevation)*10);
    if(roamTransition<1){
      roamTransition=Math.min(1,roamTransition+(reduced.matches?1:dt*3.5));
      const blend=1-(1-roamTransition)**3;
      town.camera.position.copy(roamStartPosition).lerp(roamEye,blend);
      target.copy(roamStartLook).lerp(roamLook,blend);
    }else{town.camera.position.copy(roamEye);target.copy(roamLook);}
    town.camera.lookAt(target);return;
  }
  target.lerp(desiredTarget,k);distance+=(desiredDistance-distance)*k;
  const horizontal=Math.sin(elevation)*distance;
  town.camera.position.set(target.x+Math.cos(azimuth)*horizontal,target.y+Math.cos(elevation)*distance,target.z+Math.sin(azimuth)*horizontal);
  town.camera.lookAt(target);
}
function frame(now:number){requestAnimationFrame(frame);if(document.hidden||!town)return;const cap=town.mobile?30:60;if(now-lastFrame<1000/cap-1)return;const elapsed=lastFrame?now-lastFrame:1000/cap;lastFrame=now;
  if(now-lastModel>750){lastModel=now;snapshot=townAt(save,townNow());town.update(weatherSnapshot());colliders=buildColliders(snapshot,[...town.environment.trees,...town.treeObstacles]);updateReadouts();}
  snapshot.elapsed=Math.max(0,townNow()-save.createdAt,save.elapsedFloorMs);snapshot.dayFraction=(snapshot.elapsed%(12*MINUTE))/(12*MINUTE);
  if(roaming){
    const input={x:(heldKeys.has('KeyD')||heldKeys.has('ArrowRight')?1:0)-(heldKeys.has('KeyA')||heldKeys.has('ArrowLeft')?1:0)+joystickInput.x,z:(heldKeys.has('KeyW')||heldKeys.has('ArrowUp')?1:0)-(heldKeys.has('KeyS')||heldKeys.has('ArrowDown')?1:0)+joystickInput.z,sprint:heldKeys.has('ShiftLeft')||heldKeys.has('ShiftRight')};
    roam.update(elapsed/1000,input,azimuth,colliders);
  }
  stepCamera(elapsed/1000);residents?.update(snapshot);positionLabels();town.render();
  if(profile&&Math.floor(now/2000)!==Math.floor((now-elapsed)/2000)){document.body.dataset.drawCalls=String(town.renderer.info.render.calls);document.body.dataset.triangles=String(town.renderer.info.render.triangles);document.body.dataset.geometries=String(town.renderer.info.memory.geometries);document.body.dataset.textures=String(town.renderer.info.memory.textures);}
  frameSamples.push(elapsed);if(frameSamples.length>=90){const sorted=[...frameSamples].sort((a,b)=>a-b),p90=sorted[Math.floor(sorted.length*.9)];frameSamples=[];if(profile){document.body.dataset.frameP50=sorted[Math.floor(sorted.length*.5)].toFixed(1);document.body.dataset.frameP90=p90.toFixed(1);document.body.dataset.frameP99=sorted[Math.floor(sorted.length*.99)].toFixed(1);document.body.dataset.pixelRatio=pixelRatio.toFixed(2);}const max=town.mobile?1.25:1.6;if(p90>(town.mobile?45:25)&&pixelRatio>0.85){pixelRatio=Math.max(.85,pixelRatio-.1);town.setPixelRatio(pixelRatio);}else if(p90<(town.mobile?36:19)&&pixelRatio<max){pixelRatio=Math.min(max,pixelRatio+.05);town.setPixelRatio(pixelRatio);}}
}
try{
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('fallback'))throw new Error('Development WebGL fallback preview');
  town=new TownScene(canvas);pixelRatio=Math.min(devicePixelRatio,town.mobile?1.25:1.5);town.setPixelRatio(pixelRatio);residents=new Residents(town.scene);town.update(weatherSnapshot());colliders=buildColliders(snapshot,[...town.environment.trees,...town.treeObstacles]);updateReadouts();document.body.classList.add('town-ready');requestAnimationFrame(frame);
  if(import.meta.env.DEV)Object.assign(window,{__townDebug:{town,save,snapshot:()=>snapshot}});
  window.addEventListener('resize',()=>{town?.resize();positionLabels();});
}catch(error){console.error('Town renderer unavailable',error);canvas.hidden=true;labels.hidden=true;fallback.hidden=false;document.body.classList.add('no-webgl');}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback.hidden=false;document.body.classList.add('no-webgl');});
canvas.addEventListener('webglcontextrestored',()=>location.reload());
const initialPanel=validPanel(location.hash.slice(1));if(initialPanel)openPanel(initialPanel,false);
if(recap.length)window.setTimeout(()=>announce(`While you were away: ${recap.join(' ')}`),1500);
persist();
