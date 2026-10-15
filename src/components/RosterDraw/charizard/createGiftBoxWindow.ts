import * as THREE from 'three'

/** Thin formed PET: curved left return, front panel and a shallow pressed lower lip. */
export function createGiftBoxWindow(material: THREE.MeshPhysicalMaterial) {
  const group = new THREE.Group()
  group.name = 'formed-pet-window'
  const points: number[] = []
  const uv: number[] = []
  const indices: number[] = []
  const columns = 80
  const rows = 32
  for (let j = 0; j <= rows; j++) {
    const v = j / rows
    const y = -0.548 + v * 1.758
    for (let i = 0; i <= columns; i++) {
      const u = i / columns
      const x = -1.48 + u * 2.67
      const edgeCurl = 0.061 * Math.exp(-u * 65)
      const lowerFold = 0.012 * Math.exp(-v * 55)
      const bow = 0.009 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI)
      points.push(x, y, 1.108 - edgeCurl - lowerFold + bow)
      uv.push(u, v)
      if (i < columns && j < rows) {
        const n = j * (columns + 1) + i
        indices.push(n, n + 1, n + columns + 1, n + 1, n + columns + 2, n + columns + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const pane = new THREE.Mesh(geometry, material)
  pane.name = 'transparent-front-sheet'
  pane.renderOrder = 10
  group.add(pane)

  // The actual source has a visible curved plastic return along its left edge.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.474, -0.535, 1.057),
    new THREE.Vector3(-1.454, 0.24, 1.091),
    new THREE.Vector3(-1.474, 1.192, 1.057),
  ])
  const fold = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.009, 8, false), material)
  fold.name = 'pet-fold-highlight'
  group.add(fold)
  const side = new THREE.Mesh(new THREE.PlaneGeometry(2.00, 1.75, 1, 1), material)
  side.name = 'transparent-left-return'
  side.rotation.y = -Math.PI / 2
  side.position.set(-1.478, 0.325, 0.10)
  group.add(side)
  return group
}
