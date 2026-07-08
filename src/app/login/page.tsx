'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { EmberParticles } from '@/shared/ui/ember-particles'
import { loginUser } from '@/modules/users/application/auth.actions'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const formData = new FormData()
    formData.append('email', email)
    formData.append('password', password)

    try {
      const result = await loginUser(formData)
      if (result.error) {
        setError(result.error)
      } else if (result.success) {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // 3D Tilt Effect
  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const rotateX = ((y - centerY) / centerY) * -5 // Max 5deg rotation
      const rotateY = ((x - centerX) / centerX) * 5

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`
    }

    const handleMouseLeave = () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
    }

    card.addEventListener('mousemove', handleMouseMove)
    card.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      card.removeEventListener('mousemove', handleMouseMove)
      card.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#0A0908] font-sans px-6 py-16">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        .ember-bg-glow {
          animation: pulseGlow 6s ease-in-out infinite;
        }
        .ember-bg-glow-slow {
          animation: pulseGlow 10s ease-in-out infinite reverse;
        }
        
        .animated-input-group {
          position: relative;
        }
        .animated-input-group::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #FF6B35, transparent);
          transition: all 0.3s ease;
          transform: translateX(-50%);
          opacity: 0;
        }
        .animated-input-group:focus-within::after {
          width: 100%;
          opacity: 1;
        }
        .animated-input {
          transition: all 0.3s ease;
        }
        .animated-input:focus {
          background: rgba(255, 255, 255, 0.08);
          border-color: transparent;
          box-shadow: 0 10px 30px -10px rgba(255, 107, 53, 0.2);
        }
        @keyframes fluidBlob1 {
          0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 0.3; }
          33% { transform: translate(30px, -50px) scale(1.1) rotate(120deg); opacity: 0.5; }
          66% { transform: translate(-20px, 20px) scale(0.9) rotate(240deg); opacity: 0.2; }
        }
        @keyframes fluidBlob2 {
          0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 0.2; }
          33% { transform: translate(-50px, -30px) scale(0.95) rotate(-120deg); opacity: 0.4; }
          66% { transform: translate(40px, -40px) scale(1.05) rotate(-240deg); opacity: 0.1; }
        }
        .fluid-blob-1 {
          animation: fluidBlob1 15s ease-in-out infinite;
        }
        .fluid-blob-2 {
          animation: fluidBlob2 18s ease-in-out infinite;
        }
      `}} />

      {/* Ember glow fields / Fluid Blobs for swirly effect */}
      <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] pointer-events-none fluid-blob-1 opacity-40 mix-blend-screen filter blur-[100px]" style={{ backgroundImage: 'radial-gradient(circle at 40% 40%, rgba(255,107,53,0.15), transparent 40%), radial-gradient(circle at 70% 60%, rgba(230,57,70,0.1), transparent 40%)' }} />
      <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] pointer-events-none fluid-blob-2 opacity-30 mix-blend-screen filter blur-[120px]" style={{ backgroundImage: 'radial-gradient(circle at 60% 30%, rgba(255,140,90,0.15), transparent 40%), radial-gradient(circle at 30% 70%, rgba(255,107,53,0.1), transparent 40%)' }} />
      <div className="absolute inset-0 pointer-events-none ember-bg-glow" style={{ backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 105%, rgba(255,107,53,0.20), transparent 60%)' }} />

      {/* Animated rising embers */}
      <EmberParticles />

      {/* Login card */}
      <div className="relative z-10 perspective-[1000px] group w-full max-w-[480px]">
        <div 
          ref={cardRef}
          className="w-full rounded-[24px] bg-gradient-to-br from-[#FF8C5A]/50 via-[#E63946]/10 to-[#FF8C5A]/25 p-px shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] transition-transform duration-300 ease-out will-change-transform"
        >
          <div className="rounded-[23px] bg-[#14100F]/85 backdrop-blur-3xl px-12 py-14 relative overflow-hidden">
            {/* Subtle card interior glow that follows hover (simulated by a static gradient for now, can be complex if needed) */}
            <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_50%_50%,rgba(255,107,53,0.05),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          <h1 className="text-sm font-extrabold tracking-[0.25em] text-[#FF8C5A] mb-8">BEF</h1>

          <div className="mb-8">
            <h2 className="text-[25px] font-bold tracking-tight text-[#F5F1EA] mb-1.5">Sign in to BEF</h2>
            <p className="text-sm text-[#F5F1EA]/50">Foundry Management System</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 relative z-10">
            <div className="space-y-2 animated-input-group">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#F5F1EA]/70 ml-1 transition-colors group-focus-within:text-[#FF8C5A]">
                Email
              </Label>
              <Input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-12 px-4 rounded-xl border-white/10 bg-white/5 text-[#F5F1EA] placeholder:text-[#F5F1EA]/30 focus-visible:ring-0 focus-visible:outline-none animated-input"
              />
            </div>

            <div className="space-y-2 animated-input-group">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#F5F1EA]/70 ml-1 transition-colors group-focus-within:text-[#FF8C5A]">
                Password
              </Label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 px-4 rounded-xl border-white/10 bg-white/5 text-[#F5F1EA] placeholder:text-[#F5F1EA]/30 focus-visible:ring-0 focus-visible:outline-none animated-input"
              />
            </div>

            {error && (
              <div className="text-xs font-medium text-[#FFB4A8] bg-[#E63946]/10 px-3.5 py-2.5 rounded-lg border border-[#E63946]/25">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#E63946] hover:brightness-110 text-[#0A0908] font-bold text-sm shadow-[0_0_0_1px_rgba(255,140,90,0.3),0_12px_30px_-10px_rgba(255,107,53,0.6)] transition-all hover:-translate-y-[2px] active:translate-y-0 active:scale-95 mt-5"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
    </div>
  )
}
