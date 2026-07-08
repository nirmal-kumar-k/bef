'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConstellationParticles } from '@/shared/ui/constellation-particles'
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
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#F8F9FA] font-sans px-4 sm:px-6 py-12">
      
      <style dangerouslySetInnerHTML={{__html: `
        /* Guaranteed Rich Card Styling (Bypassing Tailwind JIT) */
        .rich-card {
          border-radius: 36px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.75) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 
            0 30px 60px -15px rgba(3, 4, 94, 0.1),
            inset 0 1px 1px rgba(255, 255, 255, 0.9),
            inset 0 -1px 1px rgba(0, 0, 0, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.9);
        }

        /* Fixed Logo Box */
        .rich-logo {
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(72, 202, 228, 0.2), rgba(114, 9, 183, 0.2));
          border: 1px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        }

        /* Highly Visible Input Styling */
        .rich-input {
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(3, 4, 94, 0.25); /* Much darker, highly visible border */
          color: #03045E;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.04);
        }
        .rich-input:focus {
          outline: none;
          background: #FFFFFF;
          border-color: rgba(72, 202, 228, 0.8);
          /* The dark, faint elegant glow */
          box-shadow: 
            0 10px 30px -5px rgba(3, 4, 94, 0.15), 
            0 0 0 3px rgba(72, 202, 228, 0.25),
            inset 0 2px 4px rgba(0, 0, 0, 0.01);
          transform: translateY(-1px);
        }
        .rich-input::placeholder {
          color: rgba(29, 53, 87, 0.6); /* Much darker, highly visible placeholder */
          font-weight: 500;
        }

        /* Vibrant Rich Button */
        .rich-button {
          border-radius: 16px;
          background: linear-gradient(135deg, #48CAE4 0%, #7209B7 100%);
          box-shadow: 
            0 12px 25px -8px rgba(114, 9, 183, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
          color: white;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: none;
        }
        .rich-button:hover {
          box-shadow: 
            0 15px 35px -8px rgba(114, 9, 183, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
          transform: translateY(-2px);
          filter: brightness(1.05);
        }
        .rich-button:active {
          transform: translateY(0);
          filter: brightness(0.95);
        }
      `}} />

      {/* Constellation Background */}
      <ConstellationParticles />

      {/* Centered Container */}
      <div className="relative z-10 w-full max-w-md">
        
        {/* Rich, Elegant, Vibrant Card */}
        <div className="w-full p-10 sm:p-12 rich-card">
          
          {/* Elegant Logo & Header */}
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 rich-logo flex items-center justify-center mb-5">
              <span className="text-sm font-black tracking-widest text-[#7209B7]">BEF</span>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-[#03045E] mb-2">
              Welcome back
            </h2>
            <p className="text-base font-medium text-[#1D3557]/70">
              Sign in to your dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#1D3557] ml-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full h-14 px-5 rich-input text-base font-medium"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#1D3557] ml-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-14 px-5 rich-input text-base font-medium"
              />
            </div>

            {error && (
              <div className="text-sm font-bold text-[#7209B7] bg-[#7209B7]/10 px-4 py-3 rounded-2xl border border-[#7209B7]/20 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 font-bold text-base tracking-wide rich-button mt-4"
            >
              Sign in
            </button>
          </form>
        </div>
        
      </div>
    </div>
  )
}
