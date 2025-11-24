// src/app/page-v2.tsx - V2 Dashboard with refined aesthetic
'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { User } from '@supabase/supabase-js'
import JobList from '@/components/JobList'
import ContactList from '@/components/ContactList'
import CSVManager from '@/components/CSVManager'
import Reporting from '@/components/Reporting'
import LandingPageV2 from '@/components/LandingPageV2'
import ExtensionAuthSync from '@/components/ExtensionAuthSync'
import {
  Briefcase,
  Users,
  Upload,
  LogOut,
  BarChart3,
  Rocket
} from 'lucide-react'
import { DM_Sans, Archivo } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'] })
const archivo = Archivo({ subsets: ['latin'], weight: ['600', '700', '800'] })

export default function HomeV2() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'contacts' | 'reporting' | 'csv'>('jobs')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClientComponentClient()

  useEffect(() => {
    let mounted = true

    async function initializeAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return

        setUser(session?.user ?? null)
        setLoading(false)

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            if (!mounted) return
            setUser(session?.user ?? null)
          }
        )

        return () => {
          subscription.unsubscribe()
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    let cleanup: (() => void) | undefined

    initializeAuth().then((cleanupFn) => {
      cleanup = cleanupFn
    })

    return () => {
      mounted = false
      if (cleanup) {
        cleanup()
      }
    }
  }, [supabase])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()

      if (typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.token')
        localStorage.removeItem('supabase.auth.expires_at')
        sessionStorage.clear()
        localStorage.removeItem('supabase.auth.refresh_token')
      }

      window.location.reload()
    } catch (error) {
      console.error('Error during sign out:', error)
      window.location.reload()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-200 rounded-full animate-pulse"></div>
            <div className="w-16 h-16 border-4 border-slate-900 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className={`mt-6 text-slate-600 font-medium ${dmSans.className}`}>Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LandingPageV2 />
  }

  const navigationItems = [
    {
      id: 'jobs',
      label: 'Job Pipeline',
      icon: Briefcase,
      description: 'Track applications'
    },
    {
      id: 'contacts',
      label: 'Network',
      icon: Users,
      description: 'Manage contacts'
    },
    {
      id: 'reporting',
      label: 'Reporting',
      icon: BarChart3,
      description: 'Analytics'
    },
    {
      id: 'csv',
      label: 'Data Hub',
      icon: Upload,
      description: 'Import & export'
    }
  ]

  return (
    <div className={`min-h-screen bg-slate-50 ${dmSans.className}`}>
      <ExtensionAuthSync />

      {/* Top Header - Refined with V2 aesthetic */}
      <header className="bg-white border-b-2 border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between h-16 px-6">
            {/* Logo/Brand */}
            <div className="flex items-center space-x-3">
              <Rocket className="w-7 h-7 text-slate-900" />
              <div>
                <h1 className={`text-xl font-bold text-slate-900 ${archivo.className}`}>Job Tracker</h1>
                <p className={`text-xs text-slate-500 ${dmSans.className}`}>Launch Into a New Role</p>
              </div>
            </div>

            {/* User Info & Actions */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:block text-right">
                <p className={`text-sm font-semibold text-slate-900 ${dmSans.className}`}>Welcome back</p>
                <p className={`text-xs text-slate-500 ${dmSans.className}`}>{user.email}</p>
              </div>
              <button
                onClick={() => {
                  if (confirm('Sign out? You will need to sign in again to access your data.')) {
                    handleSignOut()
                  }
                }}
                className={`flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-slate-700 border-2 border-slate-200 hover:border-slate-300 rounded-xl transition-all duration-200 hover:bg-slate-50 ${dmSans.className}`}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation Tabs - V2 Style */}
        <div className="mb-8">
          <div className="bg-slate-50 rounded-xl p-2 border-2 border-slate-200">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as 'jobs' | 'contacts' | 'reporting' | 'csv')}
                    className={`relative group p-4 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-white shadow-md border-2 border-slate-300'
                        : 'hover:bg-white/80 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        isActive
                          ? 'bg-slate-900 shadow-lg'
                          : 'bg-slate-100 group-hover:bg-slate-200'
                      }`}>
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-600'}`} />
                      </div>
                      <div className="text-left flex-1">
                        <p className={`font-semibold transition-colors ${
                          isActive ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-800'
                        }`}>
                          {item.label}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                      </div>
                    </div>

                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-slate-900 rounded-full" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main Content Area - V2 Style */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm min-h-[600px]">
          <div className="p-6">
            {/* Tab Content */}
            <div className="space-y-6">
              {activeTab === 'jobs' && <JobList />}
              {activeTab === 'contacts' && <ContactList />}
              {activeTab === 'reporting' && <Reporting />}
              {activeTab === 'csv' && <CSVManager />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
