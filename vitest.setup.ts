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
