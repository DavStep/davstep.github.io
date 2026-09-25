import * as THREE from 'three';
import { MAT } from './materials';
import { pathRibbon, ringPoints } from './paths';
import { TerrainSurface } from './terrain-surface';
import { naturalTerrainHeight } from './environment';
import { IDEA_DISTRICTS,DISTRICT_IDEAS,type DistrictIdea } from './idea-districts';
import type { Levels } from './game';

/** Persistent courtyards make the additions read as one growing place. */
export class DistrictScenery {
  readonly group=new THREE.Group();
  private sites:{idea:DistrictIdea;level:number;group:THREE.Group;growth:number}[]=[];
  private owned=new Set<THREE.BufferGeometry>();
  constructor(parent:THREE.Group,mobile:boolean){
    this.group.name='Persistent_idea_districts';parent.add(this.group);
    const surface=new TerrainSurface(mobile,naturalTerrainHeight);
    const box=new THREE.BoxGeometry(1,1,1);this.owned.add(box);
    for(const idea of DISTRICT_IDEAS){
      const site=IDEA_DISTRICTS[idea];
      for(const level of [1,2,3,4,5,6,7,8]){
        const g=new THREE.Group();g.name=`${idea}_district_detail_${level}`;g.visible=false;this.group.add(g);
        const block=(name:string,x:number,z:number,w:number,h:number,d:number,mat:THREE.Material,lift=0)=>{
          const m=new THREE.Mesh(box,mat);m.name=name;m.position.set(x,surface.sample(x,z).height+h/2+lift,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;g.add(m);
        };
        if(level===1){
          const points=ringPoints(8.8,28).map(p=>({x:p.x+site.x,z:p.z+site.z}));
          const geometry=pathRibbon(points,2.3,mobile,surface);this.owned.add(geometry);
          const path=new THREE.Mesh(geometry,MAT.path);path.name='Local_courtyard';path.receiveShadow=true;g.add(path);
        }else if(level===2){
          for(const side of [-1,1]){
            block('Entrance_signpost',site.x+side*5,site.z+10,.25,3,.25,MAT.woodDark);
            block('District_banner',site.x+side*5.6,site.z+10,1.2,1.1,.1,idea==='market'?MAT.gold:MAT.blue,1.6);
          }
        }else if(level===3){
          for(const x of [-7,7])for(const z of [-7,7]){
            block('Street_lamp',site.x+x,site.z+z,.18,3.5,.18,MAT.woodDark);
            block('Lamp_light',site.x+x,site.z+z,.5,.65,.5,MAT.gold,3.1);
          }
        }else{
          const count=level-2;
          for(let i=0;i<count;i++)block(idea==='market'?'Trade_crates':'Supply_stores',site.x-4+i*1.6,site.z+(level%2?6:-7),1,.7+(i%2)*.5,1,MAT.woodLight);
          if(level===8){
            for(const side of [-1,1])block('Grand_entrance_pier',site.x+side*5,site.z+11,1,5,1,MAT.stone);
            block('Grand_entrance_arch',site.x,site.z+11,11,1,1.2,MAT.stone,4.8);
            block('District_crest',site.x,site.z+11.7,1.6,1.6,.15,MAT.gold,3.8);
          }
        }
        this.sites.push({idea,level,group:g,growth:0});
      }
    }
  }
  setLevels(levels:Levels,instant=false){for(const site of this.sites){site.group.visible=levels[site.idea]>=site.level;if(!site.group.visible)site.growth=0;else if(instant)site.growth=1;}}
  update(dt:number,reduced=false){for(const s of this.sites){if(!s.group.visible)continue;s.growth=reduced?1:Math.min(1,s.growth+Math.max(0,dt)*1.4);s.group.scale.y=Math.max(.001,s.growth);}}
  dispose(){this.group.removeFromParent();this.owned.forEach(g=>g.dispose());this.group.clear();}
}
