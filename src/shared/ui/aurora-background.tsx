'use client'

import { useEffect, useRef } from 'react'

interface Orb {
  x: number
  y: number
  radius: number
  color: string
  vx: number
  vy: number
  baseX: number
  baseY: number
}

const COLORS = [
  'rgba(72, 202, 228, 0.8)',   // Vibrant Cyan
  'rgba(144, 224, 239, 0.7)',  // Light Blue
  'rgba(114, 9, 183, 0.6)',    // Vibrant Purple
  'rgba(255, 181, 167, 0.7)'   // Peach
]

export function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let orbs: Orb[] = []
    let frameId = 0
    const mouse = { x: -1000, y: -1000, active: false }

    const initOrbs = (w: number, h: number) => {
      orbs = []
      const numOrbs = 6
      for (let i = 0; i < numOrbs; i++) {
        orbs.push({
          x: Math.random() * w,
          y: Math.random() * h,
          baseX: Math.random() * w,
          baseY: Math.random() * h,
          radius: Math.max(w, h) * (Math.random() * 0.5 + 0.3), // Massive orbs
          color: COLORS[i % COLORS.length],
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
        })
      }
    }

    const applySize = (w: number, h: number) => {
      const dpr = window.devicePixelRatio || 1
      width = w
      height = h
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      initOrbs(w, h)
    }

    const drawFrame = () => {
      // Clear with a pure white base color so orbs show up beautifully
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)

      // Use multiply blending mode so colors elegantly combine against the white background
      ctx.globalCompositeOperation = 'multiply'

      for (let i = 0; i < orbs.length; i++) {
        const orb = orbs[i]
        
        orb.baseX += orb.vx
        orb.baseY += orb.vy

        if (orb.baseX < -orb.radius || orb.baseX > width + orb.radius) orb.vx *= -1
        if (orb.baseY < -orb.radius || orb.baseY > height + orb.radius) orb.vy *= -1

        let targetX = orb.baseX
        let targetY = orb.baseY

        if (mouse.active) {
          const dx = mouse.x - orb.baseX
          const dy = mouse.y - orb.baseY
          const dist = Math.sqrt(dx * dx + dy * dy)
          
          const pullStrength = Math.max(0, 1 - dist / (width * 0.8))
          targetX += dx * pullStrength * 0.2
          targetY += dy * pullStrength * 0.2
        }

        orb.x += (targetX - orb.x) * 0.05
        orb.y += (targetY - orb.y) * 0.05

        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius)
        grad.addColorStop(0, orb.color)
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)') // Fade to transparent white

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'source-over'
    }

    const tick = () => {
      drawFrame()
      frameId = requestAnimationFrame(tick)
    }

    const container = canvas.parentElement
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width: w, height: h } = entry.contentRect
      if (w > 0 && h > 0) applySize(w, h)
    })
    if (container) resizeObserver.observe(container)
    applySize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight)

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
      mouse.active = true
    }
    const onMouseLeave = () => {
      mouse.active = false
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    frameId = requestAnimationFrame(tick)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      cancelAnimationFrame(frameId)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
}
