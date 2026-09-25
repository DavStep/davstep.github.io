import * as THREE from 'three';
import { TownScene } from './scene';
import { Residents } from './residents';
import { RoamController } from './navigation';
import { buildColliders, isBlocked, type Collider } from './collision';
import { terrainHeight } from './environment';
import type { TownSnapshot } from './model';
import { PROJECTS, PROJECT_BY_KEY, type ProjectKey } from './projects';
import { GAME_SAVE_KEY, IDEAS, IDEA_INFO, chooseIdea, evaluate, newGameSave, parseGameSave, restartGame, type Idea, type Levels } from './game';
import { snapshotForGame } from './game-snapshot';
import { GameScenery } from './game-scenery';
import { streamCollisionSegments } from './game-path';
import './style.css';
import './style-2.css';
import './style-3.css';
import './panels.css';
import './game.css';

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
const gameSave=(()=>{try{return parseGameSave(localStorage.getItem(GAME_SAVE_KEY));}catch{return newGameSave();}})();
let gameState=evaluate(gameSave.order);
let shownLevels:Levels={...gameState.levels};
const sessionStart=performance.now();
function persist(){try{localStorage.setItem(GAME_SAVE_KEY,JSON.stringify(gameSave));}catch{}}
let snapshot:TownSnapshot=snapshotForGame(shownLevels,0,gameState.gateMask);
let rainPreview=false;
const weatherSnapshot=():TownSnapshot=>rainPreview?{...snapshot,weather:'rain'}:snapshot;
let town:TownScene|null=null,residents:Residents|null=null,scenery:GameScenery|null=null;
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
document.addEventListener('visibilitychange',()=>{if(document.hidden){heldKeys.clear();saveNow();}else {lastFrame=0;}});
window.setInterval(persist,15000);
function setIntroHidden(value:boolean){intro.classList.toggle('dismissed',gameSave.started||value);}
$('#intro-start').addEventListener('click',()=>startGame());
$('#fallback-start').addEventListener('click',()=>startGame());
$('#intro-work').addEventListener('click',()=>openPanel('work'));
$('#open-work-mobile').addEventListener('click',()=>openPanel('work'));
$('#brand').addEventListener('click',()=>{closePanel();if(roaming)leaveRoam();else recenter();setIntroHidden(false);});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-panel]'))button.addEventListener('click',()=>openPanel(button.dataset.panel!));

function projectMarkup(key:ProjectKey):string{
  const p=PROJECT_BY_KEY[key];
  const number=String(PROJECTS.findIndex(project=>project.key===key)+1).padStart(2,'0');
  return `<div class="project-panel"><div class="project-visual"><img src="${p.image}" alt="Art from ${p.title}" loading="eager" /><span class="project-visual-index">${number} / 05</span><div class="project-visual-footer"><span>PROJECT LANDMARK</span><strong>${p.landmark}</strong></div></div><div class="panel-copy"><button class="panel-back" type="button" data-back-work>← &nbsp; All projects</button><div class="project-heading"><span class="landmark-name">SELECTED WORK &nbsp; / &nbsp; ${number}</span><span class="project-badge">${p.kicker}</span></div><h2 id="${panelTitleId}">${p.title}</h2><p class="lead">${p.description}</p><div class="project-contribution"><span>WHAT I BUILT</span><p>${p.contribution}</p></div>${p.url?`<a class="panel-action" href="${p.url}" target="_blank" rel="noopener noreferrer">${p.key==='dwarves'?'Play the prototype':'Explore the project'} <span>↗</span></a>`:'<span class="development-note">In development · more to show soon</span>'}<div class="panel-endmark">DAV STEPANYAN <span>✦</span> SELECTED WORK</div></div></div>`;
}
function workMarkup():string{return `<div class="work-overview"><div class="work-intro"><div><span class="landmark-name">THE TOWN ARCHIVE &nbsp; / &nbsp; 01</span><h2 id="${panelTitleId}">Selected <em>work.</em></h2><p>Five games and experiments, each with a place in the town.</p></div><span class="work-count">05 <small>PROJECTS</small></span></div><div class="work-gallery">${PROJECTS.map((p,i)=>`<button class="work-card" type="button" data-project-link="${p.key}"><img src="${p.image}" alt="" loading="lazy" /><span class="work-card-shade"></span><span class="work-card-index">0${i+1} / 05</span><span class="work-card-arrow" aria-hidden="true">↗</span><span class="work-card-text"><small>${p.kicker}</small><strong>${p.title}</strong></span></button>`).join('')}</div></div>`;}
function aboutMarkup():string{return `<div class="editorial-panel about-panel"><div class="editorial-art about-art" aria-hidden="true"><div class="about-mosaic"><img src="/assets/games/idle-outpost.webp" alt="" /><img src="/assets/games/sandship.webp" alt="" /><img src="/assets/games/idle-wizard.webp" alt="" /></div><div class="editorial-cover-caption"><span>DAV STEPANYAN &nbsp; / &nbsp; YEREVAN</span><strong>Building worlds<br>that move.</strong><small>GAME DEVELOPMENT · CREATIVE SYSTEMS</small></div></div><div class="panel-copy"><span class="landmark-name">THE PERSON BEHIND THE WORLD &nbsp; / &nbsp; 02</span><h2 id="${panelTitleId}">Hi, I'm Dav.</h2><p class="lead">I make worlds that won't sit still.</p><p>I'm a game developer in Yerevan, Armenia. At Rockbite Games I've worked across gameplay, economies, progression, and the small details that make systems feel alive. I enjoy both writing the code and watching what players actually do with it.</p><p>After hours, I keep building: browser games, creative tools, and a co-op mining adventure. This town is another place to try ideas and let them grow.</p><div class="about-facts"><div><small>ROLE</small><strong>Lead Code Wizard</strong></div><div><small>BASE</small><strong>Yerevan, Armenia</strong></div><div><small>CURRENTLY BUILDING</small><strong>Drunk Dwarves</strong></div></div></div></div>`;}
function contactMarkup():string{return `<div class="editorial-panel contact-panel"><div class="editorial-art contact-art" aria-hidden="true"><div class="postcard"><span class="postcard-top">DAV STEPANYAN &nbsp; / &nbsp; TOWN POST</span><span class="postcard-mark">DS<span>✦</span></span><strong>Good ideas<br>start with<br>a hello.</strong><span class="postcard-bottom">YEREVAN, ARMENIA &nbsp; · &nbsp; OPEN TO CONVERSATION</span></div></div><div class="panel-copy"><span class="landmark-name">THE TOWN POST &nbsp; / &nbsp; 03</span><h2 id="${panelTitleId}">Let's make something alive.</h2><p class="lead">Have a game idea, a system to untangle, or just want to compare notes?</p><a class="panel-action" href="mailto:davitstepanyan99@gmail.com">Send me an email <span>↗</span></a><div class="contact-links"><a href="https://github.com/DavStep" target="_blank" rel="noopener noreferrer"><span>GitHub</span><span>↗</span></a><a href="https://anilist.co/user/DevStep" target="_blank" rel="noopener noreferrer"><span>AniList</span><span>↗</span></a><a href="https://steamcommunity.com/id/stepdev/" target="_blank" rel="noopener noreferrer"><span>Steam</span><span>↗</span></a><button type="button" id="copy-discord"><span>Copy Discord: step_dev</span><span>↗</span></button></div></div></div>`;}
function validPanel(id:string|null):string|null{return id&&(id==='work'||id==='about'||id==='contact'||id.startsWith('project-')&&PROJECTS.some(p=>`project-${p.key}`===id))?id:null;}
function openPanel(id:string,updateHistory=true){
  const valid=validPanel(id);if(!valid)return;
  if(activePanel===valid)return;
  if(roaming)leaveRoam(false);
  if(!activePanel)lastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  activePanel=valid;
  panel.dataset.view=valid.startsWith('project-')?'project':valid;
  panel.querySelectorAll<HTMLButtonElement>('.panel-tab').forEach(button=>button.setAttribute('aria-current',String(button.dataset.panel===valid||(valid.startsWith('project-')&&button.dataset.panel==='work'))));
  panelKicker.textContent=valid.startsWith('project-')?PROJECT_BY_KEY[valid.slice(8) as ProjectKey].kicker:valid==='work'?'THE TOWN ARCHIVE':valid==='about'?'ABOUT DAV':'GET IN TOUCH';
  panelBody.innerHTML=valid.startsWith('project-')?projectMarkup(valid.slice(8) as ProjectKey):valid==='work'?workMarkup():valid==='about'?aboutMarkup():contactMarkup();
  panelBody.scrollTop=0;
  panel.hidden=false;backdrop.hidden=false;$('.chrome').inert=true;$('.town-ui').inert=true;fallback.inert=true;
  requestAnimationFrame(()=>{panel.classList.add('open');backdrop.classList.add('open');closeButton.focus();});
  document.body.classList.add('panel-open');
  if(valid.startsWith('project-')){
    const p=snapshot.plots.find(q=>q.project===valid.slice(8));
    if(p&&town){desiredTarget.set(p.x,0,p.z);desiredDistance=Math.min(desiredDistance,88);setIntroHidden(true);}
  }
  if(updateHistory)history.pushState({panel:valid},'',`#${valid}`);
  panelBody.querySelectorAll<HTMLButtonElement>('[data-project-link]').forEach(button=>button.addEventListener('click',()=>openPanel(`project-${button.dataset.projectLink}`)));
  panelBody.querySelector<HTMLButtonElement>('[data-back-work]')?.addEventListener('click',()=>openPanel('work'));
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
const gameHud=$<HTMLElement>('#game-hud');
const gameCards=$<HTMLDivElement>('#game-cards');
const gameEvent=$<HTMLParagraphElement>('#game-event');
const gameResult=$<HTMLDivElement>('#game-result');
const gameSkip=$<HTMLButtonElement>('#game-skip');
const CARD_ORDER:readonly Idea[]=['windmill','archive','market','settlers','observatory','roads','walls','grove','workshop'];
let animating=false,animationToken=0;
let eventMessage='Choose what enters the town. Watch earlier ideas change.';
const descriptions:Record<Idea,[string,string,string]>={
  settlers:['Builders arrive and mark out their homes.','Homes rise around the new roads.','The tournament fills with neighbors and banners.'],
  grove:['Saplings take root beyond the square.','Gardens spread and the workshop gets timber.','The irrigated grove bursts into bloom.'],
  workshop:['A little forge opens its doors.','The smiths make a gear for the bridge.','The Machine Yard and forge start working together.'],
  roads:['Surveyors mark a route through town.','The geared bridge opens a crossing.','Stone roads and minecart tracks connect the town.'],
  walls:['A timber wall rises around the town. Without a road, it has no gates.','Road gates and a stone wall secure the crossings.','A second line of walls protects the outer mill.'],
  market:['Stalls appear in the square.','A caravan crosses the bridge with supplies.','The Trading Hall fills with goods and visitors.'],
  windmill:['A small mill rises beside dry fields.','The sails turn; a stream branches from the river to the mill.','Water feeds the fields and golden wheat grows.'],
  archive:['The post begins collecting the town’s stories.','Plans travel between the guild and the post.','The Archive maps every part of the town.'],
  observatory:['A star platform rises above the rooftops.','The wizard aligns a new lens.','The five project landmarks shine as constellations.'],
};
const approaches:Record<Idea,string>={
  settlers:'A little settler carries a seed toward the square…',
  grove:'A gardener brings a sapling to the edge of town…',
  workshop:'A smith hurries over with a hammer…',
  roads:'A surveyor carries the first stone to the crossing…',
  walls:'A mason measures the edge of town for the new wall…',
  market:'A trader brings a crate of supplies…',
  windmill:'A builder carries a gear to the river mill…',
  archive:'A messenger brings a letter to the post…',
  observatory:'An astronomer carries a bright lens to the tower…',
};
const focalPlot:Record<Idea,string>={settlers:'castle',grove:'project-wizard',workshop:'forge',roads:'project-dwarves',walls:'',market:'market',windmill:'mill',archive:'post',observatory:'project-wizard'};

function renderGameHud(){
  gameHud.hidden=!gameSave.started;
  $('#fallback-start').hidden=gameSave.started;
  document.body.classList.toggle('game-running',gameSave.started);
  $('#game-turn').textContent=`TURN ${gameSave.order.length} / ${IDEAS.length}`;
  $('#game-summary').textContent=animating?'The town is changing…':gameState.finished?`${gameState.maxCount} of ${IDEAS.length} ideas reached MAX`:'Choose the next idea.';
  gameSkip.hidden=!animating;
  gameEvent.textContent=eventMessage;
  gameCards.innerHTML=CARD_ORDER.map(idea=>{
    const info=IDEA_INFO[idea],level=shownLevels[idea],chosen=gameSave.order.includes(idea),missed=gameState.missed.includes(idea);
    const status=level===3?'MAX':level?`LV ${level}`:'CHOOSE';
    return `<button type="button" class="game-card ${chosen?'chosen':''} ${level===3?'max':''} ${missed?'missed':''}" data-idea="${idea}" aria-label="${info.name}, ${status}" ${chosen||animating||gameState.finished?'disabled':''}><span class="game-card-icon" aria-hidden="true">${info.icon}</span><span class="game-card-label">${info.name}</span><span class="game-card-level">${status}</span></button>`;
  }).join('');
  gameResult.hidden=!gameState.finished||animating;
  if(!gameResult.hidden){
    const title=gameState.perfect?'A town in harmony':gameState.secret?'Storybook Night discovered':`A town with ${gameState.maxCount} of ${IDEAS.length} ideas at MAX`;
    const detail=gameState.perfect?'Every building and its surroundings reached their fullest form.':gameState.isolatedMill?'The wall was built before a road reached it. No gate connects the outside mill, so its supplies and water system cannot develop.':gameState.secret?'The Archive’s sketches turned into glowing paper birds.':gameState.missed.length?`Look again at ${IDEA_INFO[gameState.missed[0]].place.toLowerCase()}. ${IDEA_INFO[gameState.missed[0]].hint}`:'Watch which buildings were waiting for each other.';
    gameResult.innerHTML=`<strong>${title}</strong>${detail}<br><button type="button" data-replay>Try another order</button>`;
  }
}
function refreshGameWorld(instant=false){
  snapshot=snapshotForGame(shownLevels,performance.now()-sessionStart,gameState.gateMask);
  town?.update(weatherSnapshot(),!instant&&animating&&!reduced.matches);
  scenery?.setLevels(shownLevels,gameState.secret&&gameState.finished&&!animating,instant);
  if(town){
    colliders=buildColliders(snapshot,[...town.environment.trees,...town.treeObstacles]);
    if(shownLevels.windmill>=2)colliders.push(...streamCollisionSegments());
  }
  residents?.update(snapshot);
  updateReadouts();
  positionLabels();
}
function startGame(){
  gameSave.started=true;persist();setIntroHidden(true);renderGameHud();refreshGameWorld(true);recenter();
  gameCards.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
}
function restart(){
  animationToken++;animating=false;restartGame(gameSave);gameState=evaluate([]);shownLevels={...gameState.levels};
  residents?.finishCue();scenery?.endBeat();
  eventMessage='A fresh town. What should arrive first?';persist();renderGameHud();refreshGameWorld(true);recenter();
}
function skipAnimation(){
  if(!animating)return;
  animationToken++;animating=false;shownLevels={...gameState.levels};
  residents?.finishCue();scenery?.endBeat();
  eventMessage=gameState.finished?'The town remembers your choices.':gameState.levels.walls>0&&gameState.gateMask===0?'The sealed wall blocks the road to the outside mill.':'The town is ready for its next idea.';
  refreshGameWorld(true);renderGameHud();recenter();
}
const delay=(ms:number)=>new Promise<void>(resolve=>window.setTimeout(resolve,ms));
async function playChoice(idea:Idea){
  if(animating||gameState.finished||gameSave.order.includes(idea))return;
  const before={...shownLevels};gameState=chooseIdea(gameSave,idea);persist();
  animating=true;const token=++animationToken;renderGameHud();
  const changed=[idea,...IDEAS.filter(key=>key!==idea&&gameState.levels[key]>before[key])];
  for(const key of changed){
    for(let level=before[key]+1;level<=gameState.levels[key];level++){
      if(token!==animationToken)return;
      const focus=key==='walls'?{x:34,z:0}:snapshot.plots.find(plot=>plot.id===focalPlot[key]);
      if(focus&&town){desiredTarget.set(focus.x,0,focus.z);desiredDistance=key==='windmill'?94:89;}
      const failed=key===idea&&level===1&&gameState.missed.includes(key);
      eventMessage=key===idea?approaches[key]:`${IDEA_INFO[key].name} responds to the new idea…`;
      if(focus)residents?.startCue(key,focus,failed,reduced.matches?.1:1.7);
      renderGameHud();
      await delay(reduced.matches?40:690);
      if(token!==animationToken)return;
      shownLevels[key]=level;
      eventMessage=descriptions[key][level-1];
      if(failed)eventMessage+=` ${IDEA_INFO[key].hint}`;
      if(key==='roads'&&level>=2&&shownLevels.walls>0&&gameState.gateMask===0)eventMessage='The road reaches the sealed wall and stops. The outside mill remains cut off.';
      if(key==='windmill'&&level===1&&gameState.isolatedMill)eventMessage='The mill stands outside the wall. Without a gate, its waterworks cannot be built.';
      refreshGameWorld();renderGameHud();
      if(focus)scenery?.beginBeat(key,focus,failed);
      if(key==='windmill'&&level===2&&!reduced.matches){
        await delay(850);
        if(token!==animationToken)return;
        eventMessage='The sails catch wind. Water runs from the river through the new channel.';
        renderGameHud();
        await delay(1550);
      }else if(key==='windmill'&&level===3&&!reduced.matches){
        await delay(750);
        if(token!==animationToken)return;
        eventMessage='Green shoots spread from the water. The field turns gold.';
        residents?.startCue('windmill',{x:34,z:-31},false,1.65);
        renderGameHud();
        await delay(1650);
      }else await delay(reduced.matches?50:key==='roads'?1650:1450);
      residents?.finishCue();scenery?.endBeat();
      while(activePanel&&token===animationToken)await delay(150);
    }
  }
  if(token!==animationToken)return;
  animating=false;shownLevels={...gameState.levels};
  eventMessage=gameState.finished?'The nine choices are complete. Inspect the town, then try another order.':gameState.levels.walls>0&&gameState.gateMask===0?'The wall has no gate. Roads cannot connect the outside mill.':'What should arrive next?';
  refreshGameWorld(true);renderGameHud();recenter();
}
gameCards.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-idea]');if(button)void playChoice(button.dataset.idea as Idea);});
gameResult.addEventListener('click',event=>{if((event.target as HTMLElement).closest('[data-replay]'))restart();});
$('#game-restart').addEventListener('click',restart);
gameSkip.addEventListener('click',skipAnimation);
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
    const visible=p.stage>0&&nearby&&!behindIntro&&projected.z<1&&projected.z>-1&&projected.x>-(town.mobile?.86:1.02)&&projected.x<(town.mobile?.86:1.02)&&projected.y>-1.08&&projected.y<1.08;
    button.style.display=visible?'flex':'none';button.style.left=`${x}px`;button.style.top=`${y}px`;
  }
}
function updateReadouts(){
  const setText=(selector:string,value:string)=>{const element=$<HTMLElement>(selector);if(element.textContent!==value)element.textContent=value;};
  setText('#season-readout',snapshot.season.toUpperCase());
  setText('#weather-readout',rainPreview?'RAIN · PREVIEW':snapshot.weather.toUpperCase());
  setText('#age-readout',`${gameSave.order.length} / ${IDEAS.length}`);
  setText('#building-readout',String(snapshot.buildings));
  setText('#status-text',gameSave.started?`${gameState.maxCount} ideas at MAX`:'A little world is waiting for your first choice.');
  const weather=rainPreview?'rain':snapshot.weather;
  if(document.body.dataset.weather!==weather)document.body.dataset.weather=weather;
  if(document.body.dataset.season!==snapshot.season)document.body.dataset.season=snapshot.season;
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
  snapshot.elapsed=now-sessionStart;
  if(roaming){
    const input={x:(heldKeys.has('KeyD')||heldKeys.has('ArrowRight')?1:0)-(heldKeys.has('KeyA')||heldKeys.has('ArrowLeft')?1:0)+joystickInput.x,z:(heldKeys.has('KeyW')||heldKeys.has('ArrowUp')?1:0)-(heldKeys.has('KeyS')||heldKeys.has('ArrowDown')?1:0)+joystickInput.z,sprint:heldKeys.has('ShiftLeft')||heldKeys.has('ShiftRight')};
    roam.update(elapsed/1000,input,azimuth,colliders);
  }
  stepCamera(elapsed/1000);residents?.update(snapshot);positionLabels();scenery?.update(now/1000,elapsed/1000);town.render(weatherSnapshot(),roaming);
  if(profile&&Math.floor(now/2000)!==Math.floor((now-elapsed)/2000)){document.body.dataset.drawCalls=String(town.renderer.info.render.calls);document.body.dataset.triangles=String(town.renderer.info.render.triangles);document.body.dataset.geometries=String(town.renderer.info.memory.geometries);document.body.dataset.textures=String(town.renderer.info.memory.textures);}
  if(profile){frameSamples.push(elapsed);if(frameSamples.length>=90){const sorted=[...frameSamples].sort((a,b)=>a-b);frameSamples=[];document.body.dataset.frameP50=sorted[Math.floor(sorted.length*.5)].toFixed(1);document.body.dataset.frameP90=sorted[Math.floor(sorted.length*.9)].toFixed(1);document.body.dataset.frameP99=sorted[Math.floor(sorted.length*.99)].toFixed(1);document.body.dataset.pixelRatio=pixelRatio.toFixed(2);}}
}
try{
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('fallback'))throw new Error('Development WebGL fallback preview');
  town=new TownScene(canvas,true);pixelRatio=Math.min(devicePixelRatio,town.mobile?1:1.25);town.setPixelRatio(pixelRatio);residents=new Residents(town.scene);scenery=new GameScenery(town.scene,town.mobile,town.environment);refreshGameWorld(true);document.body.classList.add('town-ready');requestAnimationFrame(frame);
  if(import.meta.env.DEV)Object.assign(window,{__townDebug:{town,gameSave,gameState:()=>gameState,snapshot:()=>snapshot}});
  window.addEventListener('resize',()=>{town?.resize();positionLabels();});
}catch(error){console.error('Town renderer unavailable',error);canvas.hidden=true;labels.hidden=true;fallback.hidden=false;document.body.classList.add('no-webgl');}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback.hidden=false;document.body.classList.add('no-webgl');});
canvas.addEventListener('webglcontextrestored',()=>location.reload());
const initialPanel=validPanel(location.hash.slice(1));if(initialPanel)openPanel(initialPanel,false);
setIntroHidden(gameSave.started);
renderGameHud();
persist();
