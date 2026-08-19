'use client'

import { useState } from 'react'
import { Rocket, Briefcase, Users, BarChart3, Upload, User, Building, Mail, Linkedin, X } from 'lucide-react'
import { DM_Sans, Archivo } from 'next/font/google'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'] })
const archivo = Archivo({ subsets: ['latin'], weight: ['600', '700', '800'] })

export default function LandingPageV2() {
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
      <div className="min-h-screen bg-slate-50 relative overflow-hidden">
        {/* Subtle geometric background */}
        <div className="absolute inset-0 opacity-[0.02]">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, #334155 0px, #334155 1px, transparent 1px, transparent 80px),
              repeating-linear-gradient(90deg, #334155 0px, #334155 1px, transparent 1px, transparent 80px)
            `
          }} />
        </div>

        {/* Soft color accent */}
        <div className="absolute top-0 right-0 w-1/3 h-96 bg-indigo-400 opacity-20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-1/4 h-96 bg-slate-400 opacity-15 blur-3xl" />

        <div className="relative z-10 max-w-7xl mx-auto px-8 py-16 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-12 xl:gap-16 items-center">
            {/* Left side - Original copy */}
            <div className="text-center lg:text-left">
              {/* Headline from original */}
              <h1 className={`text-4xl sm:text-5xl lg:text-[3.25rem] font-bold leading-[1.08] tracking-tight text-slate-900 mb-6 text-balance ${archivo.className}`}>
                Remember every connection. And every conversation since.
              </h1>

              {/* Subhead from original */}
              <p className={`text-base sm:text-lg text-slate-600 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0 ${dmSans.className}`}>
                Log when you connected on LinkedIn, then keep a running history of every email, call, meeting, and message that follows. Your relationships stay warm because nothing slips through the cracks.
              </p>

              {/* CTA from original */}
              <div>
                <button
                  onClick={() => setShowModal(true)}
                  className={`group px-8 py-4 bg-gradient-to-br from-slate-900 to-slate-700 text-white text-lg font-bold rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 inline-flex items-center gap-3 ${dmSans.className}`}
                >
                  Start Building Your Network
                  <Rocket className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </button>

                <p className={`mt-5 text-sm text-slate-500 max-w-xl mx-auto lg:mx-0 text-balance ${dmSans.className}`}>
                  Tracking a job search too? Link contacts to the roles you&apos;re pursuing and see who can help.
                </p>
              </div>
            </div>

            {/* Right side - Dashboard preview */}
            <div className="mt-12 lg:mt-0">
              <div className="relative">
                {/* Decorative blur background */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/20 to-slate-400/20 blur-3xl rounded-3xl" />

                {/* App preview mockup */}
                <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-slate-200 overflow-hidden">
                  {/* Mock header */}
                  <div className="bg-white border-b-2 border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Rocket className="w-6 h-6 text-slate-800" />
                      <div>
                        <div className={`text-sm font-bold text-slate-900 ${dmSans.className}`}>Job Tracker</div>
                        <div className={`text-xs text-slate-500 ${dmSans.className}`}>Launch Into a New Role</div>
                      </div>
                    </div>
                  </div>

                  {/* Mock navigation tabs */}
                  <div className="p-4 pb-3">
                    <div className="bg-slate-50 rounded-xl p-2 border-2 border-slate-200">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* Job Pipeline Tab */}
                        <div className="p-3 rounded-lg hover:bg-white/80 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                              <Briefcase className="w-4 h-4 text-slate-600" />
                            </div>
                            <div className="text-left">
                              <div className={`text-xs font-semibold text-slate-600 ${dmSans.className}`}>Job Pipeline</div>
                              <div className={`text-[10px] text-slate-500 ${dmSans.className}`}>Track jobs</div>
                            </div>
                          </div>
                        </div>
                        {/* Network Tab - Active */}
                        <div className="relative p-3 rounded-lg bg-white shadow-md border-2 border-slate-300">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-lg">
                              <Users className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-left">
                              <div className={`text-xs font-semibold text-slate-900 ${dmSans.className}`}>Network</div>
                              <div className={`text-[10px] text-slate-500 ${dmSans.className}`}>Connections</div>
                            </div>
                          </div>
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-10 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 rounded-full" />
                        </div>
                        {/* Reporting Tab */}
                        <div className="p-3 rounded-lg hover:bg-white/80 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                              <BarChart3 className="w-4 h-4 text-slate-600" />
                            </div>
                            <div className="text-left">
                              <div className={`text-xs font-semibold text-slate-600 ${dmSans.className}`}>Reporting</div>
                              <div className={`text-[10px] text-slate-500 ${dmSans.className}`}>Analytics</div>
                            </div>
                          </div>
                        </div>
                        {/* Data Hub Tab */}
                        <div className="p-3 rounded-lg hover:bg-white/80 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                              <Upload className="w-4 h-4 text-slate-600" />
                            </div>
                            <div className="text-left">
                              <div className={`text-xs font-semibold text-slate-600 ${dmSans.className}`}>Data Hub</div>
                              <div className={`text-[10px] text-slate-500 ${dmSans.className}`}>Import</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mock contact cards - 3-column grid */}
                  <div className="px-4 pb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {/* Contact 1 */}
                      <div className="bg-white border-2 border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-slate-900 group-hover:bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className={`text-sm font-bold text-slate-900 truncate ${dmSans.className}`}>Jordan Chen</h3>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-600 mb-1">
                          <Building className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <p className={`text-xs truncate ${dmSans.className}`}>Acme Industries</p>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-600 mb-1">
                          <Briefcase className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <p className={`text-xs truncate ${dmSans.className}`}>VP Engineering</p>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-1">
                          <Linkedin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className={`text-blue-600 truncate ${dmSans.className}`}>LinkedIn Profile</span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-2">
                          <Mail className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className={`truncate ${dmSans.className}`}>jordan.chen@acme.com</span>
                        </div>
                        <div className="mb-1">
                          <div className="inline-flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                            <Briefcase className="w-3 h-3" />
                            <span>2 linked jobs</span>
                          </div>
                        </div>
                      </div>

                      {/* Contact 2 */}
                      <div className="bg-white border-2 border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-slate-900 group-hover:bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className={`text-sm font-bold text-slate-900 truncate ${dmSans.className}`}>Sarah Park</h3>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-600 mb-1">
                          <Building className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <p className={`text-xs truncate ${dmSans.className}`}>CloudScale</p>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-600 mb-1">
                          <Briefcase className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <p className={`text-xs truncate ${dmSans.className}`}>Director of Product</p>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-1">
                          <Linkedin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className={`text-blue-600 truncate ${dmSans.className}`}>LinkedIn Profile</span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-2">
                          <Mail className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className={`truncate ${dmSans.className}`}>sarah.park@cloudscale.io</span>
                        </div>
                        <div className="mb-1">
                          <div className="inline-flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                            <Briefcase className="w-3 h-3" />
                            <span>1 linked job</span>
                          </div>
                        </div>
                      </div>

                      {/* Contact 3 */}
                      <div className="bg-white border-2 border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-slate-900 group-hover:bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className={`text-sm font-bold text-slate-900 truncate ${dmSans.className}`}>Marcus Rod</h3>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-600 mb-1">
                          <Building className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <p className={`text-xs truncate ${dmSans.className}`}>DesignLabs</p>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-600 mb-1">
                          <Briefcase className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <p className={`text-xs truncate ${dmSans.className}`}>Head of Design</p>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-1">
                          <Linkedin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className={`text-blue-600 truncate ${dmSans.className}`}>LinkedIn Profile</span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-2">
                          <Mail className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className={`truncate ${dmSans.className}`}>marcus@designlabs.co</span>
                        </div>
                      </div>

                      {/* Contact 4 */}
                      <div className="bg-white border-2 border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-slate-900 group-hover:bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className={`text-sm font-bold text-slate-900 truncate ${dmSans.className}`}>Alex Kim</h3>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-600 mb-1">
                          <Building className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <p className={`text-xs truncate ${dmSans.className}`}>TechFlow</p>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-600 mb-1">
                          <Briefcase className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <p className={`text-xs truncate ${dmSans.className}`}>Engineering Manager</p>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-1">
                          <Linkedin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className={`text-blue-600 truncate ${dmSans.className}`}>LinkedIn Profile</span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-2">
                          <Mail className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className={`truncate ${dmSans.className}`}>alex.kim@techflow.dev</span>
                        </div>
                        <div className="mb-1">
                          <div className="inline-flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                            <Briefcase className="w-3 h-3" />
                            <span>3 linked jobs</span>
                          </div>
                        </div>
                      </div>

                      {/* Contact 5 */}
                      <div className="bg-white border-2 border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-slate-900 group-hover:bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className={`text-sm font-bold text-slate-900 truncate ${dmSans.className}`}>Priya Nair</h3>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-600 mb-1">
                          <Building className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <p className={`text-xs truncate ${dmSans.className}`}>Northwind</p>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-600 mb-1">
                          <Briefcase className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <p className={`text-xs truncate ${dmSans.className}`}>Talent Partner</p>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-1">
                          <Linkedin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className={`text-blue-600 truncate ${dmSans.className}`}>LinkedIn Profile</span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-2">
                          <Mail className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className={`truncate ${dmSans.className}`}>priya.nair@northwind.com</span>
                        </div>
                      </div>

                      {/* Contact 6 */}
                      <div className="bg-white border-2 border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-slate-900 group-hover:bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className={`text-sm font-bold text-slate-900 truncate ${dmSans.className}`}>Michael Torres</h3>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-600 mb-1">
                          <Building className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <p className={`text-xs truncate ${dmSans.className}`}>BuildRight</p>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-600 mb-1">
                          <Briefcase className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <p className={`text-xs truncate ${dmSans.className}`}>Principal Architect</p>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-1">
                          <Linkedin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className={`text-blue-600 truncate ${dmSans.className}`}>LinkedIn Profile</span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-2">
                          <Mail className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className={`truncate ${dmSans.className}`}>m.torres@buildright.com</span>
                        </div>
                        <div className="mb-1">
                          <div className="inline-flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                            <Briefcase className="w-3 h-3" />
                            <span>1 linked job</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal - Refined style */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            onClick={() => setShowModal(false)}
          />

          <div className={`fixed inset-y-0 right-0 w-full sm:w-[600px] bg-white shadow-2xl z-50 ${dmSans.className}`}>
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="bg-slate-900 text-white p-8 relative">
                <button
                  onClick={() => setShowModal(false)}
                  className="absolute top-6 right-6 hover:opacity-70 transition-opacity"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="text-xs font-semibold tracking-wide mb-2 opacity-60">WELCOME</div>
                <h2 className={`text-3xl font-bold ${archivo.className}`}>
                  Get started
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {!isEmailMode ? (
                  <>
                    <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                      Sign in to pick up your network where you left off — connections, conversations, and what to do next.
                    </p>

                    <button
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-md transition-all duration-200 disabled:opacity-50 mb-4"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <span className="text-slate-700 font-semibold">
                        {loading ? 'Connecting...' : 'Continue with Google'}
                      </span>
                    </button>

                    <button
                      onClick={() => setIsEmailMode(true)}
                      className="w-full px-6 py-4 border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-semibold text-slate-700"
                    >
                      Use email instead
                    </button>

                    <div className="mt-10 pt-8 border-t border-slate-200">
                      <div className="text-xs font-semibold tracking-wide mb-4 text-slate-500">WHAT'S INCLUDED</div>
                      <div className="space-y-3">
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-slate-900 rounded flex-shrink-0 mt-0.5" />
                          <span className="text-slate-600">A dated record of every connection you make</span>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-indigo-500 rounded flex-shrink-0 mt-0.5" />
                          <span className="text-slate-600">Full interaction history &mdash; email, calls, meetings, LinkedIn</span>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-slate-900 rounded flex-shrink-0 mt-0.5" />
                          <span className="text-slate-600">Follow-up reminders, plus job pipeline tracking</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEmailMode(false)}
                      className="mb-8 text-sm font-semibold text-slate-600 hover:text-slate-900"
                    >
                      ← Back
                    </button>

                    <form onSubmit={handleEmailAuth} className="space-y-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors"
                          required
                        />
                      </div>

                      {message && (
                        <div className={`p-4 rounded-xl text-sm font-medium ${
                          message.includes('error') || message.includes('Invalid')
                            ? 'bg-red-50 text-red-700 border-2 border-red-200'
                            : 'bg-green-50 text-green-700 border-2 border-green-200'
                        }`}>
                          {message}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-6 py-4 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
                      >
                        {loading ? 'Processing...' : (isSignUp ? 'Create account' : 'Sign in')}
                      </button>
                    </form>

                    <div className="mt-6 text-center">
                      <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                      >
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
