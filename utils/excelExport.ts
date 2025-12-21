
import * as XLSX from 'xlsx';
import { RepairTicket } from '../types';
import moment from 'moment';

// Helper: แปลง Zone เป็นภาษาไทย (Duplicate Logic from RepairActionsBar to ensure consistency)
const getZoneThai = (zone: string) => {
    switch (zone) {
        case 'senior_high': return 'ม.ปลาย';
        case 'junior_high': return 'ม.ต้น';
        case 'common': return 'ส่วนกลาง';
        case 'elementary': return 'ประถม';
        case 'kindergarten': return 'อนุบาล';
        case 'auditorium': return 'หอประชุม';
        default: return zone;
    }
};

const getThaiStatus = (s: string) => {
    switch (s?.toLowerCase()) {
        case 'pending': return 'รอดำเนินการ';
        case 'in_progress':
        case 'inprogress': return 'กำลังดำเนินการ';
        case 'waiting_parts':
        case 'waiting-parts':
        case 'waitingparts': return 'รออะไหล่';
        case 'completed': return 'เสร็จสิ้น';
        case 'cancelled':
        case 'canceled': return 'ยกเลิกงาน';
        default: return s;
    }
};

export const exportToExcel = (data: RepairTicket[], fileName: string) => {
    // 1. Format data for Excel to match PDF Structure
    // Columns: ["ลำดับ", "วัน/เวลาแจ้ง", "ผู้แจ้ง", "ปัญหา / อาการ", "สถานที่", "สถานะ"]
    const formattedData = data.map((ticket, index) => {
        // Prepare Date
        let dateObj: Date;
        if (ticket.createdAt && typeof (ticket.createdAt as any).toDate === 'function') {
            dateObj = (ticket.createdAt as any).toDate();
        } else {
            dateObj = new Date(ticket.createdAt as any);
        }
        const thaiDate = moment(dateObj).add(543, 'years').format('DD/MM/YY HH:mm');

        // Prepare Location
        const zoneThai = getZoneThai(ticket.zone || '');
        const locationDisplay = ticket.room ? `${ticket.room} (${zoneThai})` : zoneThai;

        return {
            'ลำดับ': index + 1,
            'วัน/เวลาแจ้ง': thaiDate,
            'ผู้แจ้ง': ticket.requesterName || '-',
            'ปัญหา / อาการ': ticket.description || '-',
            'สถานที่': locationDisplay,
            'สถานะ': getThaiStatus(ticket.status)
        };
    });

    // 2. Create Sheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // 3. Auto-adjust column widths
    const wscols = [
        { wch: 8 },  // ลำดับ
        { wch: 18 }, // วัน/เวลาแจ้ง
        { wch: 20 }, // ผู้แจ้ง
        { wch: 40 }, // ปัญหา / อาการ
        { wch: 25 }, // สถานที่
        { wch: 15 }  // สถานะ
    ];
    worksheet['!cols'] = wscols;

    // 4. Create Workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Repair Report");

    // 5. Generate Buffer & Download
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
