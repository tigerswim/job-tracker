'use client'

import { useState } from 'react'
import { Compass, Heart, MapPin, Briefcase, Mail, Phone } from 'lucide-react'
import { Libre_Baskerville, Crimson_Pro, Lora } from 'next/font/google'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const libreBaskerville = Libre_Baskerville({ subsets: ['latin'], weight: ['400', '700'] })
const crimsonPro = Crimson_Pro({ subsets: ['latin'], weight: ['400', '600', '700'] })
const lora = Lora({ subsets: ['latin'], weight: ['600', '700'] })

export default function LandingPageV3() {
  const [showModal, setShowModal] = useState(false)
  const [isEmailMode, setIsEmailMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const supabase = createClientComponentClient()

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setMessage('')

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.clear()
        localStorage.removeItem('supabase.auth.token')
        localStorage.removeItem('supabase.auth.expires_at')
        localStorage.removeItem('supabase.auth.refresh_token')
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: 'select_account'
          }
        }
      })

      if (error) throw error
    } catch (error: any) {
      setMessage(error.message)
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        setMessage('Check your email for the confirmation link!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      }
    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="min-h-screen relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #f5e6d3 0%, #e8d5c4 50%, #d4c5b0 100%)'
      }}>
        {/* Vintage paper texture overlay */}
        <div className="absolute inset-0 opacity-[0.15]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
          mixBlendMode: 'multiply'
        }} />

        {/* Warm gradient orbs */}
        <div className="absolute top-20 right-10 w-96 h-96 rounded-full opacity-30 blur-3xl" style={{
          background: 'radial-gradient(circle, #d4a574 0%, transparent 70%)'
        }} />
        <div className="absolute bottom-20 left-10 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{
          background: 'radial-gradient(circle, #8b6f47 0%, transparent 70%)'
        }} />

        <div className="relative z-10 max-w-7xl mx-auto px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left side - Warm, human content */}
            <div>
              {/* Decorative element */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-16 h-px bg-gradient-to-r from-amber-800 to-transparent" />
                <Compass className="w-6 h-6 text-amber-800" />
                <div className="w-16 h-px bg-gradient-to-l from-amber-800 to-transparent" />
              </div>

              {/* Serif headline */}
              <h1 className={`text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight text-amber-950 mb-8 ${libreBaskerville.className}`}>
                Navigate Your Career Journey
              </h1>

              {/* Body copy */}
              <p className={`text-xl lg:text-2xl text-amber-900/80 leading-relaxed mb-10 ${crimsonPro.className}`}>
                In the age of endless applications, the most valuable currency remains unchanged: genuine human connections. Let us help you nurture them.
              </p>

              {/* Warm CTA */}
              <button
                onClick={() => setShowModal(true)}
                className={`group px-10 py-5 bg-gradient-to-br from-amber-700 to-amber-900 text-amber-50 text-lg font-semibold rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-500 flex items-center gap-3 ${crimsonPro.className}`}
                style={{
                  boxShadow: '0 10px 40px rgba(139, 69, 19, 0.3)'
                }}
              >
                Begin Your Journey
                <Heart className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>

              {/* Testimonial-style note */}
              <div className="mt-12 pl-6 border-l-2 border-amber-800/30">
                <p className={`text-amber-900/70 italic leading-relaxed ${crimsonPro.className}`}>
                  "The best opportunities come not from what you know, but from who knows you."
                </p>
                <div className="mt-2 text-sm text-amber-800/60">— Ancient Career Wisdom</div>
              </div>
            </div>

            {/* Right side - Vintage contact cards */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Decorative corner frame */}
                <div className="absolute -top-4 -left-4 w-24 h-24 border-t-2 border-l-2 border-amber-800/30" />
                <div className="absolute -bottom-4 -right-4 w-24 h-24 border-b-2 border-r-2 border-amber-800/30" />

                {/* Card stack */}
                <div className="space-y-4 relative">
                  {/* Card 1 */}
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-800/20 rounded-lg p-6 shadow-lg relative overflow-hidden transform hover:rotate-1 transition-transform duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
                      <svg viewBox="0 0 100 100" fill="currentColor" className="text-amber-900">
                        <circle cx="50" cy="50" r="40" />
                      </svg>
                    </div>
                    <div className="relative">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white font-bold text-xl shadow-md">
                          JC
                        </div>
                        <MapPin className="w-5 h-5 text-amber-700" />
                      </div>
                      <h3 className={`text-2xl font-bold text-amber-950 mb-1 ${lora.className}`}>
                        Jordan Chen
                      </h3>
                      <p className={`text-amber-900/70 mb-3 ${crimsonPro.className}`}>
                        Vice President of Engineering
                      </p>
                      <div className="flex items-center gap-2 text-sm text-amber-800/60 mb-4">
                        <Briefcase className="w-4 h-4" />
                        <span>Acme Industries</span>
                      </div>
                      <div className="pt-4 border-t border-amber-800/10 flex gap-2">
                        <div className="px-3 py-1 bg-amber-800/10 rounded-full text-xs font-semibold text-amber-900">
                          2 connections
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-gradient-to-br from-stone-50 to-stone-100 border-2 border-stone-700/20 rounded-lg p-6 shadow-lg relative overflow-hidden transform hover:-rotate-1 transition-transform duration-300" style={{ marginLeft: '2rem' }}>
                    <div className="absolute top-0 left-0 w-32 h-32 opacity-5">
                      <svg viewBox="0 0 100 100" fill="currentColor" className="text-stone-800">
                        <path d="M50,10 L90,90 L10,90 Z" />
                      </svg>
                    </div>
                    <div className="relative">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center text-white font-bold text-xl shadow-md">
                          SP
                        </div>
                        <Mail className="w-5 h-5 text-stone-700" />
                      </div>
                      <h3 className={`text-2xl font-bold text-stone-950 mb-1 ${lora.className}`}>
                        Sarah Park
                      </h3>
                      <p className={`text-stone-900/70 mb-3 ${crimsonPro.className}`}>
                        Head of Product Design
                      </p>
                      <div className="flex items-center gap-2 text-sm text-stone-800/60 mb-4">
                        <Briefcase className="w-4 h-4" />
                        <span>CloudScale</span>
                      </div>
                      <div className="pt-4 border-t border-stone-800/10 flex gap-2">
                        <div className="px-3 py-1 bg-stone-800/10 rounded-full text-xs font-semibold text-stone-900">
                          1 connection
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-gradient-to-br from-amber-100 to-amber-200 border-2 border-amber-900/20 rounded-lg p-6 shadow-lg relative overflow-hidden transform hover:rotate-1 transition-transform duration-300" style={{ marginLeft: '1rem' }}>
                    <div className="absolute bottom-0 right-0 w-32 h-32 opacity-5">
                      <svg viewBox="0 0 100 100" fill="currentColor" className="text-amber-900">
                        <rect x="20" y="20" width="60" height="60" />
                      </svg>
                    </div>
                    <div className="relative">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center text-white font-bold text-xl shadow-md">
                          AK
                        </div>
                        <Phone className="w-5 h-5 text-amber-800" />
                      </div>
                      <h3 className={`text-2xl font-bold text-amber-950 mb-1 ${lora.className}`}>
                        Alex Kim
                      </h3>
                      <p className={`text-amber-900/70 mb-3 ${crimsonPro.className}`}>
                        Engineering Manager
                      </p>
                      <div className="flex items-center gap-2 text-sm text-amber-800/60 mb-4">
                        <Briefcase className="w-4 h-4" />
                        <span>TechFlow</span>
                      </div>
                      <div className="pt-4 border-t border-amber-900/10 flex gap-2">
                        <div className="px-3 py-1 bg-amber-900/10 rounded-full text-xs font-semibold text-amber-900">
                          3 mutual contacts
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features section */}
          <div className="mt-24 pt-16 border-t-2 border-amber-800/20">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-lg">
                  <Compass className="w-8 h-8 text-amber-50" />
                </div>
                <h3 className={`text-xl font-bold text-amber-950 mb-2 ${lora.className}`}>
                  Map Your Network
                </h3>
                <p className={`text-amber-900/70 ${crimsonPro.className}`}>
                  Every connection is a potential pathway to your next opportunity.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center shadow-lg">
                  <Heart className="w-8 h-8 text-stone-50" />
                </div>
                <h3 className={`text-xl font-bold text-stone-950 mb-2 ${lora.className}`}>
                  Nurture Relationships
                </h3>
                <p className={`text-stone-900/70 ${crimsonPro.className}`}>
                  Track conversations and follow up with care and intention.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center shadow-lg">
                  <Briefcase className="w-8 h-8 text-amber-50" />
                </div>
                <h3 className={`text-xl font-bold text-amber-950 mb-2 ${lora.className}`}>
                  Find Your Path
                </h3>
                <p className={`text-amber-900/70 ${crimsonPro.className}`}>
                  Let your network guide you to meaningful career opportunities.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal - Warm vintage style */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 bg-amber-950/60 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setShowModal(false)}
          />

          <div className={`fixed inset-y-0 right-0 w-full sm:w-[550px] bg-gradient-to-br from-amber-50 to-amber-100 border-l-2 border-amber-800/30 shadow-2xl z-50 animate-slide-in-right ${crimsonPro.className}`}>
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-8 border-b-2 border-amber-800/20 bg-gradient-to-r from-amber-100 to-amber-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Compass className="w-6 h-6 text-amber-800" />
                      <span className="text-sm text-amber-800/60 tracking-wider">WELCOME</span>
                    </div>
                    <h2 className={`text-3xl font-bold text-amber-950 ${lora.className}`}>
                      Join Our Community
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-amber-900 hover:text-amber-700 text-3xl leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-md mx-auto">
                  {!isEmailMode ? (
                    <>
                      <p className="text-amber-900/80 mb-8 text-lg leading-relaxed">
                        Begin your journey toward meaningful professional connections.
                      </p>

                      <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-white border-2 border-amber-800/30 rounded-xl hover:border-amber-800/60 hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span className="text-amber-900 font-semibold text-lg">
                          {loading ? 'Connecting...' : 'Continue with Google'}
                        </span>
                      </button>

                      <div className="mt-6 text-center">
                        <button
                          onClick={() => setIsEmailMode(true)}
                          className="text-sm text-amber-800/60 hover:text-amber-900 transition-colors"
                        >
                          Or sign in with email →
                        </button>
                      </div>

                      <div className="mt-10 pt-8 border-t-2 border-amber-800/10">
                        <p className="text-amber-900 font-semibold mb-4">What awaits you:</p>
                        <div className="space-y-3 text-amber-900/70">
                          <p className="flex items-center gap-2">
                            <span className="text-amber-800">✦</span>
                            A curated space for your professional network
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="text-amber-800">✦</span>
                            Thoughtful reminders for meaningful follow-ups
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="text-amber-800">✦</span>
                            Tools to navigate your career with intention
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsEmailMode(false)}
                        className="mb-6 text-sm text-amber-800 hover:text-amber-900 flex items-center gap-1"
                      >
                        ← Return
                      </button>

                      <form onSubmit={handleEmailAuth} className="space-y-5">
                        <div>
                          <label className="block text-sm font-semibold text-amber-900 mb-2">Email Address</label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-white border-2 border-amber-800/20 rounded-lg text-amber-900 focus:ring-2 focus:ring-amber-600/30 focus:border-amber-800/40"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-amber-900 mb-2">Password</label>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-white border-2 border-amber-800/20 rounded-lg text-amber-900 focus:ring-2 focus:ring-amber-600/30 focus:border-amber-800/40"
                            required
                          />
                        </div>

                        {message && (
                          <div className={`p-4 rounded-lg text-sm ${
                            message.includes('error') || message.includes('Invalid')
                              ? 'bg-red-100 text-red-800 border-2 border-red-300'
                              : 'bg-green-100 text-green-800 border-2 border-green-300'
                          }`}>
                            {message}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full px-6 py-4 bg-gradient-to-br from-amber-700 to-amber-900 text-amber-50 font-semibold rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                        >
                          {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                        </button>
                      </form>

                      <div className="mt-6 text-center">
                        <button
                          onClick={() => setIsSignUp(!isSignUp)}
                          className="text-sm text-amber-800/70 hover:text-amber-900"
                        >
                          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
