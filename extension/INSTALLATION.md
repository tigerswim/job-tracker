# Job Tracker Extension - Installation & Testing Guide

## Prerequisites

Before installing the extension, ensure:

1. ✅ You have Chrome browser installed (version 88 or later)
2. ✅ You have a Job Tracker account at https://job-tracker.kineticbrandpartners.com
3. ✅ The Job Tracker backend API is running and accessible
4. ✅ Extension icons are created (see `/assets/ICONS_README.md`)

## Step 1: Create Extension Icons (First Time Only)

The extension requires three icon files. Choose one method:

### Option A: Use ImageMagick (Quickest for Development)

```bash
cd extension/assets
convert -size 16x16 xc:'#2563eb' icon16.png
convert -size 48x48 xc:'#2563eb' icon48.png
convert -size 128x128 xc:'#2563eb' icon128.png
```

### Option B: Use Online Generator

1. Go to https://www.favicon-generator.org/
2. Upload any Job Tracker logo or blue square image
3. Download the generated icons
4. Rename and place in `extension/assets/`

### Option C: Create Custom Icons

1. Design icons using Figma, Sketch, or Photoshop
2. Export as PNG at 16x16, 48x48, and 128x128 pixels
3. Place in `extension/assets/`

## Step 2: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`

2. Enable "Developer mode" toggle in the top right corner

3. Click "Load unpacked" button

4. Navigate to your project directory and select the `extension` folder:
   ```
   /Users/danhoeller/Website Development/kineticbrandpartners/job-tracker/extension
   ```

5. The extension should now appear in your extensions list

6. Pin the extension to your toolbar (optional but recommended):
   - Click the puzzle piece icon in Chrome toolbar
   - Find "Job Tracker - Quick Import"
   - Click the pin icon

## Step 3: Set Up Authentication

### Method A: Automatic Sync (Recommended)

1. Open Job Tracker in a new tab: https://job-tracker.kineticbrandpartners.com

2. Log in with your credentials

3. The extension should automatically detect and store your auth token

4. Test by clicking the extension icon - you should see the main interface (not a login prompt)

### Method B: Manual Token Setup

If automatic sync doesn't work:

1. Log in to Job Tracker website

2. Open Chrome DevTools (F12 or Right-click → Inspect)

3. Go to the Console tab

4. Run this command:
   ```javascript
   window.getJobTrackerAuthToken()
   ```

5. Copy the displayed auth token

6. Click the Job Tracker extension icon

7. If you see "Please log in to Job Tracker first", the token wasn't synced

8. For now, the auth will be stored when you successfully use the extension

## Step 4: Test the Extension

### Test 1: LinkedIn Job Posting

1. Go to LinkedIn Jobs: https://www.linkedin.com/jobs/

2. Search for any job and click on a job posting

3. Wait for the page to load completely

4. You should see a blue floating button in the bottom right: "Add to Job Tracker"

5. Click the floating button OR click the extension icon in toolbar

6. The popup should open with job data pre-filled (title, company, location, etc.)

7. Review the data and click "Add to Job Tracker"

8. You should see a success message

9. Open Job Tracker website and verify the job was added

### Test 2: Indeed Job Posting

1. Go to Indeed: https://www.indeed.com/

2. Search for any job and click on a job posting

3. Wait for the floating button to appear

4. Click the button to open the popup

5. Verify job data is extracted

6. Add the job and verify success

### Test 3: Generic Job Board (Greenhouse/Lever)

1. Find any job posting on:
   - Greenhouse: e.g., https://boards.greenhouse.io/
   - Lever: e.g., https://jobs.lever.co/

2. Navigate to a specific job posting

3. Click extension icon (floating button may not appear on all sites)

4. Verify data extraction

5. Add the job

### Test 4: Keyboard Shortcut

1. On any job posting page, press `Alt+J` (Windows/Linux) or `Option+J` (Mac)

2. The extension popup should open

3. Complete the flow

## Step 5: Verify Backend Integration

1. Check Chrome DevTools Console (F12) on job posting page for any errors

2. Check Background Service Worker logs:
   - Go to `chrome://extensions/`
   - Find Job Tracker extension
   - Click "Inspect views: service worker"
   - Check Console for errors

3. Verify API is receiving requests:
   - Open Job Tracker dev server terminal
   - You should see POST requests to `/api/extension/jobs`

4. Check database:
   - Open Supabase dashboard
   - Go to Table Editor → jobs
   - Verify new jobs are being created

## Common Issues & Solutions

### Issue: Extension Not Loading

**Solution:**
- Check that all required files exist in the extension folder
- Verify icon files are in `assets/` directory
- Look for errors in `chrome://extensions/` page
- Check Chrome DevTools console for syntax errors

### Issue: Floating Button Not Appearing

**Solution:**
- Refresh the job posting page
- Check that you're on an actual job posting page (not search results)
- Open DevTools Console and look for content script errors
- Verify the URL matches patterns in `manifest.json`

### Issue: Authentication Failing

**Solution:**
- Log out and back in to Job Tracker website
- Clear extension storage: `chrome://extensions/` → Details → "Clear storage and data"
- Check that Supabase credentials are correct in `.env.local`
- Verify the API endpoint `/api/extension/jobs` is accessible

### Issue: Job Data Not Extracted

**Solution:**
- Try clicking extension icon instead of floating button
- Check DevTools Console for parser errors
- Verify the site is using standard HTML structure
- The generic parser should work as fallback

### Issue: API Errors (401, 500)

**Solution:**
- Verify auth token is valid (not expired)
- Check backend server is running
- Review API logs for specific error messages
- Verify CORS settings allow extension requests

## Development Workflow

### Making Changes

1. Edit extension files
2. Go to `chrome://extensions/`
3. Click refresh icon on Job Tracker extension
4. Test changes on a job posting page

### Debugging

**Content Scripts:**
- Open DevTools on job posting page (F12)
- Check Console tab for content script logs

**Background Worker:**
- Go to `chrome://extensions/`
- Click "Inspect views: service worker" under Job Tracker
- Check Console for background script logs

**Popup:**
- Right-click extension icon
- Select "Inspect popup"
- Check Console for popup script logs

## Testing Checklist

Before marking extension as complete, verify:

- [ ] Extension loads without errors
- [ ] Icons display correctly in toolbar and popup
- [ ] LinkedIn parser extracts job data correctly
- [ ] Indeed parser extracts job data correctly
- [ ] Generic parser works on at least one other site
- [ ] Floating button appears and works
- [ ] Extension icon popup works
- [ ] Keyboard shortcut (Alt+J) works
- [ ] Authentication succeeds
- [ ] Jobs are successfully created in database
- [ ] Error handling shows appropriate messages
- [ ] UI matches Job Tracker website styling
- [ ] Mobile Chrome tested (if applicable)

## Next Steps

Once extension is working:

1. ✅ Test on multiple job boards
2. ✅ Refine parsers based on real-world usage
3. ✅ Add better error messages
4. ✅ Create professional icons
5. ✅ Add analytics/tracking (optional)
6. ✅ Prepare for Chrome Web Store submission
7. ✅ Write user documentation
8. ✅ Create demo video

## Getting Help

If you encounter issues:

1. Check the main README.md for architecture overview
2. Review code comments in source files
3. Check Chrome extension documentation: https://developer.chrome.com/docs/extensions/
4. Open an issue on GitHub with:
   - Chrome version
   - Extension version
   - Steps to reproduce
   - Error messages from Console
   - Screenshot if relevant

## Uninstallation

To remove the extension:

1. Go to `chrome://extensions/`
2. Find "Job Tracker - Quick Import"
3. Click "Remove"
4. Confirm deletion

Note: This will not delete any jobs already added to Job Tracker.
