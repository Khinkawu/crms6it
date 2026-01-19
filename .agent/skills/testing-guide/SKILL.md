---
name: testing-guide
description: Vitest testing patterns for Next.js including React Testing Library, hook testing, Firebase mocking, and API route testing. Use when writing or debugging tests.
metadata:
  author: crms6-it
  version: "1.0.0"
---

# Vitest Testing Guide

Comprehensive guide for testing Next.js applications with Vitest, React Testing Library, and Firebase mocking.

## When to Apply

Reference these guidelines when:
- Writing unit tests for React components
- Testing custom hooks
- Mocking Firebase/Firestore operations
- Testing API routes
- Setting up test coverage

---

## 1. Project Test Configuration

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',           // Browser-like environment
        setupFiles: ['./vitest.setup.ts'],
        globals: true,                   // Use global describe, it, expect
        include: ['**/*.test.ts', '**/*.test.tsx'],
        exclude: ['node_modules', '.next'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
})
```

### vitest.setup.ts

```typescript
import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock Firebase
vi.mock('./lib/firebase', () => ({
    db: {},
    storage: {},
    auth: {
        currentUser: {
            getIdToken: vi.fn().mockResolvedValue('mock-token'),
            uid: 'test-user-id',
        }
    },
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: {
        error: vi.fn(),
        success: vi.fn(),
        loading: vi.fn(),
        promise: vi.fn(),
    },
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        loading: vi.fn(),
    }
}))
```

### Running Tests

```bash
# Run all tests
npm run test

# Run tests once (CI mode)
npm run test:run

# Run with coverage
npx vitest --coverage

# Run specific file
npx vitest hooks/__tests__/usePhotographyFacebook.test.ts
```

---

## 2. Hook Testing Pattern

### Basic Hook Test

```typescript
// hooks/__tests__/usePhotographyFacebook.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePhotographyFacebook } from '../usePhotographyFacebook'

describe('usePhotographyFacebook', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('handleFacebookToggle', () => {
        it('should toggle facebook enabled state', () => {
            const { result } = renderHook(() => usePhotographyFacebook())

            // Initially disabled
            expect(result.current.facebookEnabled['job1']).toBeFalsy()

            // Enable
            act(() => {
                result.current.handleFacebookToggle('job1')
            })
            expect(result.current.facebookEnabled['job1']).toBe(true)

            // Disable
            act(() => {
                result.current.handleFacebookToggle('job1')
            })
            expect(result.current.facebookEnabled['job1']).toBe(false)
        })
    })
})
```

### Testing Async Hooks

```typescript
import { waitFor } from '@testing-library/react'

describe('useAsyncHook', () => {
    it('should fetch data on mount', async () => {
        const { result } = renderHook(() => useAsyncData())

        // Initial loading state
        expect(result.current.isLoading).toBe(true)

        // Wait for async operation
        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        // Check data
        expect(result.current.data).toHaveLength(5)
    })
})
```

### Testing Hooks with Context

```typescript
import { AuthProvider } from '@/context/AuthContext'

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
)

it('should use auth context', () => {
    const { result } = renderHook(() => useMyHook(), { wrapper })
    expect(result.current.user).toBeDefined()
})
```

---

## 3. Component Testing Pattern

### Basic Component Test

```typescript
// app/components/__tests__/Button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../Button'

describe('Button', () => {
    it('renders with correct text', () => {
        render(<Button>Click me</Button>)
        expect(screen.getByRole('button')).toHaveTextContent('Click me')
    })

    it('calls onClick when clicked', () => {
        const handleClick = vi.fn()
        render(<Button onClick={handleClick}>Click</Button>)
        
        fireEvent.click(screen.getByRole('button'))
        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('is disabled when disabled prop is true', () => {
        render(<Button disabled>Disabled</Button>)
        expect(screen.getByRole('button')).toBeDisabled()
    })
})
```

### Testing Form Components

```typescript
import userEvent from '@testing-library/user-event'

describe('RepairForm', () => {
    it('submits form with correct data', async () => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        
        render(<RepairForm onSubmit={onSubmit} />)
        
        // Fill form
        await user.type(screen.getByLabelText(/รายละเอียด/i), 'เปิดไม่ติด')
        await user.selectOptions(screen.getByLabelText(/โซน/i), 'senior_high')
        
        // Submit
        await user.click(screen.getByRole('button', { name: /ส่ง/i }))
        
        // Verify
        expect(onSubmit).toHaveBeenCalledWith({
            description: 'เปิดไม่ติด',
            zone: 'senior_high',
        })
    })
})
```

---

## 4. Firebase Mocking

### Mock Firestore Query

```typescript
import { vi } from 'vitest'

// In test file
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn().mockResolvedValue({
        docs: [
            { id: '1', data: () => ({ title: 'Test Repair', status: 'pending' }) },
            { id: '2', data: () => ({ title: 'Test Repair 2', status: 'completed' }) },
        ],
        size: 2,
    }),
    doc: vi.fn(),
    getDoc: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ name: 'Test User' }),
    }),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    addDoc: vi.fn().mockResolvedValue({ id: 'new-doc-id' }),
}))
```

### Mock Specific Behavior

```typescript
import { getDocs } from 'firebase/firestore'

it('handles empty results', async () => {
    // Override mock for this test
    vi.mocked(getDocs).mockResolvedValueOnce({
        docs: [],
        size: 0,
    } as any)
    
    const { result } = renderHook(() => useRepairs())
    
    await waitFor(() => {
        expect(result.current.repairs).toHaveLength(0)
    })
})
```

---

## 5. API Route Testing

### Setup for Route Handlers

```typescript
// __tests__/api/repairs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from '@/app/api/repairs/route'

// Mock Firebase Admin
vi.mock('@/lib/firebaseAdmin', () => ({
    adminDb: {
        collection: vi.fn().mockReturnThis(),
        doc: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ title: 'Test' }),
        }),
        add: vi.fn().mockResolvedValue({ id: 'new-id' }),
    },
}))

describe('POST /api/repairs', () => {
    it('creates a new repair', async () => {
        const request = new Request('http://localhost/api/repairs', {
            method: 'POST',
            body: JSON.stringify({
                description: 'Computer not working',
                room: '401',
                zone: 'senior_high',
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.id).toBe('new-id')
    })
})
```

---

## 6. Testing Best Practices

### ✅ Do

```typescript
// ✅ Test behavior, not implementation
it('shows error message on failed submit', async () => {
    // Mock API failure
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
    
    render(<Form />)
    await userEvent.click(screen.getByRole('button', { name: /submit/i }))
    
    expect(screen.getByText(/เกิดข้อผิดพลาด/i)).toBeInTheDocument()
})

// ✅ Use data-testid sparingly, prefer accessible queries
screen.getByRole('button', { name: /submit/i })  // Good
screen.getByTestId('submit-button')              // Only when necessary

// ✅ Clean up after each test
beforeEach(() => {
    vi.clearAllMocks()
})

// ✅ Use act() for state updates
act(() => {
    result.current.handleSubmit()
})
```

### ❌ Don't

```typescript
// ❌ Don't test implementation details
expect(component.state.isLoading).toBe(true)  // Bad - testing internal state

// ❌ Don't use arbitrary timeouts
await new Promise(r => setTimeout(r, 1000))  // Bad - use waitFor instead

// ❌ Don't ignore act() warnings
// If you see "Warning: An update was not wrapped in act()"
// Wrap your updates properly
```

---

## 7. Test Organization

### File Structure

```
hooks/
├── usePhotographyFacebook.ts
├── usePhotographyJobUpload.ts
└── __tests__/
    ├── usePhotographyFacebook.test.ts
    └── usePhotographyJobUpload.test.ts

app/
├── components/
│   ├── Button.tsx
│   └── __tests__/
│       └── Button.test.tsx
└── api/
    ├── repairs/
    │   └── route.ts
    └── __tests__/
        └── repairs.test.ts
```

### Naming Conventions

```typescript
// Filename: ComponentName.test.tsx or useHookName.test.ts

// Test suites
describe('ComponentName', () => {
    describe('when user is logged in', () => {
        it('shows welcome message', () => {})
        it('shows logout button', () => {})
    })
    
    describe('when user is not logged in', () => {
        it('shows login form', () => {})
    })
})
```

---

## 8. Common Matchers

### Jest-DOM Matchers

```typescript
// Visibility
expect(element).toBeVisible()
expect(element).toBeInTheDocument()

// Content
expect(element).toHaveTextContent('Hello')
expect(element).toHaveValue('input value')

// State
expect(element).toBeDisabled()
expect(element).toBeChecked()
expect(element).toHaveFocus()

// Classes/Attributes
expect(element).toHaveClass('active')
expect(element).toHaveAttribute('href', '/home')
```

### Vitest Matchers

```typescript
// Equality
expect(value).toBe(5)
expect(array).toEqual([1, 2, 3])

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeDefined()

// Numbers
expect(value).toBeGreaterThan(3)
expect(value).toBeLessThanOrEqual(10)

// Mocks
expect(mockFn).toHaveBeenCalled()
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
expect(mockFn).toHaveBeenCalledTimes(3)
```

---

## 9. Coverage Configuration

### package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Coverage Thresholds

```typescript
// vitest.config.ts
export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                global: {
                    statements: 70,
                    branches: 70,
                    functions: 70,
                    lines: 70,
                },
            },
        },
    },
})
```

---

## 10. Feedback Format

- **[TEST-CRITICAL]**: Tests breaking CI/CD pipeline
- **[TEST-FLAKY]**: Inconsistent test results
- **[TEST-COVERAGE]**: Missing test coverage for critical paths
- **[TEST-MOCK]**: Mock not working correctly
- **[TEST-PERF]**: Tests running too slowly
