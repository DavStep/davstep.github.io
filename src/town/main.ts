import * as THREE from 'three';
import { TownScene } from './scene';
import { ChoiceWorker } from './choice-worker';
import { terrainHeight } from './environment';
import type { TownSnapshot } from './model';
import { PROJECTS, PROJECT_BY_KEY, type ProjectKey } from './projects';
import { GAME_SAVE_KEY, IDEAS, IDEA_INFO, chooseIdea, evaluate, newGameSave, parseGameSave, restartGame, type Idea, type Levels } from './game';
import { JOINT_PROJECTS } from './action-rules';
import { snapshotForGame } from './game-snapshot';
import { MAX_LEVEL } from './milestones';
import { eventTitle, eventWaves } from './action-story';
import { ReactionEffects, eventFocus } from './reaction-effects';
import { moatColliders } from './moat-layout';
import { SANDSHIP_ARRIVAL_MS } from './parachute-arrival';
import { GameScenery } from './game-scenery';
import { buildColliders, isBlocked } from './collision';
import { landscapeColliders } from './landscape-state';
import { IDEA_COLORS } from './idea-colors';
import { boundedOrbitDistance, orbitFieldOfView } from './camera-bounds';
import './style.css';
import './style-2.css';
import './style-3.css';
import './panels.css';
import './game.css';
import './glass.css';
import './panel-rail.css';
import './story-flow.css';

const $ = <T extends HTMLElement>(selector:string) => document.querySelector(selector) as T;
const canvas=$<HTMLCanvasElement>('#town-canvas');
const panel=$<HTMLElement>('#content-panel');
const backdrop=$<HTMLDivElement>('#panel-backdrop');
const panelBody=$<HTMLDivElement>('#panel-body');
const panelTitleId='panel-title';
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
const storageKey=GAME_SAVE_KEY+(import.meta.env.DEV&&new URLSearchParams(location.search).has('playtest')?'.playtest':'');
const gameSave=(()=>{try{return parseGameSave(localStorage.getItem(storageKey));}catch{return newGameSave();}})();
let gameState=evaluate(gameSave.order);
let shownLevels:Levels={...gameState.levels};
let shownProjects=new Set(gameState.projects);
const sessionStart=performance.now();
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(gameSave));}catch{}}
let snapshot:TownSnapshot=snapshotForGame(shownLevels,0,shownProjects.has('road-gates')?gameState.gateMask:0);
let town:TownScene|null=null,worker:ChoiceWorker|null=null,scenery:GameScenery|null=null,reactions:ReactionEffects|null=null;
let target=new THREE.Vector3(0,terrainHeight(0,0)*.55,0),desiredTarget=target.clone();
const townOverviewDistance=(levels:Levels)=>148+Math.min(24,Object.values(levels).filter(level=>level>0).length*2.4);
let azimuth=.72,elevation=Math.max(...Object.values(shownLevels))>3?.38:1.05,distance=townOverviewDistance(shownLevels),desiredAzimuth=azimuth,desiredElevation=elevation,desiredDistance=distance;
let lastFrame=0,lastModel=0,frameSamples:number[]=[],pixelRatio=1;
let activePanel:string|null=null,lastFocus:HTMLElement|null=null,toastTimer=0;

function announce(text:string){toast.textContent=text;toast.hidden=false;clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>toast.hidden=true,5500);}
function saveNow(){persist();}
window.addEventListener('pagehide',saveNow);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow();else lastFrame=0;});
window.setInterval(persist,15000);
function setIntroHidden(value:boolean){const hidden=gameSave.started||value;intro.classList.toggle('dismissed',hidden);intro.inert=hidden;intro.setAttribute('aria-hidden',String(hidden));}
$('#intro-start').addEventListener('click',()=>startGame());
$('#fallback-start').addEventListener('click',()=>startGame());
$('#intro-work').addEventListener('click',()=>openPanel('work'));
$('#open-work-mobile').addEventListener('click',()=>openPanel('work'));
$('#brand').addEventListener('click',()=>{closePanel();recenter();setIntroHidden(false);});
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
  if(!activePanel)lastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  activePanel=valid;
  panel.dataset.view=valid.startsWith('project-')?'project':valid;
  panel.querySelectorAll<HTMLButtonElement>('.panel-tab').forEach(button=>button.setAttribute('aria-current',String(button.dataset.panel===valid||(valid.startsWith('project-')&&button.dataset.panel==='work'))));
  panelBody.innerHTML=valid.startsWith('project-')?projectMarkup(valid.slice(8) as ProjectKey):valid==='work'?workMarkup():valid==='about'?aboutMarkup():contactMarkup();
  panelBody.scrollTop=0;
  panel.hidden=false;backdrop.hidden=false;$('.chrome').inert=true;$('.town-ui').inert=true;fallback.inert=true;
  requestAnimationFrame(()=>{panel.classList.add('open');backdrop.classList.add('open');closeButton.focus();});
  document.body.classList.add('panel-open');
  if(valid.startsWith('project-')){
    const p=snapshot.plots.find(q=>q.project===valid.slice(8));
    if(p&&town){desiredTarget.set(p.x,terrainHeight(p.x,p.z),p.z);desiredDistance=Math.min(desiredDistance,88);setIntroHidden(true);}
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
  if(e.key==='Tab'&&activePanel){const items=[...panel.querySelectorAll<HTMLElement>('button,a[href]')].filter(el=>!el.hasAttribute('disabled'));if(!items.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
});
window.addEventListener('popstate',()=>{const id=validPanel(location.hash.slice(1));if(id)openPanel(id,false);else closePanel(false);});

function recenter(){desiredTarget.set(0,terrainHeight(0,0)*.55,0);desiredDistance=townOverviewDistance(shownLevels);desiredAzimuth=.72;desiredElevation=Math.max(...Object.values(shownLevels))>3?.38:1.05;}
const gameHud=$<HTMLElement>('#game-hud');
const gameCards=$<HTMLDivElement>('#game-cards');
const gameProgress=$<HTMLDivElement>('#game-progress');
const gameEvent=$<HTMLParagraphElement>('#game-event');
const gameResult=$<HTMLDivElement>('#game-result');
const gameSkip=$<HTMLButtonElement>('#game-skip');
const CARD_ORDER:readonly Idea[]=['windmill','archive','market','settlers','observatory','roads','walls','grove','river','workshop'];
let animating=false,animationToken=0;
let eventMessage='';
let desiredUiOffset=0,uiOffset=0;
// Frame the action in the exposed landscape, above the decision dock.
// Observe layout changes instead of measuring the DOM in the render loop.
new ResizeObserver(()=>{
  const top=gameHud.getBoundingClientRect().top;
  desiredUiOffset=gameHud.hidden?0:Math.max(0,Math.min(innerHeight*.32,innerHeight/2-(90+top)/2));
}).observe(gameHud);

function renderGameHud(){
  gameHud.hidden=!gameSave.started;
  $('#fallback-start').hidden=gameSave.started;
  document.body.classList.toggle('game-running',gameSave.started);
  $('#game-turn').textContent=`${gameSave.order.length} / ${IDEAS.length}`;
  $('.game-hud-kicker').textContent=gameSave.order.length&&gameState.route==='storybook'?'✦  STORYBOOK ROUTE':'✦  THE ORDER PUZZLE';
  if(!gameProgress.children.length)gameProgress.innerHTML=IDEAS.map(()=>'<span></span>').join('');
  for(const [index,mark] of [...gameProgress.children].entries())mark.classList.toggle('filled',index<gameSave.order.length);
  $('#game-summary').textContent=gameState.finished&&!animating
    ?gameState.perfect?'All ideas at MAX':`${gameState.score} / ${IDEAS.length*MAX_LEVEL} levels reached`
    :`${gameState.projects.length} / ${JOINT_PROJECTS.length} collaborations · ${gameState.score} / ${IDEAS.length*MAX_LEVEL} levels`;
  gameSkip.hidden=!animating;
  gameEvent.textContent=eventMessage;
  gameEvent.hidden=!eventMessage;
  if(!gameCards.children.length)gameCards.innerHTML=CARD_ORDER.map(idea=>{
    const info=IDEA_INFO[idea];
    return `<button type="button" class="game-card" data-idea="${idea}" style="--idea-color:#${IDEA_COLORS[idea].toString(16).padStart(6,'0')}"><span class="game-card-icon" aria-hidden="true"><img src="${info.icon}" alt="" draggable="false" /></span><span class="game-card-label">${info.name}</span><span class="game-card-level"></span></button>`;
  }).join('');
  for(const idea of CARD_ORDER){
    const info=IDEA_INFO[idea],chosen=gameSave.order.includes(idea);
    const button=gameCards.querySelector<HTMLButtonElement>(`[data-idea="${idea}"]`)!;
    const level=shownLevels[idea];
    const fault=gameState.faults.find(item=>item.idea===idea||item.partner===idea);
    button.classList.toggle('chosen',chosen);
    button.classList.toggle('missed',Boolean(fault));
    button.querySelector('.game-card-level')!.textContent=level===MAX_LEVEL?'MAX':level?`${level} / ${MAX_LEVEL}`:'';
    button.title=fault?.reason??info.hint;
    button.disabled=chosen||animating||gameState.finished;
    button.setAttribute('aria-label',chosen?`${info.name}, chosen${level?`, level ${level} of ${MAX_LEVEL}`:''}${fault?`, missed collaboration: ${fault.reason}`:''}`:`${info.name}. ${info.hint}`);
  }
  gameResult.hidden=!gameState.finished||animating;
  if(!gameResult.hidden){
    const title=gameState.secret?'Storybook Night':gameState.perfect?'Every idea reached MAX':`${gameState.score} / ${IDEAS.length*MAX_LEVEL} levels`;
    const diagnosis=gameState.faults.length
      ?`<details><summary>Missed collaborations (${gameState.faults.length})</summary><ul>${gameState.faults.map(fault=>`<li>${fault.reason}</li>`).join('')}</ul></details>`
      :`<span>All ${JOINT_PROJECTS.length} collaborations completed.</span>`;
    gameResult.innerHTML=`<div class="game-result-copy"><strong>${title}</strong><span>Best: ${gameSave.bestScore} / ${IDEAS.length*MAX_LEVEL}</span>${diagnosis}</div><button type="button" data-replay>Try another order</button>`;
  }
}
function refreshGameWorld(instant=false){
  snapshot=snapshotForGame(shownLevels,performance.now()-sessionStart,shownProjects.has('road-gates')?gameState.gateMask:0);
  town?.update(snapshot,!instant&&animating&&!reduced.matches);
  scenery?.setLevels(shownLevels,gameState.secret&&gameState.finished&&!animating,instant);
  worker?.update();
}
function startGame(){
  gameSave.started=true;
  persist();setIntroHidden(true);renderGameHud();refreshGameWorld(true);recenter();
  gameCards.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
}
function restart(){
  animationToken++;animating=false;restartGame(gameSave);gameState=evaluate([]);shownLevels={...gameState.levels};
  shownProjects=new Set();
  worker?.finishCue(true);scenery?.endBeat();reactions?.clear();
  eventMessage='';persist();renderGameHud();refreshGameWorld(true);recenter();
}
function finishDecision(instant=false){
  animating=false;shownLevels={...gameState.levels};shownProjects=new Set(gameState.projects);
  worker?.finishCue(instant);scenery?.endBeat();reactions?.clear();
  const last=gameSave.order.at(-1);
  const newFaults=gameState.faults.filter(fault=>fault.idea===last);
  const newProjects=[...new Set(gameState.events.map(event=>event.project).filter((id):id is string=>Boolean(id)))];
  const firstProject=JOINT_PROJECTS.find(project=>project.id===newProjects[0]);
  eventMessage=newFaults.length
    ?`${newFaults.length} missed collaboration${newFaults.length===1?'':'s'}. ${newFaults[0].reason}`
    :newProjects.length?`${newProjects.length} collaboration${newProjects.length===1?'':'s'} built. ${firstProject?.name}: ${firstProject?.result}`
    :last?`${IDEA_INFO[last].name} arrived. Choose another idea to make a collaboration.`:'';
  refreshGameWorld(instant);renderGameHud();recenter();
  const next=gameState.finished?gameResult.querySelector<HTMLButtonElement>('button'):gameCards.querySelector<HTMLButtonElement>('button:not(:disabled)');
  next?.focus({preventScroll:true});
}
function skipAnimation(){
  if(!animating)return;
  animationToken++;finishDecision(true);
}
const delay=(ms:number)=>new Promise<void>(resolve=>window.setTimeout(resolve,ms));
async function waitForScene(ms:number,token:number){
  let remaining=ms;
  while(remaining>0&&token===animationToken){
    await delay(100);
    if(!document.hidden&&!activePanel)remaining-=100;
  }
}
async function playChoice(idea:Idea){
  if(animating||gameState.finished||gameSave.order.includes(idea))return;
  shownProjects=new Set(gameState.projects);
  gameState=chooseIdea(gameSave,idea);persist();
  animating=true;const token=++animationToken;
  const waves=eventWaves(gameState);
  renderGameHud();gameSkip.focus({preventScroll:true});
  try{
    if(town){
      const focus=eventFocus({idea,level:1});
      const future=snapshotForGame({...shownLevels,[idea]:1},performance.now()-sessionStart,shownProjects.has('road-gates')?gameState.gateMask:0);
      const obstacles=[...town.environment.activeTrees,...town.treeObstacles];
      const colliders=[...buildColliders(future,obstacles),...landscapeColliders(shownLevels),...moatColliders(shownLevels)];
      worker?.startCue(idea,focus,(x,z)=>!isBlocked(x,z,colliders,1.15),reduced.matches);
    }
    for(const wave of waves){
      if(token!==animationToken)return;
      // Water release and the first harvest get the hero shot; other changes
      // in this causal wave happen together in the world.
      const hero=wave.find(e=>e.idea==='river'&&e.level<=3)??wave.find(e=>e.idea==='windmill'&&e.level<=3)??wave[0];
      const focus=eventFocus(hero),arrival=hero.level===1;
      const sandship=hero.idea==='workshop'&&arrival;
      if(town){
        desiredTarget.set(focus.x,town.environment.landscapeHeight(focus.x,focus.z)+(sandship?8:2),focus.z);
        desiredDistance=hero.level>=4?145:hero.idea==='river'?130:105;
        desiredElevation=.95;
        desiredAzimuth=Math.atan2(-focus.z,-focus.x)+.4;
      }
      const project=JOINT_PROJECTS.find(item=>item.id===hero.project);
      eventMessage=project?`${project.name}: ${project.result}`:eventTitle(hero);
      if(!reduced.matches&&town)reactions?.begin(hero,idea);
      renderGameHud();
      await waitForScene(reduced.matches||!town?250:arrival?650:450,token);
      if(token!==animationToken)return;
      for(const event of wave){shownLevels[event.idea]=event.level;if(event.project)shownProjects.add(event.project);}
      refreshGameWorld(reduced.matches||!town);
      if(!reduced.matches&&town)reactions?.reveal();
      eventMessage=project?`${project.name} → ${eventTitle(hero)}`:eventTitle(hero);
      renderGameHud();
      const duration=sandship?SANDSHIP_ARRIVAL_MS+150:hero.idea==='river'&&hero.level===2?7500:hero.idea==='river'&&hero.level===3?7500:hero.idea==='windmill'&&hero.level===3?2900:hero.project?1150:2200;
      await waitForScene(reduced.matches||!town?450:duration,token);
      if(token!==animationToken)return;
      reactions?.clear();
    }
    if(token!==animationToken)return;
    finishDecision();
  }catch(error){
    console.error('Reaction playback interrupted',error);
    if(token===animationToken){finishDecision(true);announce('Your choice is saved.');}
  }
}
gameCards.addEventListener('click',event=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-idea]');
  if(button&&!button.disabled)void playChoice(button.dataset.idea as Idea);
});
gameResult.addEventListener('click',event=>{
  if((event.target as HTMLElement).closest('[data-replay]'))restart();
});
$('#game-restart').addEventListener('click',restart);
gameSkip.addEventListener('click',skipAnimation);
function stepCamera(dt:number){
  if(!town)return;
  const k=reduced.matches?1:1-Math.exp(-dt*8);
  azimuth+=(desiredAzimuth-azimuth)*k;elevation+=(desiredElevation-elevation)*k;
  target.lerp(desiredTarget,k);distance+=(desiredDistance-distance)*k;
  uiOffset+=(desiredUiOffset-uiOffset)*k;
  const view=town.camera.view;
  if(!view||Math.abs(view.offsetY-uiOffset)>.2||view.fullWidth!==innerWidth||view.fullHeight!==innerHeight)
    town.camera.setViewOffset(innerWidth,innerHeight,0,uiOffset,innerWidth,innerHeight);
  const cameraDistance=boundedOrbitDistance(target.x,target.z,azimuth,elevation,distance);
  const fov=orbitFieldOfView(distance,cameraDistance);
  if(Math.abs(town.camera.fov-fov)>.001){town.camera.fov=fov;town.camera.updateProjectionMatrix();}
  const horizontal=Math.sin(elevation)*cameraDistance;
  town.camera.position.set(target.x+Math.cos(azimuth)*horizontal,target.y+Math.cos(elevation)*cameraDistance,target.z+Math.sin(azimuth)*horizontal);
  town.camera.lookAt(target);
}
function frame(now:number){requestAnimationFrame(frame);if(document.hidden||!town)return;const cap=town.mobile?30:60;if(now-lastFrame<1000/cap-1)return;const elapsed=lastFrame?now-lastFrame:1000/cap;lastFrame=now;
  snapshot.elapsed=now-sessionStart;
  stepCamera(elapsed/1000);reactions?.update(elapsed/1000);worker?.update();scenery?.update(now/1000,elapsed/1000);town.render(snapshot,false);
  if(profile&&Math.floor(now/2000)!==Math.floor((now-elapsed)/2000)){document.body.dataset.drawCalls=String(town.renderer.info.render.calls);document.body.dataset.triangles=String(town.renderer.info.render.triangles);document.body.dataset.geometries=String(town.renderer.info.memory.geometries);document.body.dataset.textures=String(town.renderer.info.memory.textures);}
  if(profile){frameSamples.push(elapsed);if(frameSamples.length>=90){const sorted=[...frameSamples].sort((a,b)=>a-b);frameSamples=[];document.body.dataset.frameP50=sorted[Math.floor(sorted.length*.5)].toFixed(1);document.body.dataset.frameP90=sorted[Math.floor(sorted.length*.9)].toFixed(1);document.body.dataset.frameP99=sorted[Math.floor(sorted.length*.99)].toFixed(1);document.body.dataset.pixelRatio=pixelRatio.toFixed(2);}}
}
try{
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('fallback'))throw new Error('Development WebGL fallback preview');
  town=new TownScene(canvas,true);pixelRatio=Math.min(devicePixelRatio,town.mobile?1:1.5);town.setPixelRatio(pixelRatio);worker=new ChoiceWorker(town.scene);scenery=new GameScenery(town.scene,town.mobile,town.environment);reactions=new ReactionEffects(town.scene);refreshGameWorld(true);document.body.classList.add('town-ready');requestAnimationFrame(frame);
  if(import.meta.env.DEV)Object.assign(window,{__townDebug:{town,gameSave,gameState:()=>gameState,snapshot:()=>snapshot}});
  window.addEventListener('resize',()=>{town?.resize();});
}catch(error){console.error('Town renderer unavailable',error);canvas.hidden=true;fallback.hidden=false;document.body.classList.add('no-webgl');}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback.hidden=false;document.body.classList.add('no-webgl');});
canvas.addEventListener('webglcontextrestored',()=>location.reload());
const initialPanel=validPanel(location.hash.slice(1));if(initialPanel)openPanel(initialPanel,false);
setIntroHidden(gameSave.started);
renderGameHud();
persist();
