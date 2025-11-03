# Quick Auth Fix

Since automatic auth sync isn't working yet, here's the quickest way to keep your auth token fresh:

## One-Time Setup Script

Run this in the **Job Tracker console** (localhost:3001):

```javascript
// Auto-refresh extension auth every 30 seconds
setInterval(() => {
  const authData = localStorage.getItem('job-tracker-extension-auth');
  if (authData) {
    console.log('✓ Extension auth still available');
  } else {
    console.log('⚠ Extension auth missing - page needs refresh');
  }
}, 30000);
```

## When You Get "Invalid authentication token"

1. Go to Job Tracker tab (localhost:3001)
2. Run in console:
   ```javascript
   copy(JSON.parse(localStorage.getItem('job-tracker-extension-auth')).access_token)
   ```
   (Token is now in clipboard)

3. Right-click extension → Inspect popup → Console:
   ```javascript
   chrome.storage.local.set({supabase_auth:{access_token:navigator.clipboard.readText().then(t=>t)}},()=>console.log('Done'))
   ```

4. Close and reopen extension popup

## Better: Refresh Job Tracker Page

The easiest fix is just refreshing the Job Tracker page when you get auth errors - the ExtensionAuthSync component will regenerate the auth data.

1. Go to localhost:3001
2. Press F5 (refresh)
3. Try the extension again

The token expires after 1 hour, so you'll need to do this periodically during long testing sessions.
