import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createGiftBoxModel } from './createGiftBoxModel'
import { createPrizeScene } from './createPrizeScene'
import { sampleReveal, REVEAL_DURATION } from './revealTimeline'
import { loadCharizardModel } from './loadCharizardModel'
import { disposeScene } from './disposeScene'
import { createFinaleEffects } from './createFinaleEffects'
import { createFinaleRenderer } from './createFinaleRenderer'
import { PRIZE_HOVER_Y } from './prizeStageLayout'

export function GiftBoxCanvas({ textureUrl, cardTextureUrl, playing, runId, initialTime = 0, readPlaybackTime, view, onWinnerVisible, onComplete, onReady, onError, cinematic = false, onPhaseChange, onFrame, onProgress, seek, active = true }) {
  const hostRef = useRef(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const latest = useRef({})
  latest.current = { active, playing, view, onWinnerVisible, onComplete, onReady, onError, onPhaseChange, onFrame, onProgress, readPlaybackTime }
  const invalidate = useRef(() => {})
  const timeline = useRef({ seconds: initialTime, turnAngle: 0.28, dragOffset: 0, revealed: false, completed: false })
  useEffect(() => {
    timeline.current = { seconds: initialTime, turnAngle: 0.28, dragOffset: 0, revealed: false, completed: false }
    onWinnerVisible(false)
    invalidate.current()
  }, [runId, initialTime, onWinnerVisible])
  useEffect(() => {
    timeline.current.turnAngle = view === 'back' ? Math.PI : 0.28
    timeline.current.dragOffset = 0
    invalidate.current()
  }, [view])
  useEffect(() => { invalidate.current() }, [playing, active])
  useEffect(() => {
    if (!seek) return
    timeline.current.seconds = seek.seconds
    timeline.current.completed = false
    invalidate.current()
  }, [seek])
  useEffect(() => {
    const host = hostRef.current
    setReady(false)
    setError('')
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !cinematic, alpha: !cinematic })
    } catch {
      setError('無法啟動 3D，請開啟瀏覽器硬體加速後重新載入。')
      latest.current.onError?.()
      return
    }
    // The cinematic scene has its own MSAA target; multisampling the final canvas
    // again only multiplies bandwidth. Its pixel budget is set once per resize.
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    host.appendChild(renderer.domElement)
    const { scene, camera, environmentTarget, key, rim, fill, ambient, fireLight } = createPrizeScene(renderer, cinematic)
    const cinematicRenderer = cinematic ? createFinaleRenderer(renderer, scene, camera) : null
    const effects = cinematic ? createFinaleEffects() : null
    if (effects) scene.add(effects.group)
    let disposed = false
    let contextAvailable = true
    let model
    let sceneReady = false
    let readyReported = false
    let frame = 0
    let previousTime = performance.now()
    let previousPose = ''
    let previousPhase = ''
    let previousProgress = -1
    let narrow = false
    let resizeCount = 0
    let surfaceWidth = 0, surfaceHeight = 0
    const frameSamples = []
    let pointerX = null
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const requestFrame = () => {
      if (!frame && !disposed && contextAvailable && sceneReady && !document.hidden && (latest.current.active || !readyReported)) frame = requestAnimationFrame(tick)
    }
    invalidate.current = () => { previousPose = ''; previousTime = performance.now(); requestFrame() }
    const tick = (now) => {
      frame = 0
      if (disposed || (!latest.current.active && readyReported)) return
      const elapsedMs = now - previousTime
      const delta = Math.min(elapsedMs / 1000, 0.05)
      previousTime = now
      const state = timeline.current
      const options = latest.current
      if (options.playing && !document.hidden && pointerX === null) {
        state.seconds = Math.min(REVEAL_DURATION, options.readPlaybackTime ? options.readPlaybackTime() : state.seconds + delta)
        if (!motionPreference.matches && ['turntable', 'figure'].includes(options.view)) state.turnAngle += delta * 0.3
      }
      const pose = sampleReveal(state.seconds, motionPreference.matches)
      options.onFrame?.(pose)
      const progressTick = Math.floor(state.seconds * 10)
      if (progressTick !== previousProgress) {
        previousProgress = progressTick
        options.onProgress?.(motionPreference.matches ? REVEAL_DURATION : state.seconds)
      }
      const inspecting = options.view !== 'reveal'
      if (pose.phase !== previousPhase) {
        previousPhase = pose.phase
        options.onPhaseChange?.(pose.phase)
      }
      if (pose.winnerVisible !== state.revealed) {
        state.revealed = pose.winnerVisible
        options.onWinnerVisible(pose.winnerVisible)
      }
      if (pose.finished && !state.completed) {
        state.completed = true; options.onComplete?.()
      }
      host.dataset.revealTime = state.seconds.toFixed(2)
      const renderKey = `${pose.y}:${pose.z}:${pose.rotationY}:${pose.opacity}:${options.view}:${inspecting ? state.turnAngle + state.dragOffset : 0}:${cinematic && !motionPreference.matches ? state.seconds : 0}`
      if (document.hidden || renderKey === previousPose) {
        if (options.playing && !motionPreference.matches && (!pose.finished || inspecting)) requestFrame()
        return
      }
      previousPose = renderKey
      model.position.set(0, inspecting ? 0 : pose.y, inspecting ? 0 : pose.z)
      model.scale.setScalar(inspecting ? 1 : pose.scale)
      model.visible = inspecting || pose.opacity > .01
      model.rotation.set(0, (inspecting ? state.turnAngle + state.dragOffset : pose.rotationY), inspecting ? 0 : pose.rotationZ)
      const { shell, figure } = model.userData.sculptRuntime.nodes
      shell.visible = options.view !== 'figure'
      figure.scale.setScalar(figure.userData.displayScale * (options.view === 'figure' ? 1.75 : 1))
      figure.position.set(0, options.view === 'figure' ? 0 : 0.275, options.view === 'figure' ? 0 : 0.02)
      renderer.domElement.style.opacity = cinematic || inspecting ? '1' : String(pose.opacity)
      if (cinematic) {
        effects.update(state.seconds, motionPreference.matches, renderer.getPixelRatio())
        cinematicRenderer.update(state.seconds, motionPreference.matches, narrow)
        key.intensity = 2.1 * pose.light
        // Keep the complete moving carton inside the shadow camera, including its rear entrance.
        key.position.set(-3, pose.y + 4, pose.z + 7)
        key.target.position.copy(model.position)
        key.target.updateMatrixWorld()
        ambient.intensity = .08 + pose.light * .66
        fill.intensity = .04 + pose.light * .71
        rim.intensity = .2 + pose.atmosphere * 2.2 + pose.impact * 2
        rim.color.setRGB(1, .64 + pose.handoff * .25, .32 + pose.handoff * .43)
        fireLight.intensity = pose.fire * 2.2
        scene.environmentIntensity = .04 + Math.min(1, pose.light) * .71
        // Fit the rotated carton with breathing room even before the portrait canvas shrinks.
        const horizontalFit = 2 / (.82 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect) + 1.8
        const distance = Math.max(12.7 - pose.cameraPush * 3.3 + pose.handoff * .4, horizontalFit) * (1 + (narrow ? pose.handoff * .2 : 0))
        const offset = narrow ? 0 : camera.aspect * 1.05 * pose.handoff
        camera.position.set(offset - .65 * (1 - pose.approach), PRIZE_HOVER_Y + 1.1 + pose.cameraPush * .65 + pose.handoff * .9 + pose.impact * .035, distance)
        camera.lookAt(offset, PRIZE_HOVER_Y - .38 * (1 - pose.handoff), 0)
        camera.setViewOffset(camera.aspect, 1, 0, narrow ? pose.handoff * .24 : 0, camera.aspect, 1)
      }
      const renderStart = performance.now()
      renderer.info.reset()
      renderer.info.autoReset = false
      if (cinematicRenderer) cinematicRenderer.render()
      else renderer.render(scene, camera)
      if (!readyReported) {
        // Readiness includes the actual prepared frame, not only shader compilation.
        renderer.getContext().finish()
        readyReported = true
        host.dataset.preparedAt = performance.now().toFixed(1)
        setReady(true)
        latest.current.onReady?.()
      }
      if (import.meta.env.DEV) {
        if (cinematicRenderer) host.dataset.sceneSamples = String(cinematicRenderer.getDiagnostics().sceneSamples)
        host.dataset.drawCalls = String(renderer.info.render.calls)
        host.dataset.triangles = String(renderer.info.render.triangles)
        host.dataset.renderMs = (performance.now() - renderStart).toFixed(1)
        host.dataset.prizePosition = model.position.toArray().map((value) => value.toFixed(3)).join(',')
        if (options.playing && state.seconds > 1 && elapsedMs > 1 && elapsedMs < 500) {
          frameSamples.push(elapsedMs)
          if (frameSamples.length > 120) frameSamples.shift()
          if (frameSamples.length % 30 === 0) {
            const ordered = [...frameSamples].sort((a, b) => a - b)
            host.dataset.frameMedianMs = ordered[Math.floor(ordered.length * .5)].toFixed(1)
            host.dataset.frameP95Ms = ordered[Math.floor(ordered.length * .95)].toFixed(1)
          }
        }
      }
      if (options.playing && !motionPreference.matches && (!pose.finished || inspecting)) requestFrame()
    }
    // Settle both loads so a failed asset cannot leak the other asset's GPU resources.
    Promise.allSettled([new THREE.TextureLoader().loadAsync(textureUrl), loadCharizardModel(), new THREE.TextureLoader().loadAsync(cardTextureUrl)]).then(async (assets) => {
      const [print, character, card] = assets
      if (disposed || assets.some((asset) => asset.status === 'rejected')) {
        if (print.status === 'fulfilled') print.value.dispose()
        if (character.status === 'fulfilled') disposeScene(character.value)
        if (card.status === 'fulfilled') card.value.dispose()
        if (!disposed) { setError('立體模型或包裝素材載入失敗，請重新載入預覽。'); latest.current.onError?.() }
        return
      }
      try {
        print.value.colorSpace = THREE.SRGBColorSpace
        print.value.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8)
        card.value.colorSpace = THREE.SRGBColorSpace
        card.value.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8)
        model = createGiftBoxModel(print.value, character.value, card.value)
        character.value.userData.displayScale = character.value.scale.x
        scene.add(model)
        // Finish shader compilation and allocate post/transmission targets before the reveal clock starts.
        await renderer.compileAsync(scene, camera)
        if (disposed) return
        cinematicRenderer?.warmup()
        host.dataset.modelVersion = 'v6-product-figurine-rebuild'
        host.dataset.sourceBounds = JSON.stringify(character.value.userData.sourceBounds)
        sceneReady = true
        previousTime = performance.now()
        requestFrame()
      } catch (loadError) {
        print.value.dispose()
        card.value.dispose()
        disposeScene(character.value)
        setError('立體場景建立失敗，請重新載入預覽。')
        latest.current.onError?.()
        console.error(loadError)
      }
    })
    const resize = () => {
      // CSS dimensions do not include the page's animated transform. A transform
      // must never change the backing buffers or restart the reveal clock.
      const width = host.clientWidth, height = host.clientHeight
      if (!width || !height || (width === surfaceWidth && height === surfaceHeight)) return
      surfaceWidth = width; surfaceHeight = height
      const pixelRatio = cinematic
        ? Math.min(window.devicePixelRatio, 2, Math.sqrt(1_800_000 / (width * height)))
        : Math.min(window.devicePixelRatio, 2)
      renderer.setPixelRatio(pixelRatio)
      // Keep this breakpoint aligned with the portrait composition in finale.css.
      narrow = window.matchMedia('(max-width: 700px), (max-width: 1000px) and (max-aspect-ratio: 1.2)').matches
      renderer.setSize(width, height)
      if (import.meta.env.DEV) host.dataset.rendererResizes = String(++resizeCount)
      cinematicRenderer?.resize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      invalidate.current()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    const pointerDown = (event) => {
      if (latest.current.view === 'reveal') return
      pointerX = event.clientX
      host.setPointerCapture(event.pointerId)
    }
    const pointerMove = (event) => {
      if (pointerX === null) return
      timeline.current.dragOffset += (event.clientX - pointerX) * 0.008
      pointerX = event.clientX
      invalidate.current()
    }
    const pointerUp = () => { pointerX = null }
    const keyDown = (event) => {
      if (latest.current.view === 'reveal' || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
      event.preventDefault()
      timeline.current.dragOffset += event.key === 'ArrowLeft' ? -0.2 : 0.2
      invalidate.current()
    }
    const contextLost = (event) => {
      event.preventDefault()
      contextAvailable = false
      cancelAnimationFrame(frame)
      frame = 0
      setError('3D 繪圖已中斷，請重新載入預覽。')
      latest.current.onError?.()
    }
    host.addEventListener('pointerdown', pointerDown)
    host.addEventListener('pointermove', pointerMove)
    host.addEventListener('pointerup', pointerUp)
    host.addEventListener('pointercancel', pointerUp)
    host.addEventListener('keydown', keyDown)
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    const visibilityChanged = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0 }
      else invalidate.current()
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    motionPreference.addEventListener('change', visibilityChanged)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      host.removeEventListener('pointerdown', pointerDown)
      host.removeEventListener('pointermove', pointerMove)
      host.removeEventListener('pointerup', pointerUp)
      host.removeEventListener('pointercancel', pointerUp)
      host.removeEventListener('keydown', keyDown)
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      document.removeEventListener('visibilitychange', visibilityChanged)
      motionPreference.removeEventListener('change', visibilityChanged)
      invalidate.current = () => {}
      disposeScene(scene)
      environmentTarget.dispose()
      cinematicRenderer?.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [textureUrl, cardTextureUrl, cinematic])
  return <div ref={hostRef} className="bonus-canvas" data-view={view} data-ready={ready} role="img" tabIndex={view !== 'reveal' ? 0 : undefined} aria-label={view !== 'reveal' ? '噴火龍禮盒 3D 模型，可拖曳或按左右鍵旋轉' : '噴火龍禮盒從後方穿出立體煙霧與火焰的出場動畫'}>{error ? <p className="bonus-canvas-status" role="alert">{error}</p> : !ready && <p className="bonus-canvas-status">正在準備立體典藏禮盒…</p>}</div>
}
