import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import moment from 'moment';

// --- 1. Helper Functions ---

const getImageBase64 = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn("Logo load failed:", error);
        return "";
    }
};

// ฟังก์ชันโหลดฟอนต์แบบ Reuse ได้ (ใช้โหลดทั้งตัวหนาและตัวปกติ)
const addFontToDoc = async (doc: jsPDF, path: string, fontName: string, style: string) => {
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to fetch font: ${path}`);
        const blob = await response.blob();
        const reader = new FileReader();

        return new Promise<void>((resolve) => {
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                // ชื่อไฟล์ใน VFS ต้องไม่ซ้ำกัน เลยเอา path มาทำเป็นชื่อไฟล์จำลอง
                const vfsName = path.split('/').pop() || 'font.ttf';

                doc.addFileToVFS(vfsName, base64);
                doc.addFont(vfsName, fontName, style);
                resolve();
            };
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error(`Error loading font ${path}:`, error);
    }
};

// --- 2. Interface ---
export interface ReportData {
    ticketId: string;
    reportDate: string;
    requester: string;
    items: {
        requestDate: string;
        requesterName: string;
        code: string;
        name: string;
        zone: string;
        status: string;
    }[];
}

// --- 3. Main Function ---

export const generateStockReport = async (
    data: ReportData,
    action: 'download' | 'print' = 'download'
) => {
    const doc = new jsPDF();
    const fontName = 'THSarabunIT9';

    // A. โหลด Assets (Font ปกติ + Font หนา + Logo)
    await Promise.all([
        addFontToDoc(doc, '/font/THSarabunIT9.ttf', fontName, 'normal'),      // โหลดตัวปกติ
        addFontToDoc(doc, '/font/THSarabunIT9 Bold.ttf', fontName, 'bold'),   // โหลดตัวหนา (ชื่อไฟล์ต้องเป๊ะตามใน folder)
    ]);

    const logoBase64 = await getImageBase64('/logo_2.png');

    // ตั้งค่าฟอนต์เริ่มต้นเป็นตัวปกติ
    doc.setFont(fontName, 'normal');

    // B. Define Template (Header)
    const drawHeader = (doc: jsPDF) => {
        const width = doc.internal.pageSize.width;

        // Logo
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 15, 10, 20, 20);
        }

        // Header Text
        doc.setTextColor(0, 0, 0);

        // ✅ ชื่อโรงเรียน (เปลี่ยนให้แล้วครับ)
        doc.setFont(fontName, 'bold'); // ใช้ตัวหนาสำหรับชื่อโรงเรียน
        doc.setFontSize(22);
        doc.text("โรงเรียนเทศบาล 6 นครเชียงราย", 40, 18);

        // ชื่อรายงาน
        doc.setFont(fontName, 'normal'); // กลับมาใช้ตัวปกติ
        doc.setFontSize(16);
        doc.text("รายงานสรุปการแจ้งซ่อม (Repair Report)", 40, 25);

        // Info Text (มุมขวาบน)
        doc.setFontSize(14);
        doc.text(`วันที่พิมพ์: ${data.reportDate}`, width - 15, 18, { align: 'right' });
        doc.text(`ผู้พิมพ์: ${data.requester}`, width - 15, 25, { align: 'right' });

        // เส้นขีดคั่น
        doc.setDrawColor(200, 200, 200);
        doc.line(15, 35, width - 15, 35);
    };

    // C. Data Preparation
    // C. Data Preparation
    const tableColumn = ["ลำดับ", "วัน/เวลาแจ้ง", "ผู้แจ้ง", "ปัญหา / อาการ", "สถานที่", "สถานะ"];

    const tableRows = data.items.map((item, index) => [
        index + 1,
        item.requestDate,
        item.requesterName,
        item.name,
        item.zone,
        item.status
    ]);

    // D. Generate Table
    autoTable(doc, {
        startY: 40,
        head: [tableColumn],
        body: tableRows,
        styles: {
            font: fontName,
            fontStyle: 'normal',  // เนื้อหาในตารางใช้ตัวปกติ
            fontSize: 13,
            cellPadding: 2,
            valign: 'middle',
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
        },
        headStyles: {
            font: fontName,
            fontStyle: 'bold',    // ✅ ใช้ตัวหนาสำหรับหัวข้อ (Bold) ได้จริงแล้ว!
            fillColor: [23, 37, 84],
            textColor: [255, 255, 255],
            halign: 'center',
            valign: 'middle',
            fontSize: 14
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },    // ลำดับ
            1: { halign: 'center', cellWidth: 25 },    // วัน/เวลา
            2: { cellWidth: 30 },                      // ผู้แจ้ง
            3: { cellWidth: 'auto' },                  // ปัญหา
            4: { cellWidth: 30 },                      // สถานที่
            5: { halign: 'center', cellWidth: 25 }     // สถานะ
        },
        // Hook: วาด Header ทุกหน้า
        didDrawPage: (data) => {
            drawHeader(doc);
            // Footer
            const pageCount = data.pageNumber;
            doc.setFont(fontName, 'normal');
            doc.setFontSize(10);
            doc.text(`หน้า ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
        },
        margin: { top: 40 }
    });

    // E. Final Action
    if (action === 'print') {
        doc.autoPrint();
        const blob = doc.output('bloburl');
        window.open(blob, '_blank');
    } else {
        doc.save(`RepairReport_${moment().format('YYYYMMDD_HHmm')}.pdf`);
    }
};

// --- 4. Inventory Log Report Function ---
export const generateInventoryLogReport = async (
    logs: any[], // Type ActivityLog[] but using any for simplicity to avoid import cycles if strictly defining types isn't easy here
    action: 'download' | 'print' = 'download'
) => {
    const doc = new jsPDF();
    const fontName = 'THSarabunIT9';

    // A. โหลด Assets
    await Promise.all([
        addFontToDoc(doc, '/font/THSarabunIT9.ttf', fontName, 'normal'),
        addFontToDoc(doc, '/font/THSarabunIT9 Bold.ttf', fontName, 'bold'),
    ]);

    const logoBase64 = await getImageBase64('/logo_2.png');
    doc.setFont(fontName, 'normal');

    // B. Header Helper
    const drawHeader = (doc: jsPDF, pageNumber: number) => {
        const width = doc.internal.pageSize.width;
        if (logoBase64) doc.addImage(logoBase64, 'PNG', 15, 10, 20, 20);

        doc.setTextColor(0, 0, 0);
        doc.setFont(fontName, 'bold');
        doc.setFontSize(22);
        doc.text("โรงเรียนเทศบาล 6 นครเชียงราย", 40, 18);

        doc.setFont(fontName, 'normal');
        doc.setFontSize(16);
        doc.text("รายงานประวัติการใช้งานวัสดุ (Inventory Log Report)", 40, 25);

        doc.setFontSize(14);
        doc.text(`วันที่พิมพ์: ${moment().add(543, 'years').format('D MMMM YYYY')}`, width - 15, 18, { align: 'right' });
        doc.text(`พิมพ์โดย: Admin System`, width - 15, 25, { align: 'right' });

        doc.setDrawColor(200, 200, 200);
        doc.line(15, 35, width - 15, 35);
    };

    // C. Data Prep
    const tableColumn = ["ว/ด/ป", "กิจกรรม", "รายการ", "ผู้ดำเนินการ", "รายละเอียด", "ลายเซ็น"];
    const tableRows = await Promise.all(logs.map(async (log) => {
        // Fetch signature if exists
        let signatureImage = '';
        if (log.signatureUrl) {
            signatureImage = await getImageBase64(log.signatureUrl);
        }

        return [
            log.timestamp?.toDate ? moment(log.timestamp.toDate()).add(543, 'years').format('DD/MM/YY HH:mm') : '-',
            getThaiAction(log.action),
            log.productName || '-',
            log.userName || '-',
            log.details || '-',
            signatureImage // Pass base64 image or empty string
        ];
    }));

    // D. Table
    autoTable(doc, {
        startY: 40,
        head: [tableColumn],
        body: tableRows,
        styles: {
            font: fontName,
            fontStyle: 'normal',
            fontSize: 12,
            cellPadding: 2,
            valign: 'middle',
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
        },
        headStyles: {
            font: fontName,
            fontStyle: 'bold',
            fillColor: [23, 37, 84],
            textColor: [255, 255, 255],
            halign: 'center',
            valign: 'middle',
            fontSize: 14
        },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 20 },
            2: { cellWidth: 35 },
            3: { cellWidth: 30 },
            4: { cellWidth: 'auto' },
            5: { cellWidth: 25, minCellHeight: 15, halign: 'center' }
        },
        didDrawCell: (data) => {
            // Check if column 5 (signature) and if content is image string
            if (data.column.index === 5 && data.cell.raw && typeof data.cell.raw === 'string' && data.cell.raw.startsWith('data:image')) {
                const dim = data.cell.height - 4;
                const textPos = data.cell.getTextPos();
                // Draw image instead of text
                doc.addImage(data.cell.raw, 'PNG', data.cell.x + 2, data.cell.y + 2, dim * 2, dim);
            }
        },
        didParseCell: (data) => {
            // Clean content for image cell to avoid printing text "data:image..."
            if (data.column.index === 5 && typeof data.cell.raw === 'string' && data.cell.raw.startsWith('data:image')) {
                data.cell.text = []; // Clear text
            } else if (data.column.index === 5) {
                data.cell.text = ['-'];
            }
        },
        didDrawPage: (data) => {
            drawHeader(doc, data.pageNumber);
            const pageCount = doc.internal.getNumberOfPages(); // Update page count properly
            doc.setFont(fontName, 'normal');
            doc.setFontSize(10);
            doc.text(`หน้า ${data.pageNumber}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
        },
        margin: { top: 40 }
    });

    // E. Final Action
    if (action === 'print') {
        doc.autoPrint();
        const blob = doc.output('bloburl');
        window.open(blob, '_blank');
    } else {
        doc.save(`InventoryLog_${moment().format('YYYYMMDD_HHmm')}.pdf`);
    }
};

// Helper for Thai Action Log
const getThaiAction = (action: string) => {
    switch (action) {
        case 'borrow': return 'ยืม';
        case 'return': return 'คืน';
        case 'requisition': return 'เบิก';
        case 'repair': return 'แจ้งซ่อม';
        case 'add': return 'เพิ่ม';
        case 'create': return 'สร้าง';
        case 'update': return 'แก้ไข';
        case 'delete': return 'ลบ';
        default: return action;
    }
};

// --- 5. Photography Job Report Function ---
export const generatePhotographyJobReport = async (
    jobs: any[],
    action: 'download' | 'print' = 'download'
) => {
    const doc = new jsPDF();
    const fontName = 'THSarabunIT9';

    // A. โหลด Assets
    await Promise.all([
        addFontToDoc(doc, '/font/THSarabunIT9.ttf', fontName, 'normal'),
        addFontToDoc(doc, '/font/THSarabunIT9 Bold.ttf', fontName, 'bold'),
    ]);

    const logoBase64 = await getImageBase64('/logo_2.png');
    doc.setFont(fontName, 'normal');

    // B. Header Helper
    const drawHeader = (doc: jsPDF) => {
        const width = doc.internal.pageSize.width;
        if (logoBase64) doc.addImage(logoBase64, 'PNG', 15, 10, 20, 20);

        doc.setTextColor(0, 0, 0);
        doc.setFont(fontName, 'bold');
        doc.setFontSize(22);
        doc.text("โรงเรียนเทศบาล 6 นครเชียงราย", 40, 18);

        doc.setFont(fontName, 'normal');
        doc.setFontSize(16);
        doc.text("รายงานประวัติงานถ่ายภาพ (Photography Job Report)", 40, 25);

        doc.setFontSize(14);
        doc.text(`วันที่พิมพ์: ${moment().add(543, 'years').format('D MMMM YYYY')}`, width - 15, 18, { align: 'right' });

        doc.setDrawColor(200, 200, 200);
        doc.line(15, 35, width - 15, 35);
    };

    // C. Data Prep
    const getThaiStatus = (status: string) => {
        switch (status) {
            case 'assigned': return 'รอส่งงาน';
            case 'completed': return 'เสร็จสิ้น';
            case 'cancelled': return 'ยกเลิก';
            default: return status;
        }
    };

    const tableColumn = ["ลำดับ", "ชื่องาน", "สถานที่", "วัน/เวลา", "สถานะ", "ช่างภาพ"];
    const tableRows = jobs.map((job, index) => {
        const dateObj = job.startTime?.toDate ? job.startTime.toDate() : new Date(job.startTime);
        const thaiDate = moment(dateObj).add(543, 'years').format('DD/MM/YY HH:mm');

        return [
            index + 1,
            job.title || '-',
            job.location || '-',
            thaiDate,
            getThaiStatus(job.status),
            job.assigneeNames?.join(', ') || '-'
        ];
    });

    // D. Table
    autoTable(doc, {
        startY: 40,
        head: [tableColumn],
        body: tableRows,
        styles: {
            font: fontName,
            fontStyle: 'normal',
            fontSize: 12,
            cellPadding: 2,
            valign: 'middle',
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
        },
        headStyles: {
            font: fontName,
            fontStyle: 'bold',
            fillColor: [75, 0, 130], // Indigo color for photography
            textColor: [255, 255, 255],
            halign: 'center',
            valign: 'middle',
            fontSize: 14
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 12 },  // ลำดับ
            1: { cellWidth: 'auto' },                 // ชื่องาน
            2: { cellWidth: 35 },                     // สถานที่
            3: { halign: 'center', cellWidth: 25 },   // วัน/เวลา
            4: { halign: 'center', cellWidth: 22 },   // สถานะ
            5: { cellWidth: 30 }                      // ช่างภาพ
        },
        didDrawPage: (data) => {
            drawHeader(doc);
            doc.setFont(fontName, 'normal');
            doc.setFontSize(10);
            doc.text(`หน้า ${data.pageNumber}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
        },
        margin: { top: 40 }
    });

    // E. Final Action
    if (action === 'print') {
        doc.autoPrint();
        const blob = doc.output('bloburl');
        window.open(blob, '_blank');
    } else {
        doc.save(`PhotographyReport_${moment().format('YYYYMMDD_HHmm')}.pdf`);
    }
};