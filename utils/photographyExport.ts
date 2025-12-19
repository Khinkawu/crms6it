import * as XLSX from 'xlsx';
import { PhotographyJob } from '../types';
import moment from 'moment';

const getThaiStatus = (status: string) => {
    switch (status) {
        case 'assigned': return 'รอส่งงาน';
        case 'completed': return 'เสร็จสิ้น';
        case 'cancelled': return 'ยกเลิก';
        default: return status;
    }
};

export const exportPhotographyToExcel = (data: PhotographyJob[], fileName: string) => {
    // Format data for Excel
    const formattedData = data.map((job, index) => {
        // Prepare Date
        let dateObj: Date;
        if (job.startTime && typeof (job.startTime as any).toDate === 'function') {
            dateObj = (job.startTime as any).toDate();
        } else {
            dateObj = new Date(job.startTime as any);
        }
        const thaiDate = moment(dateObj).add(543, 'years').format('DD/MM/YY HH:mm');

        return {
            'ลำดับ': index + 1,
            'ชื่องาน': job.title || '-',
            'สถานที่': job.location || '-',
            'วัน/เวลา': thaiDate,
            'สถานะ': getThaiStatus(job.status),
            'ช่างภาพ': job.assigneeNames?.join(', ') || '-',
            'ลิงก์ Drive': job.driveLink || '-',
        };
    });

    // Create Sheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Auto-adjust column widths
    const wscols = [
        { wch: 8 },  // ลำดับ
        { wch: 35 }, // ชื่องาน
        { wch: 25 }, // สถานที่
        { wch: 18 }, // วัน/เวลา
        { wch: 12 }, // สถานะ
        { wch: 20 }, // ช่างภาพ
        { wch: 40 }, // ลิงก์ Drive
    ];
    worksheet['!cols'] = wscols;

    // Create Workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Photography Jobs");

    // Generate Buffer & Download
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
