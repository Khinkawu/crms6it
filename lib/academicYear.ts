export const getThaiAcademicYear = (date: Date = new Date()) => {
    const month = date.getMonth(); // 0-11 (Jan=0, May=4, Oct=9, Nov=10, Apr=3)
    const year = date.getFullYear();
    const thaiYear = year + 543;

    // Academic Year Logic
    // Term 1: May (4) - Oct (9)
    // Term 2: Nov (10) - Apr (3 of next year)

    // Check if we are in Term 2 of the previous year (Jan-Apr)
    // Example: Jan 2025 -> Academic Year 2567 (started May 2024)
    let academicYear = thaiYear;
    let semester = 1;

    if (month >= 4 && month <= 9) { // May - Oct
        semester = 1;
        academicYear = thaiYear;
    } else if (month >= 10) { // Nov - Dec
        semester = 2;
        academicYear = thaiYear;
    } else { // Jan - Apr
        semester = 2;
        academicYear = thaiYear - 1; // It belongs to the previous academic year
    }

    return { academicYear, semester };
};

export const getThaiMonthName = (date: Date = new Date()) => {
    return date.toLocaleDateString('th-TH', { month: 'long' });
};

export const getThaiMonthNumber = (date: Date = new Date()) => {
    return (date.getMonth() + 1).toString().padStart(2, '0');
};
