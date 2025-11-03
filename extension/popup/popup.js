// popup.js - Popup UI logic for Job Tracker extension

import { checkAuth, addJobToTracker, setAuthData } from '../utils/api.js';

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

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  authStatus = document.getElementById('authStatus');
  mainContent = document.getElementById('mainContent');
  loadingState = document.getElementById('loadingState');
  jobForm = document.getElementById('jobForm');
  successState = document.getElementById('successState');
  errorState = document.getElementById('errorState');
  addJobFormElement = document.getElementById('addJobForm');
  cancelBtn = document.getElementById('cancelBtn');
  submitBtn = document.getElementById('submitBtn');
  addAnotherBtn = document.getElementById('addAnotherBtn');
  retryBtn = document.getElementById('retryBtn');

  // Set up event listeners
  addJobFormElement.addEventListener('submit', handleSubmit);
  cancelBtn.addEventListener('click', () => window.close());
  addAnotherBtn.addEventListener('click', resetToForm);
  retryBtn.addEventListener('click', resetToForm);

  // Check authentication
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
function showLoading() {
  hideAllStates();
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
