import { rosterDrawAsset } from '../rosterDrawAssets'
const scoreUrl = rosterDrawAsset('score')
import { ENTRANCE_DURATION } from './entranceMotion.js'

// The held first scene frame is at 1s; the score includes the 1.45s button entrance.
export const SCORE_OFFSET = ENTRANCE_DURATION / 1000 - 1
let context
let bufferPromise
const audioContext = () => (context ??= new AudioContext())

/** Call inside a trusted click, before any asset loading or draw request awaits. */
export function unlockFinaleAudio() {
  void audioContext().resume().catch((error) => console.warn('Finale audio could not start', error))
}

export function prepareFinaleAudio() {
  if (!bufferPromise) {
    bufferPromise = fetch(scoreUrl).then((response) => {
      if (!response.ok) throw new Error(`配樂載入失敗 (${response.status})`)
      return response.arrayBuffer()
    }).then((data) => audioContext().decodeAudioData(data)).catch(error => { bufferPromise = null; throw error })
  }
  return bufferPromise
}

/** One monotonic clock for the scene and its score. Muting never stops that clock. */
export function createFinaleSoundtrack(onState, now = () => performance.now() / 1000) {
  const ctx = audioContext()
  const output = ctx.createGain()
  output.connect(ctx.destination)
  let buffer, source, sourceGain, anchor = null, position = 1 + SCORE_OFFSET
  let disposed = false, muted = false, volume = .7, lastState
  const time = () => position + (anchor === null ? 0 : now() - anchor)
  const report = () => {
    const state = !buffer ? 'loading' : muted ? 'muted' : ctx.state !== 'running' ? 'blocked'
      : anchor === null ? 'paused' : time() >= buffer.duration ? 'ended' : 'playing'
    if (state !== lastState) { lastState = state; onState(state) }
  }
  const stopSource = () => {
    if (!source) return
    const oldSource = source, oldGain = sourceGain
    oldSource.onended = () => { oldSource.disconnect(); oldGain.disconnect() }
    oldGain.gain.cancelScheduledValues(ctx.currentTime)
    oldGain.gain.setValueAtTime(oldGain.gain.value, ctx.currentTime)
    oldGain.gain.linearRampToValueAtTime(0, ctx.currentTime + .012)
    oldSource.stop(ctx.currentTime + .015)
    source = sourceGain = null
  }
  const startSource = () => {
    stopSource()
    const offset = time()
    if (!disposed && buffer && anchor !== null && ctx.state === 'running' && offset < buffer.duration) {
      const node = ctx.createBufferSource(), gain = ctx.createGain()
      source = node; sourceGain = gain
      node.buffer = buffer
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + .012)
      node.connect(gain).connect(output)
      node.onended = () => {
        node.disconnect(); gain.disconnect()
        if (source === node) { source = sourceGain = null; report() }
      }
      node.start(0, Math.max(0, offset))
    }
    report()
  }
  const contextChanged = () => { if (!disposed) startSource() }
  ctx.addEventListener('statechange', contextChanged)
  return {
    time,
    attach(nextBuffer) { buffer = nextBuffer; startSource() },
    seek(seconds, playing) {
      position = Math.max(0, seconds); anchor = playing ? now() : null; startSource()
    },
    setPlaying(playing) {
      if (playing === (anchor !== null)) return
      position = time(); anchor = playing ? now() : null; startSource()
    },
    setVolume(nextVolume, nextMuted) {
      volume = nextVolume; muted = nextMuted
      output.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, .025)
      report()
    },
    dispose() {
      disposed = true; stopSource()
      setTimeout(() => output.disconnect(), 30)
      ctx.removeEventListener('statechange', contextChanged)
    },
  }
}
