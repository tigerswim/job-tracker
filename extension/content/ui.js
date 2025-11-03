// ui.js - Floating button UI for content script

let floatingButton = null;

/**
 * Show floating "Add to Job Tracker" button
 */
function showFloatingButton() {
  // Don't create button if it already exists
  if (floatingButton) {
    floatingButton.style.display = 'flex';
    return;
  }

  // Create floating button
  floatingButton = document.createElement('div');
  floatingButton.id = 'job-tracker-floating-button';
  floatingButton.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="8.5" cy="7" r="4"></circle>
      <path d="M20 8v6M23 11h-6"></path>
    </svg>
    <span>Add to Job Tracker</span>
  `;

  // Add click handler
  floatingButton.addEventListener('click', () => {
    // Send message to background script to open popup
    chrome.runtime.sendMessage({ action: 'openPopup' });
  });

  // Add to page
  document.body.appendChild(floatingButton);

  // Add close button functionality
  const closeButton = document.createElement('button');
  closeButton.className = 'job-tracker-close-btn';
  closeButton.innerHTML = '×';
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    hideFloatingButton();
  });
  floatingButton.appendChild(closeButton);

  // Show with animation
  setTimeout(() => {
    floatingButton.classList.add('visible');
  }, 100);
}

/**
 * Hide floating button
 */
function hideFloatingButton() {
  if (floatingButton) {
    floatingButton.classList.remove('visible');
    setTimeout(() => {
      if (floatingButton) {
        floatingButton.style.display = 'none';
      }
    }, 300);
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.showFloatingButton = showFloatingButton;
  window.hideFloatingButton = hideFloatingButton;
}
