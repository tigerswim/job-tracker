// api.js - API communication utilities for Job Tracker extension

const API_BASE_URL = 'https://job-tracker.kineticbrandpartners.com';
const DEV_API_BASE_URL = 'http://localhost:3001';

// Determine if we're in development mode
function getApiBaseUrl() {
  // Check if we have localhost in any open tabs (dev mode)
  // For now, default to localhost for testing
  return DEV_API_BASE_URL;
}

/**
 * Check if user is authenticated with Job Tracker
 * @returns {Promise<boolean>}
 */
export async function checkAuth() {
  try {
    const authData = await getAuthData();

    if (!authData || !authData.access_token) {
      return false;
    }

    // Verify token is still valid by making a test API call
    const response = await fetch(`${getApiBaseUrl()}/api/contacts?limit=1`, {
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch (error) {
    console.error('Auth check failed:', error);
    return false;
  }
}

/**
 * Get stored authentication data
 * @returns {Promise<object|null>}
 */
export async function getAuthData() {
  return new Promise((resolve) => {
    // First try to get from extension storage
    chrome.storage.local.get(['supabase_auth'], (result) => {
      if (result.supabase_auth) {
        resolve(result.supabase_auth);
        return;
      }

      // If not in extension storage, try to fetch from Job Tracker website
      try {
        chrome.tabs.query({ url: '*://localhost:3001/*' }, async (tabs) => {
          if (tabs.length > 0) {
            // Try to get auth from Job Tracker tab
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getAuthData' }, (response) => {
              if (response && response.authData) {
                // Store it for future use
                setAuthData(response.authData);
                resolve(response.authData);
              } else {
                resolve(null);
              }
            });
          } else {
            resolve(null);
          }
        });
      } catch (error) {
        console.error('Error fetching auth from Job Tracker:', error);
        resolve(null);
      }
    });
  });
}

/**
 * Store authentication data
 * @param {object} authData - Supabase auth data
 * @returns {Promise<void>}
 */
export async function setAuthData(authData) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ supabase_auth: authData }, resolve);
  });
}

/**
 * Clear stored authentication data
 * @returns {Promise<void>}
 */
export async function clearAuthData() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['supabase_auth'], resolve);
  });
}

/**
 * Add a job to Job Tracker
 * @param {object} jobData - Job data to add
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function addJobToTracker(jobData) {
  try {
    const authData = await getAuthData();

    if (!authData || !authData.access_token) {
      return {
        success: false,
        error: 'Not authenticated. Please log in to Job Tracker first.'
      };
    }

    const response = await fetch(`${getApiBaseUrl()}/api/extension/jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jobData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `API error: ${response.status}`);
    }

    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Error adding job:', error);
    return {
      success: false,
      error: error.message || 'Failed to add job to tracker'
    };
  }
}

/**
 * Listen for auth updates from Job Tracker website
 * This allows the extension to automatically get auth when user logs in
 */
export function setupAuthListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateAuth') {
      setAuthData(request.authData).then(() => {
        sendResponse({ success: true });
      });
      return true; // Keep channel open for async response
    }
  });
}
