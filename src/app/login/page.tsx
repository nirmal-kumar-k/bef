'use client'

import { useState } from 'react'
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

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#0A0908] font-sans px-6 py-16">
      {/* Ember glow field */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 50% at 50% 105%, rgba(255,107,53,0.30), transparent 60%),
            radial-gradient(ellipse 35% 30% at 15% 10%, rgba(230,57,70,0.16), transparent 60%),
            radial-gradient(ellipse 40% 35% at 90% 15%, rgba(45,27,78,0.38), transparent 60%)
          `,
        }}
      />

      {/* Animated rising embers */}
      <EmberParticles />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-[400px] rounded-[18px] bg-gradient-to-br from-[#FF8C5A]/50 via-[#E63946]/10 to-[#FF8C5A]/25 p-px shadow-[0_30px_70px_-25px_rgba(0,0,0,0.75)]">
        <div className="rounded-[17px] bg-[#14100F]/85 backdrop-blur-2xl px-9 py-11">
          <h1 className="text-sm font-extrabold tracking-[0.25em] text-[#FF8C5A] mb-8">BEF</h1>

          <div className="mb-8">
            <h2 className="text-[25px] font-bold tracking-tight text-[#F5F1EA] mb-1.5">Sign in to BEF</h2>
            <p className="text-sm text-[#F5F1EA]/50">Foundry Management System</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#F5F1EA]/70">
                Email
              </Label>
              <Input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-11 px-3.5 rounded-lg border-white/10 bg-white/5 text-[#F5F1EA] placeholder:text-[#F5F1EA]/30 focus-visible:border-[#FF6B35] focus-visible:ring-2 focus-visible:ring-[#FF6B35]/25"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#F5F1EA]/70">
                Password
              </Label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 px-3.5 rounded-lg border-white/10 bg-white/5 text-[#F5F1EA] placeholder:text-[#F5F1EA]/30 focus-visible:border-[#FF6B35] focus-visible:ring-2 focus-visible:ring-[#FF6B35]/25"
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
              className="w-full h-11 rounded-lg bg-gradient-to-r from-[#FF6B35] to-[#E63946] hover:brightness-110 text-[#0A0908] font-bold text-sm shadow-[0_0_0_1px_rgba(255,140,90,0.3),0_12px_30px_-10px_rgba(255,107,53,0.6)] transition-[filter] mt-3"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
