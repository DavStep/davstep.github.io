import * as THREE from 'three';

// Colors and soft, low-contrast surface marks follow the painted timber and
// matte stone treatment in Drunk Dwarves. The marks use world coordinates, so
// batched and instanced geometry shares one continuous material.
export const C = {
  grass: 0x789667, grassDark: 0x5a7b59, earth: 0x8d795f, path: 0xbda982,
  wood: 0x80604b, woodLight: 0x9b7759, woodDark: 0x674d3d,
  stone: 0xa7a195, stoneDark: 0x777b78, plaster: 0xe5c9a1,
  roof: 0xb56c58, roofDark: 0x76576b, roofBlue: 0x668193,
  gold: 0xe9c06c, window: 0x50433d, lamp: 0xffd390,
} as const;

export type Mat = THREE.Material;
const make = (color:number, roughness=.9, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});

function painted(material:THREE.MeshStandardMaterial, surface:'timber'|'stone'){
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.vertexShader='varying vec3 vTownSurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec4 surfacePosition=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        surfacePosition=instanceMatrix*surfacePosition;
      #endif
      vTownSurface=(modelMatrix*surfacePosition).xyz;
    `);
    shader.fragmentShader=`varying vec3 vTownSurface;
      float townHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float townNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(townHash(i),townHash(i+vec3(1,0,0)),f.x),
                       mix(townHash(i+vec3(0,1,0)),townHash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(townHash(i+vec3(0,0,1)),townHash(i+vec3(1,0,1)),f.x),
                       mix(townHash(i+vec3(0,1,1)),townHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      ${surface==='timber'
        ? 'float grain=townNoise(vTownSurface*vec3(1.8,.24,1.8)); diffuseColor.rgb*=mix(.90,1.06,grain);'
        : 'float fleck=townNoise(vTownSurface*vec3(.65,.8,.65)); diffuseColor.rgb*=mix(.91,1.055,fleck);'}
    `);
  };
  material.customProgramCacheKey=()=>`town-painted-${surface}-v1`;
  return material;
}

export const MAT = {
  grass:make(C.grass,1),grassDark:make(C.grassDark,1),earth:make(C.earth,1),path:make(C.path,1),
  wood:painted(make(C.wood,.88),'timber'),woodLight:painted(make(C.woodLight,.88),'timber'),woodDark:painted(make(C.woodDark,.92),'timber'),
  stone:painted(make(C.stone,1),'stone'),stoneDark:painted(make(C.stoneDark,1),'stone'),plaster:make(C.plaster,1),
  roof:make(C.roof,.92),roofDark:make(C.roofDark,.92),roofBlue:make(C.roofBlue,.92),
  gold:make(C.gold,.68,.1),window:make(C.window,.88),lamp:new THREE.MeshBasicMaterial({color:C.lamp}),
  white:make(0xeae9dd),leaf:make(0x52775a,1),leafLight:make(0x709466,1),leafDark:make(0x456b5a,1),
  red:make(0xbe7062),purple:make(0x8d729e),blue:make(0x668db0),
} as const;
