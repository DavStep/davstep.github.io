import * as THREE from 'three';

// Continuous 3D detail avoids visible texture seams at the longitude seam and poles.
const detailGLSL=`
float planetHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float planetNoise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(planetHash(i),planetHash(i+vec3(1,0,0)),f.x),mix(planetHash(i+vec3(0,1,0)),planetHash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(planetHash(i+vec3(0,0,1)),planetHash(i+vec3(1,0,1)),f.x),mix(planetHash(i+vec3(0,1,1)),planetHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
vec3 planetLinear(vec3 c){return pow(c,vec3(2.2));}
`;

export function createPlanetTerrainMaterial(){
  const material=new THREE.MeshStandardMaterial({roughness:.94});
  const water={value:0},lush={value:0};
  material.userData.water=water;material.userData.lush=lush;
  material.onBeforeCompile=shader=>{
    shader.uniforms.terrainWater=water;shader.uniforms.terrainLush=lush;
    shader.vertexShader='varying vec3 terrainPosition; varying vec3 terrainNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      terrainPosition=position;terrainNormal=normal;
    `);
    shader.fragmentShader=detailGLSL+'varying vec3 terrainPosition; varying vec3 terrainNormal; uniform float terrainWater; uniform float terrainLush;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 radial=normalize(terrainPosition);
      float altitude=length(terrainPosition)-85.;
      float slope=1.-max(0.,dot(normalize(terrainNormal),radial));
      float broad=planetNoise(radial*17.);
      float grain=planetNoise(terrainPosition*1.6);
      float patches=planetNoise(radial*45.+broad*2.);
      // Broad meadow shapes with small grass flecks, rather than blurry vertex color.
      vec3 grass=mix(vec3(.29,.51,.29),vec3(.43,.62,.35),smoothstep(.18,.82,broad));
      grass=mix(grass,vec3(.50,.65,.33),smoothstep(.62,.82,patches)*.16);
      grass*=.985+grain*.03;
      grass=mix(grass*.92,grass,terrainLush);
      float stone=smoothstep(.09,.3,slope)*smoothstep(.6,2.,altitude);
      stone=max(stone,smoothstep(5.,10.,altitude)*.78);
      // Warm exposed strata and cool recesses make cliffs legible at globe scale.
      float strata=.5+.5*sin(altitude*1.7+planetNoise(radial*38.)*5.);
      vec3 rock=mix(vec3(.40,.45,.43),vec3(.58,.58,.52),patches);
      rock*=.94+.06*smoothstep(.15,.75,strata)+grain*.02;
      vec3 surface=mix(grass,rock,stone);
      float snowLine=8.8+(broad-.5)*4.+(patches-.5)*1.7;
      float snow=smoothstep(snowLine,snowLine+.7,altitude)*(1.-smoothstep(.48,.72,slope));
      surface=mix(surface,mix(vec3(.77,.87,.90),vec3(.98,.98,.91),grain*.45+.5),snow);
      float sand=(1.-smoothstep(.22,.95,altitude+(patches-.5)*.25))*terrainWater;
      vec3 beach=mix(vec3(.77,.64,.39),vec3(.96,.84,.57),smoothstep(-.1,.5,altitude));
      beach*=.96+grain*.065;
      surface=mix(surface,beach,sand);
      diffuseColor.rgb=planetLinear(surface);
    `);
  };
  material.customProgramCacheKey=()=>'planet-painted-terrain-v1';return material;
}

export function createPlanetOceanMaterial(heights:THREE.Texture){
  const material=new THREE.MeshPhysicalMaterial({roughness:.5,metalness:0,specularColor:0xb2f8ff,specularIntensity:.55,envMapIntensity:.2});
  const time={value:0};material.userData.time=time;
  material.onBeforeCompile=shader=>{
    shader.uniforms.planetHeights={value:heights};shader.uniforms.planetWaterTime=time;
    shader.vertexShader='varying vec3 waterDirection;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwaterDirection=normalize(position);');
    shader.fragmentShader=detailGLSL+`
      varying vec3 waterDirection;uniform sampler2D planetHeights;uniform float planetWaterTime;
      float waveStroke(vec2 p){
        vec2 cell=floor(p),q=fract(p);
        float seed=planetHash(vec3(cell,13.));
        float x=q.x-.5,y=q.y-(.40+.12*sin(planetWaterTime*.65+seed*6.));
        float curve=y-x*x*(.45+seed*.4);
        float aa=max(fwidth(curve),.005);
        float line=1.-smoothstep(.015,.015+aa,abs(curve));
        float ends=smoothstep(.12,.22,q.x)*(1.-smoothstep(.7,.86,q.x));
        return line*ends*smoothstep(.58,.75,seed)*(.65+.35*sin(seed*12.+planetWaterTime*.5));
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 n=normalize(waterDirection);
      vec2 uv=vec2(atan(n.z,n.x)/6.2831853+.5,asin(clamp(n.y,-1.,1.))/3.14159265+.5);
      float h=texture2D(planetHeights,uv).r,depth=max(0.,-h);
      float broad=planetNoise(n*12.+vec3(planetWaterTime*.025,0,0));
      float shoal=1.-smoothstep(.2,4.8,depth);
      vec3 ocean=mix(vec3(.035,.28,.59),vec3(.035,.53,.73),broad);
      ocean=mix(ocean,vec3(.17,.77,.72),shoal*.88);
      vec3 weights=pow(abs(n),vec3(6.));weights/=dot(weights,vec3(1.));
      vec3 p=n*85.*.155;
      float strokes=waveStroke(p.yz)*weights.x+waveStroke(p.xz+7.)*weights.y+waveStroke(p.xy+19.)*weights.z;
      ocean=mix(ocean,vec3(.64,.91,.91),strokes*.68*(1.-smoothstep(.0,.45,h)));
      // Broken, moving surf bands sit on the water itself, with no coplanar decals.
      float breakup=planetNoise(n*95.);
      float phase=depth*2.8-planetWaterTime*.65+breakup*.65;
      float aa=max(fwidth(phase),.04);
      float surf=1.-smoothstep(.12,.12+aa,abs(sin(phase)));
      surf*=smoothstep(.12,.4,depth)*(1.-smoothstep(.5,1.7,depth))*.55;
      float edge=(1.-smoothstep(.035,.25,depth))*(.72+breakup*.28);
      ocean=mix(ocean,vec3(.89,.97,.86),max(edge,surf));
      diffuseColor.rgb=planetLinear(ocean);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 wn=normalize(waterDirection);
      vec3 waves=vec3(sin(wn.z*125.+planetWaterTime*.7),sin(wn.x*110.+planetWaterTime*.6),sin(wn.y*135.-planetWaterTime*.5));
      waves-=wn*dot(wn,waves);
      normal=normalize(normal+mat3(viewMatrix)*waves*.025);
    `);
  };
  material.customProgramCacheKey=()=>'planet-cartoon-ocean-v1';return material;
}
