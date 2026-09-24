// Run with: node --import tsx scripts/audit-town-assets.mjs [--mobile] [--production]
// Inspects existing procedural geometry without a renderer or changing source files.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const mobile = process.argv.includes('--mobile');
globalThis.matchMedia = query => ({ matches: query.includes('max-width') && mobile, addEventListener() {}, removeEventListener() {} });
const root = new URL('../', import.meta.url);
const inputs = ['scene', 'landmarks', 'environment', 'materials', 'residents', 'town-plan', 'model', 'wall-layout', 'contact-shadows', 'sky', 'rain', 'cottages', 'castle', 'civic', 'nature', 'props', 'authored-landmarks', 'nature-placement', 'prop-placement', 'paths'];
const sourceFiles = new Map(await Promise.all(inputs.map(async name => [name, await readFile(new URL(`src/town/${name}.ts`, root), 'utf8')])));
const generatedFiles = new Map(await Promise.all(['cottages','castle','civic','nature','props','landmarks'].map(async name => [name, await readFile(new URL(`src/town/generated/${name}.json`, root), 'utf8')])));
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

function inspect(object) {
  object.updateMatrixWorld(true);
  let meshes = 0, instances = 0, triangles = 0;
  const materials = new Set(), geometries = new Set();
  object.traverse(node => {
    if (!node.isMesh) return;
    meshes++;
    const count = node.isInstancedMesh ? node.count : node.geometry.isInstancedBufferGeometry ? node.geometry.instanceCount : 1;
    instances += count;
    geometries.add(node.geometry);
    triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 * count;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(materialNames.get(material) ?? material.type);
  });
  const bounds = new THREE.Box3().setFromObject(object);
  const rounded = vector => vector.toArray().map(n => Number(n.toFixed(3)));
  return { meshes, instances, triangles, geometries: geometries.size, materials: [...materials].sort(), bounds: bounds.isEmpty() ? null : { min: rounded(bounds.min), max: rounded(bounds.max) } };
}

const assets = [];
for (const plot of PLOTS) {
  const stages = [];
  for (let stage = plot.kind === 'project' ? 3 : plot.kind === 'castle' ? 2 : 1; stage <= 6; stage++) {
    stages.push({ stage, ...inspect(building({ ...plot, stage, renovation: 0 })) });
  }
  assets.push({ id: plot.id, kind: plot.kind, project: plot.project, variant: plot.variant ?? 0, x: plot.x, z: plot.z, stages });
}

const environment = new Environment(new THREE.Scene(), mobile);
const decor = Object.assign(Object.create(TownScene.prototype), { mobile, land: new THREE.Group(), treeObstacles: [] });
decor.createDecor();
const snapshot = townAt(createSave(0, 12345), 50 * 60000);
const contactsScene = new THREE.Scene();
const contactShadows = new ContactShadows(contactsScene, terrainHeight);
contactShadows.setTrees([...environment.trees, ...decor.treeObstacles]);
const town = Object.assign(Object.create(TownScene.prototype), {
  mobile, structures: new THREE.Group(), roads: new THREE.Group(), walls: new THREE.Group(), pickBoxes: new Map(), contactShadows,
});
town.buildStructures(snapshot.plots);
town.buildRoads(snapshot);
town.buildWalls(snapshot);
const residents = new Residents(new THREE.Scene());
residents.update(snapshot);
const skyScene = new THREE.Scene(), rainScene = new THREE.Scene();
new TownSky(skyScene);
new Rain(rainScene, mobile);

for (const [name, original] of sourceFiles) {
  if (await readFile(new URL(`src/town/${name}.ts`, root), 'utf8') !== original) throw new Error(`${name}.ts changed during the audit; rerun against a stable source snapshot.`);
}
const hashes = Object.fromEntries([...sourceFiles].map(([name, text]) => [name + '.ts', createHash('sha256').update(text).digest('hex')]));
for (const [name, original] of generatedFiles) {
  if (await readFile(new URL(`src/town/generated/${name}.json`, root), 'utf8') !== original) throw new Error(`${name}.json changed during the audit`);
  hashes[`generated/${name}.json`] = createHash('sha256').update(original).digest('hex');
}
const report = {
  scope: 'Living Town authored and procedural assets; source geometry only, no shader displacement, GPU, shadow-pass, culling, or artistic validation',
  mobile, sourceHashes: hashes, plots: PLOTS.length, assets,
  matureScene: { ageMinutes: 50, seed: 12345, structures: inspect(town.structures), roads: inspect(town.roads), walls: inspect(town.walls), environment: inspect(environment.group), decor: inspect(decor.land), residents: inspect(residents.group), contactShadows: inspect(contactsScene), forestTrees: environment.trees.length, townTrees: decor.treeObstacles.length },
  renderSupport: { sky: inspect(skyScene), rainWhenEnabled: inspect(rainScene) },
};
const output = new URL(`docs/art-direction/geometry-${process.argv.includes('--production') ? 'production' : 'audit'}-${mobile ? 'mobile' : 'desktop'}.json`, root);
await mkdir(new URL('docs/art-direction/', root), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: fileURLToPath(output), plots: report.plots, matureScene: report.matureScene }, null, 2));
