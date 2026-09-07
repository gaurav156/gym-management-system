import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import type { CameraDevice } from 'html5-qrcode'

interface Props {
  active: boolean
  onScan: (decodedText: string) => void
  onCameraError?: (message: string) => void
}

const ELEMENT_ID = 'qr-reader-region'

// Wraps html5-qrcode's camera scanner. All start()/stop() calls are chained through
// opChainRef so they can never overlap - critical because React 18 StrictMode
// double-invokes this effect in dev (mount -> cleanup -> mount again). Without this
// chaining, cleanup's stop() can fire before the matching start() has resolved, which
// orphans the camera stream: the capture indicator/flashlight stays on, but the video
// element it was attaching to gets torn down mid-initialization and nothing is ever
// shown. Chaining guarantees stop() always waits for its start() to finish first.
export default function QrScanner({ active, onScan, onCameraError }: Props) {
  const html5QrRef = useRef<Html5Qrcode | null>(null)
  const opChainRef = useRef<Promise<void>>(Promise.resolve())
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const [starting, setStarting] = useState(false)
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [cameraIndex, setCameraIndex] = useState(0)

  // Discover cameras once the scanner becomes active, so phones with both a front and
  // back camera get a "Switch camera" control and default to the back one. Silently
  // falls back to facingMode if enumeration isn't available - start() below still works.
  useEffect(() => {
    if (!active) return
    let cancelled = false
    Html5Qrcode.getCameras()
      .then((list) => {
        if (cancelled) return
        setCameras(list)
        const backIndex = list.findIndex((c) => /back|rear|environment/i.test(c.label))
        if (backIndex >= 0) setCameraIndex(backIndex)
      })
      .catch(() => { /* can fail pre-permission on some browsers - not fatal */ })
    return () => { cancelled = true }
  }, [active])

  useEffect(() => {
    if (!active) return

    opChainRef.current = opChainRef.current.then(async () => {
      setStarting(true)
      try {
        const scanner = new Html5Qrcode(ELEMENT_ID, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        })
        html5QrRef.current = scanner

        const cameraConfig: any =
          cameras.length > 0
            ? { deviceId: { exact: cameras[cameraIndex]?.id ?? cameras[0].id } }
            : { facingMode: 'environment' }

        await scanner.start(
          cameraConfig,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => onScanRef.current(decodedText),
          () => { /* fires continuously while no QR is in frame - expected, ignore */ }
        )
      } catch (err) {
        onCameraError?.('Could not access the camera. Check browser permissions, or use PIN check-in instead.')
        console.error('QR scanner start failed:', err)
        html5QrRef.current = null
      } finally {
        setStarting(false)
      }
    })

    return () => {
      opChainRef.current = opChainRef.current.then(async () => {
        const scanner = html5QrRef.current
        html5QrRef.current = null
        if (!scanner) return
        try { await scanner.stop() } catch { /* already stopped/never started - fine */ }
        try { scanner.clear() } catch { /* ignore */ }
      })
    }
  }, [active, cameraIndex, cameras])

  if (!active) return null

  return (
    <div>
      <div
        id={ELEMENT_ID}
        className="mx-auto w-full max-w-xs overflow-hidden rounded-md bg-black"
        style={{ minHeight: 250 }}
      />
      {starting && <p className="mt-2 text-center text-xs text-gray-400">Starting camera...</p>}
      {cameras.length > 1 && (
        <button
          type="button"
          onClick={() => setCameraIndex((i) => (i + 1) % cameras.length)}
          className="mx-auto mt-2 block text-xs text-gray-500 hover:underline"
        >
          Switch camera
        </button>
      )}
    </div>
  )
}