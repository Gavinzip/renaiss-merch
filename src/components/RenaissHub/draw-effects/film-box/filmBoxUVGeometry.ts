import * as THREE from 'three';
import { FILM_BOX as D } from './filmBoxDesign';
import { octagon } from './filmBoxGeometry';
import { filmBoxUV, type FilmBoxFace } from './filmBoxTextureAtlas';

// The image is projected over a chamfered shell, including its upper/lower
// bevels. Its photographed corner highlights follow actual changes in surface.
export function texturedWalls(height: number, shell: 'Base' | 'Lid') {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const rings = [[0,D.bevel],[D.bevel,0],[height-D.bevel,0],[height,D.bevel]].map(([y,inset]) => ({y,points:octagon(D.width-inset*2,D.depth-inset*2,Math.max(.01,D.chamfer-inset*.6))}));
  for(let ring=0;ring<rings.length-1;ring++) rings[ring].points.forEach(([ax,az], i) => {
    const [bx,bz] = rings[ring].points[(i+1)%8];
    const [cx,cz] = rings[ring+1].points[(i+1)%8], [dx,dz] = rings[ring+1].points[i];
    const face: FilmBoxFace = i === 2 ? `right${shell}` : i === 6 ? `left${shell}` : i <= 1 || i === 7 ? `back${shell}` : `front${shell}`;
    const horizontal = (x: number, z: number) => i === 2 ? .5 - z / D.depth : i === 6 ? .5 + z / D.depth : face.startsWith('back') ? .5 - x / D.width : .5 + x / D.width;
    const offset = positions.length / 3;
    for (const [x,y,z] of [[ax,rings[ring].y,az],[bx,rings[ring].y,bz],[cx,rings[ring+1].y,cz],[dx,rings[ring+1].y,dz]]) {
      positions.push(x,y,z); uv.push(...filmBoxUV(face,horizontal(x,z),y/height));
    }
    indices.push(offset,offset+2,offset+1,offset,offset+3,offset+2);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export function texturedCap(width: number, depth: number, cut: number, face: 'top' | 'lining', down = false) {
  const polygon = octagon(width,depth,cut), positions = [0,0,0], uv = filmBoxUV(face,.5,.5), indices: number[] = [];
  // The top photograph includes a second perimeter. Keep that perimeter off
  // the planar deck: the bevelled wall already carries the physical edge.
  const span = face === 'top' ? .86 : 1;
  polygon.forEach(([x,z]) => { positions.push(x,0,z); uv.push(...filmBoxUV(face,.5+x/width*span,.5-z/depth*span)); });
  for(let i=0;i<polygon.length;i++) {
    const a=i+1,b=(i+1)%polygon.length+1; indices.push(0,down?a:b,down?b:a);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
