import { useEffect, useRef, useState } from 'react'

export function useWinnerPrizeGallery(bonusRef) {
  const hostRef = useRef(null), runtimeRef = useRef(null)
  const [status, setStatus] = useState('loading')
  useEffect(() => {
    if (!bonusRef.current) return
    let disposed = false
    import('./createWinnerPrizeGallery').then(({ createWinnerPrizeGallery }) => {
      if (disposed) return
      runtimeRef.current = createWinnerPrizeGallery({
        host: hostRef.current,
        slot: bonusRef.current,
        onStatus: state => { if (!disposed) setStatus(state) },
      })
    }).catch(() => {
      if (!disposed) setStatus('error')
    })
    return () => { disposed = true; runtimeRef.current?.dispose(); runtimeRef.current = null }
  }, [bonusRef])
  return { hostRef, status, rotate: direction => runtimeRef.current?.rotate(direction) }
}
