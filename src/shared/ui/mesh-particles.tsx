'use client'

import { useEffect, useRef } from 'react'

interface Vertex {
  baseX: number
  baseY: number
  x: number
  y: number
  phaseX: number
  phaseY: number
}

export function MeshParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    const SPACING = 90
    let grid: Vertex[][] = []
    let frameId = 0
    const mouse = { x: -1000, y: -1000, active: false }
    let time = 0

    const initGrid = (w: number, h: number) => {
      cols = Math.ceil(w / SPACING) + 2
      rows = Math.ceil(h / SPACING) + 2
      grid = []

      for (let i = 0; i < cols; i++) {
        const col: Vertex[] = []
        for (let j = 0; j < rows; j++) {
          // Add slight organic randomness to the rigid grid
          const offsetX = (Math.random() - 0.5) * (SPACING * 0.4)
          const offsetY = (Math.random() - 0.5) * (SPACING * 0.4)
          col.push({
            baseX: (i - 1) * SPACING + offsetX,
            baseY: (j - 1) * SPACING + offsetY,
            x: 0,
            y: 0,
            phaseX: Math.random() * Math.PI * 2,
            phaseY: Math.random() * Math.PI * 2,
          })
        }
        grid.push(col)
      }
    }

    const applySize = (w: number, h: number) => {
      const dpr = window.devicePixelRatio || 1
      width = w
      height = h
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      initGrid(w, h)
    }

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height)

      // Calculate positions
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const v = grid[i][j]
          // Slow organic drifting
          const driftX = Math.sin(time * 0.001 + v.phaseX) * 15
          const driftY = Math.cos(time * 0.001 + v.phaseY) * 15
          
          let targetX = v.baseX + driftX
          let targetY = v.baseY + driftY

          // Mouse reactivity (vertices pull towards mouse to create "elevation" effect)
          if (mouse.active) {
            const dx = mouse.x - targetX
            const dy = mouse.y - targetY
            const dist = Math.sqrt(dx * dx + dy * dy)
            const pullRadius = 350
            if (dist < pullRadius) {
              const force = Math.pow((pullRadius - dist) / pullRadius, 2)
              // Pull towards mouse
              targetX += dx * force * 0.3
              targetY += dy * force * 0.3
            }
          }

          v.x = targetX
          v.y = targetY
        }
      }

      ctx.lineWidth = 1
      // Draw mesh lines
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const v = grid[i][j]

          // Right neighbor
          if (i < cols - 1) {
            const right = grid[i + 1][j]
            drawMeshLine(ctx, v, right)
          }
          // Bottom neighbor
          if (j < rows - 1) {
            const bottom = grid[i][j + 1]
            drawMeshLine(ctx, v, bottom)
          }
          // Diagonal neighbor (bottom-right) to make triangles
          if (i < cols - 1 && j < rows - 1) {
            const diag = grid[i + 1][j + 1]
            drawMeshLine(ctx, v, diag)
          }
        }
      }

      // Draw vertices
      ctx.fillStyle = '#48CAE4'
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const v = grid[i][j]
          ctx.beginPath()
          ctx.arc(v.x, v.y, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const drawMeshLine = (ctx: CanvasRenderingContext2D, v1: Vertex, v2: Vertex) => {
      // Create a very soft, calming gradient line
      const grad = ctx.createLinearGradient(v1.x, v1.y, v2.x, v2.y)
      grad.addColorStop(0, 'rgba(72, 202, 228, 0.15)') // Soft Cyan
      grad.addColorStop(1, 'rgba(114, 9, 183, 0.08)') // Soft Purple
      
      ctx.strokeStyle = grad
      ctx.beginPath()
      ctx.moveTo(v1.x, v1.y)
      ctx.lineTo(v2.x, v2.y)
      ctx.stroke()
    }

    const tick = () => {
      time += 16 // Approx 60fps time step
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
