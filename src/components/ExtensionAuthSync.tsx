// src/components/ExtensionAuthSync.tsx
// Component to sync authentication with Chrome extension

'use client'

import { useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function ExtensionAuthSync() {
  useEffect(() => {
    // Create Supabase client once and reuse it (prevents memory leak)
    const supabase = createClientComponentClient()

    const syncAuthWithExtension = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.access_token) {
          console.log('[Extension Sync] No session found')
          return
        }

        // Store auth data in localStorage for extension to access
        const authData = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          user: session.user
        }

        localStorage.setItem('job-tracker-extension-auth', JSON.stringify(authData))
        console.log('[Extension Sync] Auth data stored for extension')

        // Also make it available on window for console access
        if (typeof window !== 'undefined') {
          (window as any).getJobTrackerAuthToken = () => {
            console.log('✅ Auth Token:', session.access_token)
            console.log('📋 Token copied to clipboard!')
            navigator.clipboard.writeText(session.access_token)
            return session.access_token
          }
        }
      } catch (error) {
        console.error('[Extension Sync] Error:', error)
      }
    }

    // Sync on mount and when auth changes
    syncAuthWithExtension()

    // Set up interval to keep syncing (in case token refreshes)
    const interval = setInterval(syncAuthWithExtension, 60000) // Every minute

    return () => clearInterval(interval)
  }, [])

  return null // This component doesn't render anything
}
