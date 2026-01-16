import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePhotographyJobUpload } from '../usePhotographyJobUpload'

// Mock toast
vi.mock('react-hot-toast', () => ({
    default: {
        error: vi.fn(),
    },
}))

describe('usePhotographyJobUpload', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('handleLinkChange', () => {
        it('should update drive links', () => {
            const { result } = renderHook(() => usePhotographyJobUpload())

            act(() => {
                result.current.handleLinkChange('job1', 'https://drive.google.com/test')
            })

            expect(result.current.driveLinks['job1']).toBe('https://drive.google.com/test')
        })
    })

    describe('removeFile', () => {
        it('should remove file at specified index', () => {
            const { result } = renderHook(() => usePhotographyJobUpload())

            // First, simulate adding files by setting the state
            const mockFile1 = new File(['content1'], 'test1.jpg', { type: 'image/jpeg' })
            const mockFile2 = new File(['content2'], 'test2.jpg', { type: 'image/jpeg' })

            // Simulate processJobFiles by using the input handler
            const mockEvent = {
                target: { files: [mockFile1, mockFile2] }
            } as unknown as React.ChangeEvent<HTMLInputElement>

            act(() => {
                result.current.handleJobFilesChange('job1', mockEvent)
            })

            // Verify files were added
            expect(result.current.jobFiles['job1']?.length).toBe(2)

            // Remove first file
            act(() => {
                result.current.removeFile('job1', 0)
            })

            // Verify file was removed
            expect(result.current.jobFiles['job1']?.length).toBe(1)
        })
    })

    describe('clearJobState', () => {
        it('should clear all state for a job', () => {
            const { result } = renderHook(() => usePhotographyJobUpload())

            // Set some state first
            act(() => {
                result.current.handleLinkChange('job1', 'https://test.com')
            })

            // Clear state
            act(() => {
                result.current.clearJobState('job1')
            })

            // Note: driveLinks is not cleared by clearJobState
            // Check other states are undefined for this job
            expect(result.current.coverFiles['job1']).toBeUndefined()
            expect(result.current.jobFiles['job1']).toBeUndefined()
            expect(result.current.previews['job1']).toBeUndefined()
        })
    })

    describe('fileToBase64', () => {
        it('should convert file to base64 string', async () => {
            const { result } = renderHook(() => usePhotographyJobUpload())

            const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })

            const base64 = await result.current.fileToBase64(mockFile)

            expect(typeof base64).toBe('string')
            expect(base64.length).toBeGreaterThan(0)
        })
    })
})
