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