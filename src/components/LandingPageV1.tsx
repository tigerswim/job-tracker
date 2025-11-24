'use client'

import { useState } from 'react'
import { Terminal, Zap, Network, Database, Code } from 'lucide-react'
import { JetBrains_Mono, Orbitron } from 'next/font/google'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600', '700'] })
const orbitron = Orbitron({ subsets: ['latin'], weight: ['700', '900'] })

export default function LandingPageV1() {
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
      <div className="min-h-screen bg-black text-green-400 relative overflow-hidden">
        {/* Animated grid background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(0, 255, 65, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 65, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            animation: 'gridScroll 20s linear infinite'
          }} />
        </div>

        {/* Scanline effect */}
        <div className="absolute inset-0 pointer-events-none opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 65, 0.3) 3px)',
          animation: 'scanline 8s linear infinite'
        }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left side - Terminal aesthetic */}
            <div className={jetbrainsMono.className}>
              {/* Terminal header */}
              <div className="border border-green-500/30 rounded-t-lg bg-green-950/20 px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs text-green-500/60">job-tracker.exe</span>
              </div>

              {/* Terminal content */}
              <div className="border-x border-b border-green-500/30 rounded-b-lg bg-black/60 backdrop-blur-sm p-8">
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-green-500 animate-pulse" />
                    <span className="text-green-500/60">$</span>
                    <span className="text-green-300">init network_map</span>
                  </div>
                  <h1 className={`text-4xl lg:text-5xl font-black tracking-tight leading-tight text-green-400 ${orbitron.className}`}
                      style={{ textShadow: '0 0 20px rgba(0, 255, 65, 0.5)' }}>
                    HACK YOUR<br />JOB SEARCH
                  </h1>
                  <div className="space-y-2 text-green-400/80 font-mono text-sm">
                    <p>&gt; Compile network data</p>
                    <p>&gt; Execute strategic connections</p>
                    <p>&gt; Deploy career opportunities</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowModal(true)}
                  className="group relative px-8 py-4 bg-green-500/10 border-2 border-green-500 text-green-400 font-bold rounded-lg hover:bg-green-500 hover:text-black transition-all duration-300 flex items-center gap-3 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    <Zap className="w-5 h-5" />
                    <span className="tracking-wide">INITIALIZE_SESSION</span>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/20 to-green-500/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                </button>

                {/* System stats */}
                <div className="mt-8 pt-6 border-t border-green-500/20 grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="text-green-500/60 mb-1">NETWORK_NODES</div>
                    <div className="text-green-400 font-bold">∞</div>
                  </div>
                  <div>
                    <div className="text-green-500/60 mb-1">CONNECTIONS</div>
                    <div className="text-green-400 font-bold">ACTIVE</div>
                  </div>
                  <div>
                    <div className="text-green-500/60 mb-1">STATUS</div>
                    <div className="text-green-400 font-bold animate-pulse">READY</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - Data visualization */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Glowing orb */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-500/20 rounded-full blur-3xl animate-pulse" />

                {/* Network nodes */}
                <div className="relative bg-black/40 backdrop-blur-sm border border-green-500/30 rounded-lg p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Network className="w-6 h-6 text-green-400" />
                    <div className={`text-green-400 font-bold text-lg tracking-wider ${orbitron.className}`}>
                      NETWORK.MAP
                    </div>
                  </div>

                  {/* Connection visualization */}
                  <div className="space-y-3">
                    {[
                      { name: 'JORDAN_CHEN', role: 'VP_ENGINEERING', conn: 2 },
                      { name: 'SARAH_PARK', role: 'HEAD_PRODUCT', conn: 1 },
                      { name: 'MARCUS_ROD', role: 'SR_UX_DESIGN', conn: 3 },
                      { name: 'ALEX_KIM', role: 'ENG_MANAGER', conn: 0 },
                      { name: 'PRIYA_PATEL', role: 'DATA_SCIENTIST', conn: 3 },
                    ].map((contact, i) => (
                      <div
                        key={i}
                        className="group relative bg-green-950/20 border border-green-500/20 rounded p-3 hover:border-green-500/60 hover:bg-green-950/40 transition-all cursor-pointer"
                        style={{ animationDelay: `${i * 100}ms` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 font-mono text-xs">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <div>
                              <div className="text-green-400 font-bold">{contact.name}</div>
                              <div className="text-green-500/60">{contact.role}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Database className="w-3 h-3 text-green-500/60" />
                            <span className="text-green-400 font-bold text-xs">{contact.conn}</span>
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/10 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      </div>
                    ))}
                  </div>

                  {/* System info */}
                  <div className="mt-6 pt-4 border-t border-green-500/20 flex justify-between text-xs font-mono">
                    <span className="text-green-500/60">UPTIME: 24/7</span>
                    <span className="text-green-400">SYNC: ✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating code snippets */}
        <div className="absolute top-20 right-10 text-green-500/20 font-mono text-xs opacity-50 animate-pulse">
          {'{ network: "mapped" }'}
        </div>
        <div className="absolute bottom-20 left-10 text-green-500/20 font-mono text-xs opacity-50 animate-pulse">
          {'<Contact status="active" />'}
        </div>
      </div>

      {/* Auth Modal */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setShowModal(false)}
          />

          <div className={`fixed inset-y-0 right-0 w-full sm:w-[500px] bg-black border-l border-green-500/30 z-50 animate-slide-in-right ${jetbrainsMono.className}`}>
            <div className="h-full flex flex-col">
              {/* Terminal header */}
              <div className="flex items-center justify-between p-6 border-b border-green-500/30">
                <div className="flex items-center gap-3">
                  <Code className="w-6 h-6 text-green-400" />
                  <h2 className={`text-xl font-bold text-green-400 tracking-wider ${orbitron.className}`}>
                    AUTH_PROTOCOL
                  </h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-green-400 hover:text-green-300 text-2xl leading-none border border-green-500/30 rounded px-2 hover:border-green-500/60 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 text-green-400">
                <div className="max-w-md mx-auto">
                  {!isEmailMode ? (
                    <>
                      <p className="text-green-400/80 mb-8 font-mono text-sm">
                        &gt; Authenticate to access network intelligence database
                      </p>

                      <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-950/20 border-2 border-green-500/30 rounded-lg hover:bg-green-950/40 hover:border-green-500 transition-all duration-200 disabled:opacity-50"
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span className="text-green-400 font-semibold">
                          {loading ? 'CONNECTING...' : 'GOOGLE_OAUTH'}
                        </span>
                      </button>

                      <div className="mt-6 text-center">
                        <button
                          onClick={() => setIsEmailMode(true)}
                          className="text-sm text-green-500/60 hover:text-green-400 transition-colors"
                        >
                          &gt; use_email_auth
                        </button>
                      </div>

                      <div className="mt-10 pt-8 border-t border-green-500/20 space-y-3 text-xs text-green-400/60">
                        <p className="text-green-400 font-semibold">&gt; SYSTEM_ACCESS_INCLUDES:</p>
                        <p>→ Network mapping algorithms</p>
                        <p>→ Contact intelligence database</p>
                        <p>→ Automated follow-up protocols</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsEmailMode(false)}
                        className="mb-6 text-sm text-green-400 hover:text-green-300 flex items-center gap-1"
                      >
                        ← RETURN
                      </button>

                      <form onSubmit={handleEmailAuth} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-green-400 mb-2">EMAIL</label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-green-950/20 border border-green-500/30 rounded-lg text-green-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-green-400 mb-2">PASSWORD</label>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-green-950/20 border border-green-500/30 rounded-lg text-green-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            required
                          />
                        </div>

                        {message && (
                          <div className={`p-3 rounded-lg text-sm border ${
                            message.includes('error') || message.includes('Invalid')
                              ? 'bg-red-950/20 text-red-400 border-red-500/30'
                              : 'bg-green-950/20 text-green-400 border-green-500/30'
                          }`}>
                            {message}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full px-6 py-4 bg-green-500/10 border-2 border-green-500 text-green-400 font-semibold rounded-lg hover:bg-green-500 hover:text-black transition-all duration-200 disabled:opacity-50"
                        >
                          {loading ? 'PROCESSING...' : (isSignUp ? 'CREATE_ACCOUNT' : 'AUTHENTICATE')}
                        </button>
                      </form>

                      <div className="mt-6 text-center">
                        <button
                          onClick={() => setIsSignUp(!isSignUp)}
                          className="text-sm text-green-400/60 hover:text-green-400"
                        >
                          {isSignUp ? '&gt; have_account' : '&gt; need_account'}
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

      <style jsx>{`
        @keyframes gridScroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(50px); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </>
  )
}
