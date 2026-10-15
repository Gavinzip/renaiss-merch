import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createGiftBoxMaterials } from './createGiftBoxMaterials'
import { createGiftBoxWindow } from './createGiftBoxWindow'
import { createGiftBoxInsert } from './createGiftBoxInsert'
import { createGiftBoxRear } from './createGiftBoxRear'
import { createGiftBoxTop } from './createGiftBoxTop'

/** Open carton with a real cavity. Only the printed paper uses the product image. */
export function createGiftBoxModel(sourceTexture: THREE.Texture, figure: THREE.Group, cardTexture: THREE.Texture) {
  const root = new THREE.Group()
  root.name = 'charizard-gift-box-v5'
  const shell = new THREE.Group()
  shell.name = 'carton-shell'
  root.add(shell)
  const { paper, printedPaper, pet, insert, lining, trayBase, cutEdge } = createGiftBoxMaterials(sourceTexture)
  const panel = (name: string, size: number[], position: number[], material: THREE.Material) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 3, 0.004), material)
    mesh.name = name
    mesh.position.set(position[0], position[1], position[2])
    mesh.castShadow = mesh.receiveShadow = true
    shell.add(mesh)
    return mesh
  }
  panel('left-upper-rail', [0.03, 0.30, 2.24], [-1.485, 1.35, 0], paper)
  panel('left-lower-rail', [0.03, 0.95, 2.24], [-1.485, -1.025, 0], paper)
  panel('left-rear-spine', [0.03, 1.75, 0.22], [-1.485, 0.325, -1.01], paper)
  panel('right-wall', [0.03, 3, 2.24], [1.485, 0, 0], paper)
  shell.add(createGiftBoxRear(paper, pet, cardTexture))
  panel('top-lid', [3.008, 0.032, 2.25], [0, 1.491, 0], paper)
  panel('bottom-wall', [3, 0.06, 2.24], [0, -1.47, 0], paper)
  panel('interior-backing', [2.91, 2.91, 0.025], [0, 0, -1.04], lining)
  panel('interior-floor', [2.89, 0.055, 1.99], [0, -0.625, 0.02], trayBase)
  shell.add(createGiftBoxInsert(insert))

  // The die-cut follows the photographed carton. No window/figurine photo is rendered.
  const point = (x: number, y: number) => new THREE.Vector2(x / 400 - 1.5, 1.5 - (y - 125) * 3 / 1225)
  const shape = new THREE.Shape([point(0, 125), point(1200, 125), point(1200, 1350), point(0, 1350)])
  const cutout = new THREE.Path([
    point(6, 249), point(266, 249), point(268, 312), point(309, 347),
    point(486, 347), point(520, 369), point(765, 369), point(796, 348),
    point(879, 348), point(907, 249), point(1074, 249), point(1074, 949),
    point(838, 949), point(825, 918), point(397, 918), point(373, 949), point(6, 949),
  ])
  shape.holes.push(cutout)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.026, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 12 })
  const positions = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (positions.getX(i) + 1.5) / 3, 1 - (125 + (1.5 - positions.getY(i)) * 1225 / 3) / 1350)
  }
  const front = new THREE.Mesh(geometry, [printedPaper, cutEdge])
  front.name = 'die-cut-front-print'
  front.position.z = 1.12
  front.castShadow = front.receiveShadow = true
  shell.add(front)

  const window = createGiftBoxWindow(pet)
  shell.add(window)
  for (const x of [-1.502, 1.502]) {
    panel('fold-edge', [0.002, 2.9, 0.009], [x, -0.018, -0.96], cutEdge)
    panel('lid-tuck-seam', [0.002, 0.006, 2.16], [x, 1.443, -0.01], cutEdge)
  }
  shell.add(createGiftBoxTop(sourceTexture))

  figure.position.set(0, 0.275, 0.02)
  root.add(figure)
  root.userData.sculptRuntime = {
    nodes: { root, shell, front, window, figure },
    sockets: { center: new THREE.Vector3() },
    colliders: [{ type: 'box', size: [3, 3, 2.275] }],
    destructionGroups: {},
  }
  return root
}
