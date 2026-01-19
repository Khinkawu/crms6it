---
name: performance-audit
description: Comprehensive performance auditing for Next.js apps including bundle analysis, render optimization, and Core Web Vitals. Use when diagnosing slow performance or optimizing load times.
---

# Performance Audit Skill

This skill provides a systematic approach to auditing and optimizing performance in the CRMS6 IT Next.js application.

## 1. Performance Audit Phases

| Phase | Focus | Tools |
|-------|-------|-------|
| **1. Measure** | Establish baseline metrics | Lighthouse, Web Vitals |
| **2. Analyze** | Identify bottlenecks | DevTools, Bundle Analyzer |
| **3. Optimize** | Apply fixes | Code changes |
| **4. Verify** | Confirm improvements | Re-measure |

---

## 2. Core Web Vitals

### Key Metrics

| Metric | Good | Needs Work | Poor | What It Measures |
|--------|------|------------|------|------------------|
| **LCP** (Largest Contentful Paint) | ≤2.5s | ≤4s | >4s | Loading speed |
| **INP** (Interaction to Next Paint) | ≤200ms | ≤500ms | >500ms | Interactivity |
| **CLS** (Cumulative Layout Shift) | ≤0.1 | ≤0.25 | >0.25 | Visual stability |

### Measuring in Code
```typescript
// Add to layout.tsx or _app.tsx
import { useReportWebVitals } from 'next/web-vitals';

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    console.log({
      name: metric.name,
      value: metric.value,
      rating: metric.rating, // 'good', 'needs-improvement', 'poor'
    });
    
    // Optional: Send to analytics
    // sendToAnalytics(metric);
  });
  
  return null;
}
```

---

## 3. Bundle Size Analysis

### Step 1: Analyze Bundle
```bash
# Install bundle analyzer
npm install @next/bundle-analyzer --save-dev

# Add to next.config.mjs
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);

# Run analysis
ANALYZE=true npm run build
```

### Step 2: Identify Large Dependencies

Common culprits in this project:
```
firebase          ~500KB  → Use modular imports
moment            ~300KB  → Already replaced with date-fns ✓
lodash            ~70KB   → Use individual imports
jspdf             ~300KB  → Consider lazy loading
xlsx              ~400KB  → Lazy load for export features
```

### Step 3: Optimize Imports

```typescript
// ❌ Bad: Imports entire library
import firebase from 'firebase/app';

// ✅ Good: Modular imports
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// ❌ Bad: Entire lodash
import _ from 'lodash';
_.debounce(fn, 300);

// ✅ Good: Individual function
import debounce from 'lodash/debounce';
debounce(fn, 300);
```

---

## 4. Lazy Loading & Code Splitting

### Dynamic Imports for Heavy Components
```typescript
import dynamic from 'next/dynamic';

// Heavy PDF generator - only load when needed
const PDFExport = dynamic(() => import('./PDFExport'), {
  loading: () => <p>Loading PDF generator...</p>,
  ssr: false, // Don't include in server bundle
});

// Heavy calendar component
const BigCalendar = dynamic(() => import('react-big-calendar'), {
  loading: () => <CalendarSkeleton />,
  ssr: false,
});
```

### Route-based Code Splitting
Next.js automatically splits code by route. Verify by checking:
1. Each page in `app/` becomes a separate chunk
2. Shared components go to common chunks

---

## 5. React Performance Optimization

### Detecting Unnecessary Re-renders

#### Option 1: React DevTools Profiler
1. Install React DevTools browser extension
2. Open DevTools → Profiler tab
3. Click Record, interact with the app, stop recording
4. Review which components re-rendered and why

#### Option 2: Console Logging
```typescript
function MyComponent({ data }) {
  console.log('MyComponent rendered');
  // If this logs too often, investigate why
}
```

#### Option 3: Why Did You Render
```bash
npm install @welldone-software/why-did-you-render --save-dev
```

### Fixing Re-render Issues

#### Issue: Object/Array Props Created Every Render
```typescript
// ❌ Bad: New object every render
<Child style={{ color: 'red' }} />
<Child items={data.filter(x => x.active)} />

// ✅ Good: Memoized values
const style = useMemo(() => ({ color: 'red' }), []);
const activeItems = useMemo(() => data.filter(x => x.active), [data]);

<Child style={style} />
<Child items={activeItems} />
```

#### Issue: Callback Props Created Every Render
```typescript
// ❌ Bad: New function every render
<Button onClick={() => handleClick(id)} />

// ✅ Good: Stable callback
const handleButtonClick = useCallback(() => handleClick(id), [id]);
<Button onClick={handleButtonClick} />
```

#### Issue: Context Causing Full Tree Re-render
```typescript
// ❌ Bad: One big context
const AppContext = createContext({ user, theme, settings, notifications });

// ✅ Good: Split contexts by update frequency
const UserContext = createContext(user);         // Rarely changes
const ThemeContext = createContext(theme);       // Sometimes changes
const NotificationsContext = createContext([]);  // Frequently changes
```

---

## 6. Image Optimization

### Use Next.js Image Component
```tsx
import Image from 'next/image';

// ✅ Optimized: Automatic lazy loading, WebP conversion, sizing
<Image
  src="/photo.jpg"
  alt="Description"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>

// For external images, add domain to next.config.mjs
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'storage.googleapis.com' },
      { hostname: 'lh3.googleusercontent.com' },
    ],
  },
};
```

### Image Checklist
- [ ] Use `next/image` instead of `<img>`
- [ ] Provide width and height to prevent CLS
- [ ] Use `priority` for above-the-fold images
- [ ] Lazy load below-the-fold images (default)
- [ ] Use appropriate sizes for different viewports

---

## 7. API & Data Fetching Optimization

### Server Components (Default in App Router)
```typescript
// This runs on server - no client JS needed
async function RepairList() {
  const repairs = await getRepairs(); // Direct server call
  return <ul>{repairs.map(r => <li key={r.id}>{r.title}</li>)}</ul>;
}
```

### Parallel Data Fetching
```typescript
// ❌ Bad: Sequential (waterfall)
const users = await getUsers();
const repairs = await getRepairs();
const bookings = await getBookings();

// ✅ Good: Parallel
const [users, repairs, bookings] = await Promise.all([
  getUsers(),
  getRepairs(),
  getBookings(),
]);
```

### Caching Strategies
```typescript
// Static data - cache indefinitely
export const revalidate = false;

// Semi-static - revalidate every hour
export const revalidate = 3600;

// Dynamic - fetch fresh every request
export const dynamic = 'force-dynamic';
```

---

## 8. Firestore Performance

### Query Optimization
```typescript
// ❌ Bad: Fetch all then filter
const allRepairs = await getDocs(collection(db, 'repairs'));
const pending = allRepairs.docs.filter(d => d.data().status === 'pending');

// ✅ Good: Filter in query
const pendingRepairs = await getDocs(
  query(collection(db, 'repairs'), where('status', '==', 'pending'))
);
```

### Pagination
```typescript
// Don't load 1000 documents at once
const PAGE_SIZE = 20;

const firstPage = await getDocs(
  query(
    collection(db, 'repairs'),
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE)
  )
);

// Get next page using last document
const lastDoc = firstPage.docs[firstPage.docs.length - 1];
const nextPage = await getDocs(
  query(
    collection(db, 'repairs'),
    orderBy('createdAt', 'desc'),
    startAfter(lastDoc),
    limit(PAGE_SIZE)
  )
);
```

### Index Optimization
- Check Firebase Console for index suggestions
- Create composite indexes for complex queries
- Monitor read counts in Firebase Console

---

## 9. Performance Audit Checklist

### Quick Audit (5 minutes)
- [ ] Run Lighthouse in Chrome DevTools
- [ ] Check Core Web Vitals scores
- [ ] Note any obvious issues (large LCP, high CLS)

### Deep Audit (30 minutes)
- [ ] **Bundle Analysis**: Run `ANALYZE=true npm run build`
- [ ] **Identify large deps**: List top 5 largest packages
- [ ] **Check for duplicates**: Same library included multiple times?
- [ ] **React Profiler**: Record user interactions, check re-renders
- [ ] **Network tab**: Look for large requests, slow APIs
- [ ] **Firestore**: Check read counts, identify hot queries

### Optimization Priorities
1. **High Impact, Low Effort**: Image optimization, lazy loading
2. **High Impact, Medium Effort**: Code splitting, query optimization
3. **Medium Impact, High Effort**: Architecture changes, caching

---

## 10. Performance Monitoring

### Add to Production
```typescript
// Report Core Web Vitals to analytics
export function reportWebVitals(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
  });

  // Send to your analytics endpoint
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', body);
  }
}
```

### Set Performance Budgets
```javascript
// next.config.mjs
const nextConfig = {
  experimental: {
    // Warn if page JS exceeds budget
    bundlePagesExternals: true,
  },
};
```

---

## 11. Feedback Format

When reporting performance issues, use these tags:

- **[PERF-CRITICAL]**: Page unusable due to slow performance
- **[PERF-LCP]**: Slow initial load (Largest Contentful Paint)
- **[PERF-INP]**: Slow interactions (Input Delay)
- **[PERF-CLS]**: Layout shifts causing poor UX
- **[PERF-BUNDLE]**: Bundle size concerns
- **[PERF-RENDER]**: Unnecessary React re-renders
- **[PERF-QUERY]**: Slow or inefficient database queries
