# Job Tracker Chrome Extension

One-click import of job postings from LinkedIn, Indeed, and company career pages into Job Tracker.

## Features

- **Automatic Job Data Extraction**: Intelligently extracts job title, company, location, salary, and description from job posting pages
- **Multi-Site Support**: Works on LinkedIn, Indeed, Greenhouse, Lever, Workday, and other major job boards
- **One-Click Import**: Add jobs to your tracker with a single click via floating button or popup
- **Keyboard Shortcut**: Press `Alt+J` to quickly add current job
- **Seamless Authentication**: Uses your existing Job Tracker login
- **Smart Parsing**: Falls back to generic parser for sites without specific support

## Supported Job Boards

- LinkedIn Jobs
- Indeed
- Greenhouse
- Lever
- Workday
- Breezy HR
- SmartRecruiters
- Any site using schema.org JobPosting markup

## Installation

### Development Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `extension` folder from this repository
5. The extension icon should appear in your Chrome toolbar

### First-Time Setup

1. **Authenticate with Job Tracker**:
   - Click the extension icon
   - If not authenticated, click "Open Job Tracker"
   - Log in to Job Tracker at https://job-tracker.kineticbrandpartners.com
   - The extension will automatically sync your authentication

2. **Grant Auth Token** (Manual Method if auto-sync doesn't work):
   - Log in to Job Tracker website
   - Open browser DevTools (F12)
   - Go to Console tab
   - Run: `localStorage.getItem('supabase.auth.token')`
   - Copy the token
   - Click extension icon → Settings
   - Paste token and save

## Usage

### Method 1: Floating Button
1. Navigate to any job posting page
2. A floating "Add to Job Tracker" button will appear in the bottom right
3. Click the button to open the import form
4. Review and edit the auto-filled data
5. Click "Add to Job Tracker"

### Method 2: Extension Icon
1. Navigate to any job posting page
2. Click the Job Tracker extension icon in your toolbar
3. The popup will open with auto-extracted job data
4. Review and edit as needed
5. Click "Add to Job Tracker"

### Method 3: Keyboard Shortcut
1. Navigate to any job posting page
2. Press `Alt+J` (Windows/Linux) or `Option+J` (Mac)
3. The extension popup will open
4. Complete the form and submit

## How It Works

1. **Content Scripts**: Injected into job posting pages to extract data
2. **Site-Specific Parsers**: Optimized extractors for LinkedIn, Indeed, etc.
3. **Generic Parser**: Fallback using schema.org structured data and common HTML patterns
4. **API Integration**: Securely sends job data to Job Tracker via authenticated API
5. **Background Worker**: Manages authentication and communication

## Architecture

```
extension/
├── manifest.json           # Extension configuration (Manifest V3)
├── background.js           # Background service worker
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Popup logic
│   └── popup.css          # Popup styling
├── content/
│   ├── content.js         # Main content script
│   ├── ui.js              # Floating button UI
│   ├── content.css        # Content script styles
│   └── parsers/
│       ├── linkedin.js    # LinkedIn-specific parser
│       ├── indeed.js      # Indeed-specific parser
│       └── generic.js     # Generic fallback parser
├── utils/
│   └── api.js             # API communication utilities
└── assets/
    ├── icon16.png         # Extension icons
    ├── icon48.png
    └── icon128.png
```

## API Endpoint

The extension communicates with Job Tracker via:

**Endpoint**: `POST /api/extension/jobs`

**Authentication**: Bearer token (Supabase auth token)

**Request Body**:
```json
{
  "job_title": "Senior Software Engineer",
  "company": "Google",
  "location": "San Francisco, CA",
  "salary": "$150k - $200k",
  "job_url": "https://...",
  "job_description": "...",
  "status": "interested",
  "notes": "..."
}
```

## Troubleshooting

### Extension Not Detecting Job Page
- Make sure you're on an actual job posting page (not search results)
- Refresh the page after installing/updating extension
- Check browser console for errors (F12 → Console)

### Authentication Issues
- Clear extension storage: chrome://extensions → Job Tracker → Details → "Clear storage"
- Log out and back into Job Tracker website
- Manually set auth token (see First-Time Setup)

### Job Data Not Extracted
- Some sites may not be supported yet
- Try the generic parser by clicking extension icon manually
- Submit an issue with the job posting URL for support

### API Errors
- Verify you're logged into Job Tracker
- Check your internet connection
- Ensure Job Tracker API is accessible

## Development

### Testing Changes
1. Make code changes
2. Go to `chrome://extensions/`
3. Click refresh icon on Job Tracker extension card
4. Test on a job posting page

### Adding New Site Support
1. Create new parser in `content/parsers/yoursite.js`
2. Export `isYourSiteJobPage()` and `extractYourSiteJobData()` functions
3. Update `content/content.js` to call your parser
4. Add site URL pattern to `manifest.json` under `content_scripts.matches`

### Debugging
- Background worker logs: `chrome://extensions/` → Job Tracker → Inspect views: service worker
- Content script logs: Open DevTools on any job page → Console tab
- Popup logs: Right-click extension icon → Inspect popup

## Privacy & Security

- **No Data Collection**: Extension only communicates with Job Tracker API
- **Secure Authentication**: Uses Supabase JWT tokens, stored locally in Chrome
- **Minimal Permissions**: Only requests access to job board domains
- **Open Source**: All code is available for review

## Future Enhancements

- [ ] Automatic company logo extraction
- [ ] Bulk import from job board search results
- [ ] Contact extraction from job postings
- [ ] Browser notifications for saved jobs
- [ ] Firefox and Edge support
- [ ] Chrome Web Store publication

## Support

For issues or feature requests, please open an issue on GitHub or contact support@kineticbrandpartners.com.

## License

This extension is part of the Job Tracker project by Kinetic Brand Partners.
