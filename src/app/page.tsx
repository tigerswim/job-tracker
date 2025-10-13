// src/app/page.tsx - Updated with Reporting section
'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { User } from '@supabase/supabase-js'
import JobList from '@/components/JobList'
import ContactList from '@/components/ContactList'
import CSVManager from '@/components/CSVManager'
import Reporting from '@/components/Reporting'
import LoginForm from '@/components/LoginForm'
import { 
  Briefcase, 
  Users, 
  Upload, 
  LogOut, 
  BarChart3
} from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'contacts' | 'reporting' | 'csv'>('jobs')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Initialize Supabase client using createClientComponentClient
  const supabase = createClientComponentClient()

  // Fixed useEffect with proper async handling
  useEffect(() => {
    let mounted = true

    async function initializeAuth() {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        
        setUser(session?.user ?? null)
        setLoading(false)

        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            if (!mounted) return
            setUser(session?.user ?? null)
          }
        )

        // Return cleanup function
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
      // Sign out from Supabase
      await supabase.auth.signOut()
      
      // Clear any stored Google OAuth state
      if (typeof window !== 'undefined') {
        // Clear any Google OAuth related localStorage
        localStorage.removeItem('supabase.auth.token')
        localStorage.removeItem('supabase.auth.expires_at')
        
        // Force Google to show account picker on next sign-in
        // by clearing any cached OAuth state
        sessionStorage.clear()
        
        // Optional: Clear other auth-related storage
        localStorage.removeItem('supabase.auth.refresh_token')
      }
      
      // Force a page reload to ensure clean state
      window.location.reload()
    } catch (error) {
      console.error('Error during sign out:', error)
      // Fallback: force reload anyway
      window.location.reload()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-pulse"></div>
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-6 text-slate-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  // Show login form if not authenticated
  if (!user) {
    return <LoginForm />
  }

  const navigationItems = [
    {
      id: 'jobs',
      label: 'Job Pipeline',
      icon: Briefcase,
      description: 'Track job applications',
      gradient: 'from-blue-500 to-blue-600'
    },
    {
      id: 'contacts',
      label: 'Network',
      icon: Users,
      description: 'Manage contacts',
      gradient: 'from-slate-500 to-slate-600'
    },
    {
      id: 'reporting',
      label: 'Reporting',
      icon: BarChart3,
      description: 'Analytics & insights',
      gradient: 'from-purple-500 to-purple-600'
    },
    {
      id: 'csv',
      label: 'Data Hub',
      icon: Upload,
      description: 'Import & export your data',
      gradient: 'from-blue-400 to-blue-500'
    }
  ]

  // Show main app if authenticated
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between h-16 px-6">
            {/* Logo/Brand */}
            <div className="flex items-center space-x-3">
              {/* Replace CareerTracker text/icon with logo image */}
              <Image
                src="/job-tracker-rocket.png"
                alt="Job Tracker Rocket"
                width={30}
                height={30}
                unoptimized={true}
                className="object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-slate-800">Job Tracker</h1>
                <p className="text-xs text-slate-500 -mt-1">Launch Into a New Role</p>
              </div>
            </div>

            {/* User Info & Actions */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-slate-700">Welcome back</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to sign out? You will need to sign in again to access your data.')) {
                    handleSignOut()
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all duration-200 hover:shadow-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2 border border-slate-200/60 shadow-sm">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as 'jobs' | 'contacts' | 'reporting' | 'csv')}
                    className={`relative group p-4 rounded-lg transition-all duration-300 ${
                      isActive
                        ? 'bg-white shadow-lg border border-slate-200/80'
                        : 'hover:bg-white/50 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                        isActive 
                          ? `bg-gradient-to-r ${item.gradient} shadow-lg` 
                          : 'bg-slate-100 group-hover:bg-slate-200'
                      }`}>
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-600'}`} />
                      </div>
                      <div className="text-left flex-1">
                        <p className={`font-semibold transition-colors ${
                          isActive ? 'text-slate-800' : 'text-slate-600 group-hover:text-slate-700'
                        }`}>
                          {item.label}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                      </div>
                    </div>
                    
                    {/* Active indicator */}
                    {isActive && (
                      <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gradient-to-r ${item.gradient} rounded-full`} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm min-h-[600px]">
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