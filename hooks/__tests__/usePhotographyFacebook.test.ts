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

    describe('handleFacebookPhotoClick', () => {
        it('should add photo to selection on click', () => {
            const { result } = renderHook(() => usePhotographyFacebook())

            act(() => {
                result.current.handleFacebookPhotoClick('job1', 0, false)
            })

            expect(result.current.facebookSelectedOrder['job1']).toContain(0)
        })

        it('should remove photo from selection on second click', () => {
            const { result } = renderHook(() => usePhotographyFacebook())

            // Click to select
            act(() => {
                result.current.handleFacebookPhotoClick('job1', 0, false)
            })

            // Click again to deselect
            act(() => {
                result.current.handleFacebookPhotoClick('job1', 0, false)
            })

            expect(result.current.facebookSelectedOrder['job1']).not.toContain(0)
        })

        it('should select range on shift-click', () => {
            const { result } = renderHook(() => usePhotographyFacebook())

            // First click at index 0
            act(() => {
                result.current.handleFacebookPhotoClick('job1', 0, false)
            })

            // Shift-click at index 3
            act(() => {
                result.current.handleFacebookPhotoClick('job1', 3, true)
            })

            expect(result.current.facebookSelectedOrder['job1']).toEqual(
                expect.arrayContaining([0, 1, 2, 3])
            )
        })
    })

    describe('selectFirstN', () => {
        it('should select first N photos', () => {
            const { result } = renderHook(() => usePhotographyFacebook())

            act(() => {
                result.current.selectFirstN('job1', 5, 10)
            })

            expect(result.current.facebookSelectedOrder['job1']).toEqual([0, 1, 2, 3, 4])
        })

        it('should not exceed total photos', () => {
            const { result } = renderHook(() => usePhotographyFacebook())

            act(() => {
                result.current.selectFirstN('job1', 50, 3)
            })

            expect(result.current.facebookSelectedOrder['job1']).toEqual([0, 1, 2])
        })
    })

    describe('selectAll', () => {
        it('should select all photos', () => {
            const { result } = renderHook(() => usePhotographyFacebook())

            act(() => {
                result.current.selectAll('job1', 5)
            })

            expect(result.current.facebookSelectedOrder['job1']).toEqual([0, 1, 2, 3, 4])
        })
    })

    describe('selectNone', () => {
        it('should clear selection', () => {
            const { result } = renderHook(() => usePhotographyFacebook())

            // First select some
            act(() => {
                result.current.selectAll('job1', 5)
            })

            // Then clear
            act(() => {
                result.current.selectNone('job1')
            })

            expect(result.current.facebookSelectedOrder['job1']).toEqual([])
        })
    })

    describe('clearFacebookState', () => {
        it('should clear all facebook state for a job', () => {
            const { result } = renderHook(() => usePhotographyFacebook())

            // Set some state
            act(() => {
                result.current.handleFacebookToggle('job1')
                result.current.selectAll('job1', 5)
            })

            // Clear
            act(() => {
                result.current.clearFacebookState('job1')
            })

            expect(result.current.facebookEnabled['job1']).toBeUndefined()
            expect(result.current.facebookSelectedOrder['job1']).toBeUndefined()
        })
    })
})
