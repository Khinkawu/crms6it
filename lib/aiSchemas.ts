
import { z } from 'zod';

// ==========================================
// AI INTENT SCHEMAS (Zod Validation)
// ==========================================

// 1. Room Schedule & Availability
export const RoomScheduleSchema = z.object({
    room: z.string().optional().describe('Room ID (e.g., sh_leelawadee, jh_phaya)'),
    date: z.string().optional().describe('Date in "YYYY-MM-DD" or "today"/"tomorrow"'),
});

export const CheckAvailabilitySchema = z.object({
    room: z.string().describe('Room ID'),
    date: z.string().describe('Date "YYYY-MM-DD"'),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).describe('Start time HH:mm'),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).describe('End time HH:mm'),
});

// 2. Personal Work
export const MyWorkSchema = z.object({
    date: z.string().optional().describe('Optional filter date'),
});

// 3. Create Repair
export const CreateRepairSchema = z.object({
    description: z.string().describe('Description of the problem'),
    room: z.string().optional().describe('Room location if mentioned'),
});

// 4. Check Repair Status
export const CheckRepairSchema = z.object({
    ticketId: z.string().optional().describe('Ticket ID if specific'),
});

// 5. Gallery Search
export const GallerySearchSchema = z.object({
    keyword: z.string().describe('Search keyword'),
    date: z.string().optional().describe('Optional date filter'),
});

// 6. Daily Summary
export const DailySummarySchema = z.object({});

// Union Schema for all potential parameters
export const AIParamsSchema = z.union([
    RoomScheduleSchema,
    CheckAvailabilitySchema,
    MyWorkSchema,
    CreateRepairSchema,
    CheckRepairSchema,
    GallerySearchSchema,
    DailySummarySchema,
]);

// AI Response Structure
export const AIResponseSchema = z.object({
    thought: z.string().optional().describe('Reasoning process'),
    intent: z.enum([
        'CHECK_ROOM_SCHEDULE',
        'CHECK_AVAILABILITY',
        'MY_WORK',
        'CREATE_REPAIR',
        'CHECK_REPAIR',
        'GALLERY_SEARCH',
        'DAILY_SUMMARY',
        'UNKNOWN'
    ]).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    message: z.string().describe('Response message to user'),
});

export type AIResponseParsed = z.infer<typeof AIResponseSchema>;
