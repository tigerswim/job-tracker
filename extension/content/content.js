// content.js - Main content script for Job Tracker extension

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractJobData') {
    const jobData = extractJobDataFromPage();
    sendResponse({ jobData });
  }
  return true; // Keep channel open for async response
});

/**
 * Extract job data from current page using appropriate parser
 * @returns {object|null} Job data or null if not found
 */
function extractJobDataFromPage() {
  let jobData = null;

  // Try LinkedIn parser
  if (typeof window.isLinkedInJobPage === 'function' && window.isLinkedInJobPage()) {
    console.log('Detected LinkedIn job page');
    jobData = window.extractLinkedInJobData();
    if (jobData) return jobData;
  }

  // Try Indeed parser
  if (typeof window.isIndeedJobPage === 'function' && window.isIndeedJobPage()) {
    console.log('Detected Indeed job page');
    jobData = window.extractIndeedJobData();
    if (jobData) return jobData;
  }

  // Try generic parser as fallback
  console.log('Trying generic parser');
  jobData = window.extractGenericJobData();

  return jobData;
}

// Initialize floating button when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFloatingButton);
} else {
  initializeFloatingButton();
}

/**
 * Initialize the floating "Add to Job Tracker" button
 */
function initializeFloatingButton() {
  // Check if we can extract job data
  const jobData = extractJobDataFromPage();

  if (jobData && jobData.job_title) {
    // Show floating button after a short delay
    setTimeout(() => {
      if (typeof window.showFloatingButton === 'function') {
        window.showFloatingButton();
      }
    }, 1000);
  }
}

// Listen for keyboard shortcut (Alt+J)
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'j') {
    e.preventDefault();
    // Trigger extension popup
    chrome.runtime.sendMessage({ action: 'openPopup' });
  }
});

console.log('Job Tracker content script loaded');
