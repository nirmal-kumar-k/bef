'use client'

import { useEffect, useRef } from 'react'

interface Ember {
  x: number
  y: number
  radius: number
  speed: number
  drift: number
  driftPhase: number
  opacity: number
  color: string
}

const EMBER_COLORS = ['#FF6B35', '#FF8C5A', '#E63946']

function createEmber(width: number, height: number, spawnAnywhere: boolean): Ember {
  return {
    x: Math.random() * width,
    y: spawnAnywhere ? Math.random() * height : height + Math.random() * 40,
    radius: Math.random() * 1.6 + 0.6,
    speed: Math.random() * 0.35 + 0.15,
    drift: Math.random() * 0.6 + 0.2,
    driftPhase: Math.random() * Math.PI * 2,
    opacity: Math.random() * 0.5 + 0.3,
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

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(60, Math.round((width * height) / 18000))
      embers = Array.from({ length: count }, () => createEmber(width, height, true))
    }

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height)
      for (const e of embers) {
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius * 4)
        grad.addColorStop(0, e.color)
        grad.addColorStop(1, 'transparent')
        ctx.globalAlpha = e.opacity
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(e.x, e.y, e.radius * 4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const tick = () => {
      for (const e of embers) {
        e.y -= e.speed
        e.driftPhase += 0.02
        e.x += Math.sin(e.driftPhase) * e.drift * 0.05
        if (e.y < -10) {
          Object.assign(e, createEmber(width, height, false))
        }
      }
      drawFrame()
      frameId = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener('resize', resize)

    if (reduceMotion) {
      drawFrame()
    } else {
      frameId = requestAnimationFrame(tick)
    }

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(frameId)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
}
