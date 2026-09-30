import * as THREE from 'three';
import type { Levels } from './game';
import { type WorldEvent,type WorldEventState,initialWorldEventState,copyWorldEventState } from './world-event-types';
import { worldEventCue,eventEase,worldEventDuration } from './world-event-cinematic';
import { createWorldEventDragon } from './world-event-dragon';
import { createEventChest,createEventShrine,createEventCaravan,createEventTowerSockets } from './world-event-props';
import { createWorldEventTerrain,WORLD_EVENT_SITES as S,CARAVAN_PATH,CARAVAN_BRIDGE,BYPASS_PATH,SAFE_LAVA_PATH,DAMAGING_LAVA_PATH,SAFE_LAVA_GRADE,DAMAGING_LAVA_GRADE,gradeHeight,EMBER_SEAM } from './world-event-terrain';
import { createPlanetShip,SHIP_FLOAT_HEIGHT,SHIP_DECK_HEIGHT } from './planet-ship';
import { createEventTender } from './world-event-tender';
import { PLANET_LANDMARK_SCALE,planetLandmarkHeight } from './planet-landmarks';
import { planetTransportLayout,harborBerth,seaRoute,mixPoint } from './planet-transport-layout';
import { PLANET_RADIUS as R,planetElevation,surfaceNormal } from './planet-geography';
import { PLOTS } from './town-plan';
import { relocateGamePlot } from './idea-districts';
import type { RoadPoint as Point } from './planet-building-access';
export { worldEventDuration };
const UP=new THREE.Vector3(0,1,0);
const wizardPlot=PLOTS.find(p=>p.project==='wizard')!;
const WIZARD=relocateGamePlot(wizardPlot);
const WIZARD_NEST={x:WIZARD.x+15,z:WIZARD.z};
const ports=planetTransportLayout().harbors;
const HARBOR=ports[0]?.land??S.townDisplay;
const ISLAND_LANDING=ports[1]?.land??S.islandChest;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
function floor(p:Point){return planetElevation(surfaceNormal(p.x,p.z));}
function position(p:Point,lift=0,sea=false){return surfaceNormal(p.x,p.z).multiplyScalar(R+(sea?SHIP_FLOAT_HEIGHT:floor(p))+lift);}
function place(root:THREE.Object3D,p:Point,lift=0,heading?:Point,sea=false,xForward=false){
  const up=surfaceNormal(p.x,p.z);root.position.copy(up).multiplyScalar(R+(sea?SHIP_FLOAT_HEIGHT:floor(p))+lift);
  if(heading){const forward=surfaceNormal(heading.x,heading.z).sub(up);forward.addScaledVector(up,-forward.dot(up)).normalize();
    if(forward.lengthSq()<.1){root.quaternion.setFromUnitVectors(UP,up);return;}
    const side=new THREE.Vector3().crossVectors(up,forward).normalize();
    root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xForward?forward:side,up,xForward?side.negate():forward));
  }else root.quaternion.setFromUnitVectors(UP,up);
}
/** Arc-length sampling keeps native spherical journeys continuous at route joins. */
export function eventRouteSample(route:readonly Point[],progress:number):{point:Point;heading:Point;index:number;t:number}{
  if(route.length<2){const point=route[0]??{x:0,z:0};return {point,heading:{x:point.x,z:point.z+1},index:0,t:0};}
  const lengths=route.slice(1).map((p,i)=>surfaceNormal(p.x,p.z).angleTo(surfaceNormal(route[i].x,route[i].z))*R);
  let remaining=lengths.reduce((a,b)=>a+b,0)*clamp(progress),index=0;
  while(index<lengths.length-1&&remaining>lengths[index])remaining-=lengths[index++];
  const t=lengths[index]?remaining/lengths[index]:0,a=route[index],b=route[index+1];
  return {point:mixPoint(a,b,t),heading:{x:b.x+(b.x-a.x)*.01,z:b.z+(b.z-a.z)*.01},index,t};
}

/** Persistent projection plus a small cast of seekable actors. No rules, timers, or save writes. */
export class PlanetWorldEvents{
  readonly group=new THREE.Group();
  private terrain:ReturnType<typeof createWorldEventTerrain>;
  private dragon:ReturnType<typeof createWorldEventDragon>;
  private island:ReturnType<typeof createEventChest>;
  private townChest:ReturnType<typeof createEventChest>;
  private carried:ReturnType<typeof createEventChest>;
  private shrine:ReturnType<typeof createEventShrine>;
  private sockets:ReturnType<typeof createEventTowerSockets>;
  private caravan:ReturnType<typeof createEventCaravan>;
  private ship:ReturnType<typeof createPlanetShip>;
  private tender:ReturnType<typeof createEventTender>;
  private crew=new THREE.Group();
  private transient=new THREE.Group();
  private display=new THREE.Group();
  private hoard=new THREE.Group();
  private lens:THREE.Mesh;
  private core:THREE.Mesh;
  private cargo:THREE.Mesh;
  private spell:THREE.Mesh;
  private flame:THREE.Mesh;
  private surge:THREE.Mesh;
  private workers:THREE.Group[]=[];
  private tools:THREE.Group[]=[];
  private circuit=new THREE.Group();
  private dragonSmoke=new THREE.Group();
  private glint:THREE.Mesh;
  private beacon:THREE.Mesh;
  private sea:Point[];
  private world=initialWorldEventState();
  private levels:Levels|null=null;
  private event:WorldEvent|null=null;
  private seconds=0;
  private progress=0;
  private reduced=false;
  private geometry=new Set<THREE.BufferGeometry>();
  private paints=new Set<THREE.Material>();
  private disposed=false;
  constructor(parent:THREE.Scene|THREE.Group,private mobile:boolean){
    this.group.name='Persistent world event history';parent.add(this.group);
    this.terrain=createWorldEventTerrain(this.group,mobile);
    this.dragon=createWorldEventDragon(mobile);this.island=createEventChest(mobile);this.townChest=createEventChest(mobile);this.carried=createEventChest(mobile);
    this.shrine=createEventShrine(mobile);this.sockets=createEventTowerSockets(mobile);this.caravan=createEventCaravan(mobile);this.ship=createPlanetShip(mobile,true);this.tender=createEventTender(mobile);this.tender.root.scale.setScalar(1.3);
    this.group.add(this.dragonSmoke,this.circuit,this.dragon.root,this.island.root,this.townChest.root,this.shrine.root,this.sockets.root,this.display,this.hoard,this.transient);
    this.transient.name='Cinematic actors';this.transient.add(this.tender.root,this.ship.root,this.carried.root,this.crew,this.caravan.root);
    const box=this.own(new THREE.BoxGeometry(1,1,1)),gem=this.own(new THREE.IcosahedronGeometry(1,0));
    const stone=this.paint(0xaaa78f),gold=this.paint(0xf4bd49,.4),blue=this.paint(0x76dce4,.3),orange=this.paint(0xff8436,.4),dark=this.paint(0x5d3f32),coat=this.paint(0x398a96),skin=this.paint(0xe9b88e);
    const block=(g:THREE.Group,p:number[],size:number[],mat:THREE.Material)=>{const m=new THREE.Mesh(box,mat);m.position.fromArray(p);m.scale.fromArray(size);m.castShadow=true;g.add(m);return m;};
    block(this.display,[0,.38,0],[3,.76,2],stone);block(this.display,[0,.84,0],[3.3,.18,2.2],gold);
    const breathPaint=new THREE.MeshBasicMaterial({color:0xc9c4c0,transparent:true,opacity:.3,depthWrite:false});this.paints.add(breathPaint);this.dragonSmoke.name='Sleeping dragon nose smoke';for(let i=0;i<3;i++){const puff=new THREE.Mesh(gem,breathPaint);puff.position.set(.2+i*.08,.9+i*.4,2.4);puff.scale.setScalar(.13+i*.055);this.dragonSmoke.add(puff);}
    this.circuit.name='Installed conductive tower rune rings';this.circuit.scale.set(PLANET_LANDMARK_SCALE.footprint,PLANET_LANDMARK_SCALE.height,PLANET_LANDMARK_SCALE.footprint);place(this.circuit,WIZARD);for(const y of [1.2,2.8,4.4]){const ring=new THREE.Mesh(this.own(new THREE.TorusGeometry(1.22,.035,5,24)),gold);ring.rotation.x=Math.PI/2;ring.position.y=y;this.circuit.add(ring);}
    this.display.name='Town artifact display';this.lens=new THREE.Mesh(this.own(new THREE.TorusGeometry(.52,.12,6,16)),blue);this.lens.position.set(-.75,1.6,0);this.display.add(this.lens);
    this.core=new THREE.Mesh(gem,orange);this.core.position.set(.75,1.45,0);this.core.scale.set(.4,.65,.4);this.display.add(this.core);
    this.cargo=new THREE.Mesh(gem,blue);this.cargo.scale.set(.55,.65,.3);this.transient.add(this.cargo);
    const coinGeometry=this.own(new THREE.CylinderGeometry(.3,.3,.08,8)),coins=new THREE.InstancedMesh(coinGeometry,gold,mobile?34:64),dummy=new THREE.Object3D();
    for(let i=0;i<coins.count;i++){const angle=i*2.39996,r=Math.sqrt(i/coins.count)*1.9;dummy.position.set(Math.cos(angle)*r,.15+(1-r/2)*.7+Math.sin(i*5)*.1,Math.sin(angle)*r);dummy.rotation.set(Math.sin(i)*.2,i*.7,Math.cos(i)*.2);dummy.updateMatrix();coins.setMatrixAt(i,dummy.matrix);}
    coins.name='Retained dragon gold hoard';this.hoard.add(coins);
    for(let i=0;i<2;i++){const worker=new THREE.Group();worker.name='Chest carrying crew';
      for(const x of [-.18,.18])block(worker,[x,.22,0],[.22,.44,.28],dark);
      block(worker,[0,.8,0],[.55,.7,.35],coat);block(worker,[0,1.35,0],[.4,.4,.4],skin);block(worker,[0,1.58,0],[.58,.12,.55],gold);
      for(const x of [-.38,.38])block(worker,[x,.86,.27],[.2,.2,.65],coat);
      const pick=new THREE.Group();pick.position.set(.5,1,.3);block(pick,[0,0,.4],[.07,.08,.9],dark);block(pick,[0,0,.8],[.7,.12,.15],stone);worker.add(pick);this.tools.push(pick);
      this.crew.add(worker);this.workers.push(worker);
    }
    const effects=(color:number)=>{const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide});this.paints.add(mat);return mat;};
    this.spell=new THREE.Mesh(this.own(new THREE.CylinderGeometry(.07,.18,1,8)),effects(0x91e7f4));this.spell.name='Wizard calming tether';
    this.flame=new THREE.Mesh(this.own(new THREE.ConeGeometry(1.4,1,8)),effects(0xffae42));this.flame.name='Dragon fire breath';
    this.surge=new THREE.Mesh(this.own(new THREE.IcosahedronGeometry(1,1)),orange);this.surge.scale.set(1.4,.35,2.1);this.surge.name='Leading lava surge';
    this.glint=new THREE.Mesh(this.own(new THREE.OctahedronGeometry(.7)),effects(0xffed93));this.glint.name='Hoard warning glint';
    this.transient.add(this.spell,this.flame,this.surge,this.glint);
    this.beacon=new THREE.Mesh(this.own(new THREE.CylinderGeometry(.12,.65,16,10)),effects(0xb4f4eb));(this.beacon.material as THREE.MeshBasicMaterial).opacity=.28;this.beacon.name='Wizard summit beacon';this.group.add(this.beacon);
    this.sea=ports.length>1?seaRoute(harborBerth(ports[0]),harborBerth(ports[1])):[];
    place(this.island.root,S.islandChest,.43);place(this.townChest.root,{x:HARBOR.x+2,z:HARBOR.z-2});place(this.shrine.root,S.shrine);
    place(this.display,S.townDisplay);place(this.sockets.root,WIZARD,7.3);place(this.hoard,{x:WIZARD_NEST.x+2,z:WIZARD_NEST.z+1});
    this.group.traverse(o=>o.userData.planetNative=true);this.clearActors();
    this.project(this.world);
  }
  private own<T extends THREE.BufferGeometry>(g:T){this.geometry.add(g);return g;}
  private paint(color:number,emission=0){const m=new THREE.MeshStandardMaterial({color,roughness:.78,emissive:color,emissiveIntensity:emission});this.paints.add(m);return m;}
  private clearActors(){for(const child of this.transient.children)child.visible=false;this.dragon.root.visible=false;this.carried.lid.rotation.x=0;this.carried.root.scale.setScalar(1);this.crew.scale.setScalar(1);this.cargo.material=this.lens.material;this.cargo.geometry=this.core.geometry;this.cargo.scale.set(.55,.65,.3);this.sockets.beam.scale.y=1;this.beacon.scale.y=1;this.tools.forEach(tool=>tool.visible=false);}
  private project(world:WorldEventState){
    const volcano=world.mountainPass==='bypass'?'bypassed':world.volcano==='overflowed'?'blocked':world.volcano;
    this.terrain.update({volcano,prepared:world.minePrepared,orchard:world.orchard==='burned'?'scorched':world.orchard,corePresent:world.artifacts.core==='mountain',orchardActive:(this.levels?.grove??0)>=5,routeOpen:(this.levels?.roads??0)>=2});
    this.island.root.visible=world.artifacts.gold==='island';this.island.lid.rotation.x=0;
    this.townChest.root.visible=world.artifacts.gold==='town';this.townChest.lid.rotation.x=world.expedition==='returned'?-1.15:0;
    this.shrine.lens.visible=world.artifacts.lens==='shrine';
    this.display.visible=world.artifacts.lens==='town'||world.artifacts.core==='town';this.lens.visible=world.artifacts.lens==='town';this.core.visible=world.artifacts.core==='town';
    this.hoard.visible=world.dragon==='tamed';this.dragonSmoke.visible=world.dragon==='tamed';place(this.dragonSmoke,WIZARD_NEST,.15);
    const wizardLevel=this.levels?.observatory??0,scale=1/(1+(WIZARD.x*WIZARD.x+WIZARD.z*WIZARD.z)/(4*R*R)),roof=planetLandmarkHeight('wizard',wizardLevel<=1?3:wizardLevel===2?4:6)*scale;
    this.sockets.root.visible=wizardLevel>0;place(this.sockets.root,{x:WIZARD.x+2.4*PLANET_LANDMARK_SCALE.footprint,z:WIZARD.z+3.8*PLANET_LANDMARK_SCALE.footprint},.12);this.sockets.root.scale.setScalar(.82);place(this.beacon,WIZARD,roof+8);this.beacon.visible=world.beacon;
    this.circuit.visible=world.installed.includes('gold');this.sockets.lens.visible=world.installed.includes('lens');this.sockets.core.visible=world.installed.includes('core');this.sockets.gold.visible=world.installed.includes('gold');this.sockets.beam.visible=world.beacon;
    this.dragon.root.visible=world.dragon==='tamed'||world.dragon==='approaching';
    if(world.dragon==='tamed'){place(this.dragon.root,WIZARD_NEST,.15);this.dragon.pose('sleeping',this.seconds,this.reduced);}
    if(world.dragon==='approaching'){place(this.dragon.root,{x:HARBOR.x+30,z:HARBOR.z+38},19,HARBOR);this.dragon.root.scale.setScalar(.65);this.dragon.pose('flying',this.seconds,this.reduced);}else this.dragon.root.scale.setScalar(1);
    this.caravan.root.visible=world.caravan==='waiting';if(this.caravan.root.visible){place(this.caravan.root,CARAVAN_PATH[Math.max(0,CARAVAN_PATH.length-4)]);this.caravan.cargo.visible=false;}
    this.group.userData.worldState={dragon:world.dragon,volcano:world.volcano,mountainPass:world.mountainPass,orchard:world.orchard,artifacts:{...world.artifacts},installed:[...world.installed],beacon:world.beacon};
  }
  setState(world:WorldEventState,levels:Levels){this.event=null;this.levels={...levels};this.world=copyWorldEventState(world);this.clearActors();this.project(this.world);}
  begin(event:WorldEvent,levels:Levels){this.event=event;this.levels={...levels};this.world=copyWorldEventState(event.after);this.progress=0;this.clearActors();this.sample(0);}
  private move(root:THREE.Object3D,route:readonly Point[],t:number,lift=0,sea=false,xForward=false){
    const sample=eventRouteSample(route,t);let height=lift;
    const from=route[sample.index],to=route[sample.index+1],same=(a:Point|undefined,b:Point)=>!!a&&Math.hypot(a.x-b.x,a.z-b.z)<.01;
    if(!sea&&((same(from,CARAVAN_BRIDGE.a)&&same(to,CARAVAN_BRIDGE.b))||(same(from,CARAVAN_BRIDGE.b)&&same(to,CARAVAN_BRIDGE.a)))){const a=floor(from),b=floor(to);height+=a*(1-sample.t)+b*sample.t+.2+Math.sin(Math.PI*sample.t)*1.5-floor(sample.point);}
    place(root,sample.point,height,sample.heading,sea,xForward);return sample.point;
  }
  private tether(mesh:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3,width=1){const delta=b.clone().sub(a);mesh.visible=true;mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(UP,delta.clone().normalize());mesh.scale.set(width,delta.length(),width);}
  private crewAt(p:Point,carrying:boolean,lift=0){this.crew.visible=true;place(this.crew,p,lift);this.workers.forEach((worker,i)=>{worker.position.set((i-.5)*2.2,0,0);worker.rotation.z=this.reduced?0:Math.sin(this.progress*80+i*Math.PI)*.055;});if(carrying){this.carried.root.visible=true;place(this.carried.root,p,lift+1);}}
  sample(progress:number):{x:number;z:number;height:number}|null{
    if(!this.event)return null;
    const e=this.event,cue=worldEventCue(progress),p=cue.progress;this.progress=p;
    this.clearActors();this.project(p>=.86?e.after:e.before);
    let focus:Point=S.townDisplay,height=3;
    const out=clamp((p-.12)/.26),interact=clamp((p-.38)/.2),back=clamp((p-.58)/.28);
    if(e.kind==='expedition'){
      focus=HARBOR;height=5;
      const outbound=clamp((p-.1)/.22),returning=clamp((p-.66)/.2);
      if(p<.86&&this.sea.length>1){
        this.ship.root.visible=true;const t=p<.32?outbound:p<.66?1:1-returning;
        focus=this.move(this.ship.root,this.sea,t,0,true,true);if(p>=.66)this.ship.root.rotateY(Math.PI);
        this.ship.sails.rotation.y=this.reduced?0:Math.sin(p*28)*.025;
        if(p>=.32&&p<.66){
          const ferryRoute=[ISLAND_LANDING,ports[1].sea,this.sea[this.sea.length-1]];
          const ferryT=p<.4?1-eventEase((p-.32)/.08):p<.55?0:eventEase((p-.55)/.11);
          const ferry=eventRouteSample(ferryRoute,ferryT);this.tender.root.visible=true;
          place(this.tender.root,ferry.point,Math.max(.08,floor(ferry.point)+.3)-SHIP_FLOAT_HEIGHT,ferry.heading,true);
          if(p<.4)this.tender.root.rotateY(Math.PI);
          this.tender.oars.forEach((oar,i)=>oar.rotation.y=this.reduced?0:Math.sin(p*100+i*.1)*.35);
          focus=ferry.point;height=2.5;
          if(p>=.4&&p<.55){
            const walk=p<.475?(p-.4)/.075:1-(p-.475)/.075;
            const q=mixPoint(ISLAND_LANDING,S.islandChest,eventEase(walk));this.crewAt(q,p>=.475);this.island.root.visible=p<.475;focus=q;
          }else{
            this.crew.visible=true;this.crew.position.copy(this.tender.root.position);this.crew.quaternion.copy(this.tender.root.quaternion);this.crew.scale.setScalar(.72);
            this.workers.forEach((worker,i)=>{worker.position.set(0,.45,(i-.5)*2.3);worker.rotation.z=0;});
            if(p>=.55){this.carried.root.visible=true;this.tender.root.updateMatrixWorld(true);this.carried.root.position.copy(this.tender.root.localToWorld(new THREE.Vector3(0,.65,0)));this.carried.root.quaternion.copy(this.tender.root.quaternion);this.carried.root.scale.setScalar(.72);this.island.root.visible=false;}
          }
        }
        if(p>=.66){this.island.root.visible=false;this.carried.root.visible=true;this.ship.root.updateMatrixWorld(true);this.carried.root.position.copy(this.ship.root.localToWorld(new THREE.Vector3(1.5,SHIP_DECK_HEIGHT+.2,.1)));this.carried.root.quaternion.copy(this.ship.root.quaternion);}
      }else if(p>=.86){focus={x:HARBOR.x+2,z:HARBOR.z-2};this.townChest.lid.rotation.x=-1.15*eventEase((p-.86)/.14);this.crewAt(focus,false);}
    }else if(e.kind==='dragon-warning'){
      focus={x:HARBOR.x+2,z:HARBOR.z-2};height=5;
      this.glint.visible=p<.7;place(this.glint,focus,2.2);this.glint.scale.setScalar(.3+Math.sin(Math.PI*p)*1.2);
      this.dragon.root.visible=p>.35;place(this.dragon.root,{x:HARBOR.x+30,z:HARBOR.z+38},19,HARBOR);this.dragon.root.scale.setScalar(.65);this.dragon.pose('flying',p*3,this.reduced);
    }else if(e.kind==='dragon-tamed'||e.kind==='dragon-raid'){
      const tame=e.kind==='dragon-tamed',approach={x:HARBOR.x+30,z:HARBOR.z+38},chest={x:HARBOR.x+2,z:HARBOR.z-2};
      const destination=tame?WIZARD_NEST:S.orchard;
      focus=p<.38?mixPoint(approach,chest,eventEase(out)):p<.58?chest:p<.86?mixPoint(chest,destination,eventEase(back)):destination;height=5;
      if(p<.86){this.dragon.root.visible=true;this.dragon.root.scale.setScalar(1);place(this.dragon.root,focus,p<.38?16*(1-out)+3:p<.58?3:3+Math.sin(back*Math.PI)*7,destination);this.dragon.pose(p>=.38&&tame?'calmed':'flying',p*8,this.reduced);}
      if(p>=.38&&p<.68&&tame)this.tether(this.spell,position(WIZARD,10),this.dragon.root.position.clone().addScaledVector(surfaceNormal(focus.x,focus.z),2));
      if(p>=.5&&p<.86){this.townChest.root.visible=false;this.carried.root.visible=true;place(this.carried.root,focus,2+Math.sin(back*Math.PI)*7);}
      if(!tame&&p>=.68&&p<.86){this.tether(this.flame,this.dragon.root.position,position(S.orchard,.6),1.2);}
      if(!tame&&p>=.86&&p<.98){focus=mixPoint(S.orchard,approach,(p-.86)/.12);this.dragon.root.visible=true;place(this.dragon.root,focus,7+(p-.86)*80,approach);this.dragon.pose('flying',p*8,this.reduced);this.carried.root.visible=true;place(this.carried.root,focus,5+(p-.86)*80);}
    }else if(e.kind==='lens-delivery'){
      const route=e.before.mountainPass==='bypass'?this.bypassCaravanRoute():CARAVAN_PATH;
      const t=p<.38?out:p<.58?1:1-back;
      if(p<.86){this.caravan.root.visible=true;focus=this.move(this.caravan.root,route,t,.12);if(p>=.58)this.caravan.root.rotateY(Math.PI);this.caravan.cargo.visible=false;this.caravan.wheels.forEach(w=>w.rotation.x=p*50);height=3;
        if(p>=.38&&p<.58){focus=S.shrine;this.crewAt(mixPoint({x:S.shrine.x+2,z:S.shrine.z+1},S.shrine,eventEase(interact)),false);}
        if(p>=.48){this.shrine.lens.visible=false;this.cargo.visible=true;this.cargo.geometry=this.lens.geometry;this.cargo.scale.setScalar(1);place(this.cargo,focus,2.1);}
      }else focus=S.townDisplay;
    }else if(e.kind==='caravan-waiting'){
      const turnout=CARAVAN_PATH[Math.max(0,CARAVAN_PATH.length-4)];focus=mixPoint(CARAVAN_PATH[2],turnout,eventEase(out));this.caravan.root.visible=true;place(this.caravan.root,focus,.15,S.pass);if(p>.58)focus=mixPoint(turnout,S.pass,.5);this.caravan.cargo.visible=false;
    }else if(e.kind==='eruption-safe'||e.kind==='eruption-damage'){
      const path=e.kind==='eruption-safe'?SAFE_LAVA_PATH:DAMAGING_LAVA_PATH;
      focus=p<.12?S.volcano:eventRouteSample(path,clamp((p-.12)/.6)).point;height=p<.12?8:3;
      if(p>=.12&&p<.86){this.surge.visible=true;const leading=this.move(this.surge,path,clamp((p-.12)/.6),.6);place(this.surge,leading,gradeHeight(e.kind==='eruption-safe'?SAFE_LAVA_GRADE:DAMAGING_LAVA_GRADE,leading)-floor(leading)+.45);}
      if(p>=.58)this.terrain.update({volcano:e.kind==='eruption-safe'?'contained':'blocked',prepared:e.after.minePrepared,orchard:e.after.orchard==='burned'?'scorched':e.after.orchard,corePresent:e.after.artifacts.core==='mountain',orchardActive:(this.levels?.grove??0)>=5,routeOpen:(this.levels?.roads??0)>=2});
    }else if(e.kind==='volcano-warning'){focus=S.volcano;height=7;}
    else if(e.kind==='mine-prepared'||e.kind==='pass-repaired'){
      const route=e.kind==='mine-prepared'?SAFE_LAVA_PATH:BYPASS_PATH;focus=eventRouteSample(route,p).point;height=3;this.crewAt(focus,false);this.tools.forEach((tool,i)=>{tool.visible=true;tool.rotation.x=this.reduced?-.5:Math.sin(p*60+i)*.85-.45;});
      if(p>.45)this.terrain.update({volcano:e.kind==='pass-repaired'?'bypassed':e.after.volcano==='overflowed'?'blocked':e.after.volcano,prepared:e.after.minePrepared,orchard:e.after.orchard==='burned'?'scorched':e.after.orchard,corePresent:e.after.artifacts.core==='mountain',orchardActive:(this.levels?.grove??0)>=5,routeOpen:(this.levels?.roads??0)>=2});
    }else if(e.kind==='core-recovered'){
      const route=[EMBER_SEAM,...[...BYPASS_PATH].reverse(),...CARAVAN_PATH.slice(0,3).reverse()];focus=p<.58?route[0]:eventRouteSample(route,back).point;height=3;
      this.caravan.root.visible=p<.86;this.move(this.caravan.root,route,p<.58?0:back,.15);this.caravan.cargo.visible=false;this.crewAt(focus,false);
      if(p>=.48&&p<.86){this.cargo.visible=true;this.cargo.material=this.core.material;place(this.cargo,focus,2.2);}else this.cargo.material=this.lens.material;
    }else if(e.kind==='orchard-restored'){focus=S.orchard;this.crewAt(focus,false);height=3;}
    else if(e.kind==='artifact-installed'){
      const source=e.artifact==='gold'?WIZARD_NEST:S.townDisplay;focus=mixPoint(source,WIZARD,eventEase(clamp((p-.12)/.65)));height=8;
      if(p>=.12&&p<.86){this.cargo.visible=true;if(e.artifact==='lens'){this.cargo.geometry=this.lens.geometry;this.cargo.scale.setScalar(1);}this.cargo.material=e.artifact==='core'?this.core.material:e.artifact==='gold'?(this.hoard.children[0] as THREE.Mesh).material:this.lens.material;place(this.cargo,focus,1.5+7*eventEase(out));this.tether(this.spell,position(WIZARD,9),this.cargo.position,.5);}
    }else if(e.kind==='beacon-lit'){focus=WIZARD;height=planetLandmarkHeight('wizard',6)*.65+8;this.sockets.beam.visible=p>.35;this.beacon.visible=p>.35;this.beacon.scale.y=.05+.95*eventEase((p-.35)/.45);this.sockets.beam.scale.y=.05+.95*eventEase((p-.35)/.45);}
    if(p===1){this.clearActors();this.project(e.after);}
    return {x:focus.x,z:focus.z,height};
  }
  private bypassCaravanRoute(){const pass=CARAVAN_PATH.findIndex(p=>p.x===S.pass.x&&p.z===S.pass.z);return [...CARAVAN_PATH.slice(0,Math.max(0,pass)),...BYPASS_PATH,...CARAVAN_PATH.slice(pass+1)];}
  finish(){if(this.event)this.world=copyWorldEventState(this.event.after);this.event=null;this.clearActors();this.sockets.beam.scale.y=1;this.project(this.world);}
  cancel(){this.event=null;this.clearActors();this.sockets.beam.scale.y=1;this.project(this.world);}
  update(dt:number,reducedMotion:boolean){this.reduced=reducedMotion;if(!reducedMotion)this.seconds+=Math.max(0,Math.min(.1,dt));this.terrain.render(this.seconds,reducedMotion);
    if(!this.event&&this.world.dragon==='tamed'){this.dragon.pose('sleeping',this.seconds,reducedMotion);this.dragonSmoke.children.forEach((puff,i)=>{const age=reducedMotion?i*.4:(this.seconds*.45+i*.4)%3;puff.position.set(.2+age*.17,.9+age*.8,2.4);puff.scale.setScalar(age<1.9?.1+age*.08:0);});}
    if(!this.event&&this.world.dragon==='approaching')this.dragon.pose('flying',this.seconds,reducedMotion);
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.terrain.dispose();this.dragon.dispose();this.island.dispose();this.townChest.dispose();this.carried.dispose();this.shrine.dispose();this.sockets.dispose();this.caravan.dispose();this.ship.dispose();this.tender.dispose();this.hoard.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});this.geometry.forEach(g=>g.dispose());this.paints.forEach(m=>m.dispose());this.group.removeFromParent();}
}
