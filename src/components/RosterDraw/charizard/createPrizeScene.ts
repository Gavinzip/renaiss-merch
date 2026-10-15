import * as THREE from 'three'
import { createProductEnvironment } from './createProductEnvironment'
import { PRIZE_GROUND_Y } from './prizeStageLayout'

export function createPrizeScene(renderer: THREE.WebGLRenderer, cinematic = false) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 50)
  camera.position.set(0, 2.8, 10.2)
  camera.lookAt(0, 0, 0)
  const ambient = new THREE.HemisphereLight(0xeaf3ff, 0xd5a878, 0.9)
  scene.add(ambient)
  if (cinematic) scene.background = new THREE.Color('#050709')
  const key = new THREE.DirectionalLight(0xfff4e3, 2.1)
  key.position.set(-3, 4, 7)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = key.shadow.camera.bottom = -4
  key.shadow.camera.right = key.shadow.camera.top = 4
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 20
  key.shadow.normalBias = 0.018
  key.shadow.bias = -0.0001
  key.shadow.radius = 9
  const fill = new THREE.DirectionalLight(0xe2edff, 0.75)
  fill.position.set(4, 1, 6)
  const rim = new THREE.DirectionalLight(0xffffff, 1.2)
  rim.position.set(1, 4, -4)
  scene.add(key, key.target, fill, rim)
  const fireLight = new THREE.PointLight(0xff8b35, 0, 12, 2)
  fireLight.position.set(-3, -0.8, 3.5)
  if (cinematic) scene.add(fireLight)
  const environmentTarget = createProductEnvironment(renderer)
  scene.environment = environmentTarget.texture
  scene.environmentIntensity = 0.75
  // This layer only receives shadows; invisible parts must not write an opaque depth plane.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: cinematic ? '#000000' : '#736455', opacity: cinematic ? .22 : .09, depthWrite: false }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = PRIZE_GROUND_Y
  floor.receiveShadow = true
  scene.add(floor)
  return { scene, camera, environmentTarget, key, rim, fill, ambient, fireLight }
}
