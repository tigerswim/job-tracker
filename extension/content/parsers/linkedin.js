// linkedin.js - LinkedIn job posting parser

/**
 * Check if current page is a LinkedIn job posting
 * @returns {boolean}
 */
function isLinkedInJobPage() {
  return window.location.hostname === 'www.linkedin.com' &&
         window.location.pathname.includes('/jobs/');
}

/**
 * Extract job data from LinkedIn job posting page
 * @returns {object|null} Job data or null if not found
 */
function extractLinkedInJobData() {
  if (!isLinkedInJobPage()) {
    return null;
  }

  try {
    const jobData = {
      job_title: null,
      company: null,
      location: null,
      salary: null,
      job_url: window.location.href,
      job_description: null,
      status: 'interested',
      notes: null
    };

    // Extract job title - try multiple selectors
    const titleSelectors = [
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      'h1.t-24',
      'h1[class*="job-title"]',
      '.jobs-details-top-card__job-title',
      'h2.t-24'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        jobData.job_title = element.textContent.trim();
        break;
      }
    }

    // Extract company name - try multiple selectors
    const companySelectors = [
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__subtitle-primary-grouping a',
      'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
      '.topcard__org-name-link',
      '.jobs-details-top-card__company-url'
    ];

    for (const selector of companySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        jobData.company = element.textContent.trim();
        break;
      }
    }

    // Extract location - more targeted approach
    // First, try to get the clean location from the top card description
    const descContainer = document.querySelector('.jobs-unified-top-card__primary-description, .jobs-unified-top-card__primary-description-without-tagline');
    if (descContainer) {
      // Look for text that looks like a location (contains comma or state)
      const text = descContainer.textContent.trim();
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      for (const line of lines) {
        // Location usually has format "City, State" or contains state abbreviation
        if (line.match(/^[A-Za-z\s]+,\s*[A-Z]{2}/) || line.match(/[A-Za-z\s]+,\s*[A-Za-z\s]+/)) {
          jobData.location = line;
          break;
        }
      }
    }

    // If not found, try bullets
    if (!jobData.location) {
      const bullets = document.querySelectorAll('.jobs-unified-top-card__bullet');
      for (const bullet of bullets) {
        const text = bullet.textContent.trim();
        if (text && text.length > 3 && text.length < 100 &&
            !text.toLowerCase().match(/^(full-time|part-time|contract|on-site|remote|hybrid|reposted|ago|people|clicked)$/i)) {
          jobData.location = text;
          break;
        }
      }
    }

    // Last resort: search all text for location pattern
    if (!jobData.location) {
      const allText = document.body.textContent;
      const locationMatch = allText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}(?:\s+\([A-Z][a-z\-]+\))?)/);
      if (locationMatch) {
        const location = locationMatch[1].trim();
        // Validate it's reasonable length and not part of description
        if (location.length < 50) {
          jobData.location = location;
        }
      }
    }

    // Try to extract salary from various possible locations
    const salarySelectors = [
      '.job-details-jobs-unified-top-card__job-insight',
      '.jobs-unified-top-card__job-insight',
      'span[class*="salary"]',
      '.compensation',
      'li.jobs-unified-top-card__job-insight'
    ];

    for (const selector of salarySelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent.trim();
        // Look for salary indicators
        if (text.match(/\$|USD|EUR|GBP|salary|\/yr|\/year|\/hour|\/hr|k-|compensation/i)) {
          jobData.salary = text;
          break;
        }
      }
      if (jobData.salary) break;
    }

    // Also check the insights list
    const insightsList = document.querySelectorAll('ul.jobs-unified-top-card__job-insight-view-model-secondary li');
    for (const item of insightsList) {
      const text = item.textContent.trim();
      // Check for location (has comma or state abbreviation)
      if (!jobData.location && (text.includes(',') || text.match(/\b[A-Z]{2}\b/))) {
        jobData.location = text;
      }
      // Check for salary
      if (!jobData.salary && text.match(/\$|salary|compensation/i)) {
        jobData.salary = text;
      }
    }

    // Extract job description
    const descriptionElement = document.querySelector('.jobs-description__content, .jobs-description, .jobs-box__html-content');
    if (descriptionElement) {
      // Get text content but preserve some structure
      const description = descriptionElement.innerText || descriptionElement.textContent;
      // Limit to first 2000 characters to avoid DB issues
      jobData.job_description = description.trim().substring(0, 2000);
    }

    // Extract workplace type (remote, hybrid, on-site) and add to notes
    const workplaceType = document.querySelector('.jobs-unified-top-card__workplace-type');
    if (workplaceType) {
      jobData.notes = `Workplace Type: ${workplaceType.textContent.trim()}`;
    }

    // Only return if we have at least title and company
    if (jobData.job_title && jobData.company) {
      console.log('LinkedIn job data extracted:', jobData);
      return jobData;
    }

    return null;
  } catch (error) {
    console.error('Error extracting LinkedIn job data:', error);
    return null;
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.extractLinkedInJobData = extractLinkedInJobData;
  window.isLinkedInJobPage = isLinkedInJobPage;
}
