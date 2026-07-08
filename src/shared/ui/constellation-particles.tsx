'use client'

import { useEffect, useRef } from 'react'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
}

const COLORS = ['#48CAE4', '#90E0EF', '#7209B7']

export function ConstellationParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let nodes: Node[] = []
    let frameId = 0
    const mouse = { x: -1000, y: -1000, active: false }

    const initNodes = (w: number, h: number) => {
      // Decrease node count for a more separated, cleaner look
      const count = Math.min(100, Math.max(30, Math.round((w * h) / 15000)))
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 1.0, // slightly slower
        vy: (Math.random() - 0.5) * 1.0,
        radius: Math.random() * 1.5 + 0.5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      }))
    }

    const applySize = (w: number, h: number) => {
      const dpr = window.devicePixelRatio || 1
      width = w
      height = h
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      initNodes(w, h)
    }

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height)

      // Draw Lines
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          
          if (dist < 150) {
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            const opacity = 1 - dist / 150
            const grad = ctx.createLinearGradient(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y)
            grad.addColorStop(0, nodes[i].color)
            grad.addColorStop(1, nodes[j].color)
            ctx.strokeStyle = grad
            ctx.globalAlpha = opacity * 0.8
            ctx.lineWidth = 1.5
            ctx.stroke()
          }
        }
      }

      // Draw Lines connecting from the mouse to nearby nodes
      if (mouse.active) {
        for (let i = 0; i < nodes.length; i++) {
          const dx = mouse.x - nodes[i].x
          const dy = mouse.y - nodes[i].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          
          const connectRadius = 180
          if (dist < connectRadius) {
            ctx.beginPath()
            ctx.moveTo(mouse.x, mouse.y)
            ctx.lineTo(nodes[i].x, nodes[i].y)
            
            const opacity = 1 - dist / connectRadius
            const grad = ctx.createLinearGradient(mouse.x, mouse.y, nodes[i].x, nodes[i].y)
            grad.addColorStop(0, 'rgba(114, 9, 183, 1)') // Purple center at mouse
            grad.addColorStop(1, nodes[i].color)
            
            ctx.strokeStyle = grad
            ctx.globalAlpha = opacity * 0.9
            ctx.lineWidth = 1.5
            ctx.stroke()
          }
        }
      }

      ctx.globalAlpha = 1
      // Draw Nodes
      for (const node of nodes) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        ctx.fillStyle = node.color
        ctx.fill()
      }
    }

    const tick = () => {
      for (const node of nodes) {
        // Move node
        node.x += node.vx
        node.y += node.vy

        // Bounce off edges
        if (node.x < 0 || node.x > width) node.vx *= -1
        if (node.y < 0 || node.y > height) node.vy *= -1

        // Mouse attraction
        if (mouse.active) {
          const dx = mouse.x - node.x
          const dy = mouse.y - node.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const pullRadius = 250
          if (dist < pullRadius) {
            const force = (pullRadius - dist) / pullRadius
            node.x += (dx / dist) * force * 1.5
            node.y += (dy / dist) * force * 1.5
          }
        }
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

    // Force start animation unconditionally
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
