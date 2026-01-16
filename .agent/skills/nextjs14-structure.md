---
name: nextjs14-structure
description: Next.js 14 App Router architecture guide covering Server vs Client Components, Server Actions, data fetching patterns, and performance optimization decisions.
---

# Next.js 14 Structure Skill

This skill provides comprehensive guidance for structuring Next.js 14 applications with the App Router, focusing on optimal Server/Client component decisions.

## 1. Server Components vs Client Components

### Decision Framework

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPONENT NEEDS                          │
├─────────────────────────┬───────────────────────────────────┤
│     SERVER COMPONENT    │       CLIENT COMPONENT            │
│     (Default in app/)   │       ('use client')              │
├─────────────────────────┼───────────────────────────────────┤
│ ✅ Fetch data directly  │ ✅ User interactions (onClick)   │
│ ✅ Access backend        │ ✅ useState, useEffect           │
│ ✅ Keep secrets safe    │ ✅ Browser APIs (localStorage)   │
│ ✅ Large dependencies   │ ✅ Real-time updates              │
│ ✅ SEO important        │ ✅ Form inputs                    │
│ ✅ No interactivity     │ ✅ Animations (framer-motion)    │
└─────────────────────────┴───────────────────────────────────┘
```

### Quick Decision Guide

Ask these questions:
1. **Does it need user interaction?** → Client
2. **Does it need browser APIs?** → Client
3. **Does it need useState/useEffect?** → Client
4. **Does it fetch sensitive data?** → Server
5. **Is it a static display?** → Server

---

## 2. Project-Specific Guidelines for CRMS6 IT

### Pages That Should Be Server Components

```typescript
// ✅ app/page.tsx - Homepage
// Server Component: Fetches data, SEO important
async function HomePage() {
  const announcements = await getAnnouncements();
  return <AnnouncementList items={announcements} />;
}

// ✅ app/admin/dashboard/page.tsx - Dashboard
// Server Component: Fetches aggregated data
async function DashboardPage() {
  const [repairs, bookings, stats] = await Promise.all([
    getRecentRepairs(),
    getRecentBookings(),
    getDashboardStats(),
  ]);
  
  return (
    <>
      <StatsCards stats={stats} />        {/* Server */}
      <RepairTable repairs={repairs} />    {/* Client - has filters */}
      <BookingCalendar bookings={bookings} /> {/* Client - interactive */}
    </>
  );
}
```

### Components That Must Be Client

```typescript
// ❌ Cannot be Server - uses hooks
'use client';

// app/components/RepairForm.tsx
function RepairForm() {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  return (
    <form onSubmit={handleSubmit}>
      <input value={title} onChange={e => setTitle(e.target.value)} />
    </form>
  );
}

// app/components/BookingCalendar.tsx
function BookingCalendar({ initialBookings }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  // react-big-calendar is a client-side library
  return <Calendar onSelectSlot={handleSelect} />;
}
```

---

## 3. Composition Pattern: Server + Client

### The "Wrapper" Pattern

```typescript
// ✅ BEST PRACTICE: Server fetches, Client renders interactive parts

// app/admin/repairs/page.tsx (Server Component)
async function RepairsPage() {
  const repairs = await getRepairs(); // Server-side fetch
  
  return (
    <div>
      <h1>รายการแจ้งซ่อม</h1>
      {/* Pass data to client component */}
      <RepairTableWithFilters initialRepairs={repairs} />
    </div>
  );
}

// app/components/RepairTableWithFilters.tsx (Client Component)
'use client';

function RepairTableWithFilters({ initialRepairs }) {
  const [repairs, setRepairs] = useState(initialRepairs);
  const [filter, setFilter] = useState('all');
  
  const filteredRepairs = repairs.filter(r => 
    filter === 'all' || r.status === filter
  );
  
  return (
    <>
      <FilterDropdown value={filter} onChange={setFilter} />
      <RepairTable repairs={filteredRepairs} />
    </>
  );
}
```

### Children Pattern for Interactivity

```typescript
// Server Component with Client children
async function RepairDetailPage({ params }) {
  const repair = await getRepair(params.id);
  
  return (
    <div>
      {/* Static content - Server rendered */}
      <h1>{repair.title}</h1>
      <p>สถานะ: {repair.status}</p>
      <p>วันที่แจ้ง: {formatDate(repair.createdAt)}</p>
      
      {/* Interactive parts - Client */}
      <StatusUpdateButtons repairId={repair.id} currentStatus={repair.status} />
      <CommentSection repairId={repair.id} />
    </div>
  );
}
```

---

## 4. Server Actions (Replace API Routes)

### When to Use Server Actions

| Use Case | API Route | Server Action |
|----------|-----------|---------------|
| Form submission | ❌ | ✅ |
| Data mutation | ❌ | ✅ |
| File upload | ❌ | ✅ |
| External webhook | ✅ | ❌ |
| Third-party callback | ✅ | ❌ |
| CORS needed | ✅ | ❌ |

### Server Action Examples

#### Basic Form Action
```typescript
// app/admin/repairs/actions.ts
'use server';

import { revalidatePath } from 'next/cache';

export async function updateRepairStatus(repairId: string, newStatus: string) {
  // Validate user has permission
  const session = await getSession();
  if (!session?.user?.isAdmin) {
    throw new Error('Unauthorized');
  }
  
  // Update in Firestore
  await updateRepair(repairId, { status: newStatus });
  
  // Revalidate the cache
  revalidatePath('/admin/repairs');
  revalidatePath(`/admin/repairs/${repairId}`);
  
  return { success: true };
}

// app/components/StatusUpdateButtons.tsx
'use client';

import { updateRepairStatus } from '../admin/repairs/actions';

function StatusUpdateButtons({ repairId, currentStatus }) {
  const [pending, startTransition] = useTransition();
  
  const handleUpdate = (newStatus: string) => {
    startTransition(async () => {
      await updateRepairStatus(repairId, newStatus);
      toast.success('อัปเดตสถานะแล้ว');
    });
  };
  
  return (
    <div>
      <button 
        onClick={() => handleUpdate('in_progress')}
        disabled={pending}
      >
        กำลังดำเนินการ
      </button>
    </div>
  );
}
```

#### Form with useFormState
```typescript
// app/components/RepairForm.tsx
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createRepair } from '../actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'กำลังบันทึก...' : 'บันทึก'}
    </button>
  );
}

function RepairForm() {
  const [state, formAction] = useFormState(createRepair, { error: null });
  
  return (
    <form action={formAction}>
      <input name="title" required />
      <textarea name="description" />
      {state.error && <p className="error">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
```

#### Server Action with File Upload
```typescript
// actions.ts
'use server';

export async function uploadRepairPhoto(formData: FormData) {
  const file = formData.get('photo') as File;
  const repairId = formData.get('repairId') as string;
  
  if (!file || file.size === 0) {
    return { error: 'No file provided' };
  }
  
  // Upload to Google Drive or Firebase Storage
  const url = await uploadToStorage(file);
  
  // Update repair document
  await updateRepair(repairId, {
    photos: arrayUnion(url),
  });
  
  revalidatePath(`/admin/repairs/${repairId}`);
  return { success: true, url };
}
```

---

## 5. Data Fetching Patterns

### Server Component Fetching

```typescript
// ✅ Direct database access in Server Components
async function RepairsPage() {
  // This runs on server only - safe to use admin SDK
  const repairs = await db.collection('repairs')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();
  
  return <RepairList repairs={repairs.docs.map(d => d.data())} />;
}
```

### Client Component with SWR/React Query

```typescript
// For real-time data in Client Components
'use client';

import useSWR from 'swr';

function LiveRepairStatus({ repairId }) {
  const { data, error, isLoading } = useSWR(
    `/api/repairs/${repairId}`,
    fetcher,
    { refreshInterval: 5000 } // Poll every 5s
  );
  
  if (isLoading) return <Skeleton />;
  if (error) return <Error />;
  
  return <StatusBadge status={data.status} />;
}
```

### Real-time with Firestore Listener

```typescript
// For true real-time updates
'use client';

function LiveRepairList() {
  const [repairs, setRepairs] = useState([]);
  
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'repairs'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setRepairs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    
    return () => unsubscribe();
  }, []);
  
  return <RepairTable repairs={repairs} />;
}
```

---

## 6. Layout and Loading States

### Streaming with Suspense

```typescript
// app/admin/dashboard/page.tsx
import { Suspense } from 'react';

async function DashboardPage() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Stats load fast - show immediately */}
      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats />
      </Suspense>
      
      {/* Table might be slow - stream when ready */}
      <Suspense fallback={<TableSkeleton />}>
        <RecentRepairs />
      </Suspense>
      
      {/* Calendar is heavy - load last */}
      <Suspense fallback={<CalendarSkeleton />}>
        <BookingCalendar />
      </Suspense>
    </div>
  );
}
```

### Loading UI
```typescript
// app/admin/repairs/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
      <div className="h-64 bg-gray-200 rounded" />
    </div>
  );
}
```

---

## 7. File Structure Best Practices

```
app/
├── (auth)/                    # Route group - shared layout
│   ├── login/
│   │   └── page.tsx
│   └── layout.tsx             # Auth layout (no sidebar)
│
├── admin/                     # Admin section
│   ├── layout.tsx             # Admin layout with sidebar
│   ├── dashboard/
│   │   ├── page.tsx           # Server Component
│   │   └── loading.tsx
│   ├── repairs/
│   │   ├── page.tsx           # Server: fetch + render
│   │   ├── [id]/
│   │   │   └── page.tsx
│   │   ├── actions.ts         # Server Actions
│   │   └── components/        # Page-specific components
│   │       ├── RepairTable.tsx    # 'use client'
│   │       └── RepairFilters.tsx  # 'use client'
│   └── bookings/
│       └── ...
│
├── api/                       # API Routes (for webhooks only)
│   ├── line-webhook/
│   └── cron/
│
├── components/                # Shared components
│   ├── ui/                    # Server Components (Button, Card)
│   └── interactive/           # Client Components
│
└── liff/                      # LIFF pages (all client)
    └── ...
```

---

## 8. Migration Checklist: API Route → Server Action

When refactoring existing API routes:

1. **Identify mutation routes** (POST, PUT, DELETE)
2. **Create actions.ts** in the relevant app folder
3. **Move logic** from route.ts to action
4. **Update client** to use action instead of fetch
5. **Add revalidatePath** for cache invalidation
6. **Keep API routes** for external webhooks only

```typescript
// BEFORE: API Route
// app/api/repairs/[id]/route.ts
export async function PATCH(request, { params }) {
  const body = await request.json();
  await updateRepair(params.id, body);
  return Response.json({ success: true });
}

// AFTER: Server Action
// app/admin/repairs/actions.ts
'use server';
export async function updateRepair(repairId: string, data: RepairUpdate) {
  await db.collection('repairs').doc(repairId).update(data);
  revalidatePath('/admin/repairs');
  return { success: true };
}
```

---

## 9. Performance Checklist

- [ ] **Default to Server Components** - Only add 'use client' when needed
- [ ] **Push 'use client' down** - Keep interactive parts small
- [ ] **Use Suspense** - Stream heavy components
- [ ] **Parallel data fetching** - Use Promise.all()
- [ ] **Server Actions** - Replace mutation API routes
- [ ] **Proper caching** - Use revalidatePath/revalidateTag

---

## 10. Feedback Format

- **[NEXTJS-CRITICAL]**: Wrong component type causing hydration errors
- **[NEXTJS-PERF]**: Too much client JS, should be server
- **[NEXTJS-PATTERN]**: Could use better composition pattern
- **[NEXTJS-ACTION]**: Should use Server Action instead of API
- **[NEXTJS-CACHE]**: Missing cache invalidation
