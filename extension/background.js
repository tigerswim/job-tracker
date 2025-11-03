// background.js - Background service worker for Job Tracker extension

import { setupAuthListener } from './utils/api.js';

// Set up auth listener on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Job Tracker extension installed');
  setupAuthListener();
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openPopup') {
    // Open the popup programmatically
    chrome.action.openPopup();
    sendResponse({ success: true });
  }
  return true;
});

// Handle keyboard command (Alt+J)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'add-job') {
    chrome.action.openPopup();
  }
});

// Listen for tab updates to potentially inject content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only proceed if the tab has finished loading
  if (changeInfo.status === 'complete' && tab.url) {
    const url = new URL(tab.url);

    // Check if it's a job posting page we care about
    const isJobPage =
      (url.hostname === 'www.linkedin.com' && url.pathname.includes('/jobs/')) ||
      (url.hostname.includes('indeed.com') && (url.pathname.includes('/viewjob') || url.search.includes('jk='))) ||
      url.hostname.includes('greenhouse.io') ||
      url.hostname.includes('lever.co') ||
      url.hostname.includes('workday.com') ||
      url.hostname.includes('breezy.hr') ||
      url.hostname.includes('smartrecruiters.com');

    if (isJobPage) {
      console.log('Detected job page:', url.hostname);
    }
  }
});

// Handle connection to Job Tracker website for auth sync
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'job-tracker-auth') {
    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'AUTH_UPDATE') {
        // Store auth data from website
        await chrome.storage.local.set({ supabase_auth: msg.authData });
        console.log('Auth data synced from website');
        port.postMessage({ type: 'AUTH_STORED', success: true });
      }
    });
  }
});

console.log('Job Tracker background service worker loaded');
