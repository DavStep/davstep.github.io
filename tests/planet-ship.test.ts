import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlanetShip,SHIP_DRAFT,SHIP_DECK_HEIGHT } from '../src/town/planet-ship';
import { PlanetTransport } from '../src/town/planet-transport';
import { PLANET_RADIUS,planetElevation } from '../src/town/planet-geography';
import { snapshotForGame } from '../src/town/game-snapshot';
import { evaluate } from '../src/town/game';

for(const mobile of [true,false])for(const flagship of [true,false])test(`${flagship?'flagship':'fishing cutter'} has an explicit waterline, distinct silhouette and owned resources (${mobile?'mobile':'desktop'})`,()=>{
  const ship=createPlanetShip(mobile,flagship),bounds=new THREE.Box3().setFromObject(ship.root),size=bounds.getSize(new THREE.Vector3());
  if(flagship)assert.ok(size.x>11&&size.y>8&&size.z>4.8,'large ship silhouette');
  else assert.ok(size.x<8&&size.y<6.5&&size.z<4,'compact fishing hull and single mast');
  assert.ok(bounds.min.y>=-SHIP_DRAFT-.01,'known keel datum');
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();let draws=0;
  ship.root.traverse(o=>{assert.equal(o.userData.planetNative,true);if(o instanceof THREE.Mesh){
    draws++;geometries.add(o.geometry);materials.add(o.material as THREE.Material);
    const position=o.geometry.getAttribute('position');for(let i=0;i<position.count;i++)assert.ok(Number.isFinite(position.getX(i)+position.getY(i)+position.getZ(i)));
  }});
  assert.ok(draws<24,'details are batched rather than hundreds of draw calls');
  let released=0;for(const g of geometries)g.addEventListener('dispose',()=>released++);for(const m of materials)m.addEventListener('dispose',()=>released++);
  ship.dispose();assert.equal(released,geometries.size+materials.size);
});

test('both ships keep their deck above the spherical ocean and their hull clear of the seabed throughout a round trip',()=>{
  const transport=new PlanetTransport(new THREE.Group(),true);
  transport.update(snapshotForGame({...evaluate([]).levels,settlers:1,river:3}),false);
  const ships=['Fishing boat','Island trading ship'].map(name=>transport.group.getObjectByName(name)!);
  assert.ok(ships.every(Boolean),'route must actually produce both vessels');
  assert.deepEqual(ships.map(ship=>ship.userData.shipType),['fishing','flagship']);
  for(let frame=0;frame<=1800;frame++){
    transport.render(frame*100,false);
    if(frame%20!==0)continue;
    transport.group.updateMatrixWorld(true);
    const separation=ships[0].position.clone().sub(ships[1].position),across=new THREE.Vector3(0,0,1).applyQuaternion(ships[1].quaternion);
    assert.ok(Math.abs(separation.dot(across))>4,'fishing lane stays clear of the flagship');
    for(const ship of ships){
      const up=new THREE.Vector3(0,1,0).applyQuaternion(ship.quaternion),normal=ship.position.clone().normalize();
      assert.ok(up.dot(normal)>.99999,'upright along the local ocean normal');
      const deck=new THREE.Vector3(0,SHIP_DECK_HEIGHT,0).applyMatrix4(ship.matrixWorld);
      assert.ok(deck.length()>PLANET_RADIUS+.8,'visible freeboard, not a submerged deck');
      ship.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const position=o.geometry.getAttribute('position');
        // Inspect the actual model vertices, including the tapered keel and bow.
        for(let i=0;i<position.count;i+=3){const p=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld),r=p.length();
          assert.ok(r>=PLANET_RADIUS-SHIP_DRAFT-.03,'only the designed draft may submerge');
          if(r<PLANET_RADIUS+.1)assert.ok(r>PLANET_RADIUS+planetElevation(p.normalize()),'hull must not run aground');
        }
      });
    }
  }
  for(const river of [4,6,8]){
    transport.update(snapshotForGame({...evaluate([]).levels,settlers:1,river}),false);
    const fleet=transport.group.children.filter(ship=>ship.userData.shipType);
    assert.equal(fleet.length,2,'upgrades retain one vessel of each type');
    assert.equal(fleet.filter(ship=>ship.userData.shipType==='fishing').length,1);
    assert.equal(fleet.filter(ship=>ship.userData.shipType==='flagship').length,1);
  }
  transport.dispose();
});
