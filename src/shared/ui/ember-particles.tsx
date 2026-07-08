'use client'

import { useEffect, useRef } from 'react'

interface Ember {
  x: number
  y: number
  radius: number
  speed: number
  drift: number
  driftPhase: number
  flickerPhase: number
  baseOpacity: number
  color: string
}

const EMBER_COLORS = ['#FF6B35', '#FF8C5A', '#E63946']

function createEmber(width: number, height: number, spawnAnywhere: boolean): Ember {
  return {
    x: Math.random() * width,
    y: spawnAnywhere ? Math.random() * height : height + Math.random() * 60,
    radius: Math.random() * 1.5 + 0.3,
    speed: Math.random() * 1.2 + 0.3,
    drift: Math.random() * 2.5 + 0.5,
    driftPhase: Math.random() * Math.PI * 2,
    flickerPhase: Math.random() * Math.PI * 2,
    baseOpacity: Math.random() * 0.8 + 0.2,
    color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
  }
}

export function EmberParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let embers: Ember[] = []
    let frameId = 0
    let time = 0
    const mouse = { x: -1000, y: -1000, active: false }

    const applySize = (w: number, h: number) => {
      const dpr = window.devicePixelRatio || 1
      width = w
      height = h
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(350, Math.max(100, Math.round((w * h) / 3000)))
      embers = Array.from({ length: count }, () => createEmber(w, h, true))
    }

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height)
      for (const e of embers) {
        const flicker = 0.65 + Math.sin(time * 0.05 + e.flickerPhase) * 0.35
        const opacity = e.baseOpacity * flicker
        const glowRadius = e.radius * 5
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, glowRadius)
        grad.addColorStop(0, e.color)
        grad.addColorStop(1, 'transparent')
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity))
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(e.x, e.y, glowRadius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const tick = () => {
      time += 1
      for (const e of embers) {
        // Curve path
        e.y -= e.speed
        e.driftPhase += 0.008
        e.x += Math.sin(e.driftPhase) * e.drift * 0.2 + (Math.cos(e.driftPhase * 0.5) * 0.1)

        if (mouse.active) {
          const dx = e.x - mouse.x
          const dy = e.y - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const repelRadius = 180
          if (dist < repelRadius && dist > 0.01) {
            const force = (1 - dist / repelRadius) * 2.5
            e.x += (dx / dist) * force
            e.y += (dy / dist) * force
          }
        }

        if (e.y < -20) {
          Object.assign(e, createEmber(width, height, false))
        }
        if (e.x < -20) e.x = width + 20
        if (e.x > width + 20) e.x = -20
      }
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
    // Fallback in case ResizeObserver hasn't fired yet
    applySize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight)

    let idleTimeout: ReturnType<typeof setTimeout>

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
      mouse.active = true
      
      clearTimeout(idleTimeout)
      idleTimeout = setTimeout(() => {
        mouse.active = false
      }, 150)
    }
    const onMouseLeave = () => {
      mouse.active = false
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    if (reduceMotion) {
      drawFrame()
    } else {
      frameId = requestAnimationFrame(tick)
    }

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      cancelAnimationFrame(frameId)
      clearTimeout(idleTimeout)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
}
