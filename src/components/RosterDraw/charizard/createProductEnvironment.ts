import * as THREE from 'three'
import { disposeScene } from './disposeScene'

/** Studio reflection cards make coating, foil and PET respond to the same environment. */
export function createProductEnvironment(renderer: THREE.WebGLRenderer) {
  const studio = new THREE.Scene()
  studio.background = new THREE.Color('#353438')
  const lightCard = (position: number[], width: number, height: number, power: number, color = '#ffffff') => {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide, toneMapped: false,
    }))
    card.position.set(position[0], position[1], position[2])
    card.lookAt(0, 0, 0)
    studio.add(card)
  }
  lightCard([-4.5, 3, 4], 3.4, 5, 3.5, '#fff6e9')
  lightCard([-3.2, 0.7, 5.5], 0.55, 5.5, 2.5)
  lightCard([4, 1.6, 4], 1.1, 5, 3.2, '#eef5ff')
  lightCard([0, 5, 1.5], 4, 3, 1.4)
  lightCard([0, 0, -5], 2, 4, 1.2)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const target = pmrem.fromScene(studio, 0.025)
  disposeScene(studio)
  pmrem.dispose()
  return target
}
