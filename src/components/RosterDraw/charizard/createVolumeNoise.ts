import * as THREE from 'three'

/** Tileable scalar field sampled inside world-space volumes, not billboard smoke art. */
export function createVolumeNoise() {
  const size = 64
  const data = new Uint8Array(size ** 3)
  const hash = (x: number, y: number, z: number) => {
    let n = ((x & 7) * 374761393 + (y & 7) * 668265263 + (z & 7) * 2147483647) | 0
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295
  }
  const mix = (a: number, b: number, t: number) => a + (b - a) * t
  const noise = (x: number, y: number, z: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
    let fx = x - ix, fy = y - iy, fz = z - iz
    fx *= fx * (3 - 2 * fx); fy *= fy * (3 - 2 * fy); fz *= fz * (3 - 2 * fz)
    const a = mix(mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx), mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy)
    const b = mix(mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx), mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx), fy)
    return mix(a, b, fz)
  }
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    data[x + size * (y + size * z)] = Math.round(noise(x / 8, y / 8, z / 8) * 255)
  }
  const texture = new THREE.Data3DTexture(data, size, size, size)
  texture.format = THREE.RedFormat
  texture.type = THREE.UnsignedByteType
  texture.minFilter = texture.magFilter = THREE.LinearFilter
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping
  texture.unpackAlignment = 1
  texture.needsUpdate = true
  return texture
}
