import * as THREE from 'three';
import { PLANET_RADIUS, PLANET_GROUND_SIZE, planetSourceGroundData } from './planet-layout';
import { createPlanetHeightTexture } from './planet-geography';

const projectionGLSL=`
#ifdef PLANET_VERTEX
attribute vec2 planetAnchor;
#endif
uniform sampler2D planetHeights;
uniform sampler2D planetGround;
float globeHeight(vec3 n){
  return texture2D(planetHeights,vec2(atan(n.z,n.x)/6.2831853+.5,asin(clamp(n.y,-1.,1.))/3.14159265+.5)).r;
}

vec3 planetNormal(vec2 p) {
  vec2 uv=p/${(2*PLANET_RADIUS).toFixed(1)};
  float d=1.0+dot(uv,uv);
  return vec3(2.0*uv.x,1.0-dot(uv,uv),2.0*uv.y)/d;
}
vec3 planetPosition(vec3 p) {
  float scale=1.0/(1.0+dot(p.xz,p.xz)/${(4*PLANET_RADIUS*PLANET_RADIUS).toFixed(1)});
  vec3 n=planetNormal(p.xz);
  float ground=texture2D(planetGround,p.xz/512.0+.5).r;
  #ifdef PLANET_VERTEX
    ground=mix(ground,planetAnchor.x,planetAnchor.y);
  #endif
  return n*(${PLANET_RADIUS.toFixed(1)}+globeHeight(n)+(p.y-ground)*scale);
}
mat3 planetBasis(vec2 p) {
  vec2 uv=p/${(2*PLANET_RADIUS).toFixed(1)};
  float u=uv.x,v=uv.y,d=1.0+dot(uv,uv);
  vec3 x=vec3(1.0-u*u+v*v,-2.0*u,-2.0*u*v)/d;
  vec3 z=vec3(-2.0*u*v,-2.0*v,1.0+u*u-v*v)/d;
  return mat3(x,planetNormal(p),z);
}
`;

/**
 * Bend the original scene at render time. Source buffers, authored models,
 * materials, road routing, instance transforms and simulation stay unchanged.
 * The depth pass uses the same projection so the original shadows still land
 * on the roads and terrain. No second set of planet assets is built.
 */
export class PlanetProjection {
  private patched=new WeakSet<THREE.Material>();
  private depths=new Map<THREE.Mesh,THREE.MeshDepthMaterial>();
  private watched=new Set<THREE.Object3D>();
  private drawables:(THREE.Mesh|THREE.Line|THREE.Points)[]=[];
  private topologyDirty=true;
  private markTopologyDirty=()=>{this.topologyDirty=true;};
  private heights=createPlanetHeightTexture();
  private ground:THREE.DataTexture;
  constructor(_scene:THREE.Scene){
    const size=PLANET_GROUND_SIZE,data=planetSourceGroundData();
    this.ground=new THREE.DataTexture(data,size,size,THREE.RedFormat,THREE.FloatType);
    this.ground.magFilter=this.ground.minFilter=THREE.LinearFilter;this.ground.needsUpdate=true;
  }
  private patch(material:THREE.Material){
    if(this.patched.has(material)||material instanceof THREE.ShaderMaterial)return;
    this.patched.add(material);
    const compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
    material.onBeforeCompile=(shader,renderer)=>{
      compile.call(material,shader,renderer);
      shader.uniforms.planetHeights={value:this.heights};shader.uniforms.planetGround={value:this.ground};
      shader.vertexShader='#define PLANET_VERTEX\n'+projectionGLSL+'\nvarying vec3 vPlanetSource;\n'+shader.vertexShader;
      // Compute the flat world position after the existing instance animation.
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
        vec4 planetSource=vec4(transformed,1.0);
        #ifdef USE_BATCHING
          planetSource=batchingMatrix*planetSource;
        #endif
        #ifdef USE_INSTANCING
          planetSource=instanceMatrix*planetSource;
        #endif
        planetSource=modelMatrix*planetSource;
        vPlanetSource=planetSource.xyz;
        vec3 planetProjectedPosition=planetPosition(planetSource.xyz);
        vec4 mvPosition=viewMatrix*vec4(planetProjectedPosition,1.0);
        gl_Position=projectionMatrix*mvPosition;
      `);
      // Preserve each model's normal detail, then turn its up direction outwards.
      shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
        vec4 planetNormalSource=vec4(position,1.0);
        #ifdef USE_INSTANCING
          planetNormalSource=instanceMatrix*planetNormalSource;
        #endif
        planetNormalSource=modelMatrix*planetNormalSource;
        vec3 planetWorldNormal=inverseTransformDirection(transformedNormal,viewMatrix);
        transformedNormal=mat3(viewMatrix)*planetBasis(planetNormalSource.xz)*planetWorldNormal;
      `);
      shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
        #if defined(USE_ENVMAP) || defined(DISTANCE) || defined(USE_SHADOWMAP) || defined(USE_TRANSMISSION) || NUM_SPOT_LIGHT_COORDS > 0
          worldPosition=vec4(planetProjectedPosition,1.0);
        #endif
      `);
      // Construction clipping planes still operate in the original simulation coordinates.
      shader.vertexShader=shader.vertexShader.replace('#include <clipping_planes_vertex>',`
        #if NUM_CLIPPING_PLANES > 0
          vClipPosition=-(viewMatrix*planetSource).xyz;
        #endif
      `);
      // Water's authored wave shader supplies a world-up normal of its own.
      shader.fragmentShader='varying vec3 vPlanetSource;\n'+projectionGLSL+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader
        .replace('viewMatrix*vec4(townWn,0.0)','viewMatrix*vec4(planetBasis(vPlanetSource.xz)*townWn,0.0)')
        .replaceAll('viewMatrix*vec4(0.0,1.0,0.0,0.0)','viewMatrix*vec4(planetNormal(vPlanetSource.xz),0.0)');
    };
    material.customProgramCacheKey=()=>`${cacheKey}-planet-projection-v2`;
    material.needsUpdate=true;
  }
  sync(scene:THREE.Scene){
    if(this.topologyDirty){
      const present=new Set<THREE.Object3D>();
      this.drawables.length=0;
      scene.traverse(object=>{
        present.add(object);
        if(!this.watched.has(object)){
          object.addEventListener('childadded',this.markTopologyDirty);
          object.addEventListener('childremoved',this.markTopologyDirty);
          this.watched.add(object);
        }
        if((object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Points)&&!object.userData.planetNative)this.drawables.push(object);
      });
      for(const object of this.watched)if(!present.has(object)){
        object.removeEventListener('childadded',this.markTopologyDirty);
        object.removeEventListener('childremoved',this.markTopologyDirty);
        this.watched.delete(object);
      }
      for(const [mesh,depth] of this.depths)if(!present.has(mesh)){
        depth.dispose();if(mesh.customDepthMaterial===depth)mesh.customDepthMaterial=undefined;
        this.depths.delete(mesh);
      }
      this.topologyDirty=false;
    }
    // Materials can be replaced (or an array edited) without changing topology.
    // Keep that cheap check on the projected drawables, not the whole scene.
    for(const object of this.drawables){
      // The original sky is already a camera-centred sphere, not ground geometry.
      const material=object.material;
      if(Array.isArray(material)){
        if(material.some(m=>m instanceof THREE.ShaderMaterial))continue;
        for(const m of material)this.patch(m);
      }else{
        if(material instanceof THREE.ShaderMaterial)continue;
        this.patch(material);
      }
      object.frustumCulled=false;
      if(!(object instanceof THREE.Mesh)||this.depths.has(object))continue;
      const first=Array.isArray(material)?material[0]:material;
      const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
      depth.clippingPlanes=first.clippingPlanes;depth.clipShadows=first.clipShadows;
      this.patch(depth);object.customDepthMaterial=depth;this.depths.set(object,depth);
    }
  }
  dispose(){
    for(const object of this.watched){object.removeEventListener('childadded',this.markTopologyDirty);object.removeEventListener('childremoved',this.markTopologyDirty);}
    this.watched.clear();this.drawables.length=0;
    for(const [mesh,depth] of this.depths){depth.dispose();if(mesh.customDepthMaterial===depth)mesh.customDepthMaterial=undefined;}
    this.depths.clear();this.heights.dispose();this.ground.dispose();
  }
}
