'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConstellationParticles } from '@/shared/ui/constellation-particles'
import { loginUser } from '@/modules/users/application/auth.actions'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const formData = new FormData()
    formData.append('username', username)
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
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#F4F6FB] font-sans px-4 py-10 sm:py-12">

      <style dangerouslySetInnerHTML={{__html: `
        /* Guaranteed Rich Card Styling (Bypassing Tailwind JIT) */
        .rich-card {
          border-radius: 28px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.97) 0%, rgba(255, 255, 255, 0.85) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow:
            0 30px 60px -15px rgba(23, 37, 84, 0.12),
            inset 0 1px 1px rgba(255, 255, 255, 0.9),
            inset 0 -1px 1px rgba(0, 0, 0, 0.02);
          border: 1.5px solid rgba(79, 70, 229, 0.45);
        }

        /* Fixed Logo Box */
        .rich-logo {
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.12), rgba(79, 70, 229, 0.04));
          border: 1px solid rgba(79, 70, 229, 0.18);
          box-shadow:
            0 6px 16px -4px rgba(79, 70, 229, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }

        /* Highly Visible Input Styling */
        .rich-input {
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(23, 37, 84, 0.16);
          color: #172554;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.03);
        }
        .rich-input:focus {
          outline: none;
          background: #FFFFFF;
          border-color: #4F46E5;
          box-shadow: 0 0 0 1px #4F46E5;
        }
        .rich-input::placeholder {
          color: rgba(100, 116, 139, 0.7);
          font-weight: 500;
        }

        /* Vibrant Rich Button */
        .rich-button {
          border-radius: 14px;
          background: linear-gradient(135deg, #4F46E5 0%, #312E81 100%);
          box-shadow:
            0 12px 25px -10px rgba(79, 70, 229, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
          color: white;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: none;
        }
        .rich-button:hover:not(:disabled) {
          box-shadow:
            0 15px 30px -10px rgba(79, 70, 229, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
          filter: brightness(1.05);
        }
        .rich-button:active:not(:disabled) {
          filter: brightness(0.95);
        }
        .rich-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}} />

      {/* Constellation Background */}
      <ConstellationParticles />

      {/* Centered Container */}
      <div className="relative z-10 w-full max-w-[400px]">

        <div className="w-full p-7 sm:p-10 rich-card">

          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rich-logo flex items-center justify-center mb-4">
              <span className="text-sm font-black tracking-[0.15em] text-[#4F46E5]">BEF</span>
            </div>
            <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[#172554] mb-1.5 leading-tight">
              Welcome back
            </h1>
            <p className="text-sm sm:text-[15px] font-medium text-[#64748B]">
              Sign in to your dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-[11px] font-bold uppercase tracking-wider text-[#334155] ml-0.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-12 sm:h-14 px-4 rich-input text-[15px] font-medium"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[11px] font-bold uppercase tracking-wider text-[#334155] ml-0.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 sm:h-14 px-4 rich-input text-[15px] font-medium"
              />
            </div>

            {error && (
              <div className="text-sm font-semibold text-red-600 bg-red-50 px-4 py-2.5 rounded-xl border border-red-200 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 sm:h-14 font-bold text-[15px] tracking-wide rich-button mt-2"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
