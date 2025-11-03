# How to Get Your Auth Token

Since the extension can't automatically detect your Supabase auth yet, you need to manually extract and set your auth token.

## Method 1: Console Command (Easiest)

1. Make sure you're logged into Job Tracker (http://localhost:3001 or https://job-tracker.kineticbrandpartners.com)

2. Open Chrome/Brave DevTools (F12 or Right-click → Inspect)

3. Go to the **Console** tab

4. Paste this command and press Enter:

```javascript
// Get Supabase auth token
(() => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.includes('-auth-token'));
  if (keys.length === 0) {
    console.error('❌ No auth found. Please log in first.');
    return null;
  }
  const authData = JSON.parse(localStorage.getItem(keys[0]));
  if (!authData?.access_token) {
    console.error('❌ No access token found.');
    return null;
  }
  console.log('✅ Auth token found!');
  console.log('Token:', authData.access_token);
  console.log('\nExpires:', new Date(authData.expires_at * 1000).toLocaleString());

  // Automatically store in extension
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('\n📦 Attempting to store in extension...');
    // You'll need to manually copy the token for now
  }

  return authData.access_token;
})();
```

5. You should see output like:
   ```
   ✅ Auth token found!
   Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

6. **Copy the token** (everything after "Token:")

## Method 2: Store Token in Extension

Now we need to store this token in the extension:

1. Keep the Job Tracker tab open with the token visible in console

2. Click the Job Tracker extension icon

3. Open DevTools for the popup:
   - Right-click the extension icon → **Inspect popup**

4. In the popup's Console tab, paste this command (replace YOUR_TOKEN with the actual token):

```javascript
chrome.storage.local.set({
  supabase_auth: {
    access_token: 'YOUR_TOKEN_HERE',
    expires_at: Date.now() + (3600 * 1000) // 1 hour from now
  }
}, () => {
  console.log('✅ Auth token stored!');
  console.log('Close and reopen the popup to test.');
});
```

5. Close the popup and click the extension icon again

6. You should now see the job import form instead of the login message

## Method 3: Use Application Tab (Alternative)

1. Open DevTools (F12) on Job Tracker website

2. Go to **Application** tab

3. In the left sidebar, expand **Local Storage**

4. Click on your domain (e.g., http://localhost:3001)

5. Find the key that starts with `sb-` and ends with `-auth-token`

6. Click on it and copy the **Value** field (it's a JSON string)

7. Parse the JSON to get the `access_token` field

8. Follow Method 2 above to store in extension

## Troubleshooting

### "No auth found" Error
- Make sure you're actually logged in (check if you can see your jobs/contacts)
- Try logging out and back in
- Clear browser cache and try again

### Token Expired
- Supabase tokens expire after 1 hour by default
- If you get auth errors, repeat the process to get a fresh token
- You'll need to re-authenticate periodically

### Extension Still Shows "Please log in"
- Make sure you stored the token in the extension (Method 2)
- Check that you replaced 'YOUR_TOKEN_HERE' with your actual token
- Try removing and re-adding the extension

## Future Enhancement

We'll add automatic auth syncing in a future update so you won't need to do this manually. For now, this manual process is necessary for testing.

## Quick Reference

**Get Token**: Console on Job Tracker → Paste command → Copy token
**Store Token**: Inspect extension popup → Console → Paste storage command with token
**Test**: Close and reopen extension popup

---

Once you have the token stored, you can test the extension on any job posting page!
