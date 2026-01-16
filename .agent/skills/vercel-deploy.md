---
name: vercel-deploy
description: Complete Vercel deployment guide including environment setup, troubleshooting, and production best practices. Use when deploying or debugging production issues.
---

# Vercel Deployment Skill

This skill provides a complete guide for deploying and managing the CRMS6 IT project on Vercel.

## 1. Pre-Deployment Checklist

### Code Quality
- [ ] All TypeScript errors resolved (`npm run build` passes locally)
- [ ] No console.log statements in production code
- [ ] ESLint errors fixed (`npm run lint`)
- [ ] No hardcoded development URLs or secrets

### Environment Variables
- [ ] All required env vars documented
- [ ] Production values differ from development
- [ ] Sensitive tokens are not committed to git

### Dependencies
- [ ] All dependencies in `package.json` (not just devDependencies if needed at runtime)
- [ ] Lock file (`package-lock.json`) committed

---

## 2. Environment Variables Setup

### Required Variables for CRMS6 IT

```bash
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# LINE
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
LIFF_ID=
NEXT_PUBLIC_LIFF_ID=

# Facebook
FACEBOOK_PAGE_ID=
FACEBOOK_PAGE_ACCESS_TOKEN=

# Google Services
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_DRIVE_FOLDER_ID=

# Email Service
EMAIL_USER=
EMAIL_PASS=

# App URLs
NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app
```

### Setting Environment Variables in Vercel

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add each variable for the appropriate environment:
   - **Production**: Live site
   - **Preview**: PR deployments
   - **Development**: Local development (if using Vercel CLI)

### Special Handling for FIREBASE_PRIVATE_KEY

The private key contains newlines. In Vercel:
```bash
# Copy the ENTIRE key including BEGIN and END lines
# Vercel handles the newlines automatically
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
```

---

## 3. Deployment Process

### Method 1: Git-based (Recommended)
1. Connect repository to Vercel
2. Push to main branch triggers production deploy
3. Push to other branches triggers preview deploy

### Method 2: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Method 3: Manual via Dashboard
1. Go to Vercel Dashboard → Deployments
2. Click "Redeploy" on any previous deployment

---

## 4. Build Configuration

### vercel.json Settings
```json
{
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["sin1"],
  "functions": {
    "app/api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

### Build Command
```bash
# Default (in package.json)
next build

# If custom build steps needed
npm run prebuild && next build
```

---

## 5. Troubleshooting Common Issues

### Build Failures

#### TypeScript Errors
```bash
# Check locally first
npm run build

# Common fixes:
# - Add missing type annotations
# - Fix import paths
# - Handle nullable types
```

#### Module Not Found
```bash
# Ensure dependency is in package.json (not just devDependencies)
npm install missing-package --save

# Check import casing (Linux is case-sensitive!)
# ❌ import Component from './component'
# ✅ import Component from './Component'
```

#### Memory Issues
```bash
# In vercel.json, increase function memory
{
  "functions": {
    "app/api/heavy-endpoint/route.ts": {
      "memory": 3008
    }
  }
}
```

---

### Runtime Errors

#### Environment Variables Not Loading
```typescript
// Debug: Log env var presence (never log values!)
console.log('ENV CHECK:', {
  hasFirebaseKey: !!process.env.FIREBASE_PRIVATE_KEY,
  hasLineToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
});
```

#### API Routes Timing Out
```javascript
// vercel.json - increase maxDuration
{
  "functions": {
    "app/api/slow-endpoint/route.ts": {
      "maxDuration": 60  // Max 60s for Pro, 10s for Hobby
    }
  }
}
```

#### CORS Issues
```typescript
// In API route
export async function OPTIONS(request: Request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
```

---

### Domain & DNS Issues

#### Custom Domain Not Working
1. Verify DNS records in domain provider:
   - A record: `76.76.21.21`
   - CNAME: `cname.vercel-dns.com`
2. Wait for DNS propagation (up to 48 hours)
3. Check SSL certificate status in Vercel

#### Redirect Issues
```javascript
// next.config.mjs
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/old-path',
        destination: '/new-path',
        permanent: true,
      },
    ];
  },
};
```

---

## 6. Monitoring & Logs

### Viewing Logs
1. Vercel Dashboard → Project → Logs
2. Filter by:
   - Function name
   - Status (Error, Warning)
   - Time range

### Log Best Practices
```typescript
// Structured logging for better searchability
console.log(JSON.stringify({
  type: 'api_request',
  endpoint: '/api/line/push',
  userId: userId,
  timestamp: new Date().toISOString(),
}));
```

### Error Tracking
Consider integrating:
- Sentry for error tracking
- LogRocket for session replay
- Vercel Analytics for performance

---

## 7. Performance Optimization

### Edge Functions
```typescript
// Use edge runtime for fast, global responses
export const runtime = 'edge';

export async function GET(request: Request) {
  // Runs at edge locations worldwide
}
```

### Caching
```typescript
// Cache API responses
export async function GET(request: Request) {
  return Response.json(data, {
    headers: {
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
    },
  });
}
```

### Static Generation
```typescript
// Force static generation where possible
export const dynamic = 'force-static';
export const revalidate = 3600; // Revalidate every hour
```

---

## 8. Rollback Procedure

If a deployment causes issues:

1. Go to Vercel Dashboard → Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"
4. Confirm the rollback

---

## 9. Deployment Checklist Template

Before each production deploy:

```markdown
## Pre-Deploy
- [ ] Build passes locally
- [ ] All tests pass
- [ ] Environment variables verified
- [ ] No sensitive data in code

## Deploy
- [ ] Deploy to preview first
- [ ] Test critical paths on preview
- [ ] Deploy to production
- [ ] Verify production is working

## Post-Deploy
- [ ] Check error logs
- [ ] Monitor performance
- [ ] Test critical user flows
- [ ] Notify team of changes
```

---

## 10. Feedback Format

When reporting deployment issues, use these tags:

- **[DEPLOY-CRITICAL]**: Production down, immediate action needed
- **[DEPLOY-BUILD]**: Build failures
- **[DEPLOY-ENV]**: Environment variable issues
- **[DEPLOY-PERF]**: Performance degradation after deploy
- **[DEPLOY-INFO]**: Deployment suggestions
