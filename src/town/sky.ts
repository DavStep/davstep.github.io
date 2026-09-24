import * as THREE from 'three';
import type { TownSnapshot } from './model';

// One unlit dome supplies a soft horizon and sun glow without post processing.
export class TownSky {
  private readonly zenith={value:new THREE.Color()};
  private readonly horizon={value:new THREE.Color()};
  private readonly sunDirection={value:new THREE.Vector3()};
  private readonly mesh:THREE.Mesh;
  constructor(scene:THREE.Scene){
    const material=new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,fog:false,
      uniforms:{zenith:this.zenith,horizon:this.horizon,sunDirection:this.sunDirection},
      vertexShader:`varying vec3 vSkyDirection;
        void main(){vSkyDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
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
  update(snapshot:TownSnapshot,night:number,sun:THREE.Vector3,camera:THREE.Vector3){
    const rainy=snapshot.weather==='rain',cloudy=snapshot.weather==='cloudy';
    const top=new THREE.Color(rainy?0x839aa9:cloudy?0x91adbb:0x72a9d1);
    const low=new THREE.Color(rainy?0xc1c1b7:cloudy?0xddd5c5:0xf1ddbd);
    if(snapshot.season==='winter'){top.lerp(new THREE.Color(0xb8ccd6),.18);low.lerp(new THREE.Color(0xdce1dc),.22);}
    this.zenith.value.copy(top).lerp(new THREE.Color(0x16283c),night*.83);
    this.horizon.value.copy(low).lerp(new THREE.Color(0x46546b),night*.72);
    this.sunDirection.value.copy(sun).normalize();
    this.mesh.position.copy(camera);
  }
  updatePosition(camera:THREE.Vector3){this.mesh.position.copy(camera);}
}
