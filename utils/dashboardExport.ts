import { DashboardStats, PersonStat } from "@/hooks/useDashboardStats";

/**
 * Export dashboard stats to Excel-compatible CSV (no external library needed)
 */
export function exportDashboardToExcel(
    stats: DashboardStats,
    personStats: PersonStat[],
    exporterName: string
) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    let csv = '\uFEFF'; // UTF-8 BOM for Thai characters
    csv += `สถิติภาพรวมระบบ CRMS6 IT\n`;
    csv += `วันที่ส่งออก: ${dateStr}\n`;
    csv += `ผู้ส่งออก: ${exporterName}\n\n`;

    // Summary
    csv += `--- สรุปภาพรวม ---\n`;
    csv += `หัวข้อ,จำนวน\n`;
    csv += `งานซ่อม - รอดำเนินการ,${stats.repairs.pending}\n`;
    csv += `งานซ่อม - กำลังดำเนินการ,${stats.repairs.in_progress}\n`;
    csv += `งานซ่อม - รออะไหล่,${stats.repairs.waiting_parts}\n`;
    csv += `งานซ่อม - เสร็จสิ้น,${stats.repairs.completed}\n`;
    csv += `งานซ่อม - ทั้งหมด,${stats.repairs.total}\n`;
    csv += `การจอง - รออนุมัติ,${stats.bookings.pending}\n`;
    csv += `การจอง - อนุมัติแล้ว,${stats.bookings.approved}\n`;
    csv += `การจอง - ทั้งหมด,${stats.bookings.total}\n`;
    csv += `อุปกรณ์ - ใกล้หมด,${stats.inventory.lowStock}\n`;
    csv += `ผู้ใช้งาน - ทั้งหมด,${stats.users.total}\n\n`;

    // Per-person
    if (personStats.length > 0) {
        csv += `--- สถิติรายบุคคล ---\n`;
        csv += `ชื่อ,รอ,กำลังดำเนินการ,เสร็จสิ้น,รวม\n`;
        personStats.forEach(p => {
            csv += `${p.name},${p.pending},${p.in_progress},${p.completed},${p.total}\n`;
        });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `CRMS6_Stats_${now.toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

/**
 * Print dashboard stats as PDF using browser print
 */
export function printDashboardStats(
    stats: DashboardStats,
    personStats: PersonStat[],
    printerName: string
) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>รายงานสถิติ CRMS6 IT</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Sarabun', sans-serif; padding: 40px; color: #1e293b; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #0e4b8a; padding-bottom: 16px; }
        .header h1 { font-size: 24px; color: #0e4b8a; }
        .header p { font-size: 14px; color: #64748b; margin-top: 4px; }
        .meta { display: flex; justify-content: space-between; font-size: 13px; color: #64748b; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #0e4b8a; color: white; padding: 10px 12px; text-align: left; font-size: 13px; }
        td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        tr:nth-child(even) { background: #f8fafc; }
        .section-title { font-size: 16px; font-weight: 700; color: #0e4b8a; margin: 20px 0 10px; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .stat-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
        .stat-box .value { font-size: 28px; font-weight: 700; }
        .stat-box .label { font-size: 12px; color: #64748b; margin-top: 4px; }
        .pending { color: #f59e0b; }
        .progress { color: #3b82f6; }
        .completed { color: #10b981; }
        @media print {
            body { padding: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 รายงานสถิติภาพรวมระบบ</h1>
        <p>ระบบแจ้งซ่อมและจัดการทรัพยากร CRMS6 IT</p>
    </div>
    <div class="meta">
        <span>📅 วันที่: ${dateStr}</span>
        <span>👤 ผู้พิมพ์: ${printerName}</span>
    </div>

    <div class="section-title">📋 สรุปงานซ่อม</div>
    <div class="stats-grid">
        <div class="stat-box">
            <div class="value pending">${stats.repairs.pending}</div>
            <div class="label">รอดำเนินการ</div>
        </div>
        <div class="stat-box">
            <div class="value progress">${stats.repairs.in_progress}</div>
            <div class="label">กำลังดำเนินการ</div>
        </div>
        <div class="stat-box">
            <div class="value completed">${stats.repairs.completed}</div>
            <div class="label">เสร็จสิ้น</div>
        </div>
    </div>

    <div class="section-title">📅 การจอง</div>
    <table>
        <tr><th>สถานะ</th><th>จำนวน</th></tr>
        <tr><td>รออนุมัติ</td><td>${stats.bookings.pending}</td></tr>
        <tr><td>อนุมัติแล้ว</td><td>${stats.bookings.approved}</td></tr>
        <tr><td>ทั้งหมด</td><td>${stats.bookings.total}</td></tr>
    </table>

    ${personStats.length > 0 ? `
    <div class="section-title">👷 สถิติรายบุคคล</div>
    <table>
        <tr><th>ชื่อ</th><th>รอ</th><th>กำลังทำ</th><th>เสร็จ</th><th>รวม</th></tr>
        ${personStats.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.pending}</td>
            <td>${p.in_progress}</td>
            <td>${p.completed}</td>
            <td>${p.total}</td>
        </tr>`).join('')}
    </table>` : ''}

    <script>window.onload = () => window.print();</script>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
    }
}
