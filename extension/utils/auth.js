// auth.js - Authentication utilities for Job Tracker extension

/**
 * Script to be injected into Job Tracker website to sync auth with extension
 * This should be added to the Job Tracker website's client-side code
 */

// This code runs on job-tracker.kineticbrandpartners.com
if (typeof window !== 'undefined' && window.location.hostname.includes('job-tracker.kineticbrandpartners.com')) {

  /**
   * Sync Supabase auth with Chrome extension
   */
  async function syncAuthWithExtension() {
    try {
      // Get Supabase auth data from localStorage
      const authKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('sb-') && key.includes('-auth-token')
      );

      if (authKeys.length === 0) {
        console.log('No Supabase auth found');
        return;
      }

      // Get the auth data
      const authData = JSON.parse(localStorage.getItem(authKeys[0]) || '{}');

      if (!authData.access_token) {
        console.log('No access token found');
        return;
      }

      // Check if extension is installed
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        // Send auth data to extension
        const extensionId = 'YOUR_EXTENSION_ID'; // This will be set after publishing

        chrome.runtime.sendMessage(
          extensionId,
          {
            action: 'updateAuth',
            authData: {
              access_token: authData.access_token,
              refresh_token: authData.refresh_token,
              expires_at: authData.expires_at,
              user: authData.user
            }
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.log('Extension not installed or not accessible');
            } else {
              console.log('Auth synced with Job Tracker extension');
            }
          }
        );
      }
    } catch (error) {
      console.error('Error syncing auth with extension:', error);
    }
  }

  // Sync auth when user logs in
  window.addEventListener('load', () => {
    // Initial sync
    setTimeout(syncAuthWithExtension, 1000);

    // Watch for auth changes
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      originalSetItem.apply(this, arguments);
      if (key.includes('auth-token')) {
        syncAuthWithExtension();
      }
    };
  });
}

/**
 * Manual auth token extraction helper
 * Users can run this in console to get their auth token
 */
function getJobTrackerAuthToken() {
  const authKeys = Object.keys(localStorage).filter(key =>
    key.startsWith('sb-') && key.includes('-auth-token')
  );

  if (authKeys.length === 0) {
    console.error('No Supabase auth found. Please log in first.');
    return null;
  }

  const authData = JSON.parse(localStorage.getItem(authKeys[0]) || '{}');

  if (!authData.access_token) {
    console.error('No access token found. Please log in first.');
    return null;
  }

  console.log('Your auth token (copy this to extension settings):');
  console.log(authData.access_token);

  return {
    access_token: authData.access_token,
    expires_at: authData.expires_at
  };
}

// Make it available globally for manual use
if (typeof window !== 'undefined') {
  window.getJobTrackerAuthToken = getJobTrackerAuthToken;
}

// Export for use in extension
export { syncAuthWithExtension, getJobTrackerAuthToken };
