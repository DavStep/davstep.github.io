import * as THREE from 'three';
import type { TownSnapshot } from './model';

const winterZenith=new THREE.Color(0xb8ccd6),winterHorizon=new THREE.Color(0xdce1dc);
const nightZenith=new THREE.Color(0x16283c),nightHorizon=new THREE.Color(0x46546b);
// Muted bounce below the horizon for reflections: olive meadow, never saturated.
const dayGround=new THREE.Color(0x6f7556),nightGround=new THREE.Color(0x1f2630),winterGround=new THREE.Color(0x9aa29a);

const skyVertex=`varying vec3 vSkyDirection;
  void main(){vSkyDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

// One unlit dome supplies a soft horizon and sun glow without post processing.
export class TownSky {
  private readonly zenith={value:new THREE.Color()};
  private readonly horizon={value:new THREE.Color()};
  private readonly ground={value:new THREE.Color()};
  private readonly sunDirection={value:new THREE.Vector3()};
  private readonly top=new THREE.Color();
  private readonly low=new THREE.Color();
  private readonly mesh:THREE.Mesh;
  private environmentScene:THREE.Scene|null=null;
  constructor(scene:THREE.Scene){
    const material=new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,fog:false,
      uniforms:{zenith:this.zenith,horizon:this.horizon,sunDirection:this.sunDirection},
      vertexShader:skyVertex,
      fragmentShader:`uniform vec3 zenith;uniform vec3 horizon;uniform vec3 sunDirection;
        varying vec3 vSkyDirection;
        void main(){
          vec3 direction=normalize(vSkyDirection);
          float height=smoothstep(-.18,.63,direction.y);
          vec3 color=mix(horizon,zenith,height);
          float halo=pow(max(dot(direction,normalize(sunDirection)),0.0),20.0);
          color+=vec3(.3,.19,.09)*halo*(1.0-height*.35);
          gl_FragColor=vec4(color,1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh=new THREE.Mesh(new THREE.SphereGeometry(440,20,12),material);
    this.mesh.renderOrder=-100;this.mesh.frustumCulled=false;scene.add(this.mesh);
  }
  /** Current linear horizon colour (after weather, season and night). */
  get horizonColor():THREE.Color{return this.horizon.value;}
  /** Current linear zenith colour (after weather, season and night). */
  get zenithColor():THREE.Color{return this.zenith.value;}
  update(snapshot:TownSnapshot,night:number,sun:THREE.Vector3,camera:THREE.Vector3){
    const rainy=snapshot.weather==='rain',cloudy=snapshot.weather==='cloudy';
    this.top.set(rainy?0x839aa9:cloudy?0x91adbb:0x5db6e8);
    this.low.set(rainy?0xc1c1b7:cloudy?0xddd5c5:0xc9ecf2);
    this.ground.value.copy(dayGround);
    if(snapshot.season==='winter'){this.top.lerp(winterZenith,.18);this.low.lerp(winterHorizon,.22);this.ground.value.lerp(winterGround,.6);}
    if(rainy||cloudy)this.ground.value.lerp(this.low,rainy?.3:.15);
    this.zenith.value.copy(this.top).lerp(nightZenith,night*.83);
    this.horizon.value.copy(this.low).lerp(nightHorizon,night*.72);
    this.ground.value.lerp(nightGround,night*.85);
    this.sunDirection.value.copy(sun).normalize();
    this.mesh.position.copy(camera);
  }
  updatePosition(camera:THREE.Vector3){this.mesh.position.copy(camera);}
  /**
   * A tiny scene containing only the sky gradient over a muted ground, used to
   * build the reflection environment with PMREMGenerator.fromScene. It shares
   * the live colour uniforms, so regenerate after update() when they change.
   */
  environment():THREE.Scene{
    if(this.environmentScene)return this.environmentScene;
    const material=new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
      uniforms:{zenith:this.zenith,horizon:this.horizon,ground:this.ground},
      vertexShader:skyVertex,
      fragmentShader:`uniform vec3 zenith;uniform vec3 horizon;uniform vec3 ground;
        varying vec3 vSkyDirection;
        void main(){
          vec3 direction=normalize(vSkyDirection);
          vec3 color=mix(horizon,zenith,smoothstep(-.02,.63,direction.y));
          color=mix(color,ground,smoothstep(.0,.22,-direction.y));
          gl_FragColor=vec4(color,1.0);
          #include <colorspace_fragment>
        }`,
    });
    const scene=new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(40,24,12),material));
    this.environmentScene=scene;
    return scene;
  }
  dispose(){
    this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();
    this.environmentScene?.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();(object.material as THREE.Material).dispose();}});
  }
}
