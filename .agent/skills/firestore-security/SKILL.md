---
name: firestore-security
description: Comprehensive Firestore Security Rules auditing and design for CRMS6 IT. Ensures proper access control for repairs, bookings, and user data.
---

# Firestore Security Rules Skill

This skill provides comprehensive guidance for designing, auditing, and testing Firestore Security Rules to protect sensitive data in CRMS6 IT.

## 1. Security Rules Overview

### Access Control Layers

```
┌─────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                       │
├─────────────────────────────────────────────────────────┤
│ 1. Authentication  - Is user logged in?                 │
│ 2. Authorization   - Does user have permission?         │
│ 3. Validation      - Is the data valid?                 │
│ 4. Rate Limiting   - Is request within limits?          │
└─────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Deny by default** - Only allow what's explicitly permitted
2. **Least privilege** - Give minimum access needed
3. **Never trust client** - Always validate on server
4. **Audit regularly** - Review rules with each feature

---

## 2. CRMS6 IT Collection Structure

| Collection | Sensitive Data | Access Model |
|------------|----------------|--------------|
| `users` | ✅ Personal info | Owner only |
| `repairs` | ✅ Location, contact | Owner + Admins |
| `bookings` | ⚠️ Schedule info | Owner + Admins |
| `photographyJobs` | ⚠️ Event details | Assigned + Admins |
| `inventory` | ❌ | Admins only |
| `activityLogs` | ⚠️ User actions | Admins only |
| `settings` | ❌ | Admins only |

---

## 3. Security Rules Templates

### Base Rules Structure

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    
    // Check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Check if user is the document owner
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Check if user is admin
    function isAdmin() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Check if user is staff (admin or technician)
    function isStaff() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'technician'];
    }
    
    // Validate that field exists and is a string
    function isValidString(field) {
      return field is string && field.size() > 0;
    }
    
    // ============================================
    // COLLECTION RULES
    // ============================================
    
    // --- USERS ---
    match /users/{userId} {
      // Users can read their own profile
      allow read: if isOwner(userId) || isAdmin();
      
      // Users can update their own profile (limited fields)
      allow update: if isOwner(userId) && 
        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'isAdmin']);
      
      // Only admins can create/delete users
      allow create, delete: if isAdmin();
    }
    
    // --- REPAIRS ---
    match /repairs/{repairId} {
      // Owner can read their repairs, staff can read all
      allow read: if isOwner(resource.data.userId) || isStaff();
      
      // Anyone authenticated can create a repair
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid &&
        isValidString(request.resource.data.title);
      
      // Only staff can update repairs
      allow update: if isStaff();
      
      // Only admins can delete repairs
      allow delete: if isAdmin();
    }
    
    // --- BOOKINGS ---
    match /bookings/{bookingId} {
      // Owner or staff can read
      allow read: if isOwner(resource.data.userId) || isStaff();
      
      // Authenticated users can create their own bookings
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
      
      // Owner can update their pending bookings, admins can update any
      allow update: if (isOwner(resource.data.userId) && resource.data.status == 'pending') 
        || isAdmin();
      
      // Only admins can delete
      allow delete: if isAdmin();
    }
    
    // --- PHOTOGRAPHY JOBS ---
    match /photographyJobs/{jobId} {
      // Staff can read all, or if assigned to user
      allow read: if isStaff() || 
        (isAuthenticated() && resource.data.assignedTo == request.auth.uid);
      
      // Only admins can create/delete jobs
      allow create, delete: if isAdmin();
      
      // Staff can update their assigned jobs
      allow update: if isStaff() || 
        (isAuthenticated() && resource.data.assignedTo == request.auth.uid);
    }
    
    // --- INVENTORY ---
    match /inventory/{itemId} {
      // Only admins can access inventory
      allow read, write: if isAdmin();
    }
    
    // --- ACTIVITY LOGS ---
    match /activityLogs/{logId} {
      // Only admins can read logs
      allow read: if isAdmin();
      
      // System can create logs (via Admin SDK), no client writes
      allow write: if false;
    }
    
    // --- SETTINGS ---
    match /settings/{settingId} {
      // Anyone can read public settings
      allow read: if true;
      
      // Only admins can modify settings
      allow write: if isAdmin();
    }
    
    // --- DEFAULT DENY ---
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 4. Security Audit Checklist

### For Each Collection, Verify:

- [ ] **Read Access**
  - Who can read this data?
  - Can users see other users' data? (Should they?)
  - Are sensitive fields exposed?

- [ ] **Write Access**
  - Who can create documents?
  - Can users modify documents they don't own?
  - Are critical fields protected (role, userId)?

- [ ] **Delete Access**
  - Who can delete documents?
  - Is there audit trail for deletions?

- [ ] **Data Validation**
  - Are required fields validated?
  - Are field types checked?
  - Is input size limited?

---

## 5. Common Vulnerabilities

### ❌ Vulnerability 1: No Auth Check

```javascript
// VULNERABLE - Anyone can read all repairs
match /repairs/{repairId} {
  allow read: if true;
}

// SECURE - Only authenticated users
match /repairs/{repairId} {
  allow read: if isAuthenticated();
}
```

### ❌ Vulnerability 2: No Owner Check

```javascript
// VULNERABLE - Any user can read any user's repairs
match /repairs/{repairId} {
  allow read: if isAuthenticated();
}

// SECURE - Only owner or staff
match /repairs/{repairId} {
  allow read: if isOwner(resource.data.userId) || isStaff();
}
```

### ❌ Vulnerability 3: Client Can Set Role

```javascript
// VULNERABLE - User can make themselves admin
match /users/{userId} {
  allow update: if isOwner(userId);
}

// SECURE - Protect role field
match /users/{userId} {
  allow update: if isOwner(userId) && 
    !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'isAdmin']);
}
```

### ❌ Vulnerability 4: Cross-User Write

```javascript
// VULNERABLE - User can create repair for another user
match /repairs/{repairId} {
  allow create: if isAuthenticated();
}

// SECURE - Must set own userId
match /repairs/{repairId} {
  allow create: if isAuthenticated() && 
    request.resource.data.userId == request.auth.uid;
}
```

---

## 6. Testing Security Rules

### Using Firebase Emulator

```bash
# Start emulator
firebase emulators:start

# Run security rules tests
firebase emulators:exec --only firestore "npm test"
```

### Test File Example

```javascript
// tests/firestore.rules.test.js
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

describe('Repairs', () => {
  it('allows owner to read their repair', async () => {
    const repair = testDb.collection('repairs').doc('repair1');
    await assertSucceeds(repair.get());
  });
  
  it('denies reading other users repair', async () => {
    const repair = testDb.collection('repairs').doc('otherUserRepair');
    await assertFails(repair.get());
  });
  
  it('denies writing to repairs without auth', async () => {
    const unauthedDb = getUnauthedDb();
    const repair = unauthedDb.collection('repairs').doc('new');
    await assertFails(repair.set({ title: 'Test' }));
  });
});
```

### Manual Testing via Console

```javascript
// In Firebase Console > Firestore > Rules Playground

// Test: Can user read their own repair?
// Path: /repairs/repair123
// Method: get
// Auth: Authenticated | UID: user123
// Document data: { userId: 'user123', title: 'Test' }
```

---

## 7. Role-Based Access Patterns

### User Roles in CRMS6 IT

```typescript
type UserRole = 'user' | 'technician' | 'photographer' | 'admin';

// In Firestore user document
{
  uid: 'abc123',
  displayName: 'สมชาย',
  email: 'somchai@company.com',
  role: 'technician',  // Protected field
  department: 'IT',
  createdAt: Timestamp,
}
```

### Role Hierarchy Functions

```javascript
// In security rules
function getUserRole() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
}

function hasRole(allowedRoles) {
  return isAuthenticated() && getUserRole() in allowedRoles;
}

// Usage
match /repairs/{repairId} {
  allow update: if hasRole(['admin', 'technician']);
}
```

---

## 8. Data Validation Rules

### Validate on Write

```javascript
match /repairs/{repairId} {
  allow create: if isAuthenticated() &&
    // Required fields
    request.resource.data.keys().hasAll(['title', 'description', 'userId']) &&
    // Type validation
    request.resource.data.title is string &&
    request.resource.data.description is string &&
    // Length limits
    request.resource.data.title.size() > 0 &&
    request.resource.data.title.size() <= 200 &&
    // Owner validation
    request.resource.data.userId == request.auth.uid &&
    // Status must be pending for new repairs
    request.resource.data.status == 'pending';
}
```

### Prevent Field Modifications

```javascript
match /repairs/{repairId} {
  allow update: if isStaff() &&
    // Cannot change userId after creation
    request.resource.data.userId == resource.data.userId &&
    // Cannot change createdAt
    request.resource.data.createdAt == resource.data.createdAt;
}
```

---

## 9. Debugging Security Rules

### Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `Missing or insufficient permissions` | Rule denied access | Check auth and conditions |
| `PERMISSION_DENIED` | Same as above | Verify rule logic |
| `null value in resource.data` | Accessing field that doesn't exist | Use `data.get('field', default)` |

### Debug Logging

```javascript
// Add debug output (remove in production)
function isOwner(userId) {
  // This will show in emulator logs
  let result = request.auth.uid == userId;
  debug('isOwner check: auth.uid=' + request.auth.uid + ', userId=' + userId + ', result=' + result);
  return result;
}
```

---

## 10. Security Rules Deployment

### Deploy Safely

```bash
# 1. Test in emulator first
firebase emulators:start

# 2. Deploy to staging/preview
firebase deploy --only firestore:rules --project staging

# 3. Test in staging environment

# 4. Deploy to production
firebase deploy --only firestore:rules --project production
```

### Version Control

Keep rules in version control:
```
firestore.rules     # Main rules file
firestore.indexes.json  # Index definitions
```

---

## 11. Feedback Format

- **[SECURITY-CRITICAL]**: Data exposed to unauthorized users
- **[SECURITY-AUTH]**: Missing authentication checks
- **[SECURITY-AUTHZ]**: Missing authorization (who can do what)
- **[SECURITY-VALIDATE]**: Missing input validation
- **[SECURITY-AUDIT]**: Needs review, potential issue
