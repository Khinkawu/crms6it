---
name: line-liff-debug
description: Debug LINE LIFF integration issues including initialization, authentication, and API calls. Use when facing LIFF-related errors or user login problems.
---

# LINE LIFF Debugging Skill

This skill provides a comprehensive guide to debugging LINE LIFF (LINE Front-end Framework) issues in the CRMS6 IT project.

## 1. LIFF Basics

### What is LIFF?
LIFF is LINE's web app framework that runs inside the LINE app, providing:
- Access to LINE user profile
- Ability to send messages
- Share content to LINE chats

### Project LIFF Files
- `hooks/useLiff.ts` - LIFF hook for React components
- `app/liff/*` - LIFF-enabled pages

---

## 2. Common LIFF Errors

### 🔴 LIFF Initialization Failed

**Error**: `liff.init() failed`

**Debugging Steps**:

1. **Verify LIFF ID**:
   ```typescript
   console.log('LIFF ID:', process.env.NEXT_PUBLIC_LIFF_ID);
   // Should be in format: 1234567890-xxxxxxxx
   ```

2. **Check LIFF URL Registration**:
   - Go to LINE Developers Console
   - Select your LIFF app
   - Verify "Endpoint URL" matches your deployed URL exactly
   - URL must be HTTPS (not localhost)

3. **Check for Errors**:
   ```typescript
   try {
     await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID });
     console.log('LIFF initialized successfully');
   } catch (error) {
     console.error('LIFF init error:', error.code, error.message);
     // Common error codes:
     // INVALID_ARGUMENT - Wrong LIFF ID format
     // UNAUTHORIZED - LIFF ID not found
     // FORBIDDEN - URL doesn't match registered endpoint
   }
   ```

---

### 🟠 User Not Logged In

**Error**: User profile returns null or login redirect fails

**Debugging Steps**:

1. **Check Login Status**:
   ```typescript
   if (liff.isLoggedIn()) {
     console.log('User is logged in');
     const profile = await liff.getProfile();
     console.log('Profile:', profile);
   } else {
     console.log('User not logged in');
     // Trigger login
     liff.login({ redirectUri: window.location.href });
   }
   ```

2. **In-App vs External Browser**:
   ```typescript
   console.log('Is in LINE app:', liff.isInClient());
   // If false, user opened in external browser - need explicit login
   ```

3. **Access Token Issues**:
   ```typescript
   const accessToken = liff.getAccessToken();
   console.log('Has access token:', !!accessToken);
   // If null, user needs to login again
   ```

---

### 🟡 Profile Data Incomplete

**Error**: Missing userId, displayName, or pictureUrl

**Debugging**:
```typescript
const profile = await liff.getProfile();
console.log('Profile check:', {
  userId: profile.userId || 'MISSING',
  displayName: profile.displayName || 'MISSING',
  pictureUrl: profile.pictureUrl || 'MISSING (normal for some accounts)',
  statusMessage: profile.statusMessage || 'EMPTY',
});
```

**Note**: `pictureUrl` may be null if user has no profile picture. Always handle this case:
```typescript
const userImage = profile.pictureUrl || '/default-avatar.png';
```

---

## 3. LIFF Hook Debugging

### useLiff Hook Pattern
```typescript
// hooks/useLiff.ts - Debug version
export function useLiff() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initLiff = async () => {
      try {
        console.log('[LIFF] Starting initialization...');
        
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
        console.log('[LIFF] Init success');
        console.log('[LIFF] In LINE app:', liff.isInClient());
        console.log('[LIFF] Logged in:', liff.isLoggedIn());

        if (liff.isLoggedIn()) {
          const userProfile = await liff.getProfile();
          console.log('[LIFF] Profile loaded:', userProfile.displayName);
          setProfile(userProfile);
          setIsLoggedIn(true);
        } else {
          console.log('[LIFF] User not logged in, redirecting...');
          liff.login();
        }
      } catch (err) {
        console.error('[LIFF] Error:', err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    initLiff();
  }, []);

  return { isLoggedIn, profile, error, isLoading, liff };
}
```

---

## 4. Common Scenarios

### Scenario 1: Works in LINE App, Fails in Browser

**Cause**: External browser requires explicit login

**Solution**:
```typescript
useEffect(() => {
  const init = async () => {
    await liff.init({ liffId: LIFF_ID });
    
    if (!liff.isLoggedIn()) {
      if (!liff.isInClient()) {
        // External browser - need explicit login
        liff.login({ redirectUri: window.location.href });
      }
    }
  };
  init();
}, []);
```

### Scenario 2: Redirect Loop on Login

**Cause**: Login succeeds but page doesn't recognize login state

**Solution**:
```typescript
// Add a flag to prevent multiple login attempts
const [loginAttempted, setLoginAttempted] = useState(false);

useEffect(() => {
  const init = async () => {
    await liff.init({ liffId: LIFF_ID });
    
    if (!liff.isLoggedIn() && !loginAttempted) {
      setLoginAttempted(true);
      liff.login();
    }
  };
  init();
}, [loginAttempted]);
```

### Scenario 3: Access Token Expired

**Symptoms**: API calls fail after some time

**Solution**:
```typescript
const getValidToken = async () => {
  const token = liff.getAccessToken();
  if (!token) {
    // Token expired, need to re-login
    liff.login({ redirectUri: window.location.href });
    return null;
  }
  return token;
};
```

---

## 5. LIFF API Calls

### Sending Messages
```typescript
// Only works when LIFF is opened from a chat
if (liff.isInClient()) {
  try {
    await liff.sendMessages([
      { type: 'text', text: 'Hello from LIFF!' }
    ]);
    console.log('Message sent');
  } catch (error) {
    console.error('Send message failed:', error);
    // Error if not opened from chat
  }
}
```

### Opening External Links
```typescript
// Open link in external browser
liff.openWindow({
  url: 'https://example.com',
  external: true
});
```

### Closing LIFF Window
```typescript
if (liff.isInClient()) {
  liff.closeWindow();
}
```

---

## 6. Testing LIFF Locally

### Challenge
LIFF requires HTTPS and registered URL, making local testing difficult.

### Solutions

#### Option 1: ngrok
```bash
# Install ngrok
npm install -g ngrok

# Start your dev server
npm run dev

# In another terminal, expose port 3000
ngrok http 3000

# Use the ngrok HTTPS URL in LIFF settings
```

#### Option 2: Mock LIFF for Development
```typescript
// Create a mock LIFF object for local development
if (process.env.NODE_ENV === 'development' && !window.liff) {
  window.liff = {
    init: async () => console.log('[MOCK] LIFF init'),
    isLoggedIn: () => true,
    isInClient: () => false,
    getProfile: async () => ({
      userId: 'mock-user-id',
      displayName: 'Mock User',
      pictureUrl: null,
    }),
    getAccessToken: () => 'mock-token',
    login: () => console.log('[MOCK] Login called'),
  };
}
```

---

## 7. LINE Developers Console Checklist

When debugging LIFF issues, verify these settings:

- [ ] **LIFF ID** matches environment variable
- [ ] **Endpoint URL** matches deployed URL exactly (including trailing slash if any)
- [ ] **Scopes** include required permissions:
  - `profile` - Get user profile
  - `openid` - OpenID Connect
  - `chat_message.write` - Send messages (if needed)
- [ ] **Bot link feature** is configured if using bot
- [ ] **HTTPS** is required for endpoint URL

---

## 8. Environment Variables

```bash
# Required for LIFF
NEXT_PUBLIC_LIFF_ID=1234567890-xxxxxxxx
LIFF_ID=1234567890-xxxxxxxx

# For server-side LINE API calls
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_access_token
```

---

## 9. Debugging Commands

### Browser Console
```javascript
// Check LIFF state
console.log('LIFF ready:', liff.ready);
console.log('Is logged in:', liff.isLoggedIn());
console.log('Is in LINE app:', liff.isInClient());
console.log('OS:', liff.getOS());
console.log('Language:', liff.getLanguage());
console.log('LIFF version:', liff.getVersion());
```

### Inspect Network Requests
1. Open DevTools → Network tab
2. Filter by "line" or "liff"
3. Check for failed requests to LINE API

---

## 10. Feedback Format

When reporting LIFF issues, use these tags:

- **[LIFF-CRITICAL]**: Login broken, users cannot access app
- **[LIFF-AUTH]**: Authentication/token issues
- **[LIFF-INIT]**: Initialization failures
- **[LIFF-API]**: LIFF API call failures
- **[LIFF-INFO]**: Configuration suggestions
