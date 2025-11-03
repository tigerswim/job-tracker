// generic.js - Generic job posting parser using schema.org and common patterns

/**
 * Extract job data using schema.org structured data
 * @returns {object|null} Job data or null if not found
 */
function extractStructuredData() {
  try {
    // Look for JSON-LD structured data
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);

        // Handle both single JobPosting and array of items
        const jobPosting = Array.isArray(data)
          ? data.find(item => item['@type'] === 'JobPosting')
          : data['@type'] === 'JobPosting' ? data : null;

        if (jobPosting) {
          return {
            job_title: jobPosting.title || null,
            company: jobPosting.hiringOrganization?.name || null,
            location: jobPosting.jobLocation?.address?.addressLocality ||
                     jobPosting.jobLocation?.address?.addressRegion ||
                     (typeof jobPosting.jobLocation === 'string' ? jobPosting.jobLocation : null),
            salary: jobPosting.baseSalary?.value?.value ||
                   jobPosting.baseSalary?.value ||
                   (typeof jobPosting.baseSalary === 'string' ? jobPosting.baseSalary : null),
            job_url: window.location.href,
            job_description: jobPosting.description?.substring(0, 2000) || null,
            status: 'interested',
            notes: jobPosting.employmentType ? `Type: ${jobPosting.employmentType}` : null
          };
        }
      } catch (e) {
        // Skip invalid JSON
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting structured data:', error);
    return null;
  }
}

/**
 * Extract job data using common HTML patterns (Greenhouse, Lever, etc.)
 * @returns {object|null} Job data or null if not found
 */
function extractGenericJobData() {
  try {
    // First try structured data
    const structuredData = extractStructuredData();
    if (structuredData && structuredData.job_title && structuredData.company) {
      console.log('Generic job data extracted via structured data:', structuredData);
      return structuredData;
    }

    // Fallback to common patterns
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

    // Common selectors for job title
    const titleSelectors = [
      'h1[class*="job-title"]',
      'h1[class*="title"]',
      '[data-qa="job-title"]',
      '.app-title',
      '.job-title',
      'h1.position-title',
      'h1',
      '[class*="JobTitle"]'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 0 && element.textContent.trim().length < 200) {
        jobData.job_title = element.textContent.trim();
        break;
      }
    }

    // Common selectors for company
    const companySelectors = [
      '[class*="company-name"]',
      '[data-qa="company-name"]',
      '.company',
      '[class*="CompanyName"]',
      'a[class*="company"]',
      '.employer'
    ];

    for (const selector of companySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 0 && element.textContent.trim().length < 100) {
        jobData.company = element.textContent.trim();
        break;
      }
    }

    // Common selectors for location
    const locationSelectors = [
      '[class*="location"]',
      '[data-qa="location"]',
      '.job-location',
      '[class*="JobLocation"]'
    ];

    for (const selector of locationSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 0 && element.textContent.trim().length < 150) {
        const text = element.textContent.trim();
        // Simple validation - location should contain common location indicators
        if (text.match(/[,\s]/) || text.length > 5) {
          jobData.location = text;
          break;
        }
      }
    }

    // Common selectors for description
    const descriptionSelectors = [
      '[class*="description"]',
      '[data-qa="job-description"]',
      '.job-description',
      '#job-description',
      '[id*="description"]',
      '.content'
    ];

    for (const selector of descriptionSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 100) {
        const description = element.innerText || element.textContent;
        jobData.job_description = description.trim().substring(0, 2000);
        break;
      }
    }

    // Extract domain as a note
    const domain = window.location.hostname.replace('www.', '');
    jobData.notes = `Source: ${domain}`;

    // Only return if we have at least title
    if (jobData.job_title) {
      console.log('Generic job data extracted via patterns:', jobData);
      return jobData;
    }

    return null;
  } catch (error) {
    console.error('Error extracting generic job data:', error);
    return null;
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.extractGenericJobData = extractGenericJobData;
  window.extractStructuredData = extractStructuredData;
}
