import * as XLSX from 'xlsx';
import { PhotographyJob } from '../types';
import { format, addYears } from 'date-fns';

const getThaiStatus = (status: string) => {
    switch (status) {
        case 'assigned': return 'รอส่งงาน';
        case 'completed': return 'เสร็จสิ้น';
        case 'cancelled': return 'ยกเลิก';
        default: return status;
    }
};

export const exportPhotographyToExcel = (data: any[], fileName: string) => {
    // Format data for Excel
    const formattedData = data.map((item, index) => {
        const isPhotoJob = item.__type === 'photography' || 'title' in item;
        let dateObj: Date;
        const dateInput = isPhotoJob ? item.startTime : item.reportDate;

        if (dateInput && typeof (dateInput as any).toDate === 'function') {
            dateObj = (dateInput as any).toDate();
        } else {
            dateObj = new Date(dateInput as any);
        }
        const thaiDate = format(addYears(dateObj, 543), 'dd/MM/yy HH:mm');

        return {
            'ลำดับ': index + 1,
            'ประเภท': isPhotoJob ? 'งานถ่ายภาพ' : 'รายงานรายวัน',
            'ชื่องาน / รายละเอียด': isPhotoJob ? item.title || '-' : item.description || '-',
            'สถานที่': isPhotoJob ? item.location || '-' : '-',
            'วัน/เวลา': thaiDate,
            'สถานะ': isPhotoJob ? getThaiStatus(item.status) : 'รายงานแล้ว',
            'ช่างภาพ': isPhotoJob ? item.assigneeNames?.join(', ') || '-' : item.userName || '-',
            'ลิงก์ Drive': item.driveLink || '-',
        };
    });

    // Create Sheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Auto-adjust column widths
    const wscols = [
        { wch: 8 },  // ลำดับ
        { wch: 15 }, // ประเภท
        { wch: 35 }, // ชื่องาน/รายละเอียด
        { wch: 25 }, // สถานที่
        { wch: 18 }, // วัน/เวลา
        { wch: 12 }, // สถานะ
        { wch: 20 }, // ช่างภาพ
        { wch: 40 }, // ลิงก์ Drive
    ];
    worksheet['!cols'] = wscols;

    // Create Workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Jobs and Reports");

    // Generate Buffer & Download
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
