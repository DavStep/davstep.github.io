import * as THREE from 'three';
import { terrainHeight, isWater } from './environment';

const random=(seed:number)=>{
  let n=seed|0;
  n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;
  n=Math.imul(n,0x846ca68b);n^=n>>>16;
  return (n>>>0)/0xffffffff;
};

/** Rain lives in world space, so buildings occlude it and camera movement creates parallax. */
export class Rain {
  private readonly streaks:THREE.Mesh;
  private readonly splashes:THREE.Mesh;
  private readonly rainTime={value:0};
  private readonly rainCenter={value:new THREE.Vector3()};
  private readonly rainExtent={value:130};
  private readonly rainHeight={value:260};
  private readonly splashTime={value:0};
  private readonly direction=new THREE.Vector3();
  private visible=false;
  private lastTime=0;

  constructor(scene:THREE.Scene,mobile:boolean){
    const count=mobile?1100:2600;
    const positions=new Float32Array(count*6*3);
    const corners=new Float32Array(count*6*2);
    const traits=new Float32Array(count*6*4);
    const quad=[[-1,0],[1,0],[-1,1],[-1,1],[1,0],[1,1]];
    for(let i=0;i<count;i++){
      const x=random(i*17+1)*2-1,z=random(i*31+2)*2-1;
      const phase=random(i*43+3),speed=25+random(i*59+4)*25;
      const length=1.25+random(i*71+5)*2.5;
      const width=.035+random(i*89+6)*.075;
      const opacity=.3+random(i*101+7)*.45;
      for(let j=0;j<6;j++){
        const vertex=i*6+j;
        positions.set([x,phase,z],vertex*3);
        corners.set(quad[j],vertex*2);
        traits.set([speed,length,width,opacity],vertex*4);
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('aCorner',new THREE.BufferAttribute(corners,2));
    geometry.setAttribute('aTraits',new THREE.BufferAttribute(traits,4));
    const material=new THREE.ShaderMaterial({
      uniforms:{uTime:this.rainTime,uCenter:this.rainCenter,uExtent:this.rainExtent,uHeight:this.rainHeight},
      transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
      vertexShader:`
        attribute vec2 aCorner;
        attribute vec4 aTraits;
        uniform float uTime,uExtent,uHeight;
        uniform vec3 uCenter;
        varying float vOpacity;
        void main(){
          float head=mod(position.y*uHeight-uTime*aTraits.x,uHeight);
          // Wrap fixed world-space drops into the view volume. Moving the camera
          // only changes which drops are visible, not their positions.
          vec2 span=vec2(2.0*uExtent);
          vec2 fixedXZ=position.xz*uExtent+vec2((uHeight-head)*.10,(uHeight-head)*.035);
          vec2 worldXZ=uCenter.xz+mod(fixedXZ-uCenter.xz+uExtent,span)-uExtent;
          vec3 world=vec3(worldXZ.x,head+.6,worldXZ.y);
          world.x-=aCorner.y*aTraits.y*.10;
          world+=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0])*aCorner.x*aTraits.z;
          world.y+=aCorner.y*aTraits.y;
          float distanceToCenter=length(world.xz-uCenter.xz)/uExtent;
          vOpacity=aTraits.w*(1.0-smoothstep(.55,1.0,distanceToCenter))*smoothstep(0.0,3.0,head);
          gl_Position=projectionMatrix*viewMatrix*vec4(world,1.0);
        }`,
      fragmentShader:`
        varying float vOpacity;
        void main(){gl_FragColor=vec4(.70,.85,.94,vOpacity);}
      `,
    });
    this.streaks=new THREE.Mesh(geometry,material);
    this.streaks.frustumCulled=false;
    this.streaks.renderOrder=2;

    const ring=new THREE.RingGeometry(.78,1,12);
    const splashCount=mobile?70:160;
    const splashGeometry=new THREE.InstancedBufferGeometry();
    splashGeometry.index=ring.index;
    splashGeometry.setAttribute('position',ring.getAttribute('position'));
    const offsets=new Float32Array(splashCount*3);
    const phases=new Float32Array(splashCount);
    const sizes=new Float32Array(splashCount);
    for(let i=0;i<splashCount;i++){
      const angle=random(i*139+11)*Math.PI*2;
      const radius=Math.sqrt(random(i*149+12))*69;
      const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
      offsets.set([x,terrainHeight(x,z)+(isWater(x,z)?.74:.09),z],i*3);
      phases[i]=random(i*157+13);
      sizes[i]=.55+random(i*163+14)*.9;
    }
    splashGeometry.setAttribute('aOffset',new THREE.InstancedBufferAttribute(offsets,3));
    splashGeometry.setAttribute('aPhase',new THREE.InstancedBufferAttribute(phases,1));
    splashGeometry.setAttribute('aSize',new THREE.InstancedBufferAttribute(sizes,1));
    splashGeometry.instanceCount=splashCount;
    ring.dispose();
    const splashMaterial=new THREE.ShaderMaterial({
      uniforms:{uTime:this.splashTime},transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
      vertexShader:`
        attribute vec3 aOffset;
        attribute float aPhase,aSize;
        uniform float uTime;
        varying float vOpacity;
        void main(){
          float age=fract(uTime*.82+aPhase);
          float radius=(.12+age*1.15)*aSize;
          vec3 world=aOffset+vec3(position.x*radius,.035,position.y*radius);
          vOpacity=pow(1.0-age,2.0)*.6;
          gl_Position=projectionMatrix*viewMatrix*vec4(world,1.0);
        }`,
      fragmentShader:`varying float vOpacity;void main(){gl_FragColor=vec4(.76,.91,.98,vOpacity);}`,
    });
    this.splashes=new THREE.Mesh(splashGeometry,splashMaterial);
    this.splashes.frustumCulled=false;
    this.splashes.renderOrder=1;
    this.streaks.visible=this.splashes.visible=false;
    scene.add(this.streaks,this.splashes);
  }

  setWeather(raining:boolean,reducedMotion:boolean){
    this.visible=raining&&!reducedMotion;
    this.streaks.visible=this.splashes.visible=this.visible;
    if(!this.visible)this.lastTime=0;
  }

  update(camera:THREE.Camera,now:number,roaming:boolean){
    if(!this.visible)return;
    const dt=this.lastTime?Math.min((now-this.lastTime)/1000,.08):0;
    this.lastTime=now;
    this.rainTime.value+=dt;
    this.splashTime.value+=dt;
    camera.getWorldDirection(this.direction);
    const reach=roaming?13:Math.min(80,camera.position.y*.7);
    this.rainCenter.value.copy(camera.position).addScaledVector(this.direction,reach);
    this.rainExtent.value=roaming?48:130;
  }

  dispose(){
    for(const mesh of [this.streaks,this.splashes]){
      mesh.removeFromParent();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
    }
  }
}
