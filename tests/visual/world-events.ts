import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PlanetWorldEvents,worldEventDuration } from '../../src/town/planet-world-events';
import { PlanetLandscape } from '../../src/town/planet-landscape';
import { PLANET_RADIUS,planetElevation,surfaceNormal } from '../../src/town/planet-geography';
import { WORLD_EVENT_SITES } from '../../src/town/world-event-terrain';
import { initialWorldEventState,copyWorldEventState,type WorldEvent,type WorldEventKind,type ArtifactId } from '../../src/town/world-event-types';
import { createWorldEventDragon,type DragonPose } from '../../src/town/world-event-dragon';
import { createEventChest,createEventShrine,createEventCaravan,createEventTowerSockets } from '../../src/town/world-event-props';
import { authoredLandmarkBuilding } from '../../src/town/authored-landmarks';
import { PLOTS } from '../../src/town/town-plan';
import { PLANET_LANDMARK_SCALE,planetLandmarkHeight } from '../../src/town/planet-landmarks';
import { snapshotForGame } from '../../src/town/game-snapshot';
import type { Levels } from '../../src/town/game';

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const stage=$<HTMLSelectElement>('stage'),eventSelect=$<HTMLSelectElement>('event'),artifact=$<HTMLSelectElement>('artifact'),focus=$<HTMLSelectElement>('focus'),progress=$<HTMLInputElement>('progress'),reduced=$<HTMLInputElement>('reduced'),mobile=$<HTMLInputElement>('mobile'),parts=$<HTMLInputElement>('parts'),pose=$<HTMLSelectElement>('pose');
const kinds:WorldEventKind[]=['expedition','dragon-warning','dragon-tamed','dragon-raid','volcano-warning','mine-prepared','eruption-safe','eruption-damage','pass-repaired','core-recovered','lens-delivery','caravan-waiting','orchard-restored','artifact-installed','beacon-lit'];
for(const kind of kinds)eventSelect.add(new Option(kind,kind));for(const key of Object.keys(WORLD_EVENT_SITES))focus.add(new Option(key,key));
const levels:Levels={settlers:6,grove:6,river:3,roads:3,market:6,windmill:6,workshop:6,archive:6,observatory:3,walls:0};
function fixture():WorldEvent{
  const kind=eventSelect.value as WorldEventKind,before=initialWorldEventState();before.turn=7;
  if(['dragon-warning','dragon-tamed','dragon-raid','artifact-installed','beacon-lit'].includes(kind)){before.expedition='returned';before.artifacts.gold='town';}
  if(kind==='dragon-tamed'||kind==='dragon-raid'){before.dragon='approaching';before.dragonDueTurn=8;}
  if(kind==='eruption-safe'){before.minePrepared=true;before.volcano='warning';}
  if(kind==='eruption-damage')before.volcano='warning';
  if(['pass-repaired','core-recovered','caravan-waiting'].includes(kind)){before.volcano='overflowed';before.mountainPass='blocked';before.caravan='waiting';}
  if(kind==='orchard-restored'){before.orchard='burned';before.burnedTurn=6;}
  if(kind==='artifact-installed'){before.artifacts={lens:'town',core:'town',gold:'friendly-dragon'};before.dragon='tamed';}
  if(kind==='beacon-lit'){before.artifacts={lens:'installed',core:'installed',gold:'installed'};before.installed=['lens','core','gold'];before.dragon='tamed';}
  const after=copyWorldEventState(before);after.turn=8;
  switch(kind){
    case 'expedition':after.expedition='returned';after.artifacts.gold='town';break;
    case 'dragon-warning':after.dragon='approaching';after.dragonDueTurn=9;break;
    case 'dragon-tamed':after.dragon='tamed';after.dragonDueTurn=null;after.artifacts.gold='friendly-dragon';break;
    case 'dragon-raid':after.dragon='departed';after.dragonDueTurn=null;after.artifacts.gold='departed-dragon';after.orchard='burned';after.burnedTurn=8;break;
    case 'volcano-warning':after.volcano='warning';break;
    case 'mine-prepared':after.minePrepared=true;break;
    case 'eruption-safe':after.volcano='contained';after.eruptionTurn=8;break;
    case 'eruption-damage':after.volcano='overflowed';after.mountainPass='blocked';after.eruptionTurn=8;break;
    case 'pass-repaired':after.mountainPass='bypass';break;
    case 'core-recovered':after.artifacts.core='town';after.mountainPass='bypass';break;
    case 'lens-delivery':after.artifacts.lens='town';after.caravan='delivered';break;
    case 'caravan-waiting':before.caravan='unavailable';after.caravan='waiting';break;
    case 'orchard-restored':after.orchard='restored';break;
    case 'artifact-installed':after.installed=[artifact.value as ArtifactId];after.artifacts[artifact.value as ArtifactId]='installed';break;
    case 'beacon-lit':after.beacon=true;break;
  }
  return {id:`qa-${kind}`,kind,turn:8,title:kind,description:'Development visual fixture',before,after,artifact:artifact.value as ArtifactId};
}
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8eafbf);const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,2500);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xfff4df,0x547080,2.4));const sun=new THREE.DirectionalLight(0xffefd5,3);scene.add(sun,sun.target);
let landscape:PlanetLandscape,events:PlanetWorldEvents,tower:THREE.Group;
let assets:{dragon:ReturnType<typeof createWorldEventDragon>;chest:ReturnType<typeof createEventChest>;caravan:ReturnType<typeof createEventCaravan>;shrine:ReturnType<typeof createEventShrine>;sockets:ReturnType<typeof createEventTowerSockets>};
const studio=new THREE.Group();scene.add(studio);const ground=new THREE.Mesh(new THREE.CircleGeometry(30,64),new THREE.MeshStandardMaterial({color:0xcac0a1,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;ground.receiveShadow=true;studio.add(ground);
let current=fixture(),playing=false,mode:'cinematic'|'before'|'after'='cinematic',manualCamera=false,lastFocus={x:0,z:0,height:3};
controls.addEventListener('start',()=>{manualCamera=true;});
function cameraAt(p:{x:number;z:number;height:number}){
  const normal=surfaceNormal(p.x,p.z),rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal),target=normal.clone().multiplyScalar(PLANET_RADIUS+planetElevation(normal)+p.height/(1+(p.x*p.x+p.z*p.z)/(4*PLANET_RADIUS*PLANET_RADIUS)));
  camera.up.copy(normal);camera.position.copy(target).add(new THREE.Vector3(18,20,22).multiplyScalar((current.kind==='beacon-lit'||focus.value==='wizard'?1.4:1)*Math.max(1,.75/(innerWidth/innerHeight))).applyQuaternion(rotation));controls.target.copy(target);camera.lookAt(target);sun.position.copy(target).add(new THREE.Vector3(35,65,20).applyQuaternion(rotation));sun.target.position.copy(target);
}
function studioCamera(){const asset=assets[stage.value as keyof typeof assets];if(!asset)return;const bounds=new THREE.Box3().setFromObject(asset.root),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),distance=Math.max(size.x,size.y,size.z)*1.4;camera.up.set(0,1,0);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(distance*.85,distance*.6,distance));camera.lookAt(center);sun.position.set(15,25,20);sun.target.position.copy(center);}
function show(){const isWorld=stage.value==='world';landscape.group.visible=isWorld;events.group.visible=isWorld;tower.visible=isWorld;studio.visible=!isWorld;for(const [key,asset] of Object.entries(assets))asset.root.visible=key===stage.value;manualCamera=false;if(!isWorld)studioCamera();seek();}
function rebuild(){landscape?.dispose();events?.dispose();tower?.removeFromParent();if(assets)Object.values(assets).forEach(a=>a.dispose());landscape=new PlanetLandscape(scene,mobile.checked);events=new PlanetWorldEvents(scene,mobile.checked);const plot=PLOTS.find(p=>p.project==='wizard')!;tower=new THREE.Group();const model=authoredLandmarkBuilding({...plot,x:0,z:0,stage:6,renovation:0},mobile.checked);model.scale.set(PLANET_LANDMARK_SCALE.footprint,PLANET_LANDMARK_SCALE.height,PLANET_LANDMARK_SCALE.footprint);tower.add(model);const normal=surfaceNormal(plot.x,plot.z);tower.position.copy(normal).multiplyScalar(PLANET_RADIUS+planetElevation(normal));tower.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);tower.scale.setScalar(1/(1+(plot.x*plot.x+plot.z*plot.z)/(4*PLANET_RADIUS*PLANET_RADIUS)));scene.add(tower);assets={dragon:createWorldEventDragon(mobile.checked),chest:createEventChest(mobile.checked),caravan:createEventCaravan(mobile.checked),shrine:createEventShrine(mobile.checked),sockets:createEventTowerSockets(mobile.checked)};Object.values(assets).forEach(a=>studio.add(a.root));current=fixture();landscape.setWorldEventState(current.before);landscape.update(snapshotForGame(levels),false);events.begin(current,levels);show();}
function seek(){
  const p=Number(progress.value);$('progress-label').textContent=p.toFixed(3);events.update(0,reduced.checked);
  if(mode==='cinematic'){lastFocus=events.sample(p)??lastFocus;}else events.setState(mode==='before'?current.before:current.after,levels);
  landscape.setWorldEventState(mode==='before'||mode==='cinematic'&&p<.86?current.before:current.after);
  landscape.setExpeditionActive(current.kind==='expedition'&&mode==='cinematic');
  assets.chest.lid.rotation.x=-p*Math.PI*.65;assets.shrine.lens.visible=parts.checked;assets.caravan.cargo.visible=parts.checked;assets.caravan.wheels.forEach(w=>w.rotation.x=p*Math.PI*4);
  for(const key of ['lens','core','gold','beam'] as const)assets.sockets[key].visible=parts.checked;
  assets.dragon.pose(pose.value as DragonPose,p*8,reduced.checked);
  if(stage.value==='world'&&!manualCamera){const fixed=focus.value==='wizard'?PLOTS.find(p=>p.project==='wizard'):WORLD_EVENT_SITES[focus.value as keyof typeof WORLD_EVENT_SITES];cameraAt(fixed?{...fixed,height:focus.value==='wizard'?planetLandmarkHeight('wizard',6)*.5:3}:lastFocus);}
  const state=mode==='before'||mode==='cinematic'&&p<.86?current.before:current.after;$('state').textContent=JSON.stringify({mode,dragon:state.dragon,volcano:state.volcano,pass:state.mountainPass,artifacts:state.artifacts,installed:state.installed,beacon:state.beacon},null,2);
}
function playLabel(){$('play').textContent=playing?'Pause':'Play';}
function begin(){current=fixture();mode='cinematic';events.begin(current,levels);progress.value='0';manualCamera=false;seek();}
eventSelect.onchange=begin;artifact.onchange=begin;stage.onchange=show;mobile.onchange=rebuild;focus.onchange=()=>{manualCamera=false;seek();};parts.onchange=seek;pose.onchange=()=>{seek();if(stage.value==='dragon')studioCamera();};reduced.onchange=seek;
progress.oninput=()=>{playing=false;playLabel();if(mode!=='cinematic'){mode='cinematic';events.begin(current,levels);}seek();};
$('play').onclick=()=>{playing=!playing;if(playing&&(mode!=='cinematic'||Number(progress.value)>=1))begin();playLabel();};
for(const side of ['before','after'] as const)$(side).onclick=()=>{playing=false;playLabel();mode=side;progress.value=side==='before'?'0':'1';lastFocus=events.sample(Number(progress.value))??lastFocus;seek();};
$('reload').onclick=()=>{playing=false;playLabel();const saved=JSON.parse(JSON.stringify(mode==='before'?current.before:current.after));events.dispose();events=new PlanetWorldEvents(scene,mobile.checked);events.setState(saved,levels);mode=mode==='before'?'before':'after';seek();};
$('reset-camera').onclick=()=>{manualCamera=false;if(stage.value==='world')seek();else studioCamera();};
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
rebuild();let previous=performance.now();
function frame(now:number){requestAnimationFrame(frame);const dt=Math.min((now-previous)/1000,.1);previous=now;if(playing){progress.value=String(Math.min(1,Number(progress.value)+dt*1000/worldEventDuration(current.kind)));seek();if(Number(progress.value)>=1){playing=false;playLabel();}}
  events.update(dt,reduced.checked);landscape.render(reduced.checked?0:now);controls.update();renderer.render(scene,camera);$('status').textContent=`${stage.value} · ${current.kind} · ${mode} · ${renderer.info.render.calls} draws · ${renderer.info.render.triangles.toLocaleString()} triangles`;
}requestAnimationFrame(frame);
window.addEventListener('beforeunload',()=>{events.dispose();landscape.dispose();Object.values(assets).forEach(a=>a.dispose());ground.geometry.dispose();(ground.material as THREE.Material).dispose();controls.dispose();renderer.dispose();});
