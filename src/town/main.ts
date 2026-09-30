import * as THREE from 'three';
import { TownScene } from './scene';
import { PLANET_RADIUS, PLANET_SAVE_KEY, planetNormal, planetPoint, planetToTown } from './planet-layout';
import { planetRiverPoint } from './planet-rivers';
import { planetTransportLayout,mixPoint } from './planet-transport-layout';
import { PlanetCameraMove,PlanetOrbit,planetEventView } from './planet-camera';
import { planetLandmarkHeight } from './planet-landmarks';
import { planetElevation } from './planet-geography';
import { ChoiceWorker } from './choice-worker';
import { terrainHeight } from './environment';
import type { TownSnapshot } from './model';
import { PROJECTS, PROJECT_BY_KEY, type ProjectKey } from './projects';
import { IDEAS, IDEA_INFO, SECRET_ORDER, ideaIcon, chooseIdea, evaluate, newGameSave, parseGameSave, restartGame, type Idea, type Levels } from './game';
import { DEVELOPMENT_RULES } from './action-rules';
import { worldNextEvent } from './world-event-logic';
import { copyWorldEventState, type WorldEvent } from './world-event-types';
import { PlanetWorldEvents, worldEventDuration } from './planet-world-events';
import { snapshotForGame } from './game-snapshot';
import { MAX_LEVEL } from './milestones';
import { eventTitle, decisionSequence } from './action-story';
import { ReactionEffects, eventFocus } from './reaction-effects';
import { moatColliders } from './moat-layout';
import { SANDSHIP_ARRIVAL_MS } from './parachute-arrival';
import { GameScenery } from './game-scenery';
import { buildColliders, isBlocked } from './collision';
import { landscapeColliders } from './landscape-state';
import { IDEA_COLORS } from './idea-colors';
import { upgradeFocus } from './upgrade-focus';
import { Juice } from './juice';
import { Sfx } from './sfx';
import type { BuildImpact } from './build-sequencer';
import './juice.css';
import './style.css';
import './style-2.css';
import './style-3.css';
import './panels.css';
import './game.css';
import './glass.css';
import './story-flow.css';
import './motion.css';
import './planet-background.css';
import './world-events.css';
import './panel-rail.css';
import '../portfolio.css';
import { EASE, burst, confetti, installMotionTokens, magnetic, play, pointerLight, reducedMotion, retrigger, rise, stagger, tweenText } from './ui-motion';
import { ProjectLabelMotion } from './project-label-motion';

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
const portfolio=$<HTMLElement>('#portfolio');
const townExperience=$<HTMLElement>('#town-experience');
const heroWorld=$<HTMLElement>('#hero-world-view');
const showcase=evaluate(SECRET_ORDER);
const showcaseSnapshot=snapshotForGame(showcase.levels,0,showcase.gateMask);
let heroVisible=false,heroRendered=false,heroTime=0,heroElapsed=0,heroWidth=0,heroHeight=0,heroPaused=false;
const heroMotion=$<HTMLButtonElement>('[data-hero-motion]');
const heroOrbit=new PlanetOrbit(),heroLook=new THREE.Vector3();
let heroManual=false;
const heroDefaultRadius=PLANET_RADIUS*3.45;
let heroRadius=heroDefaultRadius,heroDesiredRadius=heroDefaultRadius,heroPinchDistance=0;
const heroPointers=new Map<number,{x:number;y:number}>();
let heroPointer:{id:number;x:number;y:number;startX:number;startY:number;dragging:boolean}|null=null;
let playing=false,portfolioScroll=0,portfolioHash='';
let playLauncher:HTMLElement|null=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
installMotionTokens();
const profile=import.meta.env.DEV||new URLSearchParams(location.search).has('profile');
new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;lastFrame=0;}).observe(heroWorld);
new ResizeObserver(entries=>{
  const size=entries[0].contentRect;
  heroWidth=size.width;heroHeight=size.height;
  if(!playing&&canvas.parentElement===heroWorld&&heroWidth>0){town?.resize();heroRendered=false;}
}).observe(heroWorld);
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
const storageKey=PLANET_SAVE_KEY+(import.meta.env.DEV&&new URLSearchParams(location.search).has('playtest')?'.playtest':'');
const gameSave=(()=>{try{return parseGameSave(localStorage.getItem(storageKey));}catch{return newGameSave();}})();
let gameState=evaluate(gameSave.order);
let shownWorld=copyWorldEventState(gameState.world);
let worldVisuals:PlanetWorldEvents|null=null;
let cinematic:{event:WorldEvent;elapsed:number;duration:number;sounded:boolean;resolve:()=>void}|null=null;
function cancelCinematic(){const active=cinematic;cinematic=null;active?.resolve();worldVisuals?.cancel();town?.setExpeditionActive(false);}
let shownLevels:Levels={...gameState.levels};
let shownProjects=new Set(gameState.projects);
const sessionStart=performance.now();
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(gameSave));}catch{}}
let snapshot:TownSnapshot=snapshotForGame(shownLevels,0,shownProjects.has('road-gates')?gameState.gateMask:0);
let town:TownScene|null=null,worker:ChoiceWorker|null=null,scenery:GameScenery|null=null,reactions:ReactionEffects|null=null,juice:Juice|null=null;
const sfx=new Sfx();
let target=new THREE.Vector3(0,terrainHeight(0,0)*.55,0),desiredTarget=target.clone();
// Frame the complete globe above the existing decision dock.
const townOverviewDistance=(_levels:Levels)=>Math.max(185,125/(innerWidth/innerHeight));
let azimuth=.72,elevation=.9,distance=townOverviewDistance(shownLevels),desiredAzimuth=azimuth,desiredElevation=elevation,desiredDistance=distance;
let manualOrbit=false,manualZoom=false;
let lookScale=.15,desiredLookScale=.15;
const cameraLook=new THREE.Vector3();
const manualCamera=new PlanetOrbit();
let cameraFlight:{move:PlanetCameraMove;elapsed:number;finish:(completed:boolean)=>void}|null=null;
function cancelCameraFlight(){const flight=cameraFlight;cameraFlight=null;flight?.finish(false);if(profile)document.body.dataset.cameraFlight='idle';}
async function frameBuildSite(focus:{x:number;z:number},height:number,view:'planet'|'site'='site',cinematicDistance?:number){
  if(!town)return;
  cancelCameraFlight();manualOrbit=false;manualZoom=false;
  const wide=view==='planet';
  const destination=wide?new THREE.Vector3():planetPoint(focus.x,terrainHeight(focus.x,focus.z)+height,focus.z);
  const normal=wide?new THREE.Vector3(0,1,0):planetNormal(focus.x,focus.z);
  const nextDistance=wide?townOverviewDistance(shownLevels):Math.max(cinematicDistance??48,(cinematicDistance?cinematicDistance*.6:28)/(innerWidth/innerHeight));
  // Pull back along the current viewing direction instead of orbiting to one tree.
  const direction=town.camera.position.clone().normalize();
  const nextAzimuth=wide?Math.atan2(direction.z,direction.x):Math.atan2(-focus.z,-focus.x)+.4;
  const nextElevation=wide?Math.acos(THREE.MathUtils.clamp(direction.y,-1,1)):.28;
  const orientation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
  const end=new THREE.Vector3(Math.cos(nextAzimuth)*Math.sin(nextElevation),Math.cos(nextElevation),Math.sin(nextAzimuth)*Math.sin(nextElevation))
    .applyQuaternion(orientation).multiplyScalar(PLANET_RADIUS+nextDistance*2);
  const arrive=()=>{
    target.copy(wide?desiredTarget.set(0,0,0):desiredTarget.set(focus.x,terrainHeight(focus.x,focus.z)+height,focus.z));
    distance=desiredDistance=nextDistance;azimuth=desiredAzimuth=nextAzimuth;elevation=desiredElevation=nextElevation;
    lookScale=desiredLookScale=wide?0:1;
  };
  if(reduced.matches){arrive();stepCamera(0);return;}
  const move=new PlanetCameraMove(town.camera.position.clone(),end,cameraLook.clone(),destination,town.camera.up);
  const completed=await new Promise<boolean>(resolve=>{cameraFlight={move,elapsed:0,finish:resolve};});
  // A cancelled flight must not restore its old target over a restart/skip.
  if(completed&&animating)arrive();
}
const pointers=new Map<number,{x:number;y:number}>();
let pointerStart:{x:number;y:number}|null=null,lastPointer:{x:number;y:number}|null=null,pinchDistance=0,dragged=false;
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
$('#brand').addEventListener('click',()=>leaveGame());
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-panel]'))button.addEventListener('click',()=>openPanel(button.dataset.panel!));

function projectMarkup(key:ProjectKey):string{
  const p=PROJECT_BY_KEY[key];
  const number=String(PROJECTS.findIndex(project=>project.key===key)+1).padStart(2,'0');
  return `<div class="project-panel"><div class="project-visual"><img src="${p.image}" alt="Art from ${p.title}" loading="eager" /><span class="project-visual-index">${number} / 05</span><div class="project-visual-footer"><span>PROJECT LANDMARK</span><strong>${p.landmark}</strong></div></div><div class="panel-copy"><button class="panel-back" type="button" data-back-work>← &nbsp; All projects</button><div class="project-heading"><span class="landmark-name">Selected work &nbsp; / &nbsp; ${number}</span><span class="project-badge">${p.kicker}</span></div><h2 id="${panelTitleId}">${p.title}</h2><p class="lead">${p.description}</p><div class="project-contribution"><span>WHAT I BUILT</span><p>${p.contribution}</p></div>${p.url?`<a class="panel-action" href="${p.url}" target="_blank" rel="noopener noreferrer">${p.key==='dwarves'?'Play the prototype':'Explore the project'} <span>↗</span></a>`:'<span class="development-note">In development · more to show soon</span>'}<div class="panel-endmark">DAV STEPANYAN <span>✦</span> SELECTED WORK</div></div></div>`;
}
function workMarkup():string{return `<div class="work-overview"><div class="work-intro"><div><span class="landmark-name">Games & experiments</span><h2 id="${panelTitleId}">Selected <em>work.</em></h2><p>Five games and experiments, each with a place in the town.</p></div><span class="work-count">05 <small>PROJECTS</small></span></div><div class="work-gallery">${PROJECTS.map((p,i)=>`<button class="work-card" type="button" data-project-link="${p.key}"><img src="${p.image}" alt="" loading="lazy" /><span class="work-card-shade"></span><span class="work-card-index">0${i+1} / 05</span><span class="work-card-arrow" aria-hidden="true">↗</span><span class="work-card-text"><small>${p.kicker}</small><strong>${p.title}</strong></span></button>`).join('')}</div></div>`;}
function aboutMarkup():string{return `<div class="editorial-panel about-panel"><div class="editorial-art about-art" aria-hidden="true"><div class="about-mosaic"><img src="/assets/games/idle-outpost.webp" alt="" /><img src="/assets/games/sandship.webp" alt="" /><img src="/assets/games/idle-wizard.webp" alt="" /></div><div class="editorial-cover-caption"><span>DAV STEPANYAN &nbsp; / &nbsp; YEREVAN</span><strong>Building worlds<br>that move.</strong><small>GAME DEVELOPMENT · CREATIVE SYSTEMS</small></div></div><div class="panel-copy"><span class="landmark-name">About me</span><h2 id="${panelTitleId}">Hi, I'm Dav.</h2><p class="lead">I make worlds that won't sit still.</p><p>I'm a game developer in Yerevan, Armenia. At Rockbite Games I've worked across gameplay, economies, progression, and the small details that make systems feel alive. I enjoy both writing the code and watching what players actually do with it.</p><p>After hours, I keep building: browser games, creative tools, and a co-op mining adventure. This town is another place to try ideas and let them grow.</p><div class="about-facts"><div><small>ROLE</small><strong>Lead Code Wizard</strong></div><div><small>BASE</small><strong>Yerevan, Armenia</strong></div><div><small>CURRENTLY BUILDING</small><strong>Drunk Dwarves</strong></div></div></div></div>`;}
function contactMarkup():string{return `<div class="editorial-panel contact-panel"><div class="editorial-art contact-art" aria-hidden="true"><div class="postcard"><span class="postcard-top">DAV STEPANYAN &nbsp; / &nbsp; TOWN POST</span><span class="postcard-mark">DS<span>✦</span></span><strong>Good ideas<br>start with<br>a hello.</strong><span class="postcard-bottom">YEREVAN, ARMENIA &nbsp; · &nbsp; OPEN TO CONVERSATION</span></div></div><div class="panel-copy"><span class="landmark-name">Get in touch</span><h2 id="${panelTitleId}">Let's make something alive.</h2><p class="lead">Have a game idea, a system to untangle, or just want to compare notes?</p><a class="panel-action" href="mailto:davitstepanyan99@gmail.com">Send me an email <span>↗</span></a><div class="contact-links"><a href="https://github.com/DavStep" target="_blank" rel="noopener noreferrer"><span>GitHub</span><span>↗</span></a><a href="https://anilist.co/user/DevStep" target="_blank" rel="noopener noreferrer"><span>AniList</span><span>↗</span></a><a href="https://steamcommunity.com/id/stepdev/" target="_blank" rel="noopener noreferrer"><span>Steam</span><span>↗</span></a><button type="button" id="copy-discord"><span>Copy Discord: step_dev</span><span>↗</span></button></div></div></div>`;}
function validPanel(id:string|null):string|null{return id&&(id==='work'||id==='about'||id==='contact'||id.startsWith('project-')&&PROJECTS.some(p=>`project-${p.key}`===id))?id:null;}
function openPanel(id:string,updateHistory=true){
  const valid=validPanel(id);if(!valid)return;
  if(activePanel===valid)return;
  const switching=Boolean(activePanel);
  if(!activePanel)lastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  activePanel=valid;
  panel.dataset.view=valid.startsWith('project-')?'project':valid;
  panel.querySelectorAll<HTMLButtonElement>('.panel-tab').forEach(button=>button.setAttribute('aria-current',String(button.dataset.panel===valid||(valid.startsWith('project-')&&button.dataset.panel==='work'))));
  panelBody.innerHTML=valid.startsWith('project-')?projectMarkup(valid.slice(8) as ProjectKey):valid==='work'?workMarkup():valid==='about'?aboutMarkup():contactMarkup();
  panelBody.scrollTop=0;
  choreographPanel(switching);
  panel.hidden=false;backdrop.hidden=false;$('.chrome').inert=true;$('.town-ui').inert=true;fallback.inert=true;
  requestAnimationFrame(()=>{panel.classList.add('open');backdrop.classList.add('open');closeButton.focus();});
  document.body.classList.add('panel-open');
  if(valid.startsWith('project-')){
    const p=snapshot.plots.find(q=>q.project===valid.slice(8));
    if(p&&town){desiredTarget.set(p.x,terrainHeight(p.x,p.z),p.z);desiredDistance=townOverviewDistance(shownLevels)*.92;setIntroHidden(true);}
  }
  if(updateHistory)history.pushState({panel:valid},'',`#town/${valid}`);
  panelBody.querySelectorAll<HTMLButtonElement>('[data-project-link]').forEach(button=>button.addEventListener('click',()=>openPanel(`project-${button.dataset.projectLink}`)));
  panelBody.querySelector<HTMLButtonElement>('[data-back-work]')?.addEventListener('click',()=>openPanel('work'));
  panelBody.querySelector<HTMLButtonElement>('#copy-discord')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText('step_dev');announce('Discord name copied.');}catch{announce('Discord: step_dev');}});
}
function choreographPanel(switching:boolean){
  if(reducedMotion())return;
  if(switching){
    play(panelBody,[{opacity:0},{opacity:1}],{duration:220,easing:EASE.outQuart});
  }else{
    play(panel,[{opacity:0,translate:'0 8px'},{opacity:1,translate:'0 0'}],{duration:300,easing:EASE.outQuart});
  }
}
function closePanel(updateHistory=true){
  if(!activePanel)return;
  activePanel=null;$('.chrome').inert=false;$('.town-ui').inert=false;fallback.inert=false;panel.classList.remove('open');backdrop.classList.remove('open');document.body.classList.remove('panel-open');
  window.setTimeout(()=>{if(!activePanel){panel.hidden=true;backdrop.hidden=true;panelBody.innerHTML='';}},reduced.matches?0:350);
  if(updateHistory)history.pushState({panel:null},'',location.pathname+location.search+(playing?'#town':''));
  lastFocus?.focus();
}
closeButton.addEventListener('click',()=>closePanel());backdrop.addEventListener('click',()=>closePanel());
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&activePanel){e.preventDefault();closePanel();return;}
  if(e.key==='Tab'&&activePanel){const items=[...panel.querySelectorAll<HTMLElement>('button,a[href]')].filter(el=>!el.hasAttribute('disabled'));if(!items.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
});
window.addEventListener('popstate',()=>{
  if(location.hash==='#town'){closePanel(false);if(!playing)startGame(false);return;}
  const id=location.hash.startsWith('#town/')?validPanel(location.hash.slice(6)):null;
  if(id){if(!playing)startGame(false);openPanel(id,false);}
  else{closePanel(false);if(playing)leaveGame(false);}
});

// ---------- Game feel: sound, floating labels, card feedback ----------
const soundButton=$<HTMLButtonElement>('#game-sound');
function renderSound(){soundButton.textContent=sfx.muted?'♪ Off':'♪';soundButton.setAttribute('aria-pressed',String(!sfx.muted));soundButton.setAttribute('aria-label',sfx.muted?'Sound off':'Sound on');soundButton.title=sfx.muted?'Sound off':'Sound on';}
soundButton.addEventListener('click',()=>{sfx.unlock();sfx.setMuted(!sfx.muted);renderSound();if(!sfx.muted)sfx.click();});
renderSound();
const floatLayer=document.createElement('div');floatLayer.className='float-layer';floatLayer.setAttribute('aria-hidden','true');document.body.append(floatLayer);
interface FloatLabel{el:HTMLElement;pos:THREE.Vector3;born:number}
const floats:FloatLabel[]=[];
const projected=new THREE.Vector3();
function floatLabel(html:string,x:number,y:number,z:number,color:number,big=false,delay=0){
  if(reduced.matches||!town)return;
  const el=document.createElement('div');
  el.className=`float-label${big?' big':''}`;
  el.style.setProperty('--idea-color',`#${color.toString(16).padStart(6,'0')}`);
  el.style.animationDelay=`${delay}ms`;
  el.innerHTML=html;floatLayer.append(el);
  floats.push({el,pos:new THREE.Vector3(x,y,z),born:performance.now()+delay});
}
function updateFloats(now:number){
  if(!town)return;
  for(let i=floats.length-1;i>=0;i--){
    const f=floats[i];
    if(now-f.born>1900){f.el.remove();floats.splice(i,1);continue;}
    projected.copy(planetPoint(f.pos.x,f.pos.y,f.pos.z)).project(town.camera);
    const visible=projected.z<1;
    f.el.style.transform=`translate(${((projected.x+1)/2*innerWidth).toFixed(1)}px,${((1-projected.y)/2*innerHeight).toFixed(1)}px)`;
    f.el.style.visibility=visible?'visible':'hidden';
  }
}
function clearFloats(){for(const f of floats)f.el.remove();floats.length=0;}
function bumpCard(idea:Idea,cls='bump'){
  const card=gameCards.querySelector<HTMLElement>(`[data-idea="${idea}"]`);
  if(!card||reduced.matches)return;
  card.classList.remove(cls);void card.offsetWidth;card.classList.add(cls);
  card.addEventListener('animationend',()=>card.classList.remove(cls),{once:true});
}
const DEBRIS:Record<string,readonly number[]>={home:[0xc98f62,0x9b6b48,0xe7d3b1,0xb6573f],wall:[0xb4aa96,0x8f8779,0xa49b89],project:[0xd2b48c,0x8c6e54,0x7e9bbf],castle:[0xb9b4aa,0x8f8a80,0xc0663f]};
let waveImpacts=0;
function onBuildImpact(impact:BuildImpact){
  if(!juice)return;
  const size=THREE.MathUtils.clamp(impact.height/7,.6,1.8);
  juice.dustRing(impact.x,impact.y,impact.z,Math.max(2.5,impact.radius*1.15),Math.round(12+size*8),.8+size*.3);
  juice.debris(impact.x,impact.y,impact.z,impact.radius,DEBRIS[impact.kind]??[0xc9b28e,0x9a826a,0xb8a590],Math.round(6+size*6));
  juice.addShake(waveImpacts===0?.35+size*.2:.12);
  if(waveImpacts<4)sfx.thud(size);
  if(waveImpacts===0)worker?.celebrate();
  waveImpacts++;
}

function recenter(resetControls=true){
  cancelCameraFlight();desiredLookScale=.15;
  desiredTarget.set(0,terrainHeight(0,0)*.55,0);
  if(resetControls){manualOrbit=false;manualZoom=false;}
  if(!manualZoom)desiredDistance=townOverviewDistance(shownLevels);
  if(!manualOrbit){desiredAzimuth=.72;desiredElevation=.9;}
  if(town&&!manualOrbit&&!reduced.matches){
    const end=new THREE.Vector3(Math.cos(desiredAzimuth)*Math.sin(desiredElevation),Math.cos(desiredElevation),Math.sin(desiredAzimuth)*Math.sin(desiredElevation))
      .multiplyScalar(PLANET_RADIUS+desiredDistance*2);
    const look=planetPoint(desiredTarget.x,desiredTarget.y,desiredTarget.z).multiplyScalar(desiredLookScale);
    cameraFlight={move:new PlanetCameraMove(town.camera.position.clone(),end,cameraLook.clone(),look,town.camera.up),elapsed:0,finish:completed=>{
      if(!completed)return;
      target.copy(desiredTarget);distance=desiredDistance;azimuth=desiredAzimuth;elevation=desiredElevation;lookScale=desiredLookScale;
    }};
  }
}
function zoom(delta:number){if(cameraFlight)return;manualZoom=true;desiredDistance=THREE.MathUtils.clamp(desiredDistance+delta,38,420);}
const gameHud=$<HTMLElement>('#game-hud');
const gameCards=$<HTMLDivElement>('#game-cards');
const gameProgress=$<HTMLDivElement>('#game-progress');
const gameEvent=$<HTMLParagraphElement>('#game-event');
const worldNotice=$<HTMLParagraphElement>('#world-notice');
const artifactTray=$<HTMLDivElement>('#world-artifacts');
const worldJournal=$<HTMLDetailsElement>('#world-journal');
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

const IDEA_HEX=Object.fromEntries(IDEAS.map(idea=>[idea,`#${IDEA_COLORS[idea].toString(16).padStart(6,'0')}`])) as Record<Idea,string>;
const HOTKEYS=['1','2','3','4','5','6','7','8','9','0'];
let lastEventMessage='',revealDone=false,revealPending=false;
let hudRendered=false;
function renderGameHud(){
  gameHud.hidden=!playing;
  gameHud.classList.toggle('is-busy',animating);
  const showResults=gameState.finished&&!animating;
  gameHud.classList.toggle('is-finished',showResults);
  $('#fallback-start').hidden=gameSave.started;
  document.body.classList.toggle('game-running',playing);
  tweenText($('#game-turn'),`${gameSave.order.length} / ${IDEAS.length}`,420);
  // Choices stay neutral during play: the town reacts, but levels and
  // verdicts are revealed only when all ten ideas are placed.
  const maxCount=IDEAS.filter(idea=>gameState.levels[idea]===MAX_LEVEL).length;
  const remaining=IDEAS.length-gameSave.order.length;
  $('.game-hud-kicker').textContent=showResults?'Your town':'Your little world';
  $('#game-summary').textContent=showResults
    ?revealPending?'Revealing the town…':gameState.secret?'Dragon’s Beacon · Complete':gameState.perfect?'Complete · Every idea at MAX':`${maxCount} of ${IDEAS.length} ideas reached MAX`
    :animating?'The town is answering…':remaining===IDEAS.length?'Place your first idea':remaining===1?'Place your last idea':`${remaining} ideas left to place`;
  const visibleWorld=animating?shownWorld:gameState.world;
  worldNotice.textContent=worldNextEvent(visibleWorld);worldNotice.hidden=!worldNotice.textContent;
  const artifactNames={lens:'Sky Lens',gold:'Dragon gold',core:'Ember Core'};
  artifactTray.replaceChildren(...(['lens','gold','core'] as const).map(id=>{
    const item=document.createElement('span'),location=visibleWorld.artifacts[id],installed=visibleWorld.installed.includes(id);
    const owned=['town','friendly-dragon','installed'].includes(location);
    item.className=owned?'collected':location==='departed-dragon'?'lost':'';
    item.textContent=`${installed?'✦':owned?'◆':'◇'} ${artifactNames[id]}`;
    item.title=installed?'Installed in the Wizard tower':location==='departed-dragon'?'Taken by the dragon':owned?'Collected':`Waiting at the ${location}`;
    item.setAttribute('aria-label',`${artifactNames[id]}: ${item.title}`);return item;
  }));
  artifactTray.hidden=!gameSave.order.length;
  worldJournal.hidden=!showResults;
  if(showResults){
    const body=worldJournal.querySelector('div')!;body.replaceChildren();
    for(const event of gameState.history){const row=document.createElement('p');row.textContent=`${event.turn}. ${event.description}`;body.append(row);}
    for(const pending of gameState.pending){const row=document.createElement('p');row.textContent=`${IDEA_INFO[pending.idea].name}: ${pending.name} needs ${pending.missing.join(', ')}.`;body.append(row);}
  }
  if(!gameProgress.children.length)gameProgress.innerHTML=IDEAS.map(()=>'<span><i></i></span>').join('');
  for(const [index,mark] of [...gameProgress.children].entries()){
    const placed=gameSave.order[index];
    mark.classList.toggle('filled',Boolean(placed));
    if(placed)(mark as HTMLElement).style.setProperty('--seg',IDEA_HEX[placed]);else (mark as HTMLElement).style.removeProperty('--seg');
  }
  gameSkip.hidden=!animating;
  const restartLabel=restartButton.querySelector('span')!;
  if(!restartArmed)restartLabel.textContent=showResults?'Play again':'Restart';
  restartButton.classList.toggle('primary',showResults);
  if(eventMessage!==lastEventMessage){
    gameEvent.textContent=eventMessage;
    if(eventMessage)play(gameEvent,[{opacity:0,translate:'0 10px',filter:'blur(5px)'},{opacity:1,translate:'0 0',filter:'blur(0px)'}],{duration:520,easing:EASE.outExpo});
    lastEventMessage=eventMessage;
  }
  gameEvent.hidden=!eventMessage;
  if(!gameCards.children.length)gameCards.innerHTML=CARD_ORDER.map((idea,index)=>{
    const info=IDEA_INFO[idea];
    return `<button type="button" class="game-card" data-idea="${idea}" aria-keyshortcuts="${HOTKEYS[index]}" style="--idea-color:${IDEA_HEX[idea]};--i:${index}"><span class="game-card-sheen" aria-hidden="true"></span><kbd class="game-card-key" aria-hidden="true">${HOTKEYS[index]}</kbd><span class="game-card-icon" aria-hidden="true"><img src="${info.icon}" alt="" draggable="false" /><span class="game-card-result"><b></b><small></small></span></span><span class="game-card-label">${info.name}</span><span class="game-card-meter" aria-hidden="true">${'<i></i>'.repeat(MAX_LEVEL)}</span></button>`;
  }).join('');
  for(const idea of CARD_ORDER){
    const info=IDEA_INFO[idea],chosen=gameSave.order.includes(idea);
    const button=gameCards.querySelector<HTMLButtonElement>(`[data-idea="${idea}"]`)!;
    const level=gameState.levels[idea],max=level===MAX_LEVEL;
    button.classList.toggle('chosen',chosen);
    button.classList.toggle('is-max',max);
    if(!showResults)button.classList.remove('revealed');
    button.querySelector('.game-card-result b')!.textContent=max?'MAX':String(level);
    button.querySelector('.game-card-result small')!.textContent=max?'':`/ ${MAX_LEVEL}`;
    button.querySelectorAll('.game-card-meter i').forEach((pip,k)=>pip.classList.toggle('on',k<level));
    // The front shows the idea fully grown; the revealed side shows the stage it reached.
    const art=button.querySelector<HTMLImageElement>('.game-card-icon img')!,wanted=showResults&&button.classList.contains('revealed')?ideaIcon(idea,level):info.icon;
    if(art.getAttribute('src')!==wanted)art.src=wanted;
    button.title=showResults?'':info.hint;
    button.disabled=chosen||animating||gameState.finished;
    button.setAttribute('aria-label',showResults
      ?`${info.name}, reached ${max?'MAX':`level ${level} of ${MAX_LEVEL}`}`
      :chosen?`${info.name}, placed`:`${info.name}. ${info.hint} Shortcut key ${HOTKEYS[CARD_ORDER.indexOf(idea)]}.`);
  }
  if(!showResults)revealDone=false;
  else if(!revealDone){
    revealDone=true;
    if(hudRendered&&playing&&!reducedMotion())revealCards();
    else{gameCards.querySelectorAll('.game-card').forEach(card=>card.classList.add('revealed'));renderGameHud();}
  }
  hudRendered=true;
}
/** Flips every card, left to right, to show the level each idea reached. */
function revealCards(){
  const token=animationToken,cards=[...gameCards.querySelectorAll<HTMLButtonElement>('.game-card')];
  const start=320,gap=110,flat='perspective(700px) rotateY(0deg)';
  revealPending=true;renderGameHud();
  cards.forEach((card,i)=>window.setTimeout(()=>{
    if(token!==animationToken)return;
    const out=card.animate([{transform:flat},{transform:'perspective(700px) rotateY(90deg) scale(1.04)'}],{duration:190,easing:EASE.inQuart,fill:'forwards'});
    out.finished.then(()=>{
      if(token!==animationToken){out.cancel();return;}
      card.classList.add('revealed');out.cancel();
      const idea=card.dataset.idea as Idea;card.querySelector<HTMLImageElement>('.game-card-icon img')!.src=ideaIcon(idea,gameState.levels[idea]);
      card.animate([{transform:'perspective(700px) rotateY(-90deg) scale(1.04)'},{transform:flat}],{duration:EASE.springSoft.duration,easing:EASE.springSoft.easing});
      if(card.classList.contains('is-max'))burst(card,'#f2c24f',8);
    },()=>{});
  },start+i*gap));
  window.setTimeout(()=>{
    if(token!==animationToken)return;
    revealPending=false;renderGameHud();
    play($('#game-summary'),[{opacity:0,translate:'0 8px',scale:.96},{opacity:1,translate:'0 0',scale:1}],{duration:EASE.spring.duration,easing:EASE.spring.easing});
    retrigger(gameHud,'finale');
    if(gameState.perfect||gameState.secret){const r=gameCards.getBoundingClientRect();confetti(r.left+r.width/2,r.top,Object.values(IDEA_HEX),120);}
  },start+cards.length*gap+420);
}
function enterHud(delay=0){
  if(reducedMotion()||gameHud.hidden)return;
  play($('.game-hud-head'),rise(26,8),{duration:760,easing:EASE.outExpo,delay,fill:'backwards'});
  stagger(gameProgress.children,[{opacity:0,scale:'0 1'},{opacity:1,scale:'1 1'}],{duration:640,easing:EASE.outExpo,delay:delay+140,gap:32});
  stagger(gameCards.children,[{translate:'0 44px',scale:.82},{translate:'0 0',scale:1}],{duration:EASE.spring.duration,easing:EASE.spring.easing,delay:delay+180,gap:40});
  stagger(gameCards.children,[{opacity:0,filter:'blur(8px)'},{opacity:1,filter:'blur(0px)'}],{duration:520,easing:EASE.outQuart,delay:delay+180,gap:40});
  stagger(gameCards.querySelectorAll('.game-card-icon'),[{scale:.4,rotate:'-12deg'},{scale:1,rotate:'0deg'}],{duration:EASE.springSnappy.duration,easing:EASE.springSnappy.easing,delay:delay+300,gap:40});
}
function readyRipple(){
  const available=[...gameCards.querySelectorAll<HTMLButtonElement>('.game-card:not(:disabled)')];
  stagger(available,[{translate:'0 0'},{translate:'0 -7px',offset:.35},{translate:'0 0'}],{duration:620,easing:EASE.inOut,gap:45});
  available.forEach((card,i)=>{card.style.setProperty('--ready-delay',`${i*45}ms`);retrigger(card,'ready');});
}
function refreshGameWorld(instant=false){
  snapshot=snapshotForGame(shownLevels,performance.now()-sessionStart,shownProjects.has('road-gates')?gameState.gateMask:0);
  town?.update(snapshot,!instant&&animating&&!reduced.matches);
  worldVisuals?.setState(shownWorld,shownLevels);
  town?.setWorldEventState(shownWorld);
  scenery?.setLevels(shownLevels,gameState.secret&&gameState.finished&&!animating,instant);
  if(town?.planetRoadClearance)scenery?.clearRoadApproaches(town.planetRoadClearance,town.planetCropClearance);
  worker?.update();
}
export function showHeroWorld(){
  if(playing||!town)return;
  heroWorld.appendChild(canvas);
  heroWidth=heroWorld.clientWidth;heroHeight=heroWorld.clientHeight;
  syncHeroMotion();
  town.setPixelRatio(Math.min(pixelRatio,1.25));
  town.update(showcaseSnapshot,false);
  worldVisuals?.setState(showcase.world,showcase.levels);
  town.setWorldEventState(showcase.world);
  scenery?.setLevels(showcase.levels,true,true);
  if(town.planetRoadClearance)scenery?.clearRoadApproaches(town.planetRoadClearance,town.planetCropClearance);
  heroRendered=false;lastFrame=0;
}
export function startGame(updateHistory=true){
  if(playing)return;
  endHeroPointer();
  const requestedPanel=location.hash.startsWith('#town/')?validPanel(location.hash.slice(6)):null;
  portfolioScroll=window.scrollY;
  if(!location.hash.startsWith('#town'))portfolioHash=location.hash;
  if(document.activeElement instanceof HTMLElement&&portfolio.contains(document.activeElement))playLauncher=document.activeElement;
  playing=true;
  portfolio.hidden=true;portfolio.inert=true;
  townExperience.hidden=false;
  townExperience.prepend(canvas);
  document.body.classList.remove('portfolio-mode');
  document.body.classList.add('game-playing');document.documentElement.classList.remove('portfolio-mode');document.documentElement.classList.add('game-playing');
  lastFrame=0;town?.setPixelRatio(pixelRatio);
  gameSave.started=true;
  persist();setIntroHidden(true);renderGameHud();refreshGameWorld(true);recenter();
  enterHud(220);
  (gameCards.querySelector<HTMLButtonElement>('button:not(:disabled)')??restartButton).focus({preventScroll:true});
  if(updateHistory&&!requestedPanel&&location.hash!=='#town')history.pushState({town:true},'',location.pathname+location.search+'#town');
  if(requestedPanel)openPanel(requestedPanel,false);
}
function leaveGame(updateHistory=true){
  if(!playing)return;
  closePanel(false);skipAnimation();animationToken++;cancelCameraFlight();clearFloats();disarmRestart();
  revealPending=false;
  playing=false;
  townExperience.hidden=true;
  portfolio.hidden=false;portfolio.inert=false;
  document.body.classList.add('portfolio-mode');
  document.body.classList.remove('game-playing','game-running');document.documentElement.classList.remove('game-playing');document.documentElement.classList.add('portfolio-mode');
  renderGameHud();persist();
  showHeroWorld();
  if(updateHistory)history.pushState({town:false},'',location.pathname+location.search+portfolioHash);
  window.scrollTo({top:portfolioScroll,behavior:'instant'});
  (playLauncher??portfolio.querySelector<HTMLAnchorElement>('a'))?.focus({preventScroll:true});
}
function restart(){
  animationToken++;cancelCinematic();animating=false;restartGame(gameSave);gameState=evaluate([]);shownLevels={...gameState.levels};
  shownWorld=copyWorldEventState(gameState.world);shownProjects=new Set();
  worker?.finishCue(true);scenery?.endBeat();reactions?.clear();juice?.clear();clearFloats();
  eventMessage='';persist();renderGameHud();refreshGameWorld(true);recenter();
  stagger(gameCards.children,[{scale:.9,opacity:.4},{scale:1,opacity:1}],{duration:EASE.spring.duration,easing:EASE.spring.easing,gap:30});
}
function finishDecision(instant=false){
  cancelCinematic();shownWorld=copyWorldEventState(gameState.world);
  animating=false;shownLevels={...gameState.levels};shownProjects=new Set(gameState.projects);
  worker?.finishCue(instant);scenery?.endBeat();reactions?.clear();
  const last=gameSave.order.at(-1);
  if(!instant&&gameState.finished&&gameState.perfect&&juice&&!reduced.matches){
    sfx.fanfare();
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2;window.setTimeout(()=>{juice?.sparkles(Math.cos(a)*18,terrainHeight(Math.cos(a)*18,Math.sin(a)*18)+2,Math.sin(a)*18,[0xffd66b,0x8da9ee,0xe99a6f,0x6fc578,0xdd80aa,0x55c6d6][i],40,4,1.8);juice?.addShake(.2);},i*180);}
  }
  eventMessage=gameState.finished||!last?'':`${IDEA_INFO[last].name} placed. Choose the next idea.`;
  refreshGameWorld(instant);renderGameHud();recenter(false);
  if(!gameState.finished)readyRipple();
  const next=gameState.finished?restartButton:gameCards.querySelector<HTMLButtonElement>('button:not(:disabled)');
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
  sfx.unlock();sfx.click();bumpCard(idea,'picked');
  shownProjects=new Set(gameState.projects);
  gameState=chooseIdea(gameSave,idea);persist();
  if(gameState.finished)for(const item of IDEAS)new Image().src=ideaIcon(item,gameState.levels[item]);
  animating=true;const token=++animationToken;
  const sequence=decisionSequence(gameState);
  const calm=reduced.matches||!town;
  renderGameHud();gameSkip.focus({preventScroll:true});
  try{
    let beat=0;
    for(const step of sequence){
      if(token!==animationToken)return;
      if(step.kind==='world'){
        const event=step.event;
        worker?.finishCue(true);reactions?.clear();
        eventMessage=event.description;gameEvent.classList.add('collab');renderGameHud();
        if(worldVisuals&&!calm){
          town?.setExpeditionActive(event.kind==='expedition');
          worldVisuals.begin(event,shownLevels);
          const focus=worldVisuals.sample(0);
          if(focus){
            const close=event.kind==='beacon-lit'?32:event.kind.startsWith('eruption')||event.kind==='mine-prepared'?36:event.kind==='expedition'||event.kind==='lens-delivery'?30:event.kind.startsWith('dragon')?26:22;
            await frameBuildSite(focus,focus.height,'site',close);
          }
          if(token!==animationToken)return;
          await new Promise<void>(resolve=>{cinematic={event,elapsed:0,duration:worldEventDuration(event.kind),sounded:false,resolve};});
          if(token!==animationToken)return;
          worldVisuals.finish();town?.setExpeditionActive(false);
        }else await waitForScene(600,token);
        if(token!==animationToken)return;
        shownWorld=copyWorldEventState(event.after);refreshGameWorld(true);renderGameHud();
        continue;
      }
      const {event,arrival,projects,world}=step.beat;
      const plannedLevels={...shownLevels,[event.idea]:event.level};
      const plannedProjects=new Set(shownProjects);
      for(const project of projects)plannedProjects.add(project);
      const planned=snapshotForGame(plannedLevels,performance.now()-sessionStart,plannedProjects.has('road-gates')?gameState.gateMask:0);
      const crossings=event.idea==='roads'?planetTransportLayout().bridges.filter(b=>[b.level,b.level+2].some(level=>level>(snapshot.roadLevel??0)&&level<=event.level)):[];
      const crossing=crossings.length===1?crossings[0]:undefined;
      const focus=event.idea==='river'?(planetTransportLayout().harbors[0]?.land??planetRiverPoint(.45)):crossing?mixPoint(crossing.a,crossing.b,.5):arrival?eventFocus({idea:event.idea,level:1}):upgradeFocus(event,snapshot,planned);
      const sandship=event.idea==='workshop'&&arrival;
      const project=DEVELOPMENT_RULES.find(item=>item.id===event.project);
      eventMessage=project?`${IDEA_INFO[event.idea].name} · ${project.name}`:eventTitle(event);
      gameEvent.classList.toggle('collab',Boolean(project));
      renderGameHud();
      await frameBuildSite(focus,sandship?8:3,planetEventView(event.idea,event.level,Boolean(crossing)));
      if(token!==animationToken)return;
      if(town&&beat===0){
        const obstacles=[...town.environment.activeTrees,...town.treeObstacles];
        const colliders=[...buildColliders(planned,obstacles),...landscapeColliders(shownLevels),...moatColliders(shownLevels)];
        const crew=gameState.events.some(event=>event.project)?4:3;
        worker?.startCue(idea,focus,(x,z)=>planetElevation(planetNormal(x,z))>.9&&!isBlocked(x,z,colliders,1.15),reduced.matches,performance.now()/1000,crew);
      }
      if(!calm){
        reactions?.begin(event,idea,focus);
        if(reactions?.travelTime)sfx.whoosh(.8);
      }
      renderGameHud();
      // Reveal only after the camera has framed the site or the whole planet.
      const travel=(reactions?.travelTime??0)*1000;
      const anticipation=calm?250:Math.max(beat===0&&arrival?1350:beat===0?1000:700,travel+120);
      await waitForScene(anticipation,token);
      if(token!==animationToken)return;
      waveImpacts=0;
      shownWorld=copyWorldEventState(world);shownLevels[event.idea]=event.level;
      for(const project of projects)shownProjects.add(project);
      refreshGameWorld(calm);
      if(!calm){
        reactions?.reveal();
        juice?.addShake(project?.45:.2);
        if(project)sfx.collab();else sfx.levelUp(event.level);
        // Ideas without buildings (grove, river, roads) still get a crew cheer.
        window.setTimeout(()=>{
          if(token!==animationToken||waveImpacts>0)return;
          worker?.celebrate();
          const y=town?.environment.landscapeHeight(focus.x,focus.z)??0;
          juice?.dustRing(focus.x,y,focus.z,5,16,1);
          juice?.sparkles(focus.x,y+.5,focus.z,IDEA_COLORS[event.idea],18,5,1.1);
          juice?.addShake(.25);sfx.thud(.8);
        },420);
        const y=(town?.environment.landscapeHeight(focus.x,focus.z)??0)+10;
        floatLabel(`<small>${IDEA_INFO[event.idea].name}</small><strong>▲ grows</strong>`,focus.x,y,focus.z,IDEA_COLORS[event.idea],Boolean(project));
        window.setTimeout(()=>bumpCard(event.idea),250);
        if(project)floatLabel(`<em>✦ ${project.name}</em>`,focus.x,(town?.environment.landscapeHeight(focus.x,focus.z)??0)+15,focus.z,IDEA_COLORS[idea],true,80);
      }
      eventMessage=project?`${IDEA_INFO[event.idea].name} · ${eventTitle(event)}`:eventTitle(event);
      renderGameHud();
      const duration=sandship?SANDSHIP_ARRIVAL_MS+150:event.idea==='river'&&(arrival||event.level<=3)?7500:event.idea==='windmill'&&event.level===3?2900:project?2200:1900;
      await waitForScene(calm?450:duration,token);
      if(token!==animationToken)return;
      reactions?.clear();
      worker?.resumeWork();
      beat++;
    }
    if(token!==animationToken)return;
    gameEvent.classList.remove('collab');
    finishDecision();
  }catch(error){
    console.error('Reaction playback interrupted',error);
    if(token===animationToken){finishDecision(true);announce('Your choice is saved.');}
  }
}
gameCards.addEventListener('click',event=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-idea]');
  if(!button||button.disabled)return;
  burst(button,IDEA_HEX[button.dataset.idea as Idea]);
  void playChoice(button.dataset.idea as Idea);
});
pointerLight(gameCards,'.game-card',7);
magnetic(document,'.intro-actions button, #game-restart.primary, .fallback button');
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||activePanel||!playing||event.metaKey||event.ctrlKey||event.altKey||event.repeat)return;
  if((event.target as HTMLElement).closest('input,textarea,select,[contenteditable]'))return;
  if(event.key==='Escape'){event.preventDefault();if(animating)skipAnimation();else leaveGame();return;}
  const index=HOTKEYS.indexOf(event.key);if(index<0)return;
  const button=gameCards.querySelector<HTMLButtonElement>(`[data-idea="${CARD_ORDER[index]}"]`);
  if(button&&!button.disabled){event.preventDefault();button.focus({preventScroll:true});button.click();}
});
const restartButton=$<HTMLButtonElement>('#game-restart');
let restartArmed=0;
function disarmRestart(){clearTimeout(restartArmed);restartArmed=0;restartButton.classList.remove('armed');restartButton.querySelector('span')!.textContent=gameState.finished&&!animating?'Play again':'Restart';restartButton.removeAttribute('aria-label');}
restartButton.addEventListener('click',()=>{
  // A finished or empty run restarts at once; a run in progress asks twice.
  if(restartArmed||!gameSave.order.length||(gameState.finished&&!animating)){disarmRestart();restart();return;}
  restartButton.classList.add('armed');restartButton.querySelector('span')!.textContent='Tap again';restartButton.setAttribute('aria-label','Tap again to confirm restart');
  restartArmed=window.setTimeout(disarmRestart,2600);
});
gameSkip.addEventListener('click',skipAnimation);
function orbit(dx:number,dy=0){
  if(cameraFlight||!town)return;
  if(!manualOrbit)manualCamera.start(town.camera,cameraLook);
  manualOrbit=true;
  manualCamera.rotate(dx,dy);
}
$('#camera-left').addEventListener('click',()=>orbit(-.32));
$('#camera-right').addEventListener('click',()=>orbit(.32));
$('#camera-zoom-in').addEventListener('click',()=>zoom(-14));
$('#camera-zoom-out').addEventListener('click',()=>zoom(14));
$('#camera-overview').addEventListener('click',()=>recenter());

// The portfolio globe has its own orbit so exploring it never changes game progress or framing.
function rotateHero(dx:number,dy=0){
  if(playing||!town||canvas.parentElement!==heroWorld)return;
  if(!heroManual)heroOrbit.start(town.camera,heroLook.set(0,0,0));
  heroManual=true;
  heroOrbit.rotate(dx,dy);
  heroRendered=false;lastFrame=0;
}
function resetHero(){
  if(playing)return;
  endHeroPointer();heroOrbit.cancelMotion();
  heroRadius=heroDesiredRadius=heroDefaultRadius;
  heroManual=false;heroTime=0;heroRendered=false;lastFrame=0;
}
function syncHeroMotion(){
  heroMotion.hidden=reduced.matches;
  heroMotion.setAttribute('aria-pressed',String(heroPaused));
  heroMotion.setAttribute('aria-label',heroPaused?'Resume planet animation':'Pause planet animation');
  heroMotion.title=heroPaused?'Resume animation':'Pause animation';
  heroMotion.querySelector('[data-pause-icon]')!.toggleAttribute('hidden',heroPaused);
  heroMotion.querySelector('[data-play-icon]')!.toggleAttribute('hidden',!heroPaused);
}
heroMotion.addEventListener('click',()=>{
  heroPaused=!heroPaused;heroRendered=false;lastFrame=0;syncHeroMotion();
});
reduced.addEventListener('change',()=>{heroRendered=false;lastFrame=0;syncHeroMotion();});
function zoomHero(delta:number){
  if(playing||!town||canvas.parentElement!==heroWorld)return;
  heroDesiredRadius=THREE.MathUtils.clamp(heroDesiredRadius*Math.exp(delta),PLANET_RADIUS*1.6,PLANET_RADIUS*4.6);
  heroRendered=false;
}
function endHeroPointer(){
  heroPointer=null;heroPinchDistance=0;heroOrbit.cancelMotion();
  delete heroWorld.dataset.dragging;
  document.body.classList.remove('hero-world-interacting');
  const ids=[...heroPointers.keys()];heroPointers.clear();
  for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
}
for(const button of heroWorld.querySelectorAll<HTMLButtonElement>('[data-hero-rotate]')){
  button.addEventListener('click',()=>{
    if(button.dataset.heroRotate==='reset')resetHero();
    else rotateHero(button.dataset.heroRotate==='left'?-.32:.32);
  });
}
for(const button of heroWorld.querySelectorAll<HTMLButtonElement>('[data-hero-zoom]')){
  button.addEventListener('click',()=>zoomHero(button.dataset.heroZoom==='in'?-.2:.2));
}
heroWorld.addEventListener('keydown',event=>{
  if(event.target!==heroWorld||event.defaultPrevented||event.metaKey||event.ctrlKey||event.altKey||playing)return;
  if(event.key==='ArrowLeft')rotateHero(-.16);
  else if(event.key==='ArrowRight')rotateHero(.16);
  else if(event.key==='ArrowUp')rotateHero(0,-.1);
  else if(event.key==='ArrowDown')rotateHero(0,.1);
  else if(event.key==='+'||event.key==='=')zoomHero(-.2);
  else if(event.key==='-'||event.key==='_')zoomHero(.2);
  else if(event.key==='Home')resetHero();
  else return;
  event.preventDefault();
});
canvas.addEventListener('wheel',event=>{
  if(activePanel||!town)return;
  event.preventDefault();
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1);
  if(playing)zoom(delta*.025);
  else zoomHero(THREE.MathUtils.clamp(delta*(event.ctrlKey?.005:.001),-.5,.5));
},{passive:false});
canvas.addEventListener('pointerdown',event=>{
  if(!playing){
    if(!town||canvas.parentElement!==heroWorld||event.button!==0||heroPointers.size>=2)return;
    if(event.pointerType!=='touch')event.preventDefault();
    window.getSelection()?.removeAllRanges();
    document.body.classList.add('hero-world-interacting');
    heroPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    canvas.setPointerCapture(event.pointerId);
    if(heroPointers.size===2){
      const [a,b]=[...heroPointers.values()];heroPinchDistance=Math.hypot(a.x-b.x,a.y-b.y);
      heroOrbit.cancelMotion();return;
    }
    heroOrbit.beginDrag(event.timeStamp);
    heroPointer={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,dragging:false};
    return;
  }
  if(!playing||activePanel||!town)return;
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  pointerStart={x:event.clientX,y:event.clientY};
  lastPointer=pointerStart;
  dragged=pointers.size>1;
  if(pointers.size>1)pinchDistance=0;
});
canvas.addEventListener('pointermove',event=>{
  if(!playing){
    if(!town||!heroPointers.has(event.pointerId))return;
    heroPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(heroPointers.size===2){
      const [a,b]=[...heroPointers.values()],next=Math.hypot(a.x-b.x,a.y-b.y);
      if(heroPinchDistance>0&&next>0)zoomHero(Math.log(heroPinchDistance/next));
      heroPinchDistance=next;return;
    }
    if(!heroPointer||heroPointer.id!==event.pointerId)return;
    const totalX=event.clientX-heroPointer.startX,totalY=event.clientY-heroPointer.startY;
    // Touch drags turn horizontally; vertical gestures keep scrolling the page.
    if(!heroPointer.dragging){
      if(Math.hypot(totalX,totalY)<4||event.pointerType==='touch'&&Math.abs(totalX)<=Math.abs(totalY))return;
      heroPointer.dragging=true;heroWorld.dataset.dragging='true';
    }
    const sensitivity=2*town.camera.position.length()*Math.tan(THREE.MathUtils.degToRad(town.camera.fov/2))/(canvas.clientHeight*PLANET_RADIUS);
    if(!heroManual){heroOrbit.start(town.camera,heroLook.set(0,0,0));heroOrbit.beginDrag(event.timeStamp);heroManual=true;}
    heroOrbit.drag((event.clientX-heroPointer.x)*sensitivity,(event.clientY-heroPointer.y)*sensitivity,event.timeStamp);
    heroRendered=false;
    heroPointer.x=event.clientX;heroPointer.y=event.clientY;
    return;
  }
  if(!pointers.has(event.pointerId)||activePanel)return;
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size===2){
    const [a,b]=[...pointers.values()];
    const nextDistance=Math.hypot(a.x-b.x,a.y-b.y);
    if(pinchDistance)zoom((pinchDistance-nextDistance)*.18);
    pinchDistance=nextDistance;dragged=true;return;
  }
  if(!lastPointer)return;
  const dx=event.clientX-lastPointer.x,dy=event.clientY-lastPointer.y;
  if(pointerStart&&Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>4)dragged=true;
  // Match the apparent globe size, so zooming in also makes dragging gentler.
  const sensitivity=2*town!.camera.position.length()*Math.tan(THREE.MathUtils.degToRad(town!.camera.fov/2))/(innerHeight*PLANET_RADIUS);
  if(dragged)orbit(dx*sensitivity,dy*sensitivity);
  lastPointer={x:event.clientX,y:event.clientY};
});
function endPointer(event:PointerEvent){
  if(heroPointers.delete(event.pointerId)){
    const pinching=heroPinchDistance>0;
    heroOrbit.endDrag(event.timeStamp,pinching||event.type!=='pointerup');
    heroPinchDistance=0;heroPointer=null;delete heroWorld.dataset.dragging;
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    const remaining=heroPointers.entries().next().value;
    if(remaining){
      const [id,p]=remaining;heroPointer={id,...p,startX:p.x,startY:p.y,dragging:false};
      heroOrbit.beginDrag(event.timeStamp);
    }else document.body.classList.remove('hero-world-interacting');
    return;
  }
  const wasTracking=pointers.delete(event.pointerId);
  if(!wasTracking)return;
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  if(pointers.size===0){
    if(event.type==='pointerup'&&!dragged&&town&&!activePanel){
      const ndc=new THREE.Vector2(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2);
      const ray=new THREE.Raycaster();ray.setFromCamera(ndc,town.camera);
      let picked:ProjectKey|null=null;
      // March through the curved surface in world space, then test the original
      // project bounds in their unchanged town coordinates. Rear landmarks are
      // rejected by the globe's surface before they can be selected.
      const point=new THREE.Vector3();
      for(let distance=town.camera.near;distance<town.camera.far;distance+=.6){
        ray.ray.at(distance,point);
        const flat=planetToTown(point);
        if(flat.y<terrainHeight(flat.x,flat.z)-.2)break;
        for(const [key,box] of town.pickBoxes)if(box.containsPoint(flat)){picked=key;break;}
        if(picked)break;
      }
      if(picked)openPanel(`project-${picked}`);
    }
    pointerStart=lastPointer=null;pinchDistance=0;dragged=false;
  }else{
    lastPointer=[...pointers.values()][0];pointerStart=null;pinchDistance=0;dragged=true;
  }
}
canvas.addEventListener('pointerup',endPointer);
canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('lostpointercapture',event=>{if(heroPointers.has(event.pointerId))endPointer(event);});
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||!playing||activePanel||event.metaKey||event.ctrlKey||event.altKey||event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable]'))return;
  if(event.key==='ArrowLeft'){event.preventDefault();orbit(-.16);}
  else if(event.key==='ArrowRight'){event.preventDefault();orbit(.16);}
  else if(event.key==='ArrowUp'){event.preventDefault();orbit(0,-.1);}
  else if(event.key==='ArrowDown'){event.preventDefault();orbit(0,.1);}
  else if(event.key==='+'||event.key==='='){event.preventDefault();zoom(-12);}
  else if(event.key==='-'){event.preventDefault();zoom(12);}
  else if(event.key==='Home'){event.preventDefault();recenter();}
});
const shakeOffset=new THREE.Vector3(),shakeLook=new THREE.Vector3();
const projectLabels=new Map<ProjectKey,ProjectLabelMotion>();
for(const project of PROJECTS){
  const button=document.createElement('button');
  button.className='world-label';button.type='button';button.hidden=true;
  button.dataset.project=project.key;
  button.innerHTML=`<span class="label-spark" aria-hidden="true">✦</span><span>${project.title}</span>`;
  button.setAttribute('aria-label',`Explore ${project.title}`);
  button.addEventListener('click',()=>openPanel(`project-${project.key}`));
  $('#world-labels').appendChild(button);projectLabels.set(project.key,new ProjectLabelMotion(button));
}
const labelProjection=new THREE.Vector3(),labelView=new THREE.Vector3();
const labelOffsets=Array.from({length:121},(_,i)=>({x:(i%11-5)*20,y:(Math.floor(i/11)-5)*16}))
  .sort((a,b)=>(a.x*a.x+a.y*a.y)-(b.x*b.x+b.y*b.y));
function positionProjectLabels(dt:number){
  if(!town)return;
  const introRect=intro.classList.contains('dismissed')?null:intro.getBoundingClientRect();
  const placed:{left:number;right:number;top:number;bottom:number}[]=[];
  let reveals=0;
  for(const plot of snapshot.plots){
    if(!plot.project)continue;
    const motion=projectLabels.get(plot.project)!,button=motion.button;
    const ground=planetPoint(plot.x,terrainHeight(plot.x,plot.z),plot.z);
    // Use the building's ground normal so rear-side banners disappear with
    // their buildings, even when their raised anchors clear the horizon.
    const facing=labelView.copy(town.camera.position).sub(ground).dot(planetNormal(plot.x,plot.z))>(motion.visible?-2:2);
    labelProjection.copy(planetPoint(plot.x,terrainHeight(plot.x,plot.z)+planetLandmarkHeight(plot.project,plot.stage)+2,plot.z)).project(town.camera);
    const x=(labelProjection.x*.5+.5)*innerWidth,y=(.5-labelProjection.y*.5)*innerHeight;
    const behindIntro=introRect&&x>introRect.left-80&&x<introRect.right+80&&y>introRect.top-32&&y<introRect.bottom+32;
    // A small margin keeps labels from flickering at the viewport / horizon.
    const margin=motion.visible?8:0;
    const visible=plot.stage>0&&!activePanel&&facing&&!behindIntro&&labelProjection.z>=-1&&labelProjection.z<=1&&x>=40-margin&&x<=innerWidth-40+margin&&y>=65-margin&&y<=innerHeight-70+margin;
    const fresh=button.hidden;
    if(motion.setVisible(visible,reveals*65))reveals++;
    if(!button.hidden){
      const width=button.offsetWidth,height=button.offsetHeight;
      const offset=labelOffsets.find(offset=>{
        const left=x+offset.x-width/2,top=y+offset.y-height*1.2;
        return left>8&&left+width<innerWidth-8&&top>(innerWidth<=700?116:82)&&
          placed.every(rect=>left>rect.right+4||left+width<rect.left-4||top>rect.bottom+4||top+height<rect.top-4);
      })??{x:0,y:0};
      const left=x+offset.x-width/2,top=y+offset.y-height*1.2;
      if(visible)placed.push({left,right:left+width,top,bottom:top+height});
      motion.position(x,y,offset,dt,fresh);
    }
  }
}
function stepCamera(dt:number){
  if(!town)return;
  const k=reduced.matches?1:1-Math.exp(-dt*8);
  uiOffset+=(desiredUiOffset-uiOffset)*k;
  const view=town.camera.view;
  if(!view||Math.abs(view.offsetY-uiOffset)>.2||view.fullWidth!==innerWidth||view.fullHeight!==innerHeight)
    town.camera.setViewOffset(innerWidth,innerHeight,0,uiOffset,innerWidth,innerHeight);
  if(cameraFlight){
    const flight=cameraFlight;
    if(!activePanel)flight.elapsed+=Math.min(dt,.1);
    const done=flight.move.sample(reduced.matches?flight.move.duration:flight.elapsed,town.camera.position,cameraLook,town.camera.up);
    town.camera.lookAt(cameraLook);
    if(profile)document.body.dataset.cameraFlight=done?'arrived':'moving';
    if(done){cameraFlight=null;flight.finish(true);}
    return;
  }
  azimuth+=(desiredAzimuth-azimuth)*k;elevation+=(desiredElevation-elevation)*k;
  target.lerp(desiredTarget,k);distance+=(desiredDistance-distance)*k;
  lookScale+=(desiredLookScale-lookScale)*k;
  const cameraDistance=PLANET_RADIUS+distance*2;
  if(manualOrbit){
    manualCamera.sample(reduced.matches?1:1-Math.exp(-dt*18),cameraDistance,town.camera.position,cameraLook,town.camera.up);
    town.camera.lookAt(cameraLook);return;
  }
  town.camera.up.set(0,1,0);
  const horizontal=Math.sin(elevation);
  const orientation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),planetNormal(target.x,target.z));
  town.camera.position.set(Math.cos(azimuth)*horizontal,Math.cos(elevation),Math.sin(azimuth)*horizontal).applyQuaternion(orientation).multiplyScalar(cameraDistance);
  const look=cameraLook.copy(planetPoint(target.x,target.y,target.z)).multiplyScalar(lookScale);
  if(profile){document.body.dataset.cameraAzimuth=azimuth.toFixed(3);document.body.dataset.cameraDistance=distance.toFixed(1);document.body.dataset.cameraTarget=`${target.x.toFixed(1)},${target.z.toFixed(1)}`;}
  if(juice&&juice.shake>0&&!reduced.matches){
    juice.shakeOffset(performance.now()/1000,shakeOffset);
    town.camera.position.add(shakeOffset);
    town.camera.lookAt(shakeLook.copy(look).addScaledVector(shakeOffset,.4));
  }else town.camera.lookAt(look);
}
function frame(now:number){requestAnimationFrame(frame);
  // Keep controls in sync even if a browser delays the media-query change event.
  if(heroMotion.hidden!==reduced.matches){heroRendered=false;syncHeroMotion();}
  if(document.hidden||!town||(!playing&&(canvas.parentElement!==heroWorld||!heroVisible||(reduced.matches||heroPaused)&&heroRendered)))return;const cap=playing?(town.mobile?30:60):24;if(now-lastFrame<1000/cap-1)return;const elapsed=lastFrame?now-lastFrame:1000/cap;lastFrame=now;
  if(!playing){
    const heroDt=reduced.matches||heroPaused?0:Math.min(elapsed/1000,.1);
    heroElapsed+=heroDt;
    if(!heroManual&&!heroPointer)heroTime+=heroDt;
    const dt=Math.min(elapsed/1000,.1);
    heroRadius+=(heroDesiredRadius-heroRadius)*(reduced.matches||heroPaused?1:1-Math.exp(-dt*10));
    const angle=.72+heroTime*.035,elevation=.9,radius=heroRadius*Math.max(1,heroHeight/Math.max(heroWidth,1)*.98);
    town.camera.clearViewOffset();
    if(heroManual){
      if(!reduced.matches&&!heroPaused&&!heroPointers.size)heroOrbit.advance(dt,.035);
      heroOrbit.sample(1,radius,town.camera.position,heroLook,town.camera.up);
      town.camera.lookAt(heroLook);
    }else{
      town.camera.up.set(0,1,0);
      town.camera.position.set(Math.cos(angle)*Math.sin(elevation),Math.cos(elevation),Math.sin(angle)*Math.sin(elevation)).multiplyScalar(radius);
      town.camera.lookAt(0,0,0);
    }
    showcaseSnapshot.elapsed=heroElapsed*1000;
    worldVisuals?.update(heroDt,reduced.matches||heroPaused);
    scenery?.update(heroElapsed,heroDt);
    town.render(showcaseSnapshot,false);
    if(heroWorld.dataset.live!=='true'){
      heroWorld.dataset.live='true';heroWorld.tabIndex=0;
      heroWorld.setAttribute('aria-describedby','hero-world-hint hero-world-keyboard-help');
      heroWorld.querySelector<HTMLElement>('.hero-world-controls')!.hidden=false;
    }
    heroRendered=true;
    return;
  }
  snapshot.elapsed=now-sessionStart;
  if(cinematic&&!activePanel){
    const active=cinematic;active.elapsed+=Math.min(elapsed,100);
    const progress=reduced.matches?1:Math.min(1,active.elapsed/active.duration),focus=worldVisuals?.sample(progress);
    if(progress>=.38&&!active.sounded){active.sounded=true;sfx.worldEvent(active.event.kind);}
    if(focus){
      desiredTarget.set(focus.x,terrainHeight(focus.x,focus.z)+focus.height,focus.z);desiredLookScale=1;
      const next=Math.atan2(-focus.z,-focus.x)+.4;
      desiredAzimuth=azimuth+Math.atan2(Math.sin(next-azimuth),Math.cos(next-azimuth));
      desiredElevation=.28;
    }
    if(progress>=1){cinematic=null;active.resolve();}
  }
  worldVisuals?.update(activePanel?0:Math.min(elapsed/1000,.1),reduced.matches);
  stepCamera(elapsed/1000);reactions?.update(elapsed/1000);juice?.update(elapsed/1000);updateFloats(now);worker?.update();scenery?.update(now/1000,elapsed/1000);town.render(snapshot,false);
  positionProjectLabels(elapsed/1000);
  if(profile&&Math.floor(now/2000)!==Math.floor((now-elapsed)/2000)){document.body.dataset.drawCalls=String(town.renderer.info.render.calls);document.body.dataset.triangles=String(town.renderer.info.render.triangles);document.body.dataset.geometries=String(town.renderer.info.memory.geometries);document.body.dataset.textures=String(town.renderer.info.memory.textures);}
  if(profile){frameSamples.push(elapsed);if(frameSamples.length>=90){const sorted=[...frameSamples].sort((a,b)=>a-b);frameSamples=[];document.body.dataset.frameP50=sorted[Math.floor(sorted.length*.5)].toFixed(1);document.body.dataset.frameP90=sorted[Math.floor(sorted.length*.9)].toFixed(1);document.body.dataset.frameP99=sorted[Math.floor(sorted.length*.99)].toFixed(1);document.body.dataset.pixelRatio=pixelRatio.toFixed(2);}}
}
try{
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('fallback'))throw new Error('Development WebGL fallback preview');
  town=new TownScene(canvas,true,true);pixelRatio=Math.min(devicePixelRatio,town.mobile?1.5:2);town.setPixelRatio(pixelRatio);worker=new ChoiceWorker(town.scene);scenery=new GameScenery(town.scene,town.mobile,town.environment,true);juice=new Juice(town.scene,town.mobile);reactions=new ReactionEffects(town.scene,juice);
  worldVisuals=new PlanetWorldEvents(town.scene,town.mobile);
  town.onBuildImpact=onBuildImpact;town.onBuildPuff=(x,y,z,size)=>juice?.puff(x,y,z,size,10);
  worker.hooks={strike:(x,y,z)=>{juice?.strike(x,y,z);sfx.tok();},pop:(x,y,z,appearing)=>{juice?.puff(x,y-.8,z,.9,7);sfx.pop(appearing?1.15:.8);},cheer:()=>sfx.cheer()};
  reactions.onArrive=()=>sfx.pop(1.6);refreshGameWorld(true);document.body.classList.add('town-ready');requestAnimationFrame(frame);
  if(import.meta.env.DEV)Object.assign(window,{__townDebug:{town,scenery,worldVisuals,gameSave,gameState:()=>gameState,snapshot:()=>snapshot,choose:playChoice,skip:skipAnimation,restart,cinematic:()=>cinematic,shownWorld:()=>shownWorld}});
  window.addEventListener('resize',()=>{town?.resize();if(!manualZoom)desiredDistance=townOverviewDistance(shownLevels);});
}catch(error){console.error('Town renderer unavailable',error);canvas.hidden=true;fallback.hidden=false;document.body.classList.add('no-webgl');}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback.hidden=false;document.body.classList.add('no-webgl');});
canvas.addEventListener('webglcontextrestored',()=>location.reload());
setIntroHidden(gameSave.started);
renderGameHud();
persist();
