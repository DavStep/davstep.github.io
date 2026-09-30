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
  const water={value:0},lush={value:0},groveOrigin={value:new THREE.Vector3(0,1,0)},groveReach={value:0};
  material.userData.water=water;material.userData.lush=lush;material.userData.groveOrigin=groveOrigin;material.userData.groveReach=groveReach;
  material.onBeforeCompile=shader=>{
    shader.uniforms.terrainWater=water;shader.uniforms.terrainLush=lush;shader.uniforms.groveOrigin=groveOrigin;shader.uniforms.groveReach=groveReach;
    shader.vertexShader='varying vec3 terrainPosition; varying vec3 terrainNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      terrainPosition=position;terrainNormal=normal;
    `);
    shader.fragmentShader=detailGLSL+'varying vec3 terrainPosition; varying vec3 terrainNormal; uniform float terrainWater; uniform float terrainLush; uniform vec3 groveOrigin; uniform float groveReach;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 radial=normalize(terrainPosition);
      float altitude=length(terrainPosition)-85.;
      float slope=1.-max(0.,dot(normalize(terrainNormal),radial));
      float broad=planetNoise(radial*17.);
      // Fade subpixel detail before it can sparkle while orbiting the planet.
      float detailFade=1.-smoothstep(.65,1.45,length(fwidth(terrainPosition*1.6)));
      float grain=mix(.5,planetNoise(terrainPosition*1.6),detailFade);
      float patches=planetNoise(radial*45.+broad*2.);
      // Broad meadow shapes with small grass flecks, rather than blurry vertex color.
      vec3 grass=mix(vec3(.27,.47,.29),vec3(.46,.61,.34),smoothstep(.18,.82,broad));
      grass=mix(grass,vec3(.62,.63,.37),smoothstep(.58,.86,patches)*.18);
      grass*=.97+grain*.06;
      float groveDistance=acos(clamp(dot(radial,groveOrigin),-1.,1.))*85.;
      float fertility=terrainLush*(1.-smoothstep(groveReach*.8,groveReach+3.,groveDistance));
      grass=mix(grass*.92,grass,fertility);
      float stone=smoothstep(.09,.3,slope)*smoothstep(.6,2.,altitude);
      stone=max(stone,smoothstep(5.,10.,altitude)*.78);
      // Warm exposed strata and cool recesses make cliffs legible at globe scale.
      float strata=.5+.5*sin(altitude*1.7+patches*5.);
      vec3 rock=mix(vec3(.37,.43,.45),vec3(.60,.57,.49),patches);
      rock*=.90+.09*smoothstep(.15,.75,strata)+grain*.05;
      vec3 surface=mix(grass,rock,stone);
      float snowLine=8.8+(broad-.5)*4.+(patches-.5)*1.7;
      float snow=smoothstep(snowLine,snowLine+.7,altitude)*(1.-smoothstep(.48,.72,slope));
      surface=mix(surface,mix(vec3(.75,.84,.88),vec3(.97,.97,.91),grain*.35+.6),snow);
      float sand=(1.-smoothstep(.22,.95,altitude+(patches-.5)*.25))*terrainWater;
      vec3 beach=mix(vec3(.77,.64,.39),vec3(.96,.84,.57),smoothstep(-.1,.5,altitude));
      beach*=.96+grain*.065;
      surface=mix(surface,beach,sand);
      float wetSand=sand*(1.-smoothstep(-.08,.45,altitude));
      surface*=1.-wetSand*.16;
      diffuseColor.rgb=planetLinear(surface);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(.97,.84,stone);
      roughnessFactor=mix(roughnessFactor,.73,snow);
      roughnessFactor=mix(roughnessFactor,.66,wetSand);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      // Reuse the sampled grain for modest relief: no textures or extra noise passes.
      vec3 terrainDx=dFdx(-vViewPosition),terrainDy=dFdy(-vViewPosition);
      vec3 terrainCrossX=cross(terrainDy,normal),terrainCrossY=cross(normal,terrainDx);
      float terrainDet=dot(terrainDx,terrainCrossX);
      float relief=(grain-.5)*mix(.025,.11,stone)*(1.-snow*.75);
      vec3 terrainGradient=sign(terrainDet)*(dFdx(relief)*terrainCrossX+dFdy(relief)*terrainCrossY);
      normal=normalize(max(abs(terrainDet),.000001)*normal-terrainGradient);
    `);
  };
  material.customProgramCacheKey=()=>'planet-painted-terrain-v2';return material;
}

export function createPlanetOceanMaterial(heights:THREE.Texture){
  const material=new THREE.MeshPhysicalMaterial({roughness:.3,metalness:0,specularColor:0xd6f5ff,specularIntensity:.72,envMapIntensity:.25});
  const time={value:0};material.userData.time=time;
  material.onBeforeCompile=shader=>{
    shader.uniforms.planetHeights={value:heights};shader.uniforms.planetWaterTime=time;
    shader.vertexShader='varying vec3 waterDirection;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwaterDirection=normalize(position);');
    shader.fragmentShader=detailGLSL+`
      varying vec3 waterDirection;uniform sampler2D planetHeights;uniform float planetWaterTime;
      float waveStroke(vec2 p){
        vec2 cell=floor(p),q=fract(p);
        float seed=planetHash(vec3(cell,13.));
        float x=q.x-.5,y=q.y-(.40+.08*sin(planetWaterTime*.65+seed*6.));
        float curve=y-x*x*(.45+seed*.4);
        float aa=max(fwidth(curve),.005);
        float line=(1.-smoothstep(.012,.012+aa,abs(curve)))*(1.-smoothstep(.06,.22,aa));
        float ends=smoothstep(.12,.22,q.x)*(1.-smoothstep(.7,.86,q.x));
        return line*ends*smoothstep(.52,.75,seed)*(.6+.4*sin(seed*12.+planetWaterTime*.5));
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 n=normalize(waterDirection);
      vec2 uv=vec2(atan(n.z,n.x)/6.2831853+.5,asin(clamp(n.y,-1.,1.))/3.14159265+.5);
      float h=texture2D(planetHeights,uv).r,depth=max(0.,-h);
      float broad=planetNoise(n*12.+vec3(planetWaterTime*.025,0,0));
      float shoal=1.-smoothstep(.2,4.8,depth);
      vec3 ocean=mix(vec3(.035,.25,.48),vec3(.035,.46,.63),smoothstep(.12,.88,broad));
      ocean=mix(ocean,vec3(.12,.69,.67),shoal*.9);
      // Long cross swells give open water coherent movement at every globe angle.
      vec3 swellA=vec3(73.,22.,49.),swellB=vec3(-31.,68.,57.);
      float phaseA=dot(n,swellA)-planetWaterTime*.72;
      float phaseB=dot(n,swellB)-planetWaterTime*.52;
      float swell=sin(phaseA)*.6+sin(phaseB)*.4;
      ocean*=1.+swell*.025*(1.-shoal*.5);
      vec3 weights=pow(abs(n),vec3(6.));weights/=dot(weights,vec3(1.));
      vec3 p=n*85.*.155;
      vec2 drift=vec2(planetWaterTime*.022,-planetWaterTime*.035);
      float strokes=waveStroke(p.yz+drift)*weights.x+waveStroke(p.xz+7.+drift)*weights.y+waveStroke(p.xy+19.+drift)*weights.z;
      ocean=mix(ocean,vec3(.60,.87,.86),strokes*.5*(1.-smoothstep(.0,.45,h)));
      // Broken, moving surf bands sit on the water itself, with no coplanar decals.
      float breakup=planetNoise(n*95.+vec3(0.,planetWaterTime*.04,0.));
      float phase=depth*3.4-planetWaterTime*.8+breakup*.9;
      float aa=max(fwidth(phase),.04);
      float surf=(1.-smoothstep(.15,.15+aa,abs(sin(phase))))*(1.-smoothstep(.5,1.7,aa));
      surf*=smoothstep(.08,.3,depth)*(1.-smoothstep(.6,1.8,depth))*(.35+breakup*.45);
      float edge=(1.-smoothstep(.035,.23,depth))*(.64+breakup*.36);
      float foam=max(edge,surf);
      ocean=mix(ocean,vec3(.89,.96,.86),foam);
      diffuseColor.rgb=planetLinear(ocean);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(.27,.39,shoal)+foam*.18;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      // Analytical slopes are continuous through the longitude seam and poles.
      // Fade subpixel chop before it can sparkle when the camera pulls back.
      vec3 chopDirection=vec3(176.,-93.,121.);
      float chopPhase=dot(n,chopDirection)-planetWaterTime*1.3;
      float chopFade=1.-smoothstep(.5,1.8,fwidth(chopPhase));
      vec3 waves=cos(phaseA)*swellA*.00044+cos(phaseB)*swellB*.0003;
      waves+=cos(chopPhase)*chopDirection*.00013*chopFade;
      waves-=n*dot(n,waves);
      normal=normalize(normal+mat3(viewMatrix)*waves*(1.-foam*.75));
    `);
  };
  material.customProgramCacheKey=()=>'planet-cartoon-ocean-v2';return material;
}
