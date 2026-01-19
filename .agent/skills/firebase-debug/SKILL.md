---
name: firebase-debug
description: Debug Firebase/Firestore issues including queries, security rules, indexing, and real-time sync problems. Use when facing database errors or performance issues.
---

# Firebase & Firestore Debugging Skill

This skill provides a systematic approach to debugging Firebase/Firestore issues in the CRMS6 IT project.

## 1. Common Error Categories

### 🔴 Permission Denied Errors
**Symptoms**: `FirebaseError: Missing or insufficient permissions`

**Debugging Steps**:
1. Check if the user is authenticated:
   ```typescript
   const user = auth.currentUser;
   console.log('Current user:', user?.uid, user?.email);
   ```

2. Verify Firestore Security Rules in Firebase Console:
   - Go to Firestore → Rules
   - Check if the path matches the rule pattern
   - Test rules using the Rules Playground

3. Common Rule Fixes:
   ```javascript
   // Allow authenticated users
   match /collection/{docId} {
     allow read, write: if request.auth != null;
   }
   
   // Allow only document owner
   match /users/{userId} {
     allow read, write: if request.auth.uid == userId;
   }
   ```

---

### 🟠 Query Index Errors
**Symptoms**: `The query requires an index`

**Debugging Steps**:
1. Check the error message for the index creation link
2. Click the link to create the composite index automatically
3. Wait for index to build (can take several minutes)

**Prevention**:
- For complex queries with multiple `where` and `orderBy`, plan indexes in advance
- Use `console.log` to verify query structure before execution

---

### 🟡 Document Not Found
**Symptoms**: Data returns `undefined` or empty

**Debugging Checklist**:
```typescript
// 1. Verify collection/document path
console.log('Path:', `collection/${docId}`);

// 2. Check if document exists
const docRef = doc(db, 'collection', docId);
const docSnap = await getDoc(docRef);
console.log('Exists:', docSnap.exists());
console.log('Data:', docSnap.data());

// 3. Verify query filters
const q = query(
  collection(db, 'collection'),
  where('field', '==', value)
);
console.log('Query filters:', value, typeof value);
```

**Common Causes**:
- Typo in collection/document name
- Wrong data type in query (string vs number)
- Document was deleted or never created
- Using wrong field name in `where` clause

---

## 2. Real-time Listener Debugging

### Memory Leak Prevention
```typescript
// ✅ Correct: Store and call unsubscribe
useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'items'),
    (snapshot) => {
      // Handle data
    },
    (error) => {
      console.error('Listener error:', error);
    }
  );
  
  return () => unsubscribe(); // Cleanup on unmount
}, []);

// ❌ Wrong: No cleanup
useEffect(() => {
  onSnapshot(collection(db, 'items'), (snapshot) => {
    // This listener will never be cleaned up!
  });
}, []);
```

### Listener Not Updating
**Debugging Steps**:
1. Add error handler to catch silent failures
2. Check if security rules allow the read
3. Verify the query matches existing documents
4. Check network connectivity

---

## 3. Write Operation Debugging

### Failed Writes
```typescript
try {
  await setDoc(doc(db, 'collection', docId), data);
  console.log('Write successful');
} catch (error) {
  if (error.code === 'permission-denied') {
    console.error('No permission to write');
  } else if (error.code === 'unavailable') {
    console.error('Network issue - check offline persistence');
  } else {
    console.error('Write failed:', error);
  }
}
```

### Data Validation Errors
Check that your data matches Firestore requirements:
- No `undefined` values (use `null` instead)
- Field names cannot contain `.` or start with `__`
- Document size limit: 1MB
- Array/map nesting limit: 20 levels

---

## 4. Performance Debugging

### Slow Queries
```typescript
// Add timing to measure query performance
const start = performance.now();
const snapshot = await getDocs(query);
const duration = performance.now() - start;
console.log(`Query took ${duration}ms, returned ${snapshot.size} docs`);
```

### N+1 Query Detection
```typescript
// ❌ Bad: N+1 queries
const users = await getDocs(collection(db, 'users'));
for (const user of users.docs) {
  const orders = await getDocs(
    query(collection(db, 'orders'), where('userId', '==', user.id))
  );
  // This makes N additional queries!
}

// ✅ Better: Batch or restructure data
const [users, allOrders] = await Promise.all([
  getDocs(collection(db, 'users')),
  getDocs(collection(db, 'orders'))
]);
// Filter in memory
```

---

## 5. Firebase Admin SDK Issues (Server-side)

### Authentication Errors
**File**: `lib/firebaseAdmin.ts`
```typescript
// Verify admin SDK is initialized correctly
console.log('Admin initialized:', admin.apps.length > 0);

// Check service account
if (!process.env.FIREBASE_PRIVATE_KEY) {
  console.error('Missing FIREBASE_PRIVATE_KEY');
}
```

### Common Environment Variable Issues
```bash
# Check these are set in .env.local
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=  # Must include \n characters
```

---

## 6. Debugging Commands

### Browser Console
```javascript
// Check Firebase connection status
firebase.firestore().enableNetwork().then(() => console.log('Connected'));

// Force cache clear
firebase.firestore().clearPersistence();
```

### Useful Debug Patterns
```typescript
// Wrap Firestore operations for debugging
const debugQuery = async (queryRef, label) => {
  console.group(`[Firestore] ${label}`);
  console.time('Duration');
  try {
    const snapshot = await getDocs(queryRef);
    console.log('Documents:', snapshot.size);
    snapshot.forEach(doc => console.log(doc.id, doc.data()));
    return snapshot;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    console.timeEnd('Duration');
    console.groupEnd();
  }
};
```

---

## 7. Feedback Format

When reporting Firebase issues, use these tags:

- **[FIREBASE-CRITICAL]**: Security rules misconfigured, data exposed
- **[FIREBASE-ERROR]**: Query failures, write errors
- **[FIREBASE-PERF]**: Slow queries, too many reads
- **[FIREBASE-INFO]**: Optimization suggestions
