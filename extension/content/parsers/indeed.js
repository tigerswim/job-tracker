// indeed.js - Indeed job posting parser

/**
 * Check if current page is an Indeed job posting
 * @returns {boolean}
 */
function isIndeedJobPage() {
  return window.location.hostname.includes('indeed.com') &&
         (window.location.pathname.includes('/viewjob') ||
          window.location.pathname.includes('/job/') ||
          window.location.search.includes('jk='));
}

/**
 * Extract job data from Indeed job posting page
 * @returns {object|null} Job data or null if not found
 */
function extractIndeedJobData() {
  if (!isIndeedJobPage()) {
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

    // Extract job title
    const titleElement = document.querySelector('.jobsearch-JobInfoHeader-title, h1.jobsearch-JobInfoHeader-title-container, h1[class*="jobTitle"]');
    if (titleElement) {
      jobData.job_title = titleElement.textContent.trim();
    }

    // Extract company name
    const companyElement = document.querySelector('[data-company-name], .jobsearch-InlineCompanyRating-companyHeader a, [data-testid="inlineHeader-companyName"]');
    if (companyElement) {
      jobData.company = companyElement.textContent.trim();
    }

    // Alternative company extraction
    if (!jobData.company) {
      const companyAlt = document.querySelector('.css-1cxc9zk, .jobsearch-CompanyInfoContainer a');
      if (companyAlt) {
        jobData.company = companyAlt.textContent.trim();
      }
    }

    // Extract location
    const locationElement = document.querySelector('[data-testid="inlineHeader-companyLocation"], .jobsearch-JobInfoHeader-subtitle-location, .jobsearch-JobInfoHeader-subtitle div');
    if (locationElement) {
      jobData.location = locationElement.textContent.trim();
    }

    // Extract salary
    const salaryElement = document.querySelector('#salaryInfoAndJobType, .jobsearch-JobMetadataHeader-item, [data-testid="jobsearch-JobMetadataHeader-salary"]');
    if (salaryElement) {
      const salaryText = salaryElement.textContent.trim();
      if (salaryText.includes('$') || salaryText.toLowerCase().includes('hour') || salaryText.toLowerCase().includes('year')) {
        jobData.salary = salaryText;
      }
    }

    // Extract job description
    const descriptionElement = document.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText, [id*="jobDescription"]');
    if (descriptionElement) {
      const description = descriptionElement.innerText || descriptionElement.textContent;
      jobData.job_description = description.trim().substring(0, 2000);
    }

    // Extract job type (full-time, part-time, etc.) and add to notes
    const jobTypeElement = document.querySelector('.jobsearch-JobMetadataHeader-item, [data-testid="job-type"]');
    if (jobTypeElement && !jobTypeElement.textContent.includes('$')) {
      const jobType = jobTypeElement.textContent.trim();
      if (jobType && jobType.length < 50) { // Sanity check
        jobData.notes = `Job Type: ${jobType}`;
      }
    }

    // Only return if we have at least title and company
    if (jobData.job_title && jobData.company) {
      console.log('Indeed job data extracted:', jobData);
      return jobData;
    }

    return null;
  } catch (error) {
    console.error('Error extracting Indeed job data:', error);
    return null;
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.extractIndeedJobData = extractIndeedJobData;
  window.isIndeedJobPage = isIndeedJobPage;
}
