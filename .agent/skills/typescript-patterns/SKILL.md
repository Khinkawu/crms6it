---
name: typescript-patterns
description: TypeScript best practices for Next.js including type definitions, generic hooks, strict null checking, and API type safety. Use when writing type-safe code or fixing TypeScript errors.
metadata:
  author: crms6-it
  version: "1.0.0"
---

# TypeScript Best Practices Skill

Guidelines for writing type-safe, maintainable TypeScript in Next.js applications.

## When to Apply

Reference these guidelines when:
- Defining types for Firestore documents
- Writing generic custom hooks
- Handling nullable values safely
- Creating type-safe API routes
- Fixing TypeScript compilation errors

---

## 1. Firestore Document Types

### Define Interfaces for Collections

```typescript
// types/index.ts

export interface RepairTicket {
    id?: string;
    ticketId: string;
    description: string;
    room: string;
    zone: 'junior_high' | 'senior_high';  // Use union types
    status: RepairStatus;
    requesterName: string;
    requesterEmail: string;
    assignedTo?: string;
    imageUrls?: string[];
    createdAt: Timestamp | Date;
    updatedAt?: Timestamp | Date;
}

export type RepairStatus = 
    | 'pending' 
    | 'in_progress' 
    | 'waiting_parts' 
    | 'completed' 
    | 'cancelled';

export interface Booking {
    id?: string;
    room: string;
    title: string;
    requesterName: string;
    requesterEmail: string;
    startTime: Timestamp | Date;
    endTime: Timestamp | Date;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    createdAt: Timestamp | Date;
}
```

### Type-Safe Firestore Queries

```typescript
// ✅ Good: Type assertion after query
const snapshot = await getDocs(collection(db, 'repairs'));
const repairs = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
} as RepairTicket));

// ✅ Better: Converter pattern
const repairConverter = {
    toFirestore: (repair: RepairTicket) => repair,
    fromFirestore: (snap: QueryDocumentSnapshot): RepairTicket => ({
        id: snap.id,
        ...snap.data()
    } as RepairTicket)
};

const repairsRef = collection(db, 'repairs').withConverter(repairConverter);
```

---

## 2. Generic Hook Patterns

### useQuery-style Hook

```typescript
// hooks/useFirestoreQuery.ts
type QueryState<T> = {
    data: T[];
    isLoading: boolean;
    error: Error | null;
};

export function useFirestoreQuery<T>(
    collectionName: string,
    queryConstraints: QueryConstraint[] = []
): QueryState<T> {
    const [state, setState] = useState<QueryState<T>>({
        data: [],
        isLoading: true,
        error: null,
    });

    useEffect(() => {
        const q = query(collection(db, collectionName), ...queryConstraints);
        
        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const items = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as T));
                setState({ data: items, isLoading: false, error: null });
            },
            (error) => {
                setState(prev => ({ ...prev, isLoading: false, error }));
            }
        );

        return () => unsubscribe();
    }, [collectionName]);

    return state;
}

// Usage
const { data: repairs, isLoading } = useFirestoreQuery<RepairTicket>(
    'repairs',
    [where('status', '==', 'pending')]
);
```

---

## 3. Strict Null Checking

### Handle Optional Values

```typescript
// ❌ Bad: Ignoring possible null
const userName = user.displayName.toUpperCase();

// ✅ Good: Optional chaining + nullish coalescing
const userName = user?.displayName?.toUpperCase() ?? 'Unknown';

// ✅ Good: Type guard
function hasDisplayName(user: User): user is User & { displayName: string } {
    return typeof user.displayName === 'string';
}

if (hasDisplayName(user)) {
    console.log(user.displayName.toUpperCase());
}
```

### Non-null Assertion (Use Sparingly)

```typescript
// Only use when you're CERTAIN the value exists
const element = document.getElementById('app')!; // ⚠️ Use carefully

// ✅ Prefer explicit check
const element = document.getElementById('app');
if (!element) throw new Error('App element not found');
```

---

## 4. Discriminated Unions

### Status-Based Logic

```typescript
// Define discriminated union
type UploadState = 
    | { status: 'idle' }
    | { status: 'uploading'; progress: number }
    | { status: 'success'; fileUrl: string }
    | { status: 'error'; error: string };

// TypeScript narrows the type based on 'status'
function renderUploadState(state: UploadState) {
    switch (state.status) {
        case 'idle':
            return <Button>Upload</Button>;
        case 'uploading':
            return <Progress value={state.progress} />; // progress is available
        case 'success':
            return <Link href={state.fileUrl}>View File</Link>; // fileUrl is available
        case 'error':
            return <Alert>{state.error}</Alert>; // error is available
    }
}
```

---

## 5. API Route Type Safety

### Request/Response Types

```typescript
// app/api/repairs/route.ts

interface CreateRepairRequest {
    description: string;
    room: string;
    zone: 'junior_high' | 'senior_high';
    imageUrl?: string;
}

interface CreateRepairResponse {
    success: boolean;
    id?: string;
    error?: string;
}

export async function POST(request: Request): Promise<Response> {
    const body = await request.json() as CreateRepairRequest;
    
    // Validate required fields
    if (!body.description || !body.room || !body.zone) {
        const response: CreateRepairResponse = {
            success: false,
            error: 'Missing required fields'
        };
        return Response.json(response, { status: 400 });
    }
    
    // Create repair...
    const response: CreateRepairResponse = {
        success: true,
        id: 'new-repair-id'
    };
    return Response.json(response);
}
```

### Type-Safe fetch Wrapper

```typescript
// utils/api.ts
async function fetchAPI<T>(
    endpoint: string, 
    options?: RequestInit
): Promise<T> {
    const response = await fetch(endpoint, options);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
}

// Usage
const repair = await fetchAPI<RepairTicket>('/api/repairs/123');
```

---

## 6. Environment Variable Typing

### Type-Safe Env Access

```typescript
// env.ts
const getEnvVar = (key: string): string => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
};

// Export typed config
export const config = {
    firebase: {
        projectId: getEnvVar('FIREBASE_PROJECT_ID'),
        clientEmail: getEnvVar('FIREBASE_CLIENT_EMAIL'),
        privateKey: getEnvVar('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    },
    line: {
        channelSecret: getEnvVar('LINE_CHANNEL_SECRET'),
        accessToken: getEnvVar('LINE_CHANNEL_ACCESS_TOKEN'),
    },
} as const;
```

---

## 7. Common TypeScript Errors

### "Property does not exist on type"

```typescript
// Error: Property 'name' does not exist on type '{}'
const data = await response.json();
console.log(data.name);

// Fix: Type assertion
interface ApiResponse { name: string; }
const data = await response.json() as ApiResponse;
```

### "Object is possibly undefined"

```typescript
// Error: Object is possibly 'undefined'
const user = users.find(u => u.id === id);
console.log(user.name);

// Fix: Check for undefined
const user = users.find(u => u.id === id);
if (!user) throw new Error('User not found');
console.log(user.name);
```

### "Type is not assignable to"

```typescript
// Error: Type 'Date' is not assignable to type 'Timestamp'
const createdAt: Timestamp = new Date();

// Fix: Use correct type or convert
import { Timestamp } from 'firebase/firestore';
const createdAt = Timestamp.fromDate(new Date());
```

---

## 8. Best Practices Summary

### ✅ Do

- Define interfaces for all Firestore collections
- Use discriminated unions for state management
- Enable strict mode in tsconfig.json
- Use generics for reusable hooks
- Handle null/undefined explicitly

### ❌ Don't

- Use `any` type (use `unknown` if necessary)
- Ignore TypeScript errors with `@ts-ignore`
- Use non-null assertion (`!`) excessively
- Define types inline repeatedly (extract to types file)

---

## 9. Feedback Format

- **[TS-CRITICAL]**: Type error blocking compilation
- **[TS-SAFETY]**: Missing null check or type guard
- **[TS-PATTERN]**: Better type pattern available
- **[TS-DRY]**: Type definitions should be extracted/reused
