import * as THREE from 'three';
import { FILM_BOX as D } from './filmBoxDesign';
import { prism, shellRing } from './filmBoxGeometry';
import { texturedCap, texturedWalls } from './filmBoxUVGeometry';
import { filmBoxAtlasTexture } from './filmBoxTextureAtlas';

// Generated-view pixels are the visible surface. Geometry supplies thickness,
// a genuinely empty cavity and a separately hinged upper shell.
export function createSurfFilmBoxModel(image: ImageBitmap) {
  const root = new THREE.Group(); root.name = 'surfFilmBox';
  const base = new THREE.Group(); base.name = 'base.shell'; root.add(base);
  const lid = new THREE.Group(); lid.name = 'lid.shell'; lid.position.set(0,D.baseHeight+D.seam,D.hingeZ); root.add(lid);
  const texture = filmBoxAtlasTexture(image);
  // The source already includes studio illumination. Preserve its exact colour
  // instead of relighting baked highlights a second time.
  const exterior = new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
  const lining = new THREE.MeshStandardMaterial({color:'#242128',metalness:.3,roughness:.64});
  const rim = new THREE.MeshPhysicalMaterial({color:'#423a43',metalness:.9,roughness:.34});
  const floorMaterial = new THREE.MeshStandardMaterial({map:texture,color:'#b7adb6',metalness:.18,roughness:.7,
    emissive:'#fff0dc',emissiveIntensity:0});
  const lidInteriorMaterial = new THREE.MeshStandardMaterial({map:texture,color:'#b7adb6',metalness:.18,roughness:.7});
  const materials = [exterior,lining,rim,floorMaterial,lidInteriorMaterial], geometries: THREE.BufferGeometry[] = [];
  function part(parent: THREE.Group, name: string, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number,number,number]) {
    geometries.push(geometry); const mesh = new THREE.Mesh(geometry,material); mesh.name=name; mesh.position.set(...position);
    mesh.castShadow=mesh.receiveShadow=true; parent.add(mesh); return mesh;
  }
  part(base,'base.photoUV',texturedWalls(D.baseHeight,'Base'),exterior,[0,0,0]);
  part(lid,'lid.photoUV',texturedWalls(D.lidHeight,'Lid'),exterior,[0,0,D.depth/2]);
  const deckWidth=D.width-D.bevel*2, deckDepth=D.depth-D.bevel*2, deckCut=D.chamfer-D.bevel*.6;
  part(lid,'lid.topPhotoUV',texturedCap(deckWidth,deckDepth,deckCut,'top'),exterior,[0,D.lidHeight+.001,D.depth/2]);
  // The inner wall surface sits strictly inside the mapped outer shell. Its
  // top and bottom rings create physical rim thickness, with no painted recess.
  part(base,'base.innerWalls',shellRing(deckWidth-.004,deckDepth-.004,D.baseHeight-.008,deckCut,D.wall,0),lining,[0,.004,0]);
  part(lid,'lid.innerWalls',shellRing(deckWidth-.004,deckDepth-.004,D.lidHeight-.008,deckCut,D.wall,0),lining,[0,.004,D.depth/2]);
  part(base,'base.floor',prism(deckWidth-.01,deckDepth-.01,D.wall,deckCut,0),lining,[0,0,0]);
  part(base,'base.floorPhotoUV',texturedCap(deckWidth-D.wall*2,deckDepth-D.wall*2,deckCut-D.wall*.5,'lining'),floorMaterial,[0,D.wall+.001,0]);
  part(lid,'lid.ceiling',prism(deckWidth-.01,deckDepth-.01,D.wall,deckCut,0),lining,[0,D.lidHeight-D.wall,D.depth/2]);
  part(lid,'lid.insidePhotoUV',texturedCap(deckWidth-D.wall*4,deckDepth-D.wall*4,deckCut,'lining',true),lidInteriorMaterial,[0,D.lidHeight-D.wall-.004,D.depth/2]);
  part(lid,'lid.innerPanelFrame',shellRing(deckWidth-D.wall*4+.016,deckDepth-D.wall*4+.016,.008,deckCut,.008,0),rim,[0,D.lidHeight-D.wall-.008,D.depth/2]);
  part(base,'base.rim',shellRing(deckWidth,deckDepth,.009,deckCut,D.wall,0),rim,[0,D.baseHeight-.009,0]);
  part(lid,'lid.rim',shellRing(deckWidth,deckDepth,.009,deckCut,D.wall,0),rim,[0,0,D.depth/2]);
  for(const x of [-.55,.55]) {
    const pin = new THREE.CylinderGeometry(.028,.028,.25,24); pin.rotateZ(Math.PI/2);
    part(base,'rearHinge.'+x,pin,rim,[x,D.baseHeight,D.hingeZ]);
    const knuckle = new THREE.CylinderGeometry(.030,.030,.16,24); knuckle.rotateZ(Math.PI/2);
    part(lid,'lid.rearHinge.'+x,knuckle,rim,[x,.012,.006]);
    part(lid,'lid.hingeLeaf.'+x,new THREE.BoxGeometry(.16,.018,.09),rim,[x,.015,.04]);
  }
  const spill = new THREE.PointLight('#fff2e7',0,1.5,2); spill.position.set(0,D.baseHeight-.1,0); base.add(spill);
  const worldScale = new THREE.Vector3();
  const nodes: Record<string,THREE.Object3D> = {}; root.traverse(node=>{if(node.name)nodes[node.name]=node;});
  root.userData.sculptRuntime = {nodes,pivots:{rearHinge:lid},sockets:{rearHinge:new THREE.Vector3(0,D.baseHeight+D.seam,D.hingeZ),cardEmit:new THREE.Vector3(0,D.baseHeight+.075,.04)},colliders:[{node:base.name,type:'compound',size:[D.width,D.baseHeight,D.depth]}],destructionGroups:{base:[base],lid:[lid]},surfaceMethod:'generated-view UV atlas',contents:'empty'};
  const states=materials.map(material=>({material,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite}));
  return {root,lid,
    setOpening(amount: number){lid.rotation.x=-Math.max(0,Math.min(D.maxOpening,amount))*D.openingAngle;},
    setCharge(amount: number){
      // Point-light distance/intensity do not inherit a parent's scale. The
      // ceremony is pixel-sized while the review lab uses metre-sized geometry.
      const unit=root.getWorldScale(worldScale).x;
      spill.distance=unit*1.5;
      const charge=Math.max(0,Math.min(1,amount));
      spill.intensity=charge*.46*unit*unit;
      floorMaterial.emissiveIntensity=charge*1.65;
    },
    setOpacity(amount: number){for(const state of states){state.material.opacity=state.opacity*amount;state.material.transparent=state.transparent||amount<1;state.material.depthWrite=state.depthWrite&&amount>.9;}},
    dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());texture.dispose();image.close();root.removeFromParent();},
  };
}
