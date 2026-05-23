import { useRef, useState, useEffect } from 'react'

type Props = { src: string; alt?: string }

export default function ZoomableImage({ src, alt }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [src])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
        setScale(s => Math.min(8, Math.max(0.25, s * factor)))
      } else {
        setOffset(o => ({ x: o.x - e.deltaX, y: o.y - e.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return
    setOffset(o => ({
      x: o.x + e.clientX - lastPos.current.x,
      y: o.y + e.clientY - lastPos.current.y,
    }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }

  function onMouseUp() { dragging.current = false }

  function onDoubleClick() {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDoubleClick={onDoubleClick}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none', borderRadius: 8 }}
        />
      </div>
      {scale !== 1 && (
        <div className="absolute bottom-2 right-2 text-[10px] text-n-500 bg-white/90 px-2 py-1 rounded-md shadow-sm pointer-events-none">
          {Math.round(scale * 100)}% · double-click to reset
        </div>
      )}
    </div>
  )
}
