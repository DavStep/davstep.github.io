import { DistrictScenery } from './district-scenery';
import { IDEA_DISTRICTS } from './idea-districts';
import * as THREE from 'three';
import { millRotor } from './civic';
import { MILL_SITE, MILL_ROTOR_SOCKET } from './windmill-layout';
import type { Levels } from './game';
import type { Idea } from './game';
import { MILL_POOL, STREAM_BRIDGES, millStreamDistance, millStreamPoint } from './game-path';
import { riverAsset } from './river-assets';
import { wheatSiteClear } from './wheat-layout';
import { Environment, naturalTerrainHeight, riverCenter, riverHalfWidth, riverSurfaceHeight, terrainHeight } from './environment';
import { Hillside } from './hillside';
import { RiverWorks } from './river-works';
import { FrontierWorld } from './frontier-world';
import { CastleMoat } from './castle-moat';
import wheatTile from './generated/wheat-tile.json';
import { MOAT_WATER_Y } from './moat-layout';

const hash = (n: number) => {
  let x = n | 0; x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); return (x ^ (x >>> 16)) >>> 0;
};
const random = (n: number) => hash(n) / 0xffffffff;
const smooth=(a:number,b:number,t:number)=>{
  const u=THREE.MathUtils.clamp((t-a)/(b-a),0,1);
  return u*u*(3-2*u);
};
export const streamSurfaceHeight = (t: number): number => t<.19
  ?THREE.MathUtils.lerp(riverSurfaceHeight(30),.12,smooth(.08,.19,t))
  :t<.58?THREE.MathUtils.lerp(.12,MOAT_WATER_Y,smooth(.19,.52,t))
  :THREE.MathUtils.lerp(MOAT_WATER_Y,-.22,smooth(.64,1,t));

// The feeder narrows in the middle, then fans gently into the mill pool.
// Its source starts broad enough to disappear under the main river.
const streamHalfWidth=(t:number)=>3.55+.1*Math.sin(t*11+1)
  +.45*(1-smooth(0,.18,t))+.12*smooth(.8,1,t);
function streamEdge(t:number,side:number):[number,number,number]{
  const p=millStreamPoint(t),a=millStreamPoint(Math.max(0,t-.002)),b=millStreamPoint(Math.min(1,t+.002));
  const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1;
  const offset=streamHalfWidth(t)*side;
  const x=p.x+dz/length*offset,z=p.z-dx/length*offset;
  // A small lift gives the feeder a stable surface where it merges with the
  // river and moat sheets. Coplanar water otherwise flickers at both joins.
  if(t<.16){
    // Begin on the existing shoreline, then turn into the feeder. Starting
    // at the river centre drew two overlapping water sheets and a hard seam.
    const shoreX=30+side*4.8,shoreZ=riverCenter(shoreX)+riverHalfWidth(shoreX);
    const blend=smooth(0,.16,t);
    return [THREE.MathUtils.lerp(shoreX,x,blend),
      THREE.MathUtils.lerp(riverSurfaceHeight(shoreX)+.008,streamSurfaceHeight(t)+.012,blend),
      THREE.MathUtils.lerp(shoreZ,z,blend)];
  }
  return [x,streamSurfaceHeight(t)+.012,z];
}
function channelRibbon(): THREE.BufferGeometry {
  const positions: number[] = [],uvs:number[]=[];
  const steps = 72;
  for (let index = 0; index < steps; index++) {
    const t0 = index / steps, t1 = (index + 1) / steps;
    const a=streamEdge(t0,-1),b=streamEdge(t0,1);
    const c=streamEdge(t1,-1),d=streamEdge(t1,1);
    for (const point of [a, b, c, b, d, c]) positions.push(...point);
    for(const [side,t] of [[-1,t0],[1,t0],[-1,t1],[1,t0],[1,t1],[-1,t1]])uvs.push(side,t*36);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.computeVertexNormals();
  return geometry;
}

interface WheatPlant { x: number; y: number; z: number; scale: number; turn: number; delay: number }
const seedlingColor = new THREE.Color(0x82b66e);
const harvestColor = new THREE.Color(0xe7bd5b);

export class GameScenery {
  readonly group = new THREE.Group();
  private readonly hillside: Hillside;
  private readonly moat: CastleMoat;
  private readonly frontier: FrontierWorld;
  private readonly districts: DistrictScenery;
  private readonly riverWorks: RiverWorks;
  private readonly water: THREE.Mesh;
  private readonly riverBed: THREE.Mesh;
  private readonly wheat: THREE.InstancedMesh;
  private readonly plants: WheatPlant[] = [];
  private readonly rotor: THREE.Group;
  private readonly bridges = new THREE.Group();
  private readonly pool:THREE.Group;
  private readonly grove = new THREE.Group();
  private readonly birds = new THREE.Group();
  private readonly celebration = new THREE.Group();
  private readonly blossoms = new THREE.Group();
  private readonly archivePages = new THREE.Group();
  private readonly beacon = new THREE.Group();
  private readonly dummy = new THREE.Object3D();
  private readonly plantColor = new THREE.Color();
  private waterFill = 0;
  private waterTarget = 0;
  private wheatGrowth = 0;
  private wheatTarget = 0;
  private secret = false;
  private levels: Levels | null = null;
  private groveGrowth = 0;
  private rotorGrowth = 0;
  private bridgeGrowth = 0;
  private archiveGrowth = 0;
  private beaconGrowth = 0;
  private birdGrowth = 0;
  private beat: { started: number; failed: boolean; kind: 'arrival' | 'upgrade' | 'max'; x: number; y: number; z: number } | null = null;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(scene: THREE.Scene, mobile: boolean,private readonly environment:Environment) {
    this.hillside = new Hillside(this.group, mobile);
    this.moat = new CastleMoat(this.group,mobile,environment);
    this.frontier = new FrontierWorld(this.group,mobile,environment,true);
    this.districts = new DistrictScenery(this.group,mobile);
    this.riverWorks = new RiverWorks(this.group,mobile,millStreamPoint,naturalTerrainHeight,streamSurfaceHeight,7.6,[.22,.8]);
    this.riverBed=new THREE.Mesh(channelRibbon().translate(0,-.75,0),new THREE.MeshStandardMaterial({color:0x8e7354,roughness:1,side:THREE.DoubleSide}));
    this.riverBed.geometry.setDrawRange(0,0);this.group.add(this.riverBed);
    this.water = new THREE.Mesh(channelRibbon(),environment.createRiverMaterial());
    this.water.geometry.setDrawRange(0, 0);
    this.group.add(this.water);
    this.pool=riverAsset('pool',environment.createPondMaterial());
    this.pool.position.set(MILL_POOL.x,streamSurfaceHeight(1),MILL_POOL.z);
    this.pool.visible=false;this.group.add(this.pool);

    const combined = new THREE.BufferGeometry();
    combined.setAttribute('position', new THREE.Float32BufferAttribute(wheatTile.positions, 3));
    combined.setAttribute('normal', new THREE.Float32BufferAttribute(wheatTile.normals, 3));
    combined.setAttribute('color', new THREE.Float32BufferAttribute(wheatTile.colors, 3));
    this.wheat = new THREE.InstancedMesh(combined, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .9 }), mobile ? 350 : 880);
    this.wheat.frustumCulled = false;
    this.wheat.castShadow = !mobile;
    let attempt = 0;
    while (this.plants.length < this.wheat.count && attempt < 50000) {
      const index = this.plants.length;
      let x:number,z:number;
      if(attempt%3===2){
        const t=.7+random(attempt*41+7)*.29;
        const p=millStreamPoint(t),a=millStreamPoint(t-.002),b=millStreamPoint(t+.002);
        const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1;
        const side=attempt%2?1:-1,offset=4.2+random(attempt*31+13)*6.2;
        x=p.x+side*dz/length*offset;
        z=p.z-side*dx/length*offset;
      }else{
        x=attempt%3===1?30+random(attempt*41+7)*14:7+random(attempt*41+7)*9;
        z=-42+random(attempt*31+13)*17;
      }
      attempt++;
      if (!wheatSiteClear(x,z)) continue;
      const y = terrainHeight(x, z);
      this.plants.push({ x, y, z, scale: .73 + random(index * 67 + 17) * .58, turn: random(index * 23 + 19) * Math.PI * 2, delay: Math.min(.38, millStreamDistance(x, z) * .012) });
      this.wheat.setColorAt(index, new THREE.Color(0xb6bf6b));
    }
    this.wheat.count=this.plants.length;
    this.wheat.visible = false;
    this.group.add(this.wheat);

    const wood = new THREE.MeshStandardMaterial({ color: 0x6c4932, roughness: .9 });
    this.rotor = millRotor(mobile);
    this.rotor.position.set(MILL_SITE.x + MILL_ROTOR_SOCKET.x,
      terrainHeight(MILL_SITE.x,MILL_SITE.z) + MILL_ROTOR_SOCKET.y, MILL_SITE.z + MILL_ROTOR_SOCKET.z);
    this.rotor.visible = false; this.group.add(this.rotor);

    for(const t of STREAM_BRIDGES){
      const site=millStreamPoint(t),before=millStreamPoint(t-.002),after=millStreamPoint(t+.002);
      const bridge=riverAsset('bridge');
      bridge.position.set(site.x,streamSurfaceHeight(t),site.z);
      bridge.rotation.y=Math.atan2(after.x-before.x,after.z-before.z);
      this.bridges.add(bridge);
    }
    this.bridges.visible=false;this.group.add(this.bridges);

    const treeTrunk = new THREE.CylinderGeometry(.24, .38, 2.2, 6);
    const treeCrown = new THREE.IcosahedronGeometry(1, 1);
    const leaf = new THREE.MeshStandardMaterial({ color: 0x5b9d60, roughness: 1 });
    for (const [x, z] of [[-42, 0], [-38, 24], [-20, 40], [2, 43], [28, 36], [43, 18], [43, -6], [-40, -22]]) {
      const tree = new THREE.Group(); tree.position.set(x, terrainHeight(x, z), z);
      const trunk = new THREE.Mesh(treeTrunk, wood); trunk.position.y = 1.1; tree.add(trunk);
      const crown = new THREE.Mesh(treeCrown, leaf); crown.position.y = 3.3; crown.scale.set(1.75, 2.1, 1.75); tree.add(crown);
      this.grove.add(tree);
    }
    this.grove.visible = false; this.group.add(this.grove);

    const blossomMaterial = new THREE.MeshStandardMaterial({ color: 0xf7a8bd, roughness: .92 });
    for (const tree of this.grove.children) {
      for (let i = 0; i < 5; i++) {
        const a = i * 2.4;
        const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(.31, 0), blossomMaterial);
        flower.position.set(tree.position.x + Math.cos(a) * 1.15, tree.position.y + 3.2 + Math.sin(i * 2) * .65, tree.position.z + Math.sin(a) * 1.15);
        this.blossoms.add(flower);
      }
    }
    this.blossoms.visible = false; this.group.add(this.blossoms);

    const paperMaterial = new THREE.MeshStandardMaterial({ color: 0xf7e5b5, roughness: 1, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const page = new THREE.Mesh(new THREE.PlaneGeometry(.58, .7), paperMaterial);
      page.position.set(10 + Math.sin(i * 1.7) * 1.2, 3 + (i % 3) * .28, -8 + i * 4);
      this.archivePages.add(page);
    }
    this.archivePages.visible = false; this.archivePages.position.set(IDEA_DISTRICTS.archive.x-10,0,IDEA_DISTRICTS.archive.z+8); this.group.add(this.archivePages);

    const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xffe4a5, transparent: true, opacity: .78 });
    const light = new THREE.Mesh(new THREE.IcosahedronGeometry(.55, 1), beaconMaterial);
    light.position.set(IDEA_DISTRICTS.observatory.x, terrainHeight(IDEA_DISTRICTS.observatory.x,IDEA_DISTRICTS.observatory.z)+14.52, IDEA_DISTRICTS.observatory.z); this.beacon.add(light);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.35, .07, 5, 24), beaconMaterial);
    halo.position.copy(light.position); halo.rotation.x = Math.PI / 2; this.beacon.add(halo);
    this.beacon.visible = false; this.group.add(this.beacon);

    const birdGeometry = new THREE.ConeGeometry(.35, .7, 3);
    const birdMaterial = new THREE.MeshBasicMaterial({ color: 0xffecb3, side: THREE.DoubleSide });
    for (let i = 0; i < 12; i++) this.birds.add(new THREE.Mesh(birdGeometry, birdMaterial));
    this.birds.visible = false; this.group.add(this.birds);
    scene.add(this.group);
  }

  setLevels(levels: Levels, secret = false, instant = false): void {
    this.levels = levels;
    this.hillside.setLevels(levels);
    this.moat.setLevels(levels,instant||this.reduced.matches);
    this.frontier.setLevels(levels,instant||this.reduced.matches);
    this.districts.setLevels(levels,instant||this.reduced.matches);
    this.waterTarget = levels.river >= 2 ? 1 : 0;
    this.riverWorks.setActive(levels.river>=2,instant||this.reduced.matches);
    this.riverWorks.markers.visible=levels.river===1;
    this.wheatTarget = levels.windmill > 0 ? Math.min(1,Math.max(.08,(levels.windmill-1)/7)) : 0;
    this.rotor.visible = levels.windmill >= 2;
    this.bridges.visible = levels.river >= 2 && levels.roads >= 2;
    this.grove.visible = levels.grove > 0;
    this.blossoms.visible = levels.grove >= 3;
    this.archivePages.visible = levels.archive >= 2;
    this.beacon.visible = levels.observatory >= 3;
    this.secret = secret;
    this.birds.visible = secret;
    if (instant || this.reduced.matches) {
      this.waterFill = this.waterTarget;
      this.wheatGrowth = this.wheatTarget;
      this.groveGrowth = levels.grove === 1 ? .6 : levels.grove === 2 ? .85 : levels.grove >= 3 ? 1 : 0;
      this.rotorGrowth = levels.windmill >= 2 ? 1 : 0;
      this.bridgeGrowth = this.bridges.visible ? 1 : 0;
      this.archiveGrowth = this.archivePages.visible ? 1 : 0;
      this.beaconGrowth = this.beacon.visible ? 1 : 0;
      this.birdGrowth = secret ? 1 : 0;
    }
    this.update(0, 0);
  }

  beginBeat(idea: Idea, position: { x: number; z: number }, failed: boolean, kind: 'arrival' | 'upgrade' | 'max' = 'arrival'): void {
    const oldMaterials = new Set<THREE.Material>();
    const oldGeometries = new Set<THREE.BufferGeometry>();
    this.celebration.traverse(object => { if (object instanceof THREE.Mesh) { oldGeometries.add(object.geometry); if (Array.isArray(object.material)) object.material.forEach(material => oldMaterials.add(material)); else oldMaterials.add(object.material); } });
    oldGeometries.forEach(geometry=>geometry.dispose());
    oldMaterials.forEach(material => material.dispose());
    this.celebration.clear();
    const color = failed ? 0xbca993 : ({ settlers: 0xa9d184, grove: 0x84c58c, workshop: 0xe5aa67, roads: 0xc4b791, walls: 0xc0ad8e, market: 0xe5c070, windmill: 0x78c6c4, river: 0x64cfde, archive: 0xb2a2d4, observatory: 0xffdc91 } satisfies Record<Idea, number>)[idea];
    const y=terrainHeight(position.x,position.z);
    if(kind!=='upgrade'){
      const ringMaterial=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false});
      const ring=new THREE.Mesh(new THREE.RingGeometry(kind==='max'?2:1.5,kind==='max'?2.2:1.7,32),ringMaterial);
      ring.rotation.x=-Math.PI/2;ring.position.set(position.x,y+.14,position.z);ring.userData.ring=true;
      this.celebration.add(ring);
    }
    const count=kind==='max'?18:kind==='upgrade'?10:12;
    const material=new THREE.MeshBasicMaterial({color:kind==='max'?0xffe1a0:color,transparent:true,opacity:.85,depthWrite:false});
    const moteGeometry=new THREE.IcosahedronGeometry(kind==='max'?.22:.16,0);
    for(let i=0;i<count;i++){
      const mote=new THREE.Mesh(moteGeometry,material);
      const angle=i*Math.PI*2/count;
      mote.userData.angle=angle;
      mote.position.set(position.x+Math.cos(angle)*1.4,y+.6,position.z+Math.sin(angle)*1.4);
      this.celebration.add(mote);
    }
    this.group.add(this.celebration);
    this.beat = { started: performance.now() / 1000, failed, kind, x:position.x, y, z:position.z };
  }

  endBeat(): void { this.beat = null; this.celebration.visible = false; }

  update(seconds: number, dt: number): void {
    const immediate = this.reduced.matches;
    this.moat.update(dt,immediate);
    this.hillside.update(seconds, immediate);
    this.frontier.update(dt,immediate);
    this.districts.update(dt,immediate);
    const approach = (value: number, target: number, rate: number) => immediate ? target : value < target ? Math.min(target, value + dt * rate) : Math.max(target, value - dt * rate);
    this.riverWorks.update(dt,immediate);
    this.waterFill = this.riverWorks.flowProgress;
    const wheatReady = this.waterTarget === 0 || this.waterFill > .72;
    if (wheatReady) this.wheatGrowth = approach(this.wheatGrowth, this.wheatTarget, .34);
    const groveLevel=this.levels?.grove??0;
    const groveTarget = groveLevel === 1 ? .6 : groveLevel === 2 ? .85 : groveLevel >= 3 ? 1 : 0;
    this.groveGrowth = approach(this.groveGrowth, groveTarget, .48);
    this.grove.children.forEach((tree, i) => tree.scale.setScalar(Math.max(.01, THREE.MathUtils.clamp(this.groveGrowth * 1.3 - i * .035, 0, 1))));
    this.blossoms.children.forEach((flower, i) => flower.scale.setScalar(Math.max(.01, THREE.MathUtils.clamp((this.groveGrowth - .75) * 5 - i % 5 * .09, 0, 1))));
    this.rotorGrowth = approach(this.rotorGrowth, this.rotor.visible ? 1 : 0, .9);
    this.rotor.scale.setScalar(Math.max(.001, this.rotorGrowth));
    this.bridgeGrowth = approach(this.bridgeGrowth, this.bridges.visible ? 1 : 0, .6);
    this.bridges.children.forEach((bridge,i)=>{bridge.scale.y=Math.max(.001,THREE.MathUtils.clamp(this.bridgeGrowth*1.7-i*.09,0,1));});
    this.pool.visible=this.riverWorks.flowProgress>.98;
    this.archiveGrowth=approach(this.archiveGrowth,this.archivePages.visible?1:0,.85);
    this.archivePages.children.forEach(page=>page.scale.setScalar(Math.max(.001,this.archiveGrowth)));
    this.beaconGrowth=approach(this.beaconGrowth,this.beacon.visible?1:0,.75);
    this.birdGrowth=approach(this.birdGrowth,this.secret?1:0,.65);
    const waterTriangles = Math.floor(this.waterFill * 72);
    this.riverBed.geometry.setDrawRange(0,Math.floor(this.riverWorks.digProgress*72)*6);
    this.riverBed.visible=this.waterFill<.95;
    this.water.geometry.setDrawRange(0, waterTriangles * 6);
    this.environment.setStreamProgress(this.riverWorks.digProgress);
    this.wheat.visible = this.wheatGrowth > .01;
    if (this.wheat.visible) {
      for (let i = 0; i < this.plants.length; i++) {
        const plant = this.plants[i];
        const wave = THREE.MathUtils.clamp((this.wheatGrowth - plant.delay) * 1.7, 0, 1);
        this.dummy.position.set(plant.x, plant.y + .025, plant.z);
        this.dummy.rotation.set(0, plant.turn, Math.sin(seconds * 1.7 + i * .73) * .035);
        this.dummy.scale.set(plant.scale, Math.max(.01, plant.scale * wave), plant.scale);
        this.dummy.updateMatrix(); this.wheat.setMatrixAt(i, this.dummy.matrix);
        const gold = THREE.MathUtils.clamp((wave - .55) * 2.25, 0, 1);
        this.wheat.setColorAt(i, this.plantColor.copy(seedlingColor).lerp(harvestColor, gold));
      }
      this.wheat.instanceMatrix.needsUpdate = true;
      if (this.wheat.instanceColor) this.wheat.instanceColor.needsUpdate = true;
    }
    if (this.rotor.visible && !immediate && this.rotorGrowth > .9 && this.waterFill > .6) this.rotor.rotation.z -= dt * .58;
    if (this.archivePages.visible) this.archivePages.children.forEach((page, i) => { page.position.z = -8 + (((immediate?0:seconds * 1.5) + i * 4) % 16);page.position.y = terrainHeight(page.position.x+this.archivePages.position.x,page.position.z+this.archivePages.position.z)+3 + i % 3 * .28 + (immediate?0:Math.sin(seconds * 2 + i) * .17); if(!immediate)page.rotation.set(Math.sin(seconds + i) * .14, seconds * .4 + i, .1); });
    if (this.beacon.visible) {
      this.beacon.children[0].scale.setScalar(Math.max(.001,this.beaconGrowth*(immediate?1:1+Math.sin(seconds*2)*.07)));
      this.beacon.children[1].scale.setScalar(Math.max(.001,this.beaconGrowth));
      if(!immediate)this.beacon.children[1].rotation.z+=dt*.38;
    }
    if (this.beat) {
      const progress = (performance.now() / 1000 - this.beat.started) / 1.25;
      this.celebration.visible = progress >= 0 && progress < 1;
      if (this.celebration.visible) {
        const {kind,x,y,z,failed}=this.beat;
        const fade=1-THREE.MathUtils.smoothstep(progress,.55,1);
        for(const object of this.celebration.children){
          const mote=object as THREE.Mesh;
          if(mote.userData.ring){
            mote.scale.setScalar(1+progress*(kind==='max'?5:4));
            (mote.material as THREE.MeshBasicMaterial).opacity=fade*.8;
            continue;
          }
          const a=mote.userData.angle as number;
          if(kind==='upgrade'){
            const orbit=a+progress*Math.PI*1.35,radius=2.1+progress*.5;
            mote.position.set(x+Math.cos(orbit)*radius,y+.7+progress*5+Math.sin(a*3)*.28,z+Math.sin(orbit)*radius);
          }else{
            const distance=1.4+progress*(failed?.9:kind==='max'?8:3.2);
            mote.position.set(x+Math.cos(a)*distance,y+.6+progress*(failed?-.25:kind==='max'?4:2),z+Math.sin(a)*distance);
          }
          mote.scale.setScalar(Math.max(.001,Math.sin(Math.min(1,progress)*Math.PI)*1.15));
          (mote.material as THREE.MeshBasicMaterial).opacity=fade*.85;
        }
      }
    }
    if (this.secret) for (let i = 0; i < this.birds.children.length; i++) {
      const bird = this.birds.children[i], angle = seconds * .42 + i * Math.PI * 2 / this.birds.children.length;
      bird.position.set(Math.cos(angle) * (10 + i % 3), terrainHeight(0,0)+20 + (immediate?0:Math.sin(seconds * 1.5 + i) * 1.8), Math.sin(angle) * (10 + i % 3));
      bird.rotation.set(Math.PI / 2, 0, -angle);
      bird.scale.setScalar(Math.max(.001,this.birdGrowth));
    }
  }

  dispose(): void {
    this.hillside.dispose();
    this.moat.dispose();
    this.frontier.dispose();
    this.districts.dispose();
    this.riverWorks.dispose();
    this.group.removeFromParent();
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
        else object.material.dispose();
      }
    });
  }
}
