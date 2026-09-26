import * as THREE from 'three';

// Colors and soft, low-contrast surface marks follow the painted timber and
// matte stone treatment in Drunk Dwarves. The marks use world coordinates, so
// batched and instanced geometry shares one continuous material.
export const C = {
  grass: 0x85ae64, grassDark: 0x58784a, leaf: 0x64844b, earth: 0x9c805e, path: 0xd5bb84,
  wood: 0x946345, woodLight: 0xb68458, woodDark: 0x704a37,
  stone: 0xbab4a4, stoneDark: 0x858b84, plaster: 0xf0d7ac,
  roof: 0xd76b4d, roofDark: 0x9e6345, roofBlue: 0x5e95ad,
  gold: 0xf2ca63, window: 0x50433d, lamp: 0xffd390,
} as const;

export type Mat = THREE.Material;
const make = (color:number, roughness=.9, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});

// Painted marks fade to their mean tone once a feature shrinks toward a
// pixel, so distant walls and roofs stay calm instead of shimmering. The
// sin-free hash keeps its precision at large world coordinates and on
// mediump-leaning mobile GPUs.
const PAINTED_CHUNK=`
  float townHash(highp vec3 p){
    p=fract(p*.1031);
    p+=dot(p,p.zyx+31.32);
    return fract((p.x+p.y)*p.z);
  }
  float townNoise(highp vec3 p){highp vec3 i=floor(p);vec3 f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(mix(townHash(i),townHash(i+vec3(1,0,0)),f.x),
                   mix(townHash(i+vec3(0,1,0)),townHash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(townHash(i+vec3(0,0,1)),townHash(i+vec3(1,0,1)),f.x),
                   mix(townHash(i+vec3(0,1,1)),townHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float townFade(highp vec3 p){return 1.0-smoothstep(.35,.9,length(fwidth(p)));}
`;

function painted(material:THREE.MeshStandardMaterial, surface:'timber'|'stone'|'roof'|'plaster'|'ground'){
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.vertexShader='varying highp vec3 vTownSurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec4 surfacePosition=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        surfacePosition=instanceMatrix*surfacePosition;
      #endif
      vTownSurface=(modelMatrix*surfacePosition).xyz;
    `);
    shader.fragmentShader='varying highp vec3 vTownSurface;\n'+PAINTED_CHUNK+shader.fragmentShader;
    // Each factor mixes toward its mean (noise averages .5) as its lattice
    // frequency approaches the pixel footprint.
    const treatment={
      timber:`highp vec3 grainP=vTownSurface*vec3(3.8,.18,3.8);
        float grain=townNoise(grainP);
        float grainLine=smoothstep(.68,.82,grain);
        diffuseColor.rgb*=mix(.94,.79+grain*.31-grainLine*.055,townFade(grainP));`,
      stone:`highp vec3 stagger=vTownSurface+vec3(mod(floor(vTownSurface.y*1.25),2.0)*.36,0.0,0.0);
        highp vec3 fleckP=stagger*vec3(1.3,1.25,1.3);
        float fleck=townNoise(floor(fleckP)*.8);
        highp float course=vTownSurface.y*1.25;
        float joint=1.0-smoothstep(.025,.065,fract(course));
        float jointFade=1.0-smoothstep(.03,.12,fwidth(course));
        diffuseColor.rgb*=mix(.935,.81+fleck*.25,townFade(fleckP))-mix(.0032,joint*.07,jointFade);`,
      roof:`highp vec3 clayP=vTownSurface*vec3(2.7,1.9,2.7),speckleP=vTownSurface*vec3(8.0,5.0,8.0);
        float clay=mix(.5,townNoise(clayP),townFade(clayP));
        float speckle=mix(.5,townNoise(speckleP),townFade(speckleP));
        diffuseColor.rgb*=.88+clay*.16+speckle*.045;`,
      plaster:`highp vec3 washP=vTownSurface*vec3(1.4,1.1,1.4);
        float wash=mix(.5,townNoise(washP),townFade(washP));
        diffuseColor.rgb*=.94+wash*.10;`,
      ground:`float groundPatch=townNoise(vTownSurface*vec3(.075,.01,.075));
        highp vec3 fleckP=vTownSurface*vec3(.46,.02,.46);
        float fleck=mix(.5,townNoise(fleckP),townFade(fleckP));
        float meadow=sin(vTownSurface.x*.045)*sin(vTownSurface.z*.059);
        diffuseColor.rgb*=.94+groundPatch*.12+fleck*.035+meadow*.045;`,
    }[surface];
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n${treatment}`);
  };
  material.customProgramCacheKey=()=>`town-painted-${surface}-v4`;
  return material;
}

export const MAT = {
  grass:painted(make(C.grass,1),'ground'),terrain:painted(new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1}),'ground'),grassDark:make(C.grassDark,1),earth:make(C.earth,1),path:make(C.path,1),
  wood:painted(make(C.wood,.88),'timber'),woodLight:painted(make(C.woodLight,.88),'timber'),woodDark:painted(make(C.woodDark,.92),'timber'),
  stone:painted(make(C.stone,1),'stone'),stoneDark:painted(make(C.stoneDark,1),'stone'),
  plaster:painted(make(C.plaster,1),'plaster'),plasterIvory:painted(make(0xf3e3c3,1),'plaster'),plasterRose:painted(make(0xe8b9a8,1),'plaster'),plasterSage:painted(make(0xc5dbb6,1),'plaster'),
  roof:painted(make(C.roof,.92),'roof'),roofDark:painted(make(C.roofDark,.92),'roof'),roofBlue:painted(make(C.roofBlue,.92),'roof'),
  roofTiles:painted(new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.96,side:THREE.DoubleSide}),'roof'),
  gold:make(C.gold,.68,.1),window:make(C.window,.88),glass:new THREE.MeshStandardMaterial({color:0x3a4047,roughness:.35,metalness:0,emissive:0x6b4a2a,emissiveIntensity:.2}),lamp:new THREE.MeshBasicMaterial({color:C.lamp}),
  white:make(0xf5f0dd),leaf:make(C.leaf,1),leafLight:make(0x90a75a,1),leafDark:make(0x4a6841,1),foliage:make(0xffffff,1),pine:make(0xffffff,1),
  red:make(0xbe7062),purple:make(0x8d729e),blue:make(0x668db0),
  iron:make(0x576a72,.7,.28),copper:make(0xb8775d,.76,.22),olive:make(0x748568,.95),sand:make(0xc6a97e,1),
  cyan:new THREE.MeshStandardMaterial({color:0x62c4cc,roughness:.3,metalness:.18,emissive:0x249aab,emissiveIntensity:.52}),
  magic:new THREE.MeshStandardMaterial({color:0x9bc5ed,roughness:.25,metalness:.08,emissive:0x5575de,emissiveIntensity:.5}),
  violet:make(0x664b89,.83),ink:make(0x34384b,.95),emerald:make(0x5aab85,.87),
} as const;
