'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
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
    <div className="relative min-h-screen w-full bg-[#F4F6FB] overflow-hidden flex items-center justify-center font-sans selection:bg-[#4F46E5] selection:text-white">
      
      {/* ── Ambient Fluid Orbs ── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#4F46E5] opacity-30 mix-blend-multiply animate-blob-1"></div>
        <div className="absolute top-[20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#4285F4] opacity-30 mix-blend-multiply animate-blob-2"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[70vw] h-[70vw] rounded-full bg-[#818CF8] opacity-20 mix-blend-multiply animate-blob-3"></div>
      </div>

      {/* ── Massive Blur Overlay (The secret to the ambient mesh) ── */}
      <div className="absolute inset-0 z-0 backdrop-blur-[150px] pointer-events-none"></div>

      {/* ── Subtle Noise Texture for Premium Finish ── */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}
      ></div>

      {/* ── Ultra-Minimalist Glassmorphism Card ── */}
      <div className="relative z-10 w-full max-w-[400px] p-10 rounded-[28px] bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_40px_rgba(31,38,135,0.04)] text-[#172554] transition-all">
        
        <div className="text-center mb-10">
          <h1 className="text-4xl font-heading font-extrabold tracking-[0.25em] text-[#172554] mb-2 drop-shadow-sm">
            BEF
          </h1>
          <p className="text-[10px] text-[#64748B] font-mono tracking-[0.35em] uppercase">
            Foundry System
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#64748B] ml-1">Email / Username</Label>
            <Input 
              type="text" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@bef.com"
              className="bg-white/60 border-white/40 h-12 px-4 rounded-xl focus-visible:ring-2 focus-visible:ring-[#4F46E5]/30 focus-visible:border-[#4F46E5] transition-all shadow-sm placeholder:text-[#94A3B8] text-[#172554]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#64748B] ml-1">Password</Label>
            <Input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-white/60 border-white/40 h-12 px-4 rounded-xl focus-visible:ring-2 focus-visible:ring-[#4F46E5]/30 focus-visible:border-[#4F46E5] transition-all shadow-sm placeholder:text-[#94A3B8] text-[#172554]"
            />
          </div>

          {error && (
            <div className="text-[11px] font-semibold text-red-600 bg-red-50/80 p-3 rounded-xl border border-red-100 backdrop-blur-sm shadow-sm text-center">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#4338CA] hover:from-[#4338CA] hover:to-[#3730A3] text-white font-bold text-[12px] tracking-[0.15em] transition-all shadow-[0_8px_20px_rgba(79,70,229,0.2)] hover:shadow-[0_12px_25px_rgba(79,70,229,0.3)] mt-8 border border-white/20"
          >
            {isLoading ? 'AUTHENTICATING...' : 'SIGN IN'}
          </Button>
        </form>

      </div>

      <style>{`
        @keyframes blob-1 {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(15vw, 15vh) scale(1.1); }
          66% { transform: translate(-10vw, 10vh) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes blob-2 {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(-15vw, 10vh) scale(1.15); }
          66% { transform: translate(-25vw, -10vh) scale(0.85); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes blob-3 {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(10vw, -15vh) scale(0.9); }
          66% { transform: translate(20vw, -20vh) scale(1.1); }
          100% { transform: translate(0px, 0px) scale(1); }
        }

        .animate-blob-1 { animation: blob-1 25s infinite alternate cubic-bezier(0.4, 0, 0.2, 1); }
        .animate-blob-2 { animation: blob-2 28s infinite alternate-reverse cubic-bezier(0.4, 0, 0.2, 1); }
        .animate-blob-3 { animation: blob-3 32s infinite alternate cubic-bezier(0.4, 0, 0.2, 1); }
      `}</style>
    </div>
  )
}
