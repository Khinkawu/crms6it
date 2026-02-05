// Booking Configuration - Room, Equipment, and Form Constants
// Extracted from BookingForm.tsx for reusability

export interface RoomInfo {
    id: string;
    name: string;
}

export interface RoomZones {
    junior_high: RoomInfo[];
    senior_high: RoomInfo[];
}

export const ROOMS: RoomZones = {
    junior_high: [
        { id: "jh_phaya", name: "ห้องพญาสัตบรรณ" },
        { id: "jh_gym", name: "โรงยิม" },
        { id: "jh_chamchuri", name: "ห้องจามจุรี" },
    ],
    senior_high: [
        { id: "sh_leelawadee", name: "ห้องลีลาวดี" },
        { id: "sh_auditorium", name: "หอประชุม" },
        { id: "sh_king_science", name: "ห้องศาสตร์พระราชา" },
        { id: "sh_language_center", name: "ห้องศูนย์ภาษา" },
        { id: "sh_admin_3", name: "ชั้น 3 อาคารอำนวยการ" },
    ]
};

// Map roomId to available equipment
export const ROOM_EQUIPMENT: Record<string, string[]> = {
    // Junior High
    jh_phaya: ["จอ LED", "ไมค์ลอย", "Pointer"],
    jh_gym: ["จอ Projector", "Projector", "ไมค์ลอย", "Pointer"],
    jh_chamchuri: ["จอ TV", "ไมค์ลอย", "Pointer"],

    // Senior High
    sh_leelawadee: ["จอ LED", "จอ TV", "ไมค์ก้าน", "ไมค์ลอย", "Pointer"],
    sh_auditorium: ["จอ LED", "ไมค์ลอย", "Pointer"],
    sh_king_science: ["จอ TV", "ไมค์ลอย", "ไมค์ก้าน", "Pointer"],
    sh_language_center: ["จอ TV", "ไมค์ลอย", "ไมค์ก้าน", "Pointer"],
    sh_admin_3: ["จอ Projector", "Projector", "ไมค์สาย", "Pointer"],
};

export const POSITIONS = ["ผู้บริหาร", "ครู", "ครู LS", "บุคลากร", "เลขานุการ"];

export const DEPARTMENTS = [
    "ฝ่ายงานวิชาการ",
    "ฝ่ายกิจการนักเรียน",
    "ฝ่ายงานบุคลากร",
    "ฝ่ายบริหารงานทั่วไป",
    "ฝ่ายแผนงานและงบประมาณ",
    "หน่วยงานภายนอก"
];

export const ROOM_LAYOUTS = [
    { id: 'u_shape', label: 'จัดโต๊ะรูปแบบตัว U' },
    { id: 'classroom', label: 'จัดโต๊ะแถวหน้ากระดาน' },
    { id: 'empty', label: 'ไม่ต้องการโต๊ะ - เก้าอี้' },
    { id: 'other', label: 'รูปแบบอื่น ๆ' },
];

// Helper functions
export function getRoomById(roomId: string): RoomInfo | undefined {
    const allRooms = [...ROOMS.junior_high, ...ROOMS.senior_high];
    return allRooms.find(r => r.id === roomId);
}

export function getEquipmentForRoom(roomId: string): string[] {
    return ROOM_EQUIPMENT[roomId] || [];
}
