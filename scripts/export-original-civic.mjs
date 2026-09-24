// Capture the six pre-integration procedural civic buildings for Blender review.
// The source factory is compiled in memory, so scene.ts remains untouched.
import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';
import { MAT } from '../src/town/materials.ts';

const source = await readFile(new URL('../src/town/scene.ts', import.meta.url), 'utf8');
const from = source.indexOf('const boxGeometry');
const to = source.indexOf('export class TownScene');
if (from < 0 || to < from) throw new Error('Could not isolate the original building factory');
if (source.slice(from, to).includes('civicBuilding(')) {
  throw new Error('The civic factory has already been replaced; use the original meshes embedded in civic.blend');
}
const header = `import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAT } from '../src/town/materials.ts';
const MOBILE = false;
`;
const compiled = ts.transpileModule(header + source.slice(from, to) + '\nexport { building };', {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/from (['"])([^'"]+)\1/g, (_, quote, name) =>
  `from ${quote}${import.meta.resolve(name)}${quote}`);
const { building } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const materials = new Map(Object.entries(MAT).map(([key, value]) => [value, key]));
const originals = [];
for (const [index, kind] of ['market', 'tavern', 'forge', 'mill', 'guild', 'post'].entries()) {
  const group = building({ id: kind, kind, x: 0, z: 0, stage: 6,
    variant: 0, renovation: 0, start: 0, step: 1 });
  group.updateMatrixWorld(true);
  const meshes = [];
  group.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
    meshes.push({ material: materials.get(node.material) ?? 'wood',
      positions: Array.from(geometry.getAttribute('position').array),
      indices: geometry.index ? Array.from(geometry.index.array) : null });
    geometry.dispose();
  });
  originals.push({ kind, offset: index * 12, meshes });
}
await writeFile('/tmp/town-original-civic.json', JSON.stringify(originals));
console.log(originals.map(item => `${item.kind}: ${item.meshes.length} source meshes`).join('\n'));
