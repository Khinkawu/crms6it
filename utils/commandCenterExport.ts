import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, addYears } from "date-fns";
import { th } from "date-fns/locale";
import type {
    CommandCenterSummary,
    StaffRepairKPI,
    StaffFacilityKPI,
    StaffPhotoKPI,
    StaffBorrowKPI,
    CommandDateRange,
    ModuleFilter,
} from "@/hooks/useCommandCenter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buddhistDate(d: Date) {
    return format(addYears(d, 543), "dd/MM/yyyy", { locale: th });
}

function buddhistDateRange(range: CommandDateRange) {
    return `${buddhistDate(range.start)} ถึง ${buddhistDate(range.end)}`;
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

export function exportCommandCenterToExcel(params: {
    summary: CommandCenterSummary;
    repairKPIs: StaffRepairKPI[];
    facilityKPIs: StaffFacilityKPI[];
    photoKPIs: StaffPhotoKPI[];
    borrowKPIs: StaffBorrowKPI[];
    dateRange: CommandDateRange;
    exporterName: string;
    module: ModuleFilter;
}) {
    const { summary, repairKPIs, facilityKPIs, photoKPIs, borrowKPIs, dateRange, exporterName, module } = params;
    const wb = XLSX.utils.book_new();
    const rangeStr = buddhistDateRange(dateRange);
    const exportedAt = buddhistDate(new Date());

    // ── Sheet 1: สรุปภาพรวม ──────────────────────────────────────────────────
    if (module === "all" || module === "repair") {
        const summaryRows = [
            ["รายงาน Command Center", "", "", "", ""],
            [`ช่วงเวลา: ${rangeStr}`, "", "", "", ""],
            [`ส่งออกโดย: ${exporterName}  |  วันที่: ${exportedAt}`, "", "", "", ""],
            [],
            ["=== สรุปงานแจ้งซ่อมโสตทัศนศึกษา ==="],
            ["รวมทั้งหมด", "รอดำเนินการ", "กำลังดำเนินการ", "รออะไหล่", "เสร็จสิ้น", "อัตราความสำเร็จ"],
            [
                summary.repair.total,
                summary.repair.pending,
                summary.repair.inProgress,
                summary.repair.waitingParts,
                summary.repair.completed,
                `${summary.repair.resolutionRate}%`,
            ],
            [],
        ];

        if (repairKPIs.length > 0) {
            summaryRows.push(["=== KPI รายช่างโสต ===" as any]);
            summaryRows.push(["ชื่อช่าง", "รวม", "รอ", "กำลังทำ", "รออะไหล่", "เสร็จ", "เวลาเฉลี่ย (ชม.)"] as any);
            repairKPIs.filter(r => r.technicianId !== "__unassigned__").forEach(r => {
                summaryRows.push([
                    r.technicianName,
                    r.total,
                    r.pending,
                    r.inProgress,
                    r.waitingParts,
                    r.completed,
                    r.avgHoursToComplete !== null ? r.avgHoursToComplete : "-",
                ] as any);
            });
        }

        const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
        ws1["!cols"] = [{ wch: 25 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, ws1, "ซ่อมโสต");
    }

    if (module === "all" || module === "facility") {
        const facilityRows: any[][] = [
            ["=== สรุปงานซ่อมอาคาร ==="],
            ["ช่วงเวลา", rangeStr],
            [],
            ["รวมทั้งหมด", "รอดำเนินการ", "กำลังดำเนินการ", "เสร็จสิ้น", "เร่งด่วนค้าง"],
            [
                summary.facility.total,
                summary.facility.pending,
                summary.facility.inProgress,
                summary.facility.completed,
                summary.facility.urgentPending,
            ],
            [],
        ];
        if (facilityKPIs.length > 0) {
            facilityRows.push(["=== KPI รายช่างอาคาร ==="]);
            facilityRows.push(["ชื่อช่าง", "รวม", "รอ", "กำลังทำ", "เสร็จ", "เร่งด่วนค้าง"]);
            facilityKPIs.filter(r => r.technicianId !== "__unassigned__").forEach(r => {
                facilityRows.push([r.technicianName, r.total, r.pending, r.inProgress, r.completed, r.urgentPending]);
            });
        }
        const ws2 = XLSX.utils.aoa_to_sheet(facilityRows);
        ws2["!cols"] = [{ wch: 25 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws2, "ซ่อมอาคาร");
    }

    if (module === "all" || module === "photography") {
        const photoRows: any[][] = [
            ["=== สรุปงานถ่ายภาพ ==="],
            ["ช่วงเวลา", rangeStr],
            [],
            ["รวมทั้งหมด", "เสร็จสิ้น", "กำลังดำเนินการ", "รอมอบหมาย", "อัตราความสำเร็จ"],
            [
                summary.photography.total,
                summary.photography.completed,
                summary.photography.assigned,
                summary.photography.pendingAssign,
                `${summary.photography.completionRate}%`,
            ],
            [],
        ];
        if (photoKPIs.length > 0) {
            photoRows.push(["=== KPI รายช่างภาพ ==="]);
            photoRows.push(["ชื่อช่างภาพ", "รวม", "เสร็จ", "ค้าง", "อัตราเสร็จ"]);
            photoKPIs.forEach(p => {
                photoRows.push([p.name, p.total, p.completed, p.pending, `${p.completionRate}%`]);
            });
        }
        const ws3 = XLSX.utils.aoa_to_sheet(photoRows);
        ws3["!cols"] = [{ wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws3, "ถ่ายภาพ");
    }

    if (module === "all" || module === "borrow") {
        const borrowRows: any[][] = [
            ["=== สรุประบบยืมคืนเบิก ==="],
            ["ช่วงเวลา", rangeStr],
            [],
            ["รวมทั้งหมด", "ยืม", "เบิก", "เกินกำหนดคืน"],
            [summary.borrow.total, summary.borrow.borrow, summary.borrow.requisition, summary.borrow.overdue],
            [],
        ];
        if (borrowKPIs.length > 0) {
            borrowRows.push(["=== KPI รายบุคคล ==="]);
            borrowRows.push(["ชื่อ", "ยืม", "เบิก", "รวม", "เกินกำหนด"]);
            borrowKPIs.forEach(b => {
                borrowRows.push([b.name, b.borrowCount, b.requisitionCount, b.total, b.overdueCount]);
            });
        }
        const ws4 = XLSX.utils.aoa_to_sheet(borrowRows);
        ws4["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws4, "ยืมคืนเบิก");
    }

    const today = format(new Date(), "yyyyMMdd");
    XLSX.writeFile(wb, `CommandCenter_${today}.xlsx`);
}

// ─── PDF Export (HTML → jsPDF autoTable) ─────────────────────────────────────

export function exportCommandCenterToPDF(params: {
    summary: CommandCenterSummary;
    repairKPIs: StaffRepairKPI[];
    facilityKPIs: StaffFacilityKPI[];
    photoKPIs: StaffPhotoKPI[];
    borrowKPIs: StaffBorrowKPI[];
    dateRange: CommandDateRange;
    exporterName: string;
    module: ModuleFilter;
}) {
    const { summary, repairKPIs, facilityKPIs, photoKPIs, borrowKPIs, dateRange, exporterName, module } = params;
    const rangeStr = buddhistDateRange(dateRange);
    const exportedAt = buddhistDate(new Date());

    // Build HTML for print-to-PDF (handles Thai better than jsPDF font embedding)
    const sections: string[] = [];

    if (module === "all" || module === "repair") {
        const rows = repairKPIs
            .filter(r => r.technicianId !== "__unassigned__")
            .map((r, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${r.technicianName}</td>
                    <td class="num">${r.total}</td>
                    <td class="num pending">${r.pending}</td>
                    <td class="num progress">${r.inProgress}</td>
                    <td class="num warn">${r.waitingParts}</td>
                    <td class="num done">${r.completed}</td>
                    <td class="num">${r.avgHoursToComplete !== null ? `${r.avgHoursToComplete} ชม.` : "-"}</td>
                </tr>`).join("");

        sections.push(`
            <div class="section">
                <h2>งานแจ้งซ่อมโสตทัศนศึกษา</h2>
                <div class="kpi-row">
                    <div class="kpi"><span>${summary.repair.total}</span>รวมทั้งหมด</div>
                    <div class="kpi pending"><span>${summary.repair.pending}</span>รอดำเนินการ</div>
                    <div class="kpi progress"><span>${summary.repair.inProgress}</span>กำลังดำเนินการ</div>
                    <div class="kpi warn"><span>${summary.repair.waitingParts}</span>รออะไหล่</div>
                    <div class="kpi done"><span>${summary.repair.completed}</span>เสร็จสิ้น</div>
                    <div class="kpi rate"><span>${summary.repair.resolutionRate}%</span>อัตราสำเร็จ</div>
                </div>
                ${rows ? `<h3>KPI รายช่าง</h3>
                <table>
                    <thead><tr><th>#</th><th>ชื่อช่าง</th><th>รวม</th><th>รอ</th><th>กำลังทำ</th><th>รออะไหล่</th><th>เสร็จ</th><th>เวลาเฉลี่ย</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>` : ""}
            </div>`);
    }

    if (module === "all" || module === "facility") {
        const rows = facilityKPIs
            .filter(r => r.technicianId !== "__unassigned__")
            .map((r, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${r.technicianName}</td>
                    <td class="num">${r.total}</td>
                    <td class="num pending">${r.pending}</td>
                    <td class="num progress">${r.inProgress}</td>
                    <td class="num done">${r.completed}</td>
                    <td class="num">${r.urgentPending > 0 ? `<span class="badge-urgent">เร่งด่วน ${r.urgentPending}</span>` : "-"}</td>
                </tr>`).join("");

        sections.push(`
            <div class="section">
                <h2>งานซ่อมอาคาร</h2>
                <div class="kpi-row">
                    <div class="kpi"><span>${summary.facility.total}</span>รวมทั้งหมด</div>
                    <div class="kpi pending"><span>${summary.facility.pending}</span>รอดำเนินการ</div>
                    <div class="kpi progress"><span>${summary.facility.inProgress}</span>กำลังดำเนินการ</div>
                    <div class="kpi done"><span>${summary.facility.completed}</span>เสร็จสิ้น</div>
                    ${summary.facility.urgentPending > 0 ? `<div class="kpi urgent"><span>${summary.facility.urgentPending}</span>เร่งด่วนค้าง</div>` : ""}
                </div>
                ${rows ? `<h3>KPI รายช่าง</h3>
                <table>
                    <thead><tr><th>#</th><th>ชื่อช่าง</th><th>รวม</th><th>รอ</th><th>กำลังทำ</th><th>เสร็จ</th><th>เร่งด่วน</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>` : ""}
            </div>`);
    }

    if (module === "all" || module === "photography") {
        const rows = photoKPIs.map((p, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${p.name}</td>
                <td class="num">${p.total}</td>
                <td class="num done">${p.completed}</td>
                <td class="num pending">${p.pending}</td>
                <td class="num">${p.completionRate}%</td>
            </tr>`).join("");

        sections.push(`
            <div class="section">
                <h2>งานถ่ายภาพ</h2>
                <div class="kpi-row">
                    <div class="kpi"><span>${summary.photography.total}</span>รวมทั้งหมด</div>
                    <div class="kpi done"><span>${summary.photography.completed}</span>เสร็จสิ้น</div>
                    <div class="kpi progress"><span>${summary.photography.assigned}</span>กำลังดำเนินการ</div>
                    <div class="kpi pending"><span>${summary.photography.pendingAssign}</span>รอมอบหมาย</div>
                    <div class="kpi rate"><span>${summary.photography.completionRate}%</span>อัตราสำเร็จ</div>
                </div>
                ${rows ? `<h3>KPI รายช่างภาพ</h3>
                <table>
                    <thead><tr><th>#</th><th>ชื่อ</th><th>รวม</th><th>เสร็จ</th><th>ค้าง</th><th>อัตราเสร็จ</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>` : ""}
            </div>`);
    }

    if (module === "all" || module === "borrow") {
        const rows = borrowKPIs.map((b, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${b.name}</td>
                <td class="num">${b.borrowCount}</td>
                <td class="num">${b.requisitionCount}</td>
                <td class="num">${b.total}</td>
                <td class="num ${b.overdueCount > 0 ? "urgent" : ""}">${b.overdueCount > 0 ? `${b.overdueCount} รายการ` : "-"}</td>
            </tr>`).join("");

        sections.push(`
            <div class="section">
                <h2>ระบบยืมคืนเบิก</h2>
                <div class="kpi-row">
                    <div class="kpi"><span>${summary.borrow.total}</span>รวมทั้งหมด</div>
                    <div class="kpi progress"><span>${summary.borrow.borrow}</span>ยืม</div>
                    <div class="kpi"><span>${summary.borrow.requisition}</span>เบิก</div>
                    ${summary.borrow.overdue > 0 ? `<div class="kpi urgent"><span>${summary.borrow.overdue}</span>เกินกำหนด</div>` : ""}
                </div>
                ${rows ? `<h3>KPI รายบุคคล</h3>
                <table>
                    <thead><tr><th>#</th><th>ชื่อ</th><th>ยืม</th><th>เบิก</th><th>รวม</th><th>เกินกำหนด</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>` : ""}
            </div>`);
    }

    const html = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>รายงาน Command Center — CRMS6 IT</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Sarabun', sans-serif; font-size: 13px; color: #1e293b; padding: 32px; }
        .header { border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { font-size: 20px; font-weight: 700; color: #2563eb; }
        .header .meta { font-size: 12px; color: #64748b; margin-top: 6px; display: flex; gap: 24px; }
        .section { margin-bottom: 32px; page-break-inside: avoid; }
        .section h2 { font-size: 15px; font-weight: 700; color: #1e40af; margin-bottom: 12px;
            padding: 8px 12px; background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px; }
        .section h3 { font-size: 13px; font-weight: 600; color: #374151; margin: 16px 0 8px; }
        .kpi-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; margin-bottom: 16px; }
        .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
        .kpi span { display: block; font-size: 24px; font-weight: 700; }
        .kpi { font-size: 11px; color: #64748b; }
        .kpi.pending span { color: #f59e0b; }
        .kpi.progress span { color: #3b82f6; }
        .kpi.done span { color: #10b981; }
        .kpi.warn span { color: #f97316; }
        .kpi.urgent span { color: #ef4444; }
        .kpi.rate span { color: #8b5cf6; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #1e40af; color: white; padding: 8px 10px; text-align: left; font-weight: 600; }
        td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
        tr:nth-child(even) td { background: #f8fafc; }
        .num { text-align: center; }
        .pending { color: #f59e0b; font-weight: 600; }
        .progress { color: #3b82f6; font-weight: 600; }
        .done { color: #10b981; font-weight: 600; }
        .warn { color: #f97316; font-weight: 600; }
        .urgent { color: #ef4444; font-weight: 600; }
        .badge-urgent { background: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
        @media print { body { padding: 16px; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>รายงาน Command Center — CRMS6 IT</h1>
        <div class="meta">
            <span>ช่วงเวลา: ${rangeStr}</span>
            <span>ส่งออกโดย: ${exporterName}</span>
            <span>วันที่: ${exportedAt}</span>
        </div>
    </div>
    ${sections.join("")}
    <script>window.onload = () => window.print();</script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
        win.document.write(html);
        win.document.close();
    }
}

// ─── Print (same as PDF but browser handles save-as-PDF) ─────────────────────

export function printCommandCenter(params: Parameters<typeof exportCommandCenterToPDF>[0]) {
    exportCommandCenterToPDF(params);
}
