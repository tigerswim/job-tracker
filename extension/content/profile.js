// profile.js - Content script for LinkedIn profile pages
// Extracts profile data and mutual connections for Job Tracker sync

/**
 * Extract the canonical LinkedIn URL from the page
 */
function getLinkedInUrl() {
  // Try canonical link first
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical && canonical.href) {
    return canonical.href;
  }

  // Fall back to current URL, cleaned up
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.href;
}

/**
 * Extract the profile name from the page
 */
function getProfileName() {
  // LinkedIn uses h1 for the main name
  const nameElement = document.querySelector('h1.text-heading-xlarge');
  if (nameElement) {
    return nameElement.textContent.trim();
  }

  // Fallback selectors
  const fallbackSelectors = [
    'h1[data-anonymize="person-name"]',
    '.pv-top-card--list li:first-child',
    '.text-heading-xlarge'
  ];

  for (const selector of fallbackSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      return el.textContent.trim();
    }
  }

  return null;
}

/**
 * Extract the profile headline/title
 */
function getProfileHeadline() {
  const headlineElement = document.querySelector('.text-body-medium.break-words');
  if (headlineElement) {
    return headlineElement.textContent.trim();
  }
  return null;
}

/**
 * Find and click the mutual connections link to open the modal
 * Returns true if successfully clicked
 */
function clickMutualConnectionsLink() {
  // Look for links containing "mutual connection"
  const allLinks = document.querySelectorAll('a[href*="facetNetwork"]');

  for (const link of allLinks) {
    if (link.textContent.toLowerCase().includes('mutual')) {
      link.click();
      return true;
    }
  }

  // Alternative: look for the mutual connections section
  const mutualSection = document.querySelector('[data-test-id="mutual-connections"]');
  if (mutualSection) {
    const link = mutualSection.querySelector('a');
    if (link) {
      link.click();
      return true;
    }
  }

  return false;
}

/**
 * Extract mutual connection names from the current page view
 * This works both in the modal and on the profile itself
 */
function extractMutualConnections() {
  const connections = [];

  // Strategy 1: Look in the mutual connections modal (if open)
  const modalConnections = document.querySelectorAll('.artdeco-modal [data-view-name="profile-component-entity"] .entity-result__title-text a span[aria-hidden="true"]');
  if (modalConnections.length > 0) {
    modalConnections.forEach(el => {
      const name = el.textContent.trim();
      if (name && !connections.includes(name)) {
        connections.push(name);
      }
    });
    return connections;
  }

  // Strategy 2: Look for connection cards in search results style
  const searchCards = document.querySelectorAll('.entity-result__title-text a span[aria-hidden="true"]');
  if (searchCards.length > 0) {
    searchCards.forEach(el => {
      const name = el.textContent.trim();
      if (name && !connections.includes(name)) {
        connections.push(name);
      }
    });
    return connections;
  }

  // Strategy 3: Look in the sidebar/inline mutual connections
  const inlineConnections = document.querySelectorAll('[data-field="mutual_connections"] .inline-show-more-text__button--small');
  if (inlineConnections.length > 0) {
    // This shows "Name, Name, and X others"
    const container = document.querySelector('[data-field="mutual_connections"]');
    if (container) {
      // Parse the text content
      const text = container.textContent;
      const namesMatch = text.match(/([A-Z][a-z]+ [A-Z][a-z]+(?:, [A-Z][a-z]+ [A-Z][a-z]+)*)/);
      if (namesMatch) {
        const names = namesMatch[1].split(', ');
        names.forEach(name => {
          if (name && !connections.includes(name)) {
            connections.push(name.trim());
          }
        });
      }
    }
  }

  // Strategy 4: Look for the new layout connection pills
  const connectionPills = document.querySelectorAll('.pv-shared-connections-card a.app-aware-link');
  connectionPills.forEach(el => {
    const nameSpan = el.querySelector('span[aria-hidden="true"]');
    if (nameSpan) {
      const name = nameSpan.textContent.trim();
      if (name && !connections.includes(name)) {
        connections.push(name);
      }
    }
  });

  return connections;
}

/**
 * Wait for mutual connections modal to load and extract names
 */
async function extractMutualConnectionsFromModal(maxWaitMs = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    // Check if modal is open
    const modal = document.querySelector('.artdeco-modal');
    if (modal) {
      // Wait a bit for content to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check for connection items
      const connections = extractMutualConnections();
      if (connections.length > 0) {
        return connections;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Timeout - return whatever we found
  return extractMutualConnections();
}

/**
 * Scroll through the modal to load all connections
 */
async function scrollModalToLoadAll(maxScrolls = 20) {
  const modal = document.querySelector('.artdeco-modal__content');
  if (!modal) return;

  let previousHeight = 0;
  let scrollCount = 0;

  while (scrollCount < maxScrolls) {
    const currentHeight = modal.scrollHeight;

    if (currentHeight === previousHeight) {
      // No new content loaded
      break;
    }

    previousHeight = currentHeight;
    modal.scrollTop = currentHeight;
    scrollCount++;

    // Wait for new content to load
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

/**
 * Close the mutual connections modal if it's open
 */
function closeModal() {
  const closeButton = document.querySelector('.artdeco-modal__dismiss');
  if (closeButton) {
    closeButton.click();
  }
}

/**
 * Get profile data including mutual connections
 * @param {boolean} openModal - Whether to open the modal to get all connections
 */
async function getProfileData(openModal = false) {
  const data = {
    linkedin_url: getLinkedInUrl(),
    name: getProfileName(),
    headline: getProfileHeadline(),
    mutual_connections: []
  };

  if (openModal) {
    // Try to open the mutual connections modal
    const clicked = clickMutualConnectionsLink();

    if (clicked) {
      // Wait for modal and extract connections
      data.mutual_connections = await extractMutualConnectionsFromModal();

      // Scroll to load all connections
      await scrollModalToLoadAll();

      // Extract again after scrolling
      data.mutual_connections = extractMutualConnections();

      // Close the modal
      closeModal();
    }
  } else {
    // Just extract what's visible on the page
    data.mutual_connections = extractMutualConnections();
  }

  return data;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getProfileData') {
    // Immediate extraction without opening modal
    const data = {
      linkedin_url: getLinkedInUrl(),
      name: getProfileName(),
      headline: getProfileHeadline(),
      mutual_connections: extractMutualConnections(),
      page_type: 'profile'
    };
    sendResponse({ profileData: data });
    return true;
  }

  if (request.action === 'extractAllMutualConnections') {
    // This opens the modal and scrolls to get all connections
    getProfileData(true).then(data => {
      data.page_type = 'profile';
      sendResponse({ profileData: data });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'checkPageType') {
    sendResponse({ pageType: 'profile' });
    return true;
  }
});

// Log that the content script loaded
console.log('[Job Tracker] Profile content script loaded for:', getLinkedInUrl());
