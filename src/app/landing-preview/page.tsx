'use client'

import { useState } from 'react'
import { Rocket } from 'lucide-react'
import { Montserrat, Manrope } from 'next/font/google'

const montserrat = Montserrat({ subsets: ['latin'], weight: ['900'] })
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '600'] })

export default function LandingPreview() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100 flex items-center justify-center px-6 py-12">
        <div className="max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-start lg:items-center">
            {/* Left side - Content */}
            <div className="text-center lg:text-left flex flex-col justify-center" style={{ minHeight: '600px' }}>
              {/* Rocket icon */}
              <div className="flex justify-center lg:justify-start mb-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-600/20 blur-3xl rounded-full animate-pulse" />
                  <Rocket className="relative w-20 h-20 text-blue-600" strokeWidth={1.5} />
                </div>
              </div>

              {/* Tweet-sized headline (under 280 chars) */}
              <h1 className={`text-5xl sm:text-6xl lg:text-7xl font-black text-slate-900 mb-6 leading-tight ${montserrat.className}`}>
                Your network knows where the jobs are.
              </h1>

              {/* Subhead with personality */}
              <p className={`text-lg sm:text-xl lg:text-2xl text-slate-600 mb-10 leading-relaxed ${manrope.className}`}>
                Track every contact, conversation, and connection in one place. Because job hunting isn't about applying harder—it's about networking smarter.
              </p>

              {/* Single transformational CTA */}
              <div>
                <button
                  onClick={() => setShowModal(true)}
                  className="group px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xl font-bold rounded-2xl shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300 inline-flex items-center gap-3"
                >
                  See Who Can Help You in 30 Seconds
                  <Rocket className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Right side - App Preview */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Decorative blur background */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-400/20 blur-3xl rounded-3xl" />

                {/* App preview mockup - matches actual Job Tracker interface */}
                <div className="relative bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden">
                  {/* Mock header */}
                  <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Rocket className="w-6 h-6 text-blue-600" />
                        <div>
                          <div className="text-sm font-bold text-slate-800">Job Tracker</div>
                          <div className="text-xs text-slate-500 -mt-0.5">Launch Into a New Role</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mock navigation tabs - matches actual tab design */}
                  <div className="p-4 pb-3">
                    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2 border border-slate-200/60">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="relative p-3 rounded-lg bg-white shadow-lg border border-slate-200/80">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                              <div className="w-3 h-3 bg-white rounded" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-semibold text-slate-800">Job Pipeline</div>
                              <div className="text-[10px] text-slate-500">Track jobs</div>
                            </div>
                          </div>
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" />
                        </div>
                        <div className="p-3 rounded-lg hover:bg-white/50">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                              <div className="w-3 h-3 text-slate-600">👥</div>
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-semibold text-slate-600">Network</div>
                              <div className="text-[10px] text-slate-500">Contacts</div>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg hover:bg-white/50">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                              <div className="w-3 h-3 text-slate-600">📊</div>
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-semibold text-slate-600">Reporting</div>
                              <div className="text-[10px] text-slate-500">Analytics</div>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg hover:bg-white/50">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                              <div className="w-3 h-3 text-slate-600">📁</div>
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-semibold text-slate-600">Data Hub</div>
                              <div className="text-[10px] text-slate-500">Import</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mock job cards - matches actual design */}
                  <div className="px-4 pb-4 space-y-3">
                    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900 text-sm mb-1">VP of Product</h3>
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span>Acme Industries</span>
                            <span>•</span>
                            <span>Austin, TX</span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg">
                          Interviewing
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
                              J
                            </div>
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
                              S
                            </div>
                          </div>
                          <span className="text-xs text-slate-600 font-medium">2 contacts</span>
                        </div>
                        <div className="text-xs text-slate-500">Updated 2d ago</div>
                      </div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900 text-sm mb-1">Head of Engineering</h3>
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span>CloudScale</span>
                            <span>•</span>
                            <span>Remote</span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-lg">
                          Applied
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
                              M
                            </div>
                          </div>
                          <span className="text-xs text-slate-600 font-medium">1 contact</span>
                        </div>
                        <div className="text-xs text-slate-500">Updated 5d ago</div>
                      </div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow opacity-75">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900 text-sm mb-1">Senior UX Designer</h3>
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span>DesignLabs</span>
                            <span>•</span>
                            <span>Seattle, WA</span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">
                          Interested
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="text-xs text-slate-500">No contacts yet</div>
                        <div className="text-xs text-slate-500">Updated 1w ago</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sign-Up Modal */}
      {showModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setShowModal(false)}
          />

          {/* Modal Panel */}
          <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white shadow-2xl z-50 animate-slide-in-right">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <Rocket className="w-6 h-6 text-blue-600" />
                  <h2 className="text-2xl font-bold text-slate-900">Map Your Network</h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-3xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-md mx-auto">
                  <p className={`text-slate-600 mb-8 text-lg leading-relaxed ${manrope.className}`}>
                    Sign in to see which contacts can help with your job search—and who you've been neglecting.
                  </p>

                  {/* Mock Google Sign-In Button (Primary CTA) */}
                  <button
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-slate-300 rounded-xl hover:bg-slate-50 hover:border-slate-400 hover:scale-105 transition-all duration-200 shadow-md hover:shadow-xl"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="text-slate-700 font-semibold text-lg">Continue with Google</span>
                  </button>

                  {/* Email option - subtle, below the fold */}
                  <div className={`mt-6 text-center ${manrope.className}`}>
                    <button className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
                      Or continue with email →
                    </button>
                  </div>

                  {/* Real talk benefits */}
                  <div className={`mt-10 pt-8 border-t border-slate-200 space-y-4 ${manrope.className}`}>
                    <p className="text-slate-700 font-semibold">Here's what happens in 30 seconds:</p>
                    <div className="space-y-3 text-slate-600">
                      <p>→ Import your contacts (or start fresh)</p>
                      <p>→ See who works at companies you're targeting</p>
                      <p>→ Get reminded to follow up (so you don't ghost people)</p>
                    </div>
                  </div>

                  <div className={`mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg ${manrope.className}`}>
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">Real talk:</span> Most jobs come from people you know. This helps you remember who those people are.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
