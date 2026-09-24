import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { PlotState } from './model';
import { MAT, type Mat } from './materials';

const BOX=new RoundedBoxGeometry(1,1,1,2,.09);
const ROCK=new THREE.IcosahedronGeometry(1,0);
const ROUND=new THREE.IcosahedronGeometry(1,1);
const GEM=new THREE.OctahedronGeometry(1,0);
export const LANDMARK_SHARED_GEOMETRIES=new Set<THREE.BufferGeometry>([BOX,ROCK,ROUND,GEM]);

function block(g:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:Mat,rz=0){
  const m=new THREE.Mesh(BOX,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.rotation.z=rz;m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
function stone(g:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:Mat=MAT.stone){
  const m=new THREE.Mesh(ROCK,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.rotation.set(.07,x*.73,z*.34);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
function round(g:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:Mat){
  const m=new THREE.Mesh(ROUND,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
function gem(g:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:Mat){
  const m=new THREE.Mesh(GEM,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;g.add(m);return m;
}
function rod(g:THREE.Group,a:[number,number,number],b:[number,number,number],r:number,mat:Mat,sides=7){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),sides),mat);
  m.position.copy(from.add(to).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());m.castShadow=true;g.add(m);return m;
}
function hoop(g:THREE.Group,x:number,y:number,z:number,r:number,tube:number,mat:Mat){
  const m=new THREE.Mesh(new THREE.TorusGeometry(r,tube,5,24),mat);m.position.set(x,y,z);m.rotation.x=Math.PI/2;m.castShadow=true;g.add(m);return m;
}
function wheel(g:THREE.Group,x:number,y:number,z:number,r:number,mat:Mat){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.22,10),mat);m.rotation.z=Math.PI/2;m.position.set(x,y,z);m.castShadow=true;g.add(m);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(r*.2,r*.2,.25,8),MAT.gold);hub.rotation.z=Math.PI/2;hub.position.set(x,y,z);g.add(hub);
}
function pennant(g:THREE.Group,x:number,y:number,z:number,mat:Mat){
  rod(g,[x,y,z],[x,y+2.2,z],.075,MAT.woodDark);
  block(g,x+.55,y+1.77,z,1.05,.52,.08,mat);
}
function base(g:THREE.Group,mat:Mat=MAT.stoneDark){block(g,0,.24,0,9.6,.42,8.6,mat);}

function outpost(g:THREE.Group,stage:number){
  base(g,MAT.earth);
  // A protected survivor exchange: counter, patched striped canopy, and lookout.
  for(const x of [-3.5,3.5])for(const z of [-2.6,2.6])block(g,x,2.2,z,.3,3.9,.32,MAT.woodDark);
  block(g,0,4.14,0,8,.3,6.5,MAT.olive);
  for(let i=0;i<7;i++)block(g,-3.25+i*1.08,4.2,3.04,.92,.17,.82,i%2?MAT.plasterIvory:MAT.red);
  block(g,0,1.22,3,6.2,1.6,.86,MAT.woodDark);
  block(g,0,2.08,3,6.6,.24,1.06,MAT.woodLight);
  for(const x of [-2.4,-1.25,1.6,2.7])block(g,x,2.39,3,.6,.45,.62,x<0?MAT.olive:MAT.gold);
  block(g,-3.65,1.05,-3.5,1.15,1.4,1.1,MAT.woodLight);
  block(g,3.6,.88,-3.55,1.25,1.15,1.2,MAT.woodLight);
  if(stage>=4){
    for(const x of [-3.8,3.8]){
      block(g,x,3.35,-3.3,.42,6.2,.43,MAT.woodDark);
      block(g,x,6.48,-3.3,1.75,.22,1.8,MAT.woodDark);
    }
    rod(g,[-3.8,6.5,-3.3],[3.8,6.5,-3.3],.14,MAT.woodLight);
    block(g,0,5.9,-3.4,3.1,1.13,.16,MAT.olive);
  }
  if(stage>=5){
    for(const x of [-2.7,2.7]){
      block(g,x,7.1,-3.3,.22,1.25,.22,MAT.woodDark);
      block(g,x,7.66,-3.3,1.1,.13,.38,MAT.woodDark);
    }
    pennant(g,2.8,6.5,-3.4,MAT.red);
    for(let i=0;i<3;i++)round(g,-2.2+i*.9,2.62,3.2,.27,.19,.27,MAT.gold);
  }
  if(stage>=6){
    for(let i=0;i<4;i++)block(g,-3.5+i*.9,.65,-4.13,.68,.7,.78,MAT.iron);
    rod(g,[0,6.5,-3.3],[0,9.7,-3.3],.12,MAT.iron);
    round(g,0,9.82,-3.3,.44,.34,.44,MAT.red);
    for(const x of [-3.55,3.55])block(g,x,1.25,4.1,.25,2.1,.26,MAT.woodDark);
  }
}

function sandship(g:THREE.Group,stage:number){
  base(g,MAT.sand);
  // The game is a traveling factory. The ship hovers over a powered dock.
  for(const x of [-3.3,3.3]){
    block(g,x,1.3,0,.62,2.1,5.7,MAT.iron);
    block(g,x,2.58,0,1.08,.35,5.9,MAT.copper);
  }
  for(const z of [-2,0,2]){
    block(g,0,.65,z,5.8,.23,.52,MAT.iron);
    block(g,0,.79,z,4.5,.13,.16,MAT.cyan);
  }
  stone(g,0,3.76,-.2,4.1,1.05,2.25,MAT.copper);
  block(g,0,4.8,-.2,7.7,.37,3.6,MAT.iron);
  block(g,0,4.52,-.2,6.5,.15,2.5,MAT.cyan);
  // The pointed bow and twin outriggers read as a flying ship from the town camera.
  const bow=new THREE.Mesh(new THREE.ConeGeometry(1.76,2.7,4),MAT.copper);
  bow.rotation.x=Math.PI/2;bow.rotation.y=Math.PI/4;bow.position.set(0,4.77,2.55);bow.scale.x=1.18;bow.castShadow=true;g.add(bow);
  block(g,0,4.98,3.38,1.1,.2,1.4,MAT.iron);
  for(const x of [-3.32,3.32]){
    rod(g,[x,5.02,-1.8],[x,5.02,1.25],.12,MAT.copper);
    for(const z of [-1.6,0,1.1])rod(g,[x,4.9,z],[x,5.54,z],.075,MAT.iron);
    block(g,x,4.4,2.1,.76,.3,1.46,MAT.copper);
  }
  for(const x of [-2.75,2.75])block(g,x,5.2,-.2,.42,.7,3.45,MAT.copper);
  if(stage>=4){
    for(const x of [-2.5,0,2.5]){
      block(g,x,5.58,-.5,2,.95,2.25,MAT.iron);
      block(g,x,6.16,-.5,2.2,.16,2.45,MAT.copper);
      block(g,x,5.65,.72,1.45,.11,.1,MAT.cyan);
    }
    rod(g,[-3.35,3.14,1.3],[-3.35,5.12,1.3],.14,MAT.copper);
    rod(g,[3.35,3.14,1.3],[3.35,5.12,1.3],.14,MAT.copper);
    for(const x of [-2.35,2.35]){
      block(g,x,5.42,1.1,.85,.83,.8,MAT.woodDark);
      block(g,x,5.9,1.1,.98,.13,.95,MAT.copper);
    }
  }
  if(stage>=5){
    for(const x of [-2.7,2.7]){
      const stack=new THREE.Mesh(new THREE.CylinderGeometry(.47,.65,2.8,8),MAT.iron);
      stack.position.set(x,7.4,-1.25);stack.castShadow=true;g.add(stack);
      hoop(g,x,8.88,-1.25,.5,.1,MAT.copper);
      round(g,x,9.42,-1.25,.52,.26,.47,MAT.plasterIvory);
    }
    for(const z of [-1.1,.9])block(g,0,7.06,z,1.8,1.95,1.65,MAT.copper);
  }
  if(stage>=6){
    for(const x of [-3.95,3.95]){
      const turbine=new THREE.Mesh(new THREE.CylinderGeometry(1.04,1.04,.42,12),MAT.iron);
      turbine.rotation.z=Math.PI/2;turbine.position.set(x,4.05,-.3);turbine.castShadow=true;g.add(turbine);
      hoop(g,x+(x>0?.25:-.25),4.05,-.3,.69,.11,MAT.cyan);
    }
    rod(g,[0,7.55,0],[0,10.1,0],.12,MAT.iron);
    block(g,.8,9.7,0,1.5,.38,.12,MAT.red);
    for(const x of [-3.5,3.5]){
      rod(g,[x,4.65,-2.7],[x,5.35,-2.7],.12,MAT.iron);
      round(g,x,5.51,-2.7,.28,.3,.28,MAT.cyan);
    }
  }
}

function battle(g:THREE.Group,stage:number){
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(4.6,4.8,.36,16),MAT.stoneDark);floor.position.y=.27;floor.receiveShadow=true;g.add(floor);
  hoop(g,0,.54,0,4.04,.28,MAT.sand);
  hoop(g,0,.58,0,2.6,.12,MAT.red);
  // Oversized playing card carries the duck archer motif of the game art.
  block(g,0,4.15,-1.55,3.7,5.95,.58,MAT.ink);
  block(g,0,4.15,-1.19,3.28,5.52,.13,MAT.plasterIvory);
  round(g,0,4.42,-1.05,.95,1.04,.25,MAT.emerald);
  round(g,0,5.07,-.9,.75,.3,.22,MAT.gold);
  block(g,.27,4.13,-.77,1.08,.21,.54,MAT.gold,0.08);
  // Bow and arrow give the card's duck its game-specific silhouette.
  rod(g,[.68,3.35,-.68],[1.54,5.1,-.68],.09,MAT.woodDark);
  rod(g,[.68,3.35,-.68],[1.07,4.15,-.68],.045,MAT.gold);
  rod(g,[1.54,5.1,-.68],[1.07,4.15,-.68],.045,MAT.gold);
  rod(g,[.36,4.12,-.56],[1.8,4.12,-.56],.055,MAT.iron);
  gem(g,1.84,4.12,-.56,.18,.18,.38,MAT.iron);
  round(g,-.3,4.56,-.76,.11,.14,.09,MAT.ink);
  block(g,0,2.35,-1,1.35,.43,.28,MAT.red);
  for(const x of [-3.8,3.8])pennant(g,x,.6,-2.65,x<0?MAT.red:MAT.blue);
  if(stage>=4){
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,x=Math.cos(a)*4.15,z=Math.sin(a)*4.15;
      block(g,x,1.12,z,.62,1.2,.62,MAT.stone);
      round(g,x,1.85,z,.39,.26,.39,i%2?MAT.red:MAT.blue);
    }
  }
  if(stage>=5){
    rod(g,[-2.3,3.3,-2.4],[2.3,7.2,-2.4],.13,MAT.iron);
    rod(g,[2.3,3.3,-2.4],[-2.3,7.2,-2.4],.13,MAT.iron);
    for(const x of [-2.3,2.3])gem(g,x,7.22,-2.4,.22,.47,.15,MAT.gold);
    block(g,0,7.8,-2.5,4.9,.37,.7,MAT.stoneDark);
  }
  if(stage>=6){
    for(const x of [-3,3]){
      block(g,x,.97,2.68,1.45,.8,1.35,MAT.woodDark);
      block(g,x,1.48,2.68,1.7,.19,1.55,x<0?MAT.red:MAT.blue);
    }
    gem(g,0,8.3,-2.55,.45,.61,.45,MAT.gold);
  }
}

function wizard(g:THREE.Group,stage:number){
  const dais=new THREE.Mesh(new THREE.CylinderGeometry(4.55,4.75,.56,12),MAT.stoneDark);dais.position.y=.32;dais.receiveShadow=true;g.add(dais);
  hoop(g,0,.65,0,3.85,.13,MAT.magic);
  const height=stage>=6?9.2:stage>=5?7.7:stage>=4?6.1:4.9;
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(1.68,2.05,height,10),MAT.stone);shaft.position.set(-1.25,height*.5+.61,-.95);shaft.castShadow=true;shaft.receiveShadow=true;g.add(shaft);
  for(const y of [2.45,4.45,6.45,8.45])if(y<height+.25)hoop(g,-1.25,y,-.95,1.76,.12,MAT.violet);
  for(const y of [2.5,4.5,6.5])if(y<height+.2)block(g,-1.25,y,.89,.42,.88,.14,MAT.magic);
  const crystal=gem(g,-1.25,height+1.35,-.95,1.15,1.82,1.15,MAT.magic);crystal.rotation.y=.4;
  for(const x of [-3.3,3.3]){
    rod(g,[x,.58,2.4],[x,3.2,2.4],.22,MAT.stoneDark);
    gem(g,x,3.36,2.4,.37,.58,.37,MAT.magic);
  }
  if(stage>=4){
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;gem(g,Math.cos(a)*3,.83,Math.sin(a)*3,.27,.48,.27,MAT.violet);
    }
    block(g,2.15,1.28,-.7,2.8,1.62,2.65,MAT.violet);
    block(g,2.15,2.22,-.7,3.3,.24,3,MAT.roofDark);
  }
  if(stage>=5){
    hoop(g,-1.25,height+1.36,-.95,1.85,.09,MAT.gold);
    for(const x of [-1,1])gem(g,-1.25+x*1.55,height+1.7,-.95,.32,.47,.32,MAT.magic);
    rod(g,[1.1,2.34,-1.8],[3.15,4.2,-1.8],.11,MAT.woodDark);
    round(g,3.15,4.2,-1.8,.47,.47,.47,MAT.magic);
  }
  if(stage>=6){
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;stone(g,Math.cos(a)*4,.8,Math.sin(a)*4,.7,.75,.7,MAT.stone);
    }
    gem(g,-1.25,height+3.55,-.95,.31,.52,.31,MAT.gold);
  }
}

function shmixel(g:THREE.Group,stage:number){
  base(g,MAT.ink);
  // A giant pixel canvas displays a potion made from raised color tiles.
  block(g,0,4.04,-1.25,6.5,6.7,.66,MAT.woodDark);
  block(g,0,4.05,-.85,5.95,6.15,.12,MAT.ink);
  const sprite=[
    '...YY...','..YPYY..','..PPP...','.PPWPP..','PPPPPPPP','PVPPPPVP','PPPPPPPP','.PPPPPP.','..BBBB..',
  ];
  const palette:Record<string,Mat>={Y:MAT.gold,P:MAT.violet,V:MAT.purple,W:MAT.white,B:MAT.blue};
  for(let row=0;row<sprite.length;row++)for(let column=0;column<8;column++){
    const symbol=sprite[row]?.[column]??'.';if(symbol==='.'||stage===3&&row>4||stage===4&&row>6)continue;
    block(g,(column-3.5)*.62,6.47-row*.59,-.68,.57,.55,.2,palette[symbol]);
  }
  for(const x of [-2.8,2.8])block(g,x,7.65,-1.2,.35,1.15,.42,MAT.woodLight);
  block(g,0,7.94,-1.2,6.75,.28,.75,MAT.roofBlue);
  for(const x of [-3.7,3.7]){
    block(g,x,1.8,1.8,.34,3.1,.34,MAT.woodDark);
    block(g,x,3.42,1.8,1.1,.24,1.1,MAT.gold);
  }
  if(stage>=4){
    block(g,-2.15,.9,2.75,1.8,.32,1.5,MAT.woodLight);
    for(let i=0;i<5;i++)block(g,-2.75+i*.31,1.16,2.8,.25,.23,.25,[MAT.blue,MAT.purple,MAT.red,MAT.gold,MAT.emerald][i]);
  }
  if(stage>=5){
    rod(g,[2.25,.82,3.25],[3.53,5.13,3.25],.19,MAT.woodLight);
    gem(g,3.53,5.35,3.25,.34,.53,.34,MAT.violet);
    for(const [i,x] of [-1.3,0,1.3].entries())block(g,x,.62,3.2,.9,.78,.88,[MAT.blue,MAT.gold,MAT.purple][i]);
  }
  if(stage>=6){
    for(let i=0;i<6;i++){
      const a=i*2.399;gem(g,Math.cos(a)*4.1,1.08+(i%3)*.52,Math.sin(a)*3.6,.32,.42,.32,[MAT.blue,MAT.purple,MAT.gold][i%3]);
    }
    block(g,0,8.85,-1.2,3.1,.37,.55,MAT.gold);
  }
}

function dwarves(g:THREE.Group,stage:number){
  base(g,MAT.earth);
  for(const [x,y,z,s] of [[-3,2.3,-1.2,2.7],[3,2.1,-1.4,2.6],[0,3.2,-3,3.4],[-4,.7,1.1,1.15],[4,.7,1.1,1.1]] as const)stone(g,x,y,z,s,s*.9,s*.85,MAT.stoneDark);
  // Chunky timber support frames a dark tunnel; rails lead out to the cart.
  block(g,0,2.18,-.45,4.35,3.7,.3,MAT.ink);
  for(const x of [-2.28,2.28])block(g,x,2.15,-.07,.5,3.95,.62,MAT.woodDark);
  block(g,0,4.17,-.07,5.05,.58,.67,MAT.woodLight);
  for(const x of [-.47,.47])block(g,x,.69,2.1,.13,.2,4.9,MAT.iron);
  for(const z of [.35,1.1,1.85,2.6,3.35,4.1])block(g,0,.65,z,1.55,.14,.28,MAT.woodDark);
  for(const x of [-3.4,3.4]){
    block(g,x,2.15,.4,.18,3.1,.18,MAT.woodDark);
    round(g,x,3.72,.4,.29,.34,.28,MAT.gold);
  }
  if(stage>=4){
    block(g,0,1.36,2.85,2.9,1.8,2.2,MAT.copper);
    block(g,0,2.35,2.85,3.15,.33,2.42,MAT.woodLight);
    for(const x of [-1.4,1.4])for(const z of [1.92,3.72])wheel(g,x,.76,z,.48,MAT.iron);
    for(let i=0;i<3;i++)gem(g,-.8+i*.72,2.68,2.7,.31,.52,.31,i===1?MAT.gold:MAT.cyan);
  }
  if(stage>=5){
    for(const side of [-1,1]){
      gem(g,side*3.55,3.28,-.45,.5,.8,.52,side<0?MAT.gold:MAT.cyan);
      rod(g,[side*3.76,.68,-2.7],[side*3.76,6.58,-2.7],.19,MAT.woodDark);
    }
    rod(g,[-3.76,6.58,-2.7],[3.76,6.58,-2.7],.22,MAT.woodDark);
    block(g,0,6.84,-2.7,3.2,.33,.78,MAT.roofDark);
  }
  if(stage>=6){
    rod(g,[2.6,6.58,-2.7],[2.6,7.65,1.8],.17,MAT.iron);
    rod(g,[2.6,7.65,1.8],[2.6,4.42,1.8],.1,MAT.iron);
    block(g,2.6,4.2,1.8,.63,.44,.52,MAT.copper);
    for(let i=0;i<4;i++)gem(g,-3.8+i*.5,.84,3.2,.25,.4,.25,i%2?MAT.gold:MAT.cyan);
  }
}

export function landmarkBuilding(plot:PlotState):THREE.Group{
  const g=new THREE.Group();g.position.set(plot.x,0,plot.z);
  switch(plot.project){
    case 'outpost':outpost(g,plot.stage);break;
    case 'sandship':sandship(g,plot.stage);break;
    case 'battle':battle(g,plot.stage);break;
    case 'wizard':wizard(g,plot.stage);break;
    case 'shmixel':shmixel(g,plot.stage);break;
    case 'dwarves':dwarves(g,plot.stage);break;
  }
  return g;
}
