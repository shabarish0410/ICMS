import type {
  DailyAttendanceRow,
  MonthlyAttendanceRow,
  MonthlyReportResponse,
  DailyReportResponse,
  SubjectAttendanceSummary,
} from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitize(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/"/g, '""');
}

function csvRow(cells: unknown[]): string {
  return cells.map((c) => `"${sanitize(c)}"`).join(',');
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── CSV: Daily Report ────────────────────────────────────────────────────────

export function exportDailyReportCSV(
  report: DailyReportResponse,
  filters: { section?: string; subject?: string }
) {
  const header = csvRow([
    'Student ID', 'IC Number', 'Student Name', 'Section', 'Subject',
    'Date', 'Session ID', 'Status', 'Present Time (IST)',
  ]);

  const dataRows = report.rows.map((row) =>
    csvRow([
      row.student_id,
      row.ic_number,
      row.student_name,
      row.section,
      row.subject_name,
      row.date_display,
      row.session_id,
      row.status,
      row.present_time || '--',
    ])
  );

  const csv = [header, ...dataRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const section = filters.section ? `_${filters.section}` : '';
  const subject = filters.subject ? `_${filters.subject}` : '';
  downloadBlob(blob, `ICMS_Daily_Attendance${section}${subject}_${report.date}.csv`);
}

// ─── CSV: Monthly Report ─────────────────────────────────────────────────────

export function exportMonthlyReportCSV(report: MonthlyReportResponse) {
  const { active_dates, rows, month, year, section, subject } = report;
  const monthName = MONTH_NAMES[month];

  // Header row: Student | IC Number | Section | 01-Aug | 02-Aug | ... | Present | Absent | % 
  const dateHeaders = active_dates.map((d) => {
    const [y, m, day] = d.split('-');
    const dt = new Date(Number(y), Number(m) - 1, Number(day));
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  });

  const header = csvRow([
    'Student Name', 'IC Number', 'Section',
    ...dateHeaders,
    'Present', 'Absent', 'Total Sessions', 'Percentage',
  ]);

  const dataRows = rows.map((row) => {
    const dayCells = active_dates.map((d) => {
      const cell = row.days[d];
      if (!cell) return '--';
      if (cell.status === 'NO_SESSION') return '--';
      if (cell.status === 'PRESENT') return 'P';
      if (cell.status === 'ABSENT') return 'A';
      return 'P/A';
    });
    return csvRow([
      row.student_name,
      row.ic_number,
      row.section,
      ...dayCells,
      row.present,
      row.absent,
      row.applicable_sessions,
      `${row.percentage.toFixed(2)}%`,
    ]);
  });

  const csv = [header, ...dataRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const sec = section ? `_${section}` : '';
  const sub = subject ? `_${subject}` : '';
  downloadBlob(blob, `ICMS_Attendance${sec}${sub}_${monthName}_${year}.csv`);
}

// ─── Excel: Monthly Report ────────────────────────────────────────────────────

export async function exportMonthlyReportExcel(
  report: MonthlyReportResponse,
  subjects: SubjectAttendanceSummary[]
) {
  const XLSX = await import('xlsx');
  const { active_dates, rows, month, year, section, subject, summary, sessions_by_date } = report;
  const monthName = MONTH_NAMES[month];

  // ── Sheet 1: Monthly Attendance Matrix ────────────────────────────────────
  const dateHeaders = active_dates.map((d) => {
    const [y, m, day] = d.split('-');
    const dt = new Date(Number(y), Number(m) - 1, Number(day));
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  });

  const matrixHeader = [
    'Student Name', 'IC Number', 'Section',
    ...dateHeaders,
    'Present', 'Absent', 'Total Sessions', 'Percentage',
  ];

  const matrixRows = rows.map((row) => {
    const dayCells = active_dates.map((d) => {
      const cell = row.days[d];
      if (!cell || cell.status === 'NO_SESSION') return '--';
      if (cell.status === 'PRESENT') return `P${cell.present_time ? ` ${cell.present_time}` : ''}`;
      if (cell.status === 'ABSENT') return 'A';
      return 'P/A';
    });
    return [
      row.student_name,
      row.ic_number,
      row.section,
      ...dayCells,
      row.present,
      row.absent,
      row.applicable_sessions,
      `${row.percentage.toFixed(2)}%`,
    ];
  });

  const matrixData = [matrixHeader, ...matrixRows];

  // ── Sheet 2: Summary ──────────────────────────────────────────────────────
  const summaryData = [
    ['Report', `${monthName} ${year} Attendance Report`],
    ['Section', section || 'All'],
    ['Subject', subject || 'All'],
    ['Generated At', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
    [],
    ['Metric', 'Value'],
    ['Total Students', summary.total_students],
    ['Total Sessions', summary.total_sessions],
    ['Total Present Records', summary.total_present],
    ['Total Absent Records', summary.total_absent],
    ['Average Attendance %', `${summary.avg_percentage.toFixed(2)}%`],
    [],
    ['Student Summary', '', '', ''],
    ['Student Name', 'IC Number', 'Present', 'Absent', 'Total Sessions', 'Percentage'],
    ...rows.map((r) => [
      r.student_name, r.ic_number, r.present, r.absent, r.applicable_sessions,
      `${r.percentage.toFixed(2)}%`,
    ]),
  ];

  // ── Sheet 3: Session Details ──────────────────────────────────────────────
  const sessionRows: unknown[][] = [
    ['Date', 'Subject', 'Section', 'Session ID', 'Student Name', 'IC Number', 'Status', 'Present Time (IST)'],
  ];

  for (const d of active_dates) {
    const daySessions = sessions_by_date[d] || [];
    for (const sess of daySessions) {
      for (const row of rows) {
        const cell = row.days[d];
        if (!cell) continue;
        const sessCell = cell.sessions.find((s) => s.session_id === sess.id);
        if (!sessCell) continue;
        const [y, m, day] = d.split('-');
        const dt = new Date(Number(y), Number(m) - 1, Number(day));
        const dateDisplay = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        sessionRows.push([
          dateDisplay,
          sess.subject_name,
          sess.section || '',
          sess.id,
          row.student_name,
          row.ic_number,
          sessCell.status,
          sessCell.present_time || '--',
        ]);
      }
    }
  }

  // ── Subject Summary Sheet ─────────────────────────────────────────────────
  const subjectData = [
    ['Subject', 'Present', 'Absent', 'Total Sessions', 'Attendance %'],
    ...subjects.map((s) => [s.subject, s.present, s.absent, s.total, `${s.percentage.toFixed(2)}%`]),
  ];

  // ── Build workbook ────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet(matrixData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Monthly Attendance');

  const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  const ws3 = XLSX.utils.aoa_to_sheet(sessionRows);
  XLSX.utils.book_append_sheet(wb, ws3, 'Session Details');

  const ws4 = XLSX.utils.aoa_to_sheet(subjectData);
  XLSX.utils.book_append_sheet(wb, ws4, 'Subject Summary');

  const sec = section ? `_${section}` : '';
  const sub = subject ? `_${subject}` : '';
  const filename = `ICMS_Attendance${sec}${sub}_${monthName}_${year}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ─── Excel: Daily Report ──────────────────────────────────────────────────────

export async function exportDailyReportExcel(report: DailyReportResponse) {
  const XLSX = await import('xlsx');

  const header = [
    'Student ID', 'IC Number', 'Student Name', 'Section', 'Subject',
    'Date', 'Session ID', 'Status', 'Present Time (IST)',
  ];

  const dataRows = report.rows.map((row) => [
    row.student_id,
    row.ic_number,
    row.student_name,
    row.section,
    row.subject_name,
    row.date_display,
    row.session_id,
    row.status,
    row.present_time || '--',
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Daily Attendance');

  XLSX.writeFile(wb, `ICMS_Daily_Attendance_${report.date}.xlsx`);
}
