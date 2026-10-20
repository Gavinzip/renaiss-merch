import * as THREE from 'three'
import { createProductEnvironment } from '../../draw/bonus-prize/createProductEnvironment'
import { disposeScene } from '../../draw/bonus-prize/disposeScene'
import { loadBonusPrizeModel } from './loadWinnerPrizeModels'

/** Transparent 3D grand-prize view; the standard prize stays a DOM image. */
export function createWinnerPrizeGallery({ host, slot, onStatus }) {
  let renderer
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }) }
  catch { onStatus('error'); return { dispose() {}, rotate() {} } }
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.setClearColor(0x000000, 0)
  renderer.autoClear = false
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(31, 1, .1, 40)
  let environment
  try { environment = createProductEnvironment(renderer) }
  catch (error) { renderer.dispose(); renderer.domElement.remove(); throw error }
  scene.environment = environment.texture
  scene.environmentIntensity = .65
  scene.add(new THREE.HemisphereLight(0xf0f6ff, 0xc4a176, 1.4))
  const key = new THREE.DirectionalLight(0xfff5e5, 2.4)
  key.position.set(-3, 5, 7); key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 20 })
  key.shadow.normalBias = .025
  const fill = new THREE.DirectionalLight(0xe7f0ff, 1.2); fill.position.set(4, 1, 5)
  const rim = new THREE.DirectionalLight(0xffdfb6, 1.3); rim.position.set(2, 4, -3)
  scene.add(key, key.target, fill, rim)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: 0x76644c, opacity: .08, depthWrite: false }))
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.67; floor.receiveShadow = true; scene.add(floor)
  const stage = {
    slot, object: null, ready: false, loading: false, visible: false, rect: null,
    angle: .28, targetAngle: .28, pointer: null,
  }
  let disposed = false, contextAvailable = true, frame = 0, previous = 0
  let width = 0, height = 0, tickCount = 0
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const requestFrame = () => {
    if (!frame && !disposed && contextAvailable && !document.hidden) frame = requestAnimationFrame(draw)
  }
  function measure() {
    width = window.innerWidth; height = window.innerHeight
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 640 ? 1.4 : 1.5, Math.sqrt(1_800_000 / (width * height))))
    renderer.setSize(width, height, false)
    requestFrame()
  }
  async function load() {
    if (stage.loading) return
    stage.loading = true
    try {
      const object = await loadBonusPrizeModel()
      if (disposed) { disposeScene(object); return }
      stage.object = object
      object.rotation.y = stage.angle; scene.add(object)
      camera.position.set(0, .8, 9); camera.lookAt(0, -.03, 0)
      await renderer.compileAsync(scene, camera)
      if (disposed) return
      stage.ready = true
      onStatus('ready')
      stage.slot.dataset.modelReady = 'true'
      stage.slot.dataset.modelSource = object.name
      requestFrame()
    } catch {
      if (!disposed) {
        if (stage.object) { scene.remove(stage.object); disposeScene(stage.object); stage.object = null }
        onStatus('error')
      }
    }
  }
  function draw(now) {
    frame = 0
    if (disposed || document.hidden || !contextAvailable) return
    const delta = Math.min((now - previous) / 1000 || 0, .04); previous = now
    // Sticky positioning, font/layout changes and nested scrolling can move a view
    // without a window scroll event. Measure active views before every render.
    stage.rect = slot.getBoundingClientRect()
    stage.visible = stage.rect.bottom > 0 && stage.rect.top < height && stage.rect.width > 0
    renderer.setScissorTest(false); renderer.clear()
    let moving = false
    if (stage.visible && stage.ready) {
      const rect = stage.rect
      const scissorTop = Math.max(0, rect.top), scissorBottom = Math.min(height, rect.bottom)
      const scissorLeft = Math.max(0, rect.left), scissorRight = Math.min(width, rect.right)
      if (scissorBottom <= scissorTop || scissorRight <= scissorLeft) return
      stage.angle = motion.matches ? stage.targetAngle : THREE.MathUtils.damp(stage.angle, stage.targetAngle, 7, delta)
      stage.object.rotation.y = stage.angle + (motion.matches ? 0 : Math.sin(now * .00032) * .025)
      stage.object.position.y = motion.matches ? 0 : Math.sin(now * .00065) * .022
      camera.aspect = rect.width / rect.height
      const distance = Math.max(3.15 / camera.aspect, 3.35) * .64 / Math.tan(THREE.MathUtils.degToRad(15.5)) + 1.25
      camera.position.set(0, .9, distance); camera.lookAt(0, -.02, 0); camera.updateProjectionMatrix()
      renderer.setViewport(rect.left, height - rect.bottom, rect.width, rect.height)
      renderer.setScissor(scissorLeft, height - scissorBottom, scissorRight - scissorLeft, scissorBottom - scissorTop)
      renderer.setScissorTest(true); renderer.render(scene, camera)
      stage.slot.dataset.drawCalls = String(renderer.info.render.calls)
      stage.slot.dataset.triangles = String(renderer.info.render.triangles)
      moving ||= !motion.matches || Math.abs(stage.angle - stage.targetAngle) > .001
    }
    host.dataset.frame = String(++tickCount)
    if (moving) requestFrame()
  }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) load()
    requestFrame()
  }, { rootMargin: '350px' })
  const cleanups = []
  observer.observe(slot)
  const down = event => {
    if (!stage.object || (event.pointerType === 'mouse' && event.button !== 0)) return
    stage.pointer = { id: event.pointerId, x: event.clientX }; stage.slot.setPointerCapture(event.pointerId)
  }
  const move = event => {
    if (!stage.pointer || stage.pointer.id !== event.pointerId) return
    stage.targetAngle += (event.clientX - stage.pointer.x) * .006
    stage.pointer.x = event.clientX; requestFrame()
  }
  const up = () => { stage.pointer = null }
  const keydown = event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault(); stage.targetAngle += event.key === 'ArrowLeft' ? -.25 : .25; requestFrame()
  }
  for (const [name, listener] of [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up], ['keydown', keydown]]) {
    stage.slot.addEventListener(name, listener); cleanups.push(() => stage.slot.removeEventListener(name, listener))
  }
  const scroll = () => requestFrame()
  const visibility = () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0 }
    else { previous = performance.now(); requestFrame() }
  }
  const contextLost = event => {
    event.preventDefault(); contextAvailable = false; cancelAnimationFrame(frame); frame = 0
    onStatus('error')
  }
  document.addEventListener('scroll', scroll, { passive: true, capture: true }); window.addEventListener('resize', measure)
  document.addEventListener('visibilitychange', visibility); motion.addEventListener('change', visibility)
  renderer.domElement.addEventListener('webglcontextlost', contextLost)
  measure()
  return {
    rotate(direction) { if (stage.ready) { stage.targetAngle += direction * .25; requestFrame() } },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); cleanups.forEach(cleanup => cleanup())
      document.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', measure)
      document.removeEventListener('visibilitychange', visibility); motion.removeEventListener('change', visibility)
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      disposeScene(scene); environment.dispose(); renderer.dispose(); renderer.domElement.remove()
    },
  }
}
