// api.js - API communication utilities for Job Tracker extension

const API_BASE_URL = 'https://job-tracker.kineticbrandpartners.com';

// Get API key from storage (set by user in extension settings)
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['extension_api_key'], (result) => {
      resolve(result.extension_api_key || null);
    });
  });
}

// Set API key in storage
export async function setApiKey(apiKey) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ extension_api_key: apiKey }, resolve);
  });
}

function getApiBaseUrl() {
  return API_BASE_URL;
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

/**
 * Look up a contact by LinkedIn URL
 * Uses API key authentication (no user login required)
 * @param {string} linkedinUrl - The LinkedIn profile URL
 * @returns {Promise<{found: boolean, contact?: object, error?: string}>}
 */
export async function lookupContact(linkedinUrl) {
  try {
    const apiKey = await getApiKey();

    if (!apiKey) {
      return {
        found: false,
        error: 'API key not configured. Please set your API key in extension settings.'
      };
    }

    const response = await fetch(`${getApiBaseUrl()}/api/extension/lookup-contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({ linkedin_url: linkedinUrl })
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        found: false,
        error: result.error || `API error: ${response.status}`
      };
    }

    return result;
  } catch (error) {
    console.error('Error looking up contact:', error);
    return {
      found: false,
      error: error.message || 'Failed to look up contact'
    };
  }
}

/**
 * Sync mutual connections to a contact
 * Uses API key authentication (no user login required)
 * @param {string} linkedinUrl - The LinkedIn profile URL
 * @param {string[]} mutualConnections - Array of mutual connection names
 * @returns {Promise<{success: boolean, added?: string[], already_existed?: string[], error?: string}>}
 */
export async function syncConnections(linkedinUrl, mutualConnections) {
  try {
    const apiKey = await getApiKey();

    if (!apiKey) {
      return {
        success: false,
        error: 'API key not configured. Please set your API key in extension settings.'
      };
    }

    const response = await fetch(`${getApiBaseUrl()}/api/extension/sync-connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        linkedin_url: linkedinUrl,
        mutual_connections: mutualConnections
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || `API error: ${response.status}`
      };
    }

    return result;
  } catch (error) {
    console.error('Error syncing connections:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync connections'
    };
  }
}
