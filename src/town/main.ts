import * as THREE from 'three';
import { TownScene } from './scene';
import { ChoiceWorker } from './choice-worker';
import { terrainHeight } from './environment';
import type { TownSnapshot } from './model';
import { PROJECTS, PROJECT_BY_KEY, type ProjectKey } from './projects';
import { GAME_SAVE_KEY, IDEAS, IDEA_INFO, ideaIcon, chooseIdea, evaluate, newGameSave, parseGameSave, restartGame, type Idea, type Levels } from './game';
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
import './panel-rail.css';
import './story-flow.css';
import './motion.css';
import { EASE, burst, confetti, installMotionTokens, magnetic, play, pointerLight, reducedMotion, retrigger, rise, stagger, tweenText } from './ui-motion';

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
installMotionTokens();
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
let town:TownScene|null=null,worker:ChoiceWorker|null=null,scenery:GameScenery|null=null,reactions:ReactionEffects|null=null,juice:Juice|null=null;
const sfx=new Sfx();
let target=new THREE.Vector3(0,terrainHeight(0,0)*.55,0),desiredTarget=target.clone();
// Start close so the first buildings read; pull back as the valley fills.
const townOverviewDistance=(levels:Levels)=>112+Math.min(48,Object.values(levels).filter(level=>level>0).length*4.8);
let azimuth=.72,elevation=Math.max(...Object.values(shownLevels))>3?.38:1.05,distance=townOverviewDistance(shownLevels),desiredAzimuth=azimuth,desiredElevation=elevation,desiredDistance=distance;
let manualOrbit=false,manualZoom=false;
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
  const switching=Boolean(activePanel),previousPanel=activePanel;
  if(!activePanel)lastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  activePanel=valid;
  panel.dataset.view=valid.startsWith('project-')?'project':valid;
  panel.querySelectorAll<HTMLButtonElement>('.panel-tab').forEach(button=>button.setAttribute('aria-current',String(button.dataset.panel===valid||(valid.startsWith('project-')&&button.dataset.panel==='work'))));
  panelBody.innerHTML=valid.startsWith('project-')?projectMarkup(valid.slice(8) as ProjectKey):valid==='work'?workMarkup():valid==='about'?aboutMarkup():contactMarkup();
  panelBody.scrollTop=0;
  choreographPanel(switching,previousPanel,valid);
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
const PANEL_ORDER=['work','project','about','contact'];
function choreographPanel(switching:boolean,previous:string|null,next:string){
  if(reducedMotion())return;
  const rank=(id:string|null)=>PANEL_ORDER.indexOf(id?.startsWith('project-')?'project':id??'');
  if(switching){
    const dir=Math.sign(rank(next)-rank(previous))||1;
    play(panelBody,[{opacity:0,translate:`${dir*28}px 0`},{opacity:1,translate:'0 0'}],{duration:520,easing:EASE.outExpo});
  }else{
    play(panel,[{opacity:0,scale:.94,translate:'0 22px'},{opacity:1,scale:1,translate:'0 0'}],{duration:760,easing:EASE.outExpo,delay:16});
  }
  const base=switching?60:180;
  play(panelBody.querySelector('.project-visual img, .about-mosaic, .postcard'),[{scale:1.12,opacity:.2},{scale:1,opacity:1}],{duration:1300,easing:EASE.outExpo,delay:base-60,fill:'backwards'});
  stagger(panelBody.querySelectorAll('.panel-copy > *, .work-intro > div > *, .work-count, .project-visual-index, .project-visual-footer, .editorial-cover-caption'),rise(16,5),{duration:720,easing:EASE.outExpo,delay:base,gap:45});
  stagger(panelBody.querySelectorAll('.work-card'),[{opacity:0,translate:'0 40px',scale:.94},{opacity:1,translate:'0 0',scale:1}],{duration:900,easing:EASE.outExpo,delay:base+100,gap:70});
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
    projected.copy(f.pos).project(town.camera);
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
  desiredTarget.set(0,terrainHeight(0,0)*.55,0);
  if(resetControls){manualOrbit=false;manualZoom=false;}
  if(!manualZoom)desiredDistance=townOverviewDistance(shownLevels);
  if(!manualOrbit){desiredAzimuth=.72;desiredElevation=Math.max(...Object.values(shownLevels))>3?.38:1.05;}
}
function zoom(delta:number){manualZoom=true;desiredDistance=THREE.MathUtils.clamp(desiredDistance+delta,38,220);}
const gameHud=$<HTMLElement>('#game-hud');
const gameCards=$<HTMLDivElement>('#game-cards');
const gameProgress=$<HTMLDivElement>('#game-progress');
const gameEvent=$<HTMLParagraphElement>('#game-event');
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
  gameHud.hidden=!gameSave.started;
  gameHud.classList.toggle('is-busy',animating);
  const showResults=gameState.finished&&!animating;
  gameHud.classList.toggle('is-finished',showResults);
  $('#fallback-start').hidden=gameSave.started;
  document.body.classList.toggle('game-running',gameSave.started);
  tweenText($('#game-turn'),`${gameSave.order.length} / ${IDEAS.length}`,420);
  // Choices stay neutral during play: the town reacts, but levels and
  // verdicts are revealed only when all ten ideas are placed.
  const maxCount=IDEAS.filter(idea=>gameState.levels[idea]===MAX_LEVEL).length;
  const remaining=IDEAS.length-gameSave.order.length;
  $('.game-hud-kicker').textContent=showResults?'✦  RESULTS':'✦  THE ORDER PUZZLE';
  $('#game-summary').textContent=showResults
    ?revealPending?'Revealing the town…':gameState.secret?'Storybook Night · Complete':gameState.perfect?'Complete · Every idea at MAX':`${maxCount} of ${IDEAS.length} ideas reached MAX`
    :animating?'The town is answering…':remaining===IDEAS.length?'Place your first idea':remaining===1?'Place your last idea':`${remaining} ideas left to place`;
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
    if(hudRendered&&!reducedMotion())revealCards();
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
  scenery?.setLevels(shownLevels,gameState.secret&&gameState.finished&&!animating,instant);
  worker?.update();
}
function startGame(){
  gameSave.started=true;
  persist();setIntroHidden(true);renderGameHud();refreshGameWorld(true);recenter();
  enterHud(220);
  gameCards.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
}
function restart(){
  animationToken++;animating=false;restartGame(gameSave);gameState=evaluate([]);shownLevels={...gameState.levels};
  shownProjects=new Set();
  worker?.finishCue(true);scenery?.endBeat();reactions?.clear();juice?.clear();clearFloats();
  eventMessage='';persist();renderGameHud();refreshGameWorld(true);recenter();
  stagger(gameCards.children,[{scale:.9,opacity:.4},{scale:1,opacity:1}],{duration:EASE.spring.duration,easing:EASE.spring.easing,gap:30});
}
function finishDecision(instant=false){
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
  const waves=eventWaves(gameState);
  const calm=reduced.matches||!town;
  renderGameHud();gameSkip.focus({preventScroll:true});
  try{
    if(town){
      const focus=eventFocus({idea,level:1});
      const future=snapshotForGame({...shownLevels,[idea]:1},performance.now()-sessionStart,shownProjects.has('road-gates')?gameState.gateMask:0);
      const obstacles=[...town.environment.activeTrees,...town.treeObstacles];
      const colliders=[...buildColliders(future,obstacles),...landscapeColliders(shownLevels),...moatColliders(shownLevels)];
      const crew=gameState.events.some(event=>event.project)?4:3;
      worker?.startCue(idea,focus,(x,z)=>!isBlocked(x,z,colliders,1.15),reduced.matches,performance.now()/1000,crew);
    }
    let beat=0;
    for(const wave of waves)for(const [eventIndex,event] of wave.entries()){
      if(token!==animationToken)return;
      const plannedLevels={...shownLevels,[event.idea]:event.level};
      const plannedProjects=new Set(shownProjects);
      if(event.project)plannedProjects.add(event.project);
      const planned=snapshotForGame(plannedLevels,performance.now()-sessionStart,plannedProjects.has('road-gates')?gameState.gateMask:0);
      const focus=upgradeFocus(event,snapshot,planned),arrival=event.level===1;
      const sandship=event.idea==='workshop'&&arrival;
      if(town){
        desiredTarget.set(focus.x,town.environment.landscapeHeight(focus.x,focus.z)+(sandship?8:3),focus.z);
        if(!manualZoom)desiredDistance=event.idea==='river'?108:event.idea==='walls'||event.idea==='grove'?102:event.idea==='roads'||event.idea==='settlers'?94:event.level>=4?68:76;
        if(!manualOrbit){desiredElevation=.92;desiredAzimuth=Math.atan2(-focus.z,-focus.x)+.4;}
      }
      const project=JOINT_PROJECTS.find(item=>item.id===event.project);
      eventMessage=project?`${IDEA_INFO[event.idea].name} · ${project.name}`:eventTitle(event);
      gameEvent.classList.toggle('collab',Boolean(project));
      if(!calm){
        reactions?.begin(event,idea,focus);
        if(reactions?.travelTime)sfx.whoosh(.8);
      }
      renderGameHud();
      // Each upgraded site gets its own camera beat and building reveal.
      const travel=(reactions?.travelTime??0)*1000;
      const anticipation=calm?250:Math.max(beat===0&&arrival?1350:beat===0?1000:700,travel+120);
      await waitForScene(anticipation,token);
      if(token!==animationToken)return;
      waveImpacts=0;
      shownLevels[event.idea]=event.level;
      if(event.project)shownProjects.add(event.project);
      refreshGameWorld(calm);
      if(!calm){
        reactions?.reveal();
        juice?.addShake(project?.45:.2);
        if(project&&eventIndex===0)sfx.collab();else sfx.levelUp(event.level);
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
      const duration=sandship?SANDSHIP_ARRIVAL_MS+150:event.idea==='river'&&event.level===2?7500:event.idea==='river'&&event.level===3?7500:event.idea==='windmill'&&event.level===3?2900:project?2200:1900;
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
pointerLight(panelBody,'.work-card',4);
magnetic(document,'.intro-actions button, .panel-action, #game-restart.primary, .fallback button');
document.addEventListener('keydown',event=>{
  if(activePanel||!gameSave.started||event.metaKey||event.ctrlKey||event.altKey||event.repeat)return;
  if((event.target as HTMLElement).closest('input,textarea,select,[contenteditable]'))return;
  if(event.key==='Escape'&&animating){event.preventDefault();skipAnimation();return;}
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
  manualOrbit=true;
  desiredAzimuth+=dx;
  desiredElevation=THREE.MathUtils.clamp(desiredElevation+dy,.38,1.42);
}
$('#camera-left').addEventListener('click',()=>orbit(-.32));
$('#camera-right').addEventListener('click',()=>orbit(.32));
$('#camera-zoom-in').addEventListener('click',()=>zoom(-14));
$('#camera-zoom-out').addEventListener('click',()=>zoom(14));
$('#camera-overview').addEventListener('click',()=>recenter());
canvas.addEventListener('wheel',event=>{if(activePanel)return;event.preventDefault();zoom(event.deltaY*.025);},{passive:false});
canvas.addEventListener('pointerdown',event=>{
  if(activePanel||!town)return;
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  pointerStart={x:event.clientX,y:event.clientY};
  lastPointer=pointerStart;
  dragged=pointers.size>1;
  if(pointers.size>1)pinchDistance=0;
});
canvas.addEventListener('pointermove',event=>{
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
  if(dragged)orbit(-dx*.006,dy*.005);
  lastPointer={x:event.clientX,y:event.clientY};
});
function endPointer(event:PointerEvent){
  const wasTracking=pointers.delete(event.pointerId);
  if(!wasTracking)return;
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  if(pointers.size===0){
    if(event.type==='pointerup'&&!dragged&&town&&!activePanel){
      const ndc=new THREE.Vector2(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2);
      const ray=new THREE.Raycaster();ray.setFromCamera(ndc,town.camera);
      let picked:ProjectKey|null=null,near=Infinity;
      for(const [key,box] of town.pickBoxes){
        const hit=ray.ray.intersectBox(box,new THREE.Vector3());
        if(hit){const d=hit.distanceTo(town.camera.position);if(d<near){picked=key;near=d;}}
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
document.addEventListener('keydown',event=>{
  if(activePanel||event.metaKey||event.ctrlKey||event.altKey||event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable]'))return;
  if(event.key==='ArrowLeft'){event.preventDefault();orbit(-.16);}
  else if(event.key==='ArrowRight'){event.preventDefault();orbit(.16);}
  else if(event.key==='ArrowUp'){event.preventDefault();orbit(0,-.1);}
  else if(event.key==='ArrowDown'){event.preventDefault();orbit(0,.1);}
  else if(event.key==='+'||event.key==='='){event.preventDefault();zoom(-12);}
  else if(event.key==='-'){event.preventDefault();zoom(12);}
  else if(event.key==='Home'){event.preventDefault();recenter();}
});
const shakeOffset=new THREE.Vector3(),shakeLook=new THREE.Vector3();
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
  if(profile){document.body.dataset.cameraAzimuth=azimuth.toFixed(3);document.body.dataset.cameraDistance=distance.toFixed(1);document.body.dataset.cameraTarget=`${target.x.toFixed(1)},${target.z.toFixed(1)}`;}
  if(juice&&juice.shake>0&&!reduced.matches){
    juice.shakeOffset(performance.now()/1000,shakeOffset);
    town.camera.position.add(shakeOffset);
    town.camera.lookAt(shakeLook.copy(target).addScaledVector(shakeOffset,.4));
  }else town.camera.lookAt(target);
}
function frame(now:number){requestAnimationFrame(frame);if(document.hidden||!town)return;const cap=town.mobile?30:60;if(now-lastFrame<1000/cap-1)return;const elapsed=lastFrame?now-lastFrame:1000/cap;lastFrame=now;
  snapshot.elapsed=now-sessionStart;
  stepCamera(elapsed/1000);reactions?.update(elapsed/1000);juice?.update(elapsed/1000);updateFloats(now);worker?.update();scenery?.update(now/1000,elapsed/1000);town.render(snapshot,false);
  if(profile&&Math.floor(now/2000)!==Math.floor((now-elapsed)/2000)){document.body.dataset.drawCalls=String(town.renderer.info.render.calls);document.body.dataset.triangles=String(town.renderer.info.render.triangles);document.body.dataset.geometries=String(town.renderer.info.memory.geometries);document.body.dataset.textures=String(town.renderer.info.memory.textures);}
  if(profile){frameSamples.push(elapsed);if(frameSamples.length>=90){const sorted=[...frameSamples].sort((a,b)=>a-b);frameSamples=[];document.body.dataset.frameP50=sorted[Math.floor(sorted.length*.5)].toFixed(1);document.body.dataset.frameP90=sorted[Math.floor(sorted.length*.9)].toFixed(1);document.body.dataset.frameP99=sorted[Math.floor(sorted.length*.99)].toFixed(1);document.body.dataset.pixelRatio=pixelRatio.toFixed(2);}}
}
try{
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('fallback'))throw new Error('Development WebGL fallback preview');
  town=new TownScene(canvas,true);pixelRatio=Math.min(devicePixelRatio,town.mobile?1:1.5);town.setPixelRatio(pixelRatio);worker=new ChoiceWorker(town.scene);scenery=new GameScenery(town.scene,town.mobile,town.environment);juice=new Juice(town.scene,town.mobile);reactions=new ReactionEffects(town.scene,juice);
  town.onBuildImpact=onBuildImpact;town.onBuildPuff=(x,y,z,size)=>juice?.puff(x,y,z,size,10);
  worker.hooks={strike:(x,y,z)=>{juice?.strike(x,y,z);sfx.tok();},pop:(x,y,z,appearing)=>{juice?.puff(x,y-.8,z,.9,7);sfx.pop(appearing?1.15:.8);},cheer:()=>sfx.cheer()};
  reactions.onArrive=()=>sfx.pop(1.6);refreshGameWorld(true);document.body.classList.add('town-ready');requestAnimationFrame(frame);
  if(import.meta.env.DEV)Object.assign(window,{__townDebug:{town,gameSave,gameState:()=>gameState,snapshot:()=>snapshot}});
  window.addEventListener('resize',()=>{town?.resize();});
}catch(error){console.error('Town renderer unavailable',error);canvas.hidden=true;fallback.hidden=false;document.body.classList.add('no-webgl');}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback.hidden=false;document.body.classList.add('no-webgl');});
canvas.addEventListener('webglcontextrestored',()=>location.reload());
const initialPanel=validPanel(location.hash.slice(1));if(initialPanel)openPanel(initialPanel,false);
setIntroHidden(gameSave.started);
renderGameHud();
document.documentElement.classList.remove('returning');
if(gameSave.started)enterHud(350);
persist();
