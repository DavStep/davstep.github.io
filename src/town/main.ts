import * as THREE from 'three';
import { TownScene } from './scene';
import { Residents } from './residents';
import { terrainHeight } from './environment';
import type { TownSnapshot } from './model';
import { PROJECTS, PROJECT_BY_KEY, type ProjectKey } from './projects';
import { GAME_SAVE_KEY, IDEAS, IDEA_INFO, chooseIdea, evaluate, newGameSave, parseGameSave, restartGame, upgradeBlocker, type Idea, type Levels } from './game';
import { snapshotForGame } from './game-snapshot';
import { MILESTONES, MAX_LEVEL } from './milestones';
import { ACTIONS, eventTitle, eventWaves, explainEvent, levelLabel, nextSuggestion, turnSummary } from './action-story';
import { chapterMarkup, decisionMarkup, journalMarkup } from './decision-panel';
import { ReactionEffects, eventFocus } from './reaction-effects';
import { moatColliders } from './moat-layout';
import { SANDSHIP_ARRIVAL_MS } from './parachute-arrival';
import { GameScenery } from './game-scenery';
import { buildColliders, isBlocked } from './collision';
import { outskirtsOverviewDistance } from './outskirts-state';
import { landscapeColliders } from './landscape-state';
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
const labels=$<HTMLDivElement>('#world-labels');
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
const sessionStart=performance.now();
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(gameSave));}catch{}}
let snapshot:TownSnapshot=snapshotForGame(shownLevels,0,gameState.gateMask);
let rainPreview=false;
const weatherSnapshot=():TownSnapshot=>rainPreview?{...snapshot,weather:'rain'}:snapshot;
let town:TownScene|null=null,residents:Residents|null=null,scenery:GameScenery|null=null,reactions:ReactionEffects|null=null;
let target=new THREE.Vector3(0,terrainHeight(0,0)*.55,0),desiredTarget=target.clone();
let azimuth=.72,elevation=Math.max(...Object.values(shownLevels))>3?.38:1.05,distance=outskirtsOverviewDistance(shownLevels),desiredAzimuth=azimuth,desiredElevation=elevation,desiredDistance=distance;
let pointerStart:{x:number;y:number;time:number}|null=null;
let lastPointer:{x:number;y:number}|null=null;
const pointers=new Map<number,{x:number;y:number}>();
let pinchDistance=0,dragged=false,lastFrame=0,lastModel=0,frameSamples:number[]=[],pixelRatio=1;
let activePanel:string|null=null,lastFocus:HTMLElement|null=null,toastTimer=0;
const labelButtons=new Map<ProjectKey,HTMLButtonElement>();

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
  if(!activePanel&&e.key==='+'||!activePanel&&e.key==='=')zoom(-12);
  if(!activePanel&&e.key==='-')zoom(12);
});
window.addEventListener('popstate',()=>{const id=validPanel(location.hash.slice(1));if(id)openPanel(id,false);else closePanel(false);});

function recenter(){desiredTarget.set(0,terrainHeight(0,0)*.55,0);desiredDistance=outskirtsOverviewDistance(shownLevels);desiredAzimuth=.72;desiredElevation=Math.max(...Object.values(shownLevels))>3?.38:1.05;}
function zoom(delta:number){
  desiredDistance=THREE.MathUtils.clamp(desiredDistance+delta,52,520);
}
$('#control-recenter').addEventListener('click',recenter);
$('#control-zoom-in').addEventListener('click',()=>zoom(-14));
$('#control-zoom-out').addEventListener('click',()=>zoom(14));
const settings=$<HTMLDivElement>('#settings-panel'),settingsButton=$<HTMLButtonElement>('#control-settings');
settingsButton.addEventListener('click',()=>{settings.hidden=!settings.hidden;settingsButton.setAttribute('aria-expanded',String(!settings.hidden));});
const gameHud=$<HTMLElement>('#game-hud');
const gameCards=$<HTMLDivElement>('#game-cards');
const gameProgress=$<HTMLDivElement>('#game-progress');
const gameEvent=$<HTMLParagraphElement>('#game-event');
const gameResult=$<HTMLDivElement>('#game-result');
const gameSkip=$<HTMLButtonElement>('#game-skip');
const CARD_ORDER:readonly Idea[]=['settlers','grove','workshop','roads','market','river','windmill','walls','archive','observatory'];
const decision=$<HTMLDivElement>('#game-decision');
const sceneCard=$<HTMLElement>('#game-scene');
const journal=$<HTMLDetailsElement>('#game-journal');
let animating=false,animationToken=0;
let selectedIdea:Idea=nextSuggestion(gameState)??'observatory';
let eventMessage=gameState.order.length?'Select a district to inspect it, or plan your next decision.':'Start with a need. Choose an idea to see what it makes possible.';
let journalOrder='';
let decisionKey='';
let needsContinue=false;
let showEnding=gameState.finished;
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
  document.body.classList.toggle('town-reacting',animating);
  $('#game-turn').textContent=`DECISION ${gameSave.order.length} / ${IDEAS.length}`;
  if(!gameProgress.children.length)gameProgress.innerHTML=IDEAS.map(()=>'<span></span>').join('');
  for(const [index,mark] of [...gameProgress.children].entries())mark.classList.toggle('filled',index<gameSave.order.length);
  $('#game-summary').textContent=animating?'Watch the connection.':needsContinue?'See what your decision changed.':gameState.finished?'Your valley, connected.':'What does the town need?';
  $('#game-chapter').innerHTML=chapterMarkup(gameState);
  gameSkip.hidden=!animating;
  gameEvent.textContent=eventMessage;
  if(!gameCards.children.length)gameCards.innerHTML=CARD_ORDER.map(idea=>{
    const info=IDEA_INFO[idea];
    return `<button type="button" class="game-card" data-idea="${idea}" aria-controls="game-decision"><span class="game-card-icon" aria-hidden="true"><img src="${info.icon}" alt="" draggable="false" /></span><span class="game-card-label">${info.name}</span><span class="game-card-level"></span></button>`;
  }).join('');
  const suggested=nextSuggestion(gameState);
  for(const idea of CARD_ORDER){
    const info=IDEA_INFO[idea],chosen=gameSave.order.includes(idea);
    const button=gameCards.querySelector<HTMLButtonElement>(`[data-idea="${idea}"]`)!;
    button.classList.toggle('chosen',chosen);
    button.classList.toggle('selected',selectedIdea===idea);
    button.classList.toggle('suggested',suggested===idea);
    const level=shownLevels[idea];
    button.querySelector('.game-card-level')!.textContent=level?levelLabel(level):suggested===idea?'Next step':'Plan';
    button.title=level?`${MILESTONES[idea][level-1].name}. ${upgradeBlocker(idea,shownLevels)??'Fully developed.'}`:ACTIONS[idea].need;
    button.disabled=animating;
    button.setAttribute('aria-pressed',String(selectedIdea===idea));
    button.setAttribute('aria-label',`${info.name}, ${levelLabel(level)}${suggested===idea?', suggested next':''}. Inspect plan`);
  }
  sceneCard.hidden=!animating;
  decision.hidden=animating||needsContinue||showEnding;
  const nextKey=gameSave.order.join(',')+':'+selectedIdea;
  if(decisionKey!==nextKey){decision.innerHTML=decisionMarkup(gameState,selectedIdea);decisionKey=nextKey;}
  journal.hidden=animating;
  if(journalOrder!==gameSave.order.join(',')||!$('#journal-entries').children.length){
    $('#journal-entries').innerHTML=journalMarkup(gameState);journalOrder=gameSave.order.join(',');
  }
  gameResult.hidden=animating||(!needsContinue&&!showEnding);
  if(!gameResult.hidden){
    const previous=evaluate(gameSave.order.slice(0,-1));
    const title=gameState.secret?'Storybook Night discovered':gameState.finished?'A valley built on connections':`Decision ${gameState.order.length} · The town answers`;
    gameResult.innerHTML=`<strong>${title}</strong><p>${turnSummary(previous,gameState)}</p>${gameState.finished?'<p>Every district is complete. Try a different route through the needs and watch how the story changes.</p><button type="button" data-replay>Build another town</button>':'<button type="button" data-continue>Plan the next decision →</button>'}`;
  }
}
function refreshGameWorld(instant=false){
  snapshot=snapshotForGame(shownLevels,performance.now()-sessionStart,shownLevels.roads>=2?gameState.gateMask:0);
  town?.update(weatherSnapshot(),!instant&&animating&&!reduced.matches);
  scenery?.setLevels(shownLevels,gameState.secret&&gameState.finished&&!animating,instant);
  residents?.update(snapshot);
  updateReadouts();
  positionLabels();
}
function startGame(){
  gameSave.started=true;persist();setIntroHidden(true);renderGameHud();refreshGameWorld(true);recenter();
  gameCards.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
}
function restart(){
  animationToken++;animating=false;needsContinue=false;showEnding=false;restartGame(gameSave);gameState=evaluate([]);shownLevels={...gameState.levels};
  residents?.finishCue();scenery?.endBeat();reactions?.clear();
  selectedIdea='settlers';journal.open=false;
  eventMessage='An empty valley. Welcome the people who will bring it to life.';persist();renderGameHud();refreshGameWorld(true);recenter();
}
function finishDecision(instant=false){
  animating=false;needsContinue=true;showEnding=gameState.finished;shownLevels={...gameState.levels};
  residents?.finishCue();scenery?.endBeat();reactions?.clear();
  eventMessage=turnSummary(evaluate(gameSave.order.slice(0,-1)),gameState);
  refreshGameWorld(instant);renderGameHud();recenter();
  gameResult.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
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
  gameState=chooseIdea(gameSave,idea);persist();
  animating=true;needsContinue=false;journal.open=false;const token=++animationToken;
  const waves=eventWaves(gameState);
  renderGameHud();gameSkip.focus({preventScroll:true});
  try{
    for(const [index,wave] of waves.entries()){
      if(token!==animationToken)return;
      // Water release and the first harvest get the hero shot; other changes
      // in this causal wave happen together and remain readable in the journal.
      const hero=wave.find(e=>e.idea==='river'&&e.level<=3)??wave.find(e=>e.idea==='windmill'&&e.level<=3)??wave[0];
      const focus=eventFocus(hero),arrival=hero.level===1;
      const sandship=hero.idea==='workshop'&&arrival;
      const gateMask=shownLevels.roads>=2?gameState.gateMask:0;
      if(town){
        desiredTarget.set(focus.x,town.environment.landscapeHeight(focus.x,focus.z)+(sandship?8:2),focus.z);
        desiredDistance=hero.level>=4?145:hero.idea==='river'?130:105;
        desiredElevation=.95;
        desiredAzimuth=Math.atan2(-focus.z,-focus.x)+.4;
      }
      sceneCard.dataset.style=ACTIONS[hero.idea].style;
      $('#scene-phase').textContent=`${arrival?'THE DECISION':'THE CONNECTION'} · ${index+1} / ${waves.length}`;
      $('#scene-title').textContent=eventTitle(hero);
      $('#scene-cause').textContent=explainEvent(hero);
      $('#scene-chain').textContent=hero.sources.length?`${hero.sources.map(source=>IDEA_INFO[source.idea].name).filter((name,i,list)=>list.indexOf(name)===i).join(' + ')} → ${IDEA_INFO[hero.idea].name}`:ACTIONS[hero.idea].promise;
      eventMessage=arrival?ACTIONS[hero.idea].need:`Because the supplies are ready, ${IDEA_INFO[hero.idea].name} can develop.`;
      if(!reduced.matches&&town)reactions?.begin(hero);
      if(hero.level<4&&hero.idea!=='river'){
        const future={...shownLevels};for(const event of wave)future[event.idea]=event.level;
        const crewSnapshot=snapshotForGame(future,performance.now()-sessionStart,gateMask);
        const obstacles=town?[...town.environment.trees,...town.treeObstacles]:[];
        const colliders=[...buildColliders(crewSnapshot,obstacles),...landscapeColliders(shownLevels),...moatColliders(shownLevels)];
        residents?.startCue(hero.idea,focus,false,reduced.matches?.1:6,(x,z)=>!isBlocked(x,z,colliders,1.15));
      }
      renderGameHud();
      await waitForScene(reduced.matches||!town?300:arrival?650:1100,token);
      if(token!==animationToken)return;
      for(const event of wave)shownLevels[event.idea]=event.level;
      refreshGameWorld(reduced.matches||!town);
      if(!reduced.matches&&town)reactions?.reveal();
      $('#scene-phase').textContent=`${arrival?'ESTABLISHED':'PAYOFF'} · ${index+1} / ${waves.length}`;
      $('#scene-chain').textContent=MILESTONES[hero.idea][hero.level-1].description;
      eventMessage=wave.map(event=>`${IDEA_INFO[event.idea].name}: ${eventTitle(event)}`).join(' · ');
      renderGameHud();
      const duration=sandship?SANDSHIP_ARRIVAL_MS+150:hero.idea==='river'&&hero.level===2?7500:hero.idea==='river'&&hero.level===3?7500:hero.idea==='windmill'&&hero.level===3?2900:2200;
      await waitForScene(reduced.matches||!town?600:duration,token);
      if(token!==animationToken)return;
      residents?.finishCue();reactions?.clear();
    }
    if(token!==animationToken)return;
    finishDecision();
  }catch(error){
    console.error('Reaction playback interrupted',error);
    if(token===animationToken){finishDecision(true);announce('Your decision is saved. The town journal records every change.');}
  }
}
gameCards.addEventListener('click',event=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-idea]');
  if(!button||animating)return;
  selectedIdea=button.dataset.idea as Idea;needsContinue=false;showEnding=false;renderGameHud();
  const level=shownLevels[selectedIdea];
  if(level&&town){const focus=eventFocus({idea:selectedIdea,level:Math.min(level,3)});desiredTarget.set(focus.x,town.environment.landscapeHeight(focus.x,focus.z),focus.z);desiredDistance=110;desiredElevation=.95;}
});
decision.addEventListener('click',event=>{if((event.target as HTMLElement).closest('#game-commit'))void playChoice(selectedIdea);});
gameResult.addEventListener('click',event=>{
  if((event.target as HTMLElement).closest('[data-replay]'))restart();
  if((event.target as HTMLElement).closest('[data-continue]')){needsContinue=false;selectedIdea=nextSuggestion(gameState)??selectedIdea;renderGameHud();gameCards.querySelector<HTMLButtonElement>(`[data-idea="${selectedIdea}"]`)?.focus({preventScroll:true});}
});
$('#game-restart').addEventListener('click',restart);
gameSkip.addEventListener('click',skipAnimation);
const weatherPreviewButton=$<HTMLButtonElement>('#weather-preview');
weatherPreviewButton.addEventListener('click',()=>{
  rainPreview=!rainPreview;
  weatherPreviewButton.setAttribute('aria-pressed',String(rainPreview));
  weatherPreviewButton.innerHTML=rainPreview?'Return to live weather <span aria-hidden="true">↗</span>':'Make it rain <span aria-hidden="true">↗</span>';
  town?.update(weatherSnapshot());updateReadouts();
});
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
    desiredAzimuth-=dx*.006;
    desiredElevation=THREE.MathUtils.clamp(desiredElevation+dy*.005,.38,1.42);
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
    projected.set(p.x,terrainHeight(p.x,p.z)+Math.max(3.5,2.6+p.stage*.62),p.z).project(town.camera);
    const x=(projected.x*.5+.5)*innerWidth,y=(-projected.y*.5+.5)*innerHeight;
    const behindIntro=introRect&&x>introRect.left-80&&x<introRect.right+80&&y>introRect.top-32&&y<introRect.bottom+32;
    const visible=p.stage>0&&!behindIntro&&projected.z<1&&projected.z>-1&&projected.x>-(town.mobile?.86:1.02)&&projected.x<(town.mobile?.86:1.02)&&projected.y>-1.08&&projected.y<1.08;
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
  stepCamera(elapsed/1000);reactions?.update(elapsed/1000);residents?.update(snapshot);positionLabels();scenery?.update(now/1000,elapsed/1000);town.render(weatherSnapshot(),false);
  if(profile&&Math.floor(now/2000)!==Math.floor((now-elapsed)/2000)){document.body.dataset.drawCalls=String(town.renderer.info.render.calls);document.body.dataset.triangles=String(town.renderer.info.render.triangles);document.body.dataset.geometries=String(town.renderer.info.memory.geometries);document.body.dataset.textures=String(town.renderer.info.memory.textures);}
  if(profile){frameSamples.push(elapsed);if(frameSamples.length>=90){const sorted=[...frameSamples].sort((a,b)=>a-b);frameSamples=[];document.body.dataset.frameP50=sorted[Math.floor(sorted.length*.5)].toFixed(1);document.body.dataset.frameP90=sorted[Math.floor(sorted.length*.9)].toFixed(1);document.body.dataset.frameP99=sorted[Math.floor(sorted.length*.99)].toFixed(1);document.body.dataset.pixelRatio=pixelRatio.toFixed(2);}}
}
try{
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('fallback'))throw new Error('Development WebGL fallback preview');
  town=new TownScene(canvas,true);pixelRatio=Math.min(devicePixelRatio,town.mobile?1:1.5);town.setPixelRatio(pixelRatio);residents=new Residents(town.scene);scenery=new GameScenery(town.scene,town.mobile,town.environment);reactions=new ReactionEffects(town.scene);refreshGameWorld(true);document.body.classList.add('town-ready');requestAnimationFrame(frame);
  if(import.meta.env.DEV)Object.assign(window,{__townDebug:{town,gameSave,gameState:()=>gameState,snapshot:()=>snapshot}});
  window.addEventListener('resize',()=>{town?.resize();positionLabels();});
}catch(error){console.error('Town renderer unavailable',error);canvas.hidden=true;labels.hidden=true;fallback.hidden=false;document.body.classList.add('no-webgl');}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback.hidden=false;document.body.classList.add('no-webgl');});
canvas.addEventListener('webglcontextrestored',()=>location.reload());
const initialPanel=validPanel(location.hash.slice(1));if(initialPanel)openPanel(initialPanel,false);
setIntroHidden(gameSave.started);
renderGameHud();
persist();
