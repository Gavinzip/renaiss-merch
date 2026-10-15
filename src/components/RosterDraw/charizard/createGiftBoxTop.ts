import * as THREE from 'three'

/** Unproject the photographed lid onto a subdivided top plane, preserving its gold symbols. */
export function createGiftBoxTop(print: THREE.Texture) {
  const geometry = new THREE.PlaneGeometry(2.99, 2.23, 24, 24)
  const uv = geometry.getAttribute('uv')
  // Source trapezoid: back edge (157,0)..(1040,0), front edge (0,125)..(1200,125).
  const ratio = 1200 / (1040 - 157)
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = 1 - uv.getY(i)
    const depth = v / (ratio + v * (1 - ratio))
    const left = 157 * (1 - depth)
    const width = 883 + 317 * depth
    uv.setXY(i, (left + u * width) / 1200, 1 - depth * 125 / 1350)
  }
  const material = new THREE.MeshPhysicalMaterial({
    map: print, roughness: 0.42, metalness: 0,
    clearcoat: 0.22, clearcoatRoughness: 0.3, envMapIntensity: 0.42,
  })
  const top = new THREE.Mesh(geometry, material)
  top.rotation.x = -Math.PI / 2
  top.position.y = 1.509
  top.name = 'top-energy-symbol-print'
  return top
}
