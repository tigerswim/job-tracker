// popup.js - Popup UI logic for Job Tracker extension

import { checkAuth, addJobToTracker, setAuthData, syncConnections, lookupContact, setApiKey } from '../utils/api.js';

/**
 * Try to fetch auth data from Job Tracker website
 */
async function fetchAuthFromWebsite() {
  try {
    console.log('[Auth Fetch] Searching for Job Tracker tabs...');

    // Query for Job Tracker tabs
    const tabs = await chrome.tabs.query({ url: ['http://localhost:3001/*', 'https://job-tracker.kineticbrandpartners.com/*'] });

    console.log('[Auth Fetch] Found tabs:', tabs.length);

    if (tabs.length === 0) {
      console.log('[Auth Fetch] No Job Tracker tabs found. Please open Job Tracker.');
      return false;
    }

    console.log('[Auth Fetch] Attempting to read auth from tab', tabs[0].id);

    // Try to execute script to get auth from localStorage
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        try {
          const authData = localStorage.getItem('job-tracker-extension-auth');
          console.log('[Injected Script] Auth data found:', !!authData);
          if (authData) {
            const parsed = JSON.parse(authData);
            return {
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token,
              expires_at: parsed.expires_at
            };
          }
        } catch (e) {
          console.error('[Injected Script] Error:', e);
        }
        return null;
      }
    });

    console.log('[Auth Fetch] Script execution result:', results);

    if (results && results[0] && results[0].result) {
      const authData = results[0].result;
      console.log('[Auth Fetch] Got auth data, storing...');
      await setAuthData(authData);
      console.log('[Auth Fetch] ✓ Auth data fetched and stored successfully');
      return true;
    }

    console.log('[Auth Fetch] No auth data returned from script');
    return false;
  } catch (error) {
    console.error('[Auth Fetch] Error:', error);
    return false;
  }
}

// DOM elements
let authStatus, mainContent, loadingState, jobForm, successState, errorState;
let addJobFormElement, cancelBtn, submitBtn, addAnotherBtn, retryBtn;
let profileSection, profileName, profileHeadline, contactMatch, contactNotFound;
let connectionsPreview, connectionsSummary, syncConnectionsBtn, loadAllBtn;
let loadingText;
let settingsSection, settingsLink, closeSettingsBtn, apiKeyInput, saveSettingsBtn, settingsSaved;

// Profile state
let currentProfileData = null;
let currentContactData = null;
let scrapedConnections = [];

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  authStatus = document.getElementById('authStatus');
  mainContent = document.getElementById('mainContent');
  loadingState = document.getElementById('loadingState');
  loadingText = document.getElementById('loadingText');
  jobForm = document.getElementById('jobForm');
  successState = document.getElementById('successState');
  errorState = document.getElementById('errorState');
  addJobFormElement = document.getElementById('addJobForm');
  cancelBtn = document.getElementById('cancelBtn');
  submitBtn = document.getElementById('submitBtn');
  addAnotherBtn = document.getElementById('addAnotherBtn');
  retryBtn = document.getElementById('retryBtn');

  // Profile elements
  profileSection = document.getElementById('profileSection');
  profileName = document.getElementById('profileName');
  profileHeadline = document.getElementById('profileHeadline');
  contactMatch = document.getElementById('contactMatch');
  contactNotFound = document.getElementById('contactNotFound');
  connectionsPreview = document.getElementById('connectionsPreview');
  connectionsSummary = document.getElementById('connectionsSummary');
  syncConnectionsBtn = document.getElementById('syncConnectionsBtn');
  loadAllBtn = document.getElementById('loadAllBtn');

  // Set up event listeners
  addJobFormElement.addEventListener('submit', handleSubmit);
  cancelBtn.addEventListener('click', () => window.close());
  addAnotherBtn.addEventListener('click', resetToForm);
  retryBtn.addEventListener('click', resetToForm);

  // Profile event listeners
  if (syncConnectionsBtn) {
    syncConnectionsBtn.addEventListener('click', handleSyncConnections);
  }
  if (loadAllBtn) {
    loadAllBtn.addEventListener('click', handleLoadAllConnections);
  }

  // Settings elements
  settingsSection = document.getElementById('settingsSection');
  settingsLink = document.getElementById('settingsLink');
  closeSettingsBtn = document.getElementById('closeSettingsBtn');
  apiKeyInput = document.getElementById('apiKeyInput');
  saveSettingsBtn = document.getElementById('saveSettingsBtn');
  settingsSaved = document.getElementById('settingsSaved');

  // Settings event listeners
  if (settingsLink) {
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSettings();
    });
  }
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', hideSettings);
  }
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', handleSaveSettings);
  }

  // Determine page type first
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isProfilePage = tab?.url?.includes('linkedin.com/in/');

  // For profile pages, we use API key auth (no user login needed)
  if (isProfilePage) {
    showLoading('Loading profile data...');
    await loadProfileData();
    return;
  }

  // For job pages, check user authentication
  let isAuthenticated = await checkAuth();

  // If not authenticated, try to get auth from Job Tracker website
  if (!isAuthenticated) {
    console.log('Not authenticated, attempting to fetch from Job Tracker...');
    const authFetched = await fetchAuthFromWebsite();
    if (authFetched) {
      isAuthenticated = true;
      console.log('Auth fetched successfully from Job Tracker');
    }
  }

  if (!isAuthenticated) {
    showAuthPrompt();
    return;
  }

  // Get current tab and extract job data
  await loadJobData();
});

// Show authentication prompt
function showAuthPrompt() {
  authStatus.classList.remove('hidden');
  mainContent.classList.add('hidden');
}

// Load job data from current page
async function loadJobData() {
  try {
    // Show loading state
    showLoading();

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error('Unable to access current tab');
    }

    // Send message to content script to extract job data
    chrome.tabs.sendMessage(tab.id, { action: 'extractJobData' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Content script error:', chrome.runtime.lastError);
        showError('Unable to extract job data from this page. Make sure you\'re on a job posting page.');
        return;
      }

      if (response && response.jobData) {
        populateForm(response.jobData);
        showForm();
      } else {
        showError('No job data found on this page. Please navigate to a job posting.');
      }
    });
  } catch (error) {
    console.error('Error loading job data:', error);
    showError(error.message || 'Failed to load job data');
  }
}

// Populate form with extracted job data
function populateForm(jobData) {
  document.getElementById('jobTitle').value = jobData.job_title || '';
  document.getElementById('company').value = jobData.company || '';
  document.getElementById('location').value = jobData.location || '';
  document.getElementById('salary').value = jobData.salary || '';
  document.getElementById('jobUrl').value = jobData.job_url || '';
  document.getElementById('jobDescription').value = jobData.job_description || '';
  document.getElementById('status').value = jobData.status || 'interested';
  document.getElementById('notes').value = jobData.notes || '';
}

// Handle form submission
async function handleSubmit(e) {
  e.preventDefault();

  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <svg class="icon spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
    </svg>
    Adding...
  `;

  try {
    // Collect form data
    const formData = new FormData(addJobFormElement);
    const jobData = {
      job_title: formData.get('job_title'),
      company: formData.get('company'),
      location: formData.get('location') || null,
      salary: formData.get('salary') || null,
      job_url: formData.get('job_url') || null,
      job_description: formData.get('job_description') || null,
      status: formData.get('status') || 'interested',
      notes: formData.get('notes') || null,
      applied_date: formData.get('status') === 'applied' ? new Date().toISOString().split('T')[0] : null
    };

    // Send to Job Tracker API
    const result = await addJobToTracker(jobData);

    if (result.success) {
      showSuccess();
    } else {
      throw new Error(result.error || 'Failed to add job');
    }
  } catch (error) {
    console.error('Error adding job:', error);
    showError(error.message || 'Failed to add job to tracker');

    // Re-enable submit button
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
      Add to Job Tracker
    `;
  }
}

// UI state management functions
function showLoading(message = 'Extracting job details...') {
  hideAllStates();
  if (loadingText) {
    loadingText.textContent = message;
  }
  loadingState.classList.remove('hidden');
}

function showForm() {
  hideAllStates();
  jobForm.classList.remove('hidden');
}

function showSuccess() {
  hideAllStates();
  successState.classList.remove('hidden');
}

function showError(message) {
  hideAllStates();
  document.getElementById('errorMessage').textContent = message;
  errorState.classList.remove('hidden');
}

function hideAllStates() {
  loadingState.classList.add('hidden');
  jobForm.classList.add('hidden');
  successState.classList.add('hidden');
  errorState.classList.add('hidden');
  if (profileSection) {
    profileSection.classList.add('hidden');
  }
}

function resetToForm() {
  // Reset submit button state
  submitBtn.disabled = false;
  submitBtn.innerHTML = `
    <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20 6L9 17l-5-5"></path>
    </svg>
    Add to Job Tracker
  `;

  // Clear form
  addJobFormElement.reset();

  // Reload job data
  loadJobData();
}

// ============================================
// Profile Page Functions
// ============================================

/**
 * Load profile data from the current LinkedIn profile page
 */
async function loadProfileData() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error('Unable to access current tab');
    }

    // Get profile data from content script
    chrome.tabs.sendMessage(tab.id, { action: 'getProfileData' }, async (response) => {
      if (chrome.runtime.lastError) {
        console.error('Content script error:', chrome.runtime.lastError);
        showError('Unable to extract profile data. Try refreshing the LinkedIn page.');
        return;
      }

      if (response && response.profileData) {
        currentProfileData = response.profileData;
        scrapedConnections = response.profileData.mutual_connections || [];

        // Look up contact in Job Tracker
        await lookupContactByUrl(currentProfileData.linkedin_url);

        // Show profile UI
        showProfileSection();
      } else {
        showError('No profile data found. Make sure you\'re on a LinkedIn profile page.');
      }
    });
  } catch (error) {
    console.error('Error loading profile data:', error);
    showError(error.message || 'Failed to load profile data');
  }
}

/**
 * Look up a contact in Job Tracker by LinkedIn URL
 */
async function lookupContactByUrl(linkedinUrl) {
  try {
    const result = await lookupContact(linkedinUrl);

    if (result.found) {
      currentContactData = result.contact;
    } else {
      currentContactData = null;
    }
  } catch (error) {
    console.error('Error looking up contact:', error);
    currentContactData = null;
  }
}

/**
 * Show the profile section with current data
 */
function showProfileSection() {
  hideAllStates();

  // Update profile info
  profileName.textContent = currentProfileData.name || 'Unknown';
  profileHeadline.textContent = currentProfileData.headline || '';

  // Show contact match status
  if (currentContactData) {
    contactMatch.classList.remove('hidden');
    contactNotFound.classList.add('hidden');
  } else {
    contactMatch.classList.add('hidden');
    contactNotFound.classList.remove('hidden');
  }

  // Update connections preview
  updateConnectionsPreview();

  // Show the section
  profileSection.classList.remove('hidden');
}

/**
 * Update the connections preview UI
 */
function updateConnectionsPreview() {
  if (scrapedConnections.length === 0) {
    connectionsPreview.innerHTML = '<p class="no-connections">No mutual connections found on page. Click "Load all" to scan.</p>';
    connectionsSummary.classList.add('hidden');
    syncConnectionsBtn.disabled = true;
    return;
  }

  // Build pills HTML
  const existingConnections = currentContactData?.mutual_connections || [];
  const pillsHtml = scrapedConnections.map(name => {
    const isNew = !isConnectionAlreadySaved(name, existingConnections);
    return `<span class="connection-pill ${isNew ? 'new-connection' : ''}">${escapeHtml(name)}</span>`;
  }).join('');

  connectionsPreview.innerHTML = `<div class="connection-pills">${pillsHtml}</div>`;

  // Update summary
  const newConnections = countNewConnections(scrapedConnections, existingConnections);
  document.getElementById('foundCount').textContent = scrapedConnections.length;
  document.getElementById('existingCount').textContent = scrapedConnections.length - newConnections;
  document.getElementById('newCount').textContent = newConnections;

  connectionsSummary.classList.remove('hidden');

  // Enable/disable sync button
  syncConnectionsBtn.disabled = !currentContactData || newConnections === 0;

  // Update button text
  if (!currentContactData) {
    syncConnectionsBtn.innerHTML = `
      <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      Contact not found
    `;
  } else if (newConnections === 0) {
    syncConnectionsBtn.innerHTML = `
      <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
      All connections saved
    `;
  } else {
    syncConnectionsBtn.innerHTML = `
      <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      Sync ${newConnections} Connection${newConnections > 1 ? 's' : ''}
    `;
  }
}

/**
 * Check if a connection name already exists (with fuzzy matching)
 */
function isConnectionAlreadySaved(name, existingConnections) {
  const normalizedNew = normalizeName(name);
  return existingConnections.some(existing => normalizeName(existing) === normalizedNew);
}

/**
 * Count how many connections are new
 */
function countNewConnections(scraped, existing) {
  return scraped.filter(name => !isConnectionAlreadySaved(name, existing)).length;
}

/**
 * Normalize a name for comparison (matching backend logic)
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    // Remove common credential suffixes
    .replace(/,?\s*(mba|phd|md|jd|cpa|pmp|cfa|cfp|esq|pe|rn|bs|ba|ms|ma|msc|llm|edd|dba|dmin|psyd|pharmd|dnp|dpt|do|dds|dmd|od|dc|dpm|drph|mph|mha|mpa|msw|lcsw|lpc|lmft|shrm-cp|shrm-scp|sphr|phr|cissp|pmi-acp|csm|six sigma|ceh|ccna|ccnp|aws|gcp|azure)\b/gi, '')
    // Remove single letter initials
    .replace(/\b[a-z]\.\s*/gi, '')
    // Remove periods
    .replace(/\./g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Handle clicking "Load all from page" button
 */
async function handleLoadAllConnections() {
  loadAllBtn.disabled = true;
  loadAllBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
      <path d="M21 12a9 9 0 11-6.219-8.56"></path>
    </svg>
    Loading...
  `;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: 'extractAllMutualConnections' }, (response) => {
      loadAllBtn.disabled = false;
      loadAllBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 11-6.219-8.56"></path>
        </svg>
        Load all from page
      `;

      if (chrome.runtime.lastError) {
        console.error('Error loading connections:', chrome.runtime.lastError);
        return;
      }

      if (response && response.profileData) {
        scrapedConnections = response.profileData.mutual_connections || [];
        updateConnectionsPreview();
      }
    });
  } catch (error) {
    console.error('Error loading all connections:', error);
    loadAllBtn.disabled = false;
    loadAllBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 11-6.219-8.56"></path>
      </svg>
      Load all from page
    `;
  }
}

/**
 * Handle syncing connections to Job Tracker
 */
async function handleSyncConnections() {
  if (!currentContactData || scrapedConnections.length === 0) {
    return;
  }

  syncConnectionsBtn.disabled = true;
  syncConnectionsBtn.innerHTML = `
    <svg class="icon spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
    </svg>
    Syncing...
  `;

  try {
    const result = await syncConnections(currentProfileData.linkedin_url, scrapedConnections);

    if (result.success) {
      // Show success
      showProfileSuccess(result.added || []);
    } else {
      throw new Error(result.error || 'Failed to sync connections');
    }
  } catch (error) {
    console.error('Error syncing connections:', error);
    showError(error.message || 'Failed to sync connections');
  }
}

/**
 * Show profile sync success state
 */
function showProfileSuccess(addedConnections) {
  hideAllStates();

  let addedListHtml = '';
  if (addedConnections.length > 0) {
    addedListHtml = `
      <div class="added-list">
        <h4>Added connections:</h4>
        <ul>
          ${addedConnections.map(name => `<li>${escapeHtml(name)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  successState.innerHTML = `
    <div class="success-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    </div>
    <h2>Connections Synced!</h2>
    <p>${addedConnections.length} connection${addedConnections.length !== 1 ? 's' : ''} added to ${escapeHtml(currentContactData.name || 'contact')}</p>
    ${addedListHtml}
    <div class="button-group" style="margin-top: 16px;">
      <a href="https://job-tracker.kineticbrandpartners.com" target="_blank" class="btn btn-primary">
        View in Job Tracker
      </a>
    </div>
  `;

  successState.classList.remove('hidden');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Settings Functions
// ============================================

/**
 * Show the settings section
 */
async function showSettings() {
  mainContent.classList.add('hidden');
  settingsSection.classList.remove('hidden');
  settingsSaved.classList.add('hidden');

  // Load current API key if exists
  const result = await chrome.storage.local.get(['extension_api_key']);
  if (result.extension_api_key) {
    apiKeyInput.value = result.extension_api_key;
  }
}

/**
 * Hide the settings section and return to main content
 */
function hideSettings() {
  settingsSection.classList.add('hidden');
  mainContent.classList.remove('hidden');
}

/**
 * Save settings
 */
async function handleSaveSettings() {
  const apiKey = apiKeyInput.value.trim();

  if (apiKey) {
    await setApiKey(apiKey);
  }

  // Show saved confirmation
  settingsSaved.classList.remove('hidden');

  // Hide after 2 seconds
  setTimeout(() => {
    settingsSaved.classList.add('hidden');
  }, 2000);
}
