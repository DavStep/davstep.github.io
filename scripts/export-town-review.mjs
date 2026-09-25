// Run with: node --import tsx scripts/export-town-review.mjs [--mobile]
// Export actual runtime geometry for neutral Blender composition review.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const mobile = process.argv.includes('--mobile');
const gameMode = process.argv.includes('--game');
const mountReview = process.argv.includes('--mount');
const lifeReview = process.argv.includes('--life');
const parachuteReview = process.argv.includes('--parachute');
const moatReview = process.argv.includes('--moat');
const outskirtsReview = process.argv.includes('--outskirts');
const frontierReview = process.argv.includes('--frontier');
const districtsReview = process.argv.includes('--districts');
const marketOnly = process.argv.includes('--market-only');
const roadsReview = process.argv.includes('--roads');
const riverSecondsArg=process.argv.find(a=>a.startsWith('--river-seconds='));
const riverSeconds=riverSecondsArg?Number(riverSecondsArg.split('=')[1]):null;
const turnArg = process.argv.find(arg=>arg.startsWith('--turn='));
const turn = turnArg ? Number(turnArg.slice(7)) : 10;
if(!Number.isInteger(turn)||turn<0||turn>10)throw new Error('--turn must be 0 through 10');
globalThis.matchMedia = query => ({ matches: query.includes('max-width') && mobile, addEventListener() {}, removeEventListener() {} });
const root = new URL('../', import.meta.url);
const inputs = ['scene', 'landmarks', 'environment', 'materials', 'residents', 'town-plan', 'model', 'wall-layout', 'contact-shadows', 'sky', 'rain'];
const sourceFiles = new Map(await Promise.all(inputs.map(async name => [name, await readFile(new URL(`src/town/${name}.ts`, root), 'utf8')])));
const sceneUrl = new URL('src/town/scene.ts', root);
const source = sourceFiles.get('scene');
// Export the private factory only in an in-memory audit copy. Resolve imports
// before loading the data URL so runtime code and geometry stay authoritative.
const compiled = ts.transpileModule(source + '\nexport { building };', {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/from (['"])([^'"]+)\1/g, (_, quote, name) => {
  const resolved = name.startsWith('.') ? new URL(name + '.ts', sceneUrl).href : import.meta.resolve(name);
  return `from ${quote}${resolved}${quote}`;
});
const { building, TownScene } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const { PLOTS, townAt, createSave } = await import(new URL('src/town/model.ts', root));
const { Environment, terrainHeight } = await import(new URL('src/town/environment.ts', root));
const { ContactShadows } = await import(new URL('src/town/contact-shadows.ts', root));
const { Residents } = await import(new URL('src/town/residents.ts', root));
const { TownSky } = await import(new URL('src/town/sky.ts', root));
const { Rain } = await import(new URL('src/town/rain.ts', root));
const { MAT } = await import(new URL('src/town/materials.ts', root));
const materialNames = new Map(Object.entries(MAT).map(([key, value]) => [value, key]));


const { IDEAS, evaluate } = await import(new URL('src/town/game.ts',root));
const { snapshotForGame } = await import(new URL('src/town/game-snapshot.ts',root));
const { GameScenery } = await import(new URL('src/town/game-scenery.ts',root));
const levels=evaluate(marketOnly?['market']:parachuteReview?['settlers','grove','workshop']:IDEAS.slice(0,turn)).levels;
if(parachuteReview)levels.workshop=1;
const snapshot=gameMode?snapshotForGame(levels):townAt(createSave(0),30*60000);
const scene=new THREE.Scene();
const env=new Environment(scene,mobile,gameMode);
const town=Object.assign(Object.create(TownScene.prototype),{
 mobile,gameMode,land:new THREE.Group(),structures:new THREE.Group(),roads:new THREE.Group(),walls:new THREE.Group(),
 treeObstacles:[],pickBoxes:new Map(),contactShadows:{setBuildings(){}}
});
town.createDecor();town.buildStructures(snapshot.plots.filter(plot=>!parachuteReview||plot.project!=='sandship'));town.buildRoads(snapshot);town.buildWalls(snapshot);
scene.add(town.land,town.structures,town.roads,town.walls);
if(parachuteReview){
 const {ParachuteArrival}=await import(new URL('src/town/parachute-arrival.ts',root));
 const ship=building(snapshot.plots.find(plot=>plot.project==='sandship'),gameMode);
 scene.add(ship);new ParachuteArrival(ship,mobile).update(.35);
}
const residents=new Residents(scene);residents.update(snapshot);
if(gameMode){
 const scenery=new GameScenery(scene,mobile,env);
 if(riverSeconds!==null){
  scenery.setLevels({...levels,river:1},false,true);
  scenery.setLevels({...levels,river:2},false,false);
  scenery.update(riverSeconds,riverSeconds);
 }else scenery.setLevels(levels,false,true);
}
scene.updateMatrixWorld(true);
const geometries=[],materials=[],objects=[],geometryIds=new Map(),materialIds=new Map();
const materialId=material=>{
 if(materialIds.has(material))return materialIds.get(material);
 const id=materials.length;materialIds.set(material,id);
 materials.push({name:materialNames.get(material)||material.name||'surface_'+id,color:/town-(river|pond)/.test(material.customProgramCacheKey?.()??'')?[.035,.31,.43]:material.color?.toArray()||[1,1,1],
  roughness:material.roughness??.95,emissive:material.emissive?.toArray()||[0,0,0],emissiveIntensity:material.emissiveIntensity??0,
  vertexColors:!!material.vertexColors});return id;
};
scene.traverseVisible(o=>{
 if(!o.isMesh||Array.isArray(o.material)||!o.visible||o.geometry.drawRange.count===0)return;
 if(!geometryIds.has(o.geometry)){
  const geo=o.geometry,id=geometries.length;geometryIds.set(geo,id);
  geometries.push({positions:Array.from(geo.attributes.position.array),indices:Number.isFinite(geo.drawRange.count)?Array.from(geo.index?.array??Array.from({length:geo.attributes.position.count},(_,i)=>i)).slice(geo.drawRange.start,geo.drawRange.start+geo.drawRange.count):geo.index?Array.from(geo.index.array):null,
   colors:geo.attributes.color?Array.from(geo.attributes.color.array):null});
 }
 const geometry=geometryIds.get(o.geometry),material=materialId(o.material),matrix=new THREE.Matrix4(),color=new THREE.Color();
 if(o.isInstancedMesh){
  for(let i=0;i<o.count;i++){
   o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);
   if(o.instanceColor)o.getColorAt(i,color);else color.set(0xffffff);
   const p=new THREE.Vector3().setFromMatrixPosition(matrix);
   if(Math.hypot(p.x,p.z)>(frontierReview||districtsReview?260:outskirtsReview?145:lifeReview?110:78))continue;
   objects.push({name:o.name||'instance',geometry,material,matrix:matrix.toArray(),color:color.toArray()});
  }
 }else objects.push({name:o.name||'mesh',geometry,material,matrix:o.matrixWorld.toArray(),color:[1,1,1]});
});
const reviewFolder=districtsReview?'art/reviews/districts/':frontierReview?'art/reviews/frontier/':riverSeconds!==null?'art/reviews/river/':outskirtsReview?'art/reviews/outskirts/':roadsReview?'art/reviews/roads/':moatReview?'art/reviews/moat/':parachuteReview?'art/reviews/parachute/':lifeReview?'art/reviews/living-world/':mountReview?'art/reviews/castle-mount/':'art/reviews/world/';
const path=new URL(reviewFolder+(marketOnly?'market-first.json':'runtime-geometry.json'),root);
await mkdir(new URL(reviewFolder,root),{recursive:true});
await writeFile(path,JSON.stringify({mobile,gameMode,turn,ageMinutes:30,geometries,materials,objects}));
console.log(JSON.stringify({geometries:geometries.length,materials:materials.length,objects:objects.length,output:fileURLToPath(path)}));
