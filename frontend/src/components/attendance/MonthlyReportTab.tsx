'use client';
import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { attendanceAPI } from '@/services/api';
import type {
  MonthlyReportResponse,
  MonthlyAttendanceRow,
  MonthlyDayCell,
  SubjectAttendanceSummary,
  AttendanceStatus,
} from '@/types';
import { exportMonthlyReportCSV, exportMonthlyReportExcel } from '@/utils/attendanceExport';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

function currentMonth() {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function formatDate(dateStr: string): string {
  const [, , day] = dateStr.split('-');
  return day; // Just the day number for compact header
}

function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ─── Cell Tooltip ─────────────────────────────────────────────────────────────

interface CellTooltipProps {
  cell: MonthlyDayCell;
  dateStr: string;
  onClose: () => void;
  position: { x: number; y: number };
}

function CellTooltip({ cell, dateStr, onClose, position }: CellTooltipProps) {
  const dateDisplay = formatDateHeader(dateStr);
  return (
    <div
      className="fixed z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl p-4 w-64 text-sm"
      style={{ top: position.y + 8, left: position.x - 128, maxWidth: '90vw' }}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="font-semibold text-gray-900 dark:text-white">{dateDisplay}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>
      {cell.sessions.map((sess, i) => (
        <div key={sess.session_id} className={`${i > 0 ? 'mt-2 pt-2 border-t border-gray-100 dark:border-slate-700' : ''}`}>
          <p className="font-medium text-gray-700 dark:text-gray-300">{sess.subject}</p>
          <p className={`font-semibold mt-0.5 ${sess.status === 'PRESENT' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {sess.status === 'PRESENT' ? '✓ Present' : '✗ Absent'}
          </p>
          {sess.present_time && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">⏰ {sess.present_time} IST</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

interface DayCellProps {
  cell: MonthlyDayCell | undefined;
  showTime: boolean;
  dateStr: string;
  onCellClick: (cell: MonthlyDayCell, dateStr: string, e: React.MouseEvent) => void;
}

function DayCell({ cell, showTime, dateStr, onCellClick }: DayCellProps) {
  if (!cell || cell.status === 'NO_SESSION') {
    return (
      <td className="px-2 py-2 text-center align-middle">
        <span className="text-gray-300 dark:text-gray-600 font-medium text-xs">—</span>
      </td>
    );
  }

  const isPresentAny = cell.sessions.some((s) => s.status === 'PRESENT');
  const isAbsentAll = cell.sessions.every((s) => s.status === 'ABSENT');
  const isPartial = !isPresentAny === false && !isAbsentAll;

  let bgClass = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  let label = 'A';
  if (cell.status === 'PRESENT') {
    bgClass = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    label = 'P';
  } else if (cell.status === 'PARTIAL') {
    bgClass = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    label = 'P/A';
  }

  return (
    <td className="px-1 py-1 text-center align-middle">
      <button
        onClick={(e) => onCellClick(cell, dateStr, e)}
        className={`${bgClass} rounded-md px-1.5 py-1 text-xs font-bold cursor-pointer hover:opacity-80 transition-opacity min-w-[32px] inline-block leading-tight`}
      >
        {label}
        {showTime && cell.present_time && (
          <span className="block text-[9px] font-normal opacity-80">{cell.present_time.replace(' AM', 'AM').replace(' PM', 'PM')}</span>
        )}
      </button>
    </td>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800 text-green-700 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 text-red-700 dark:text-red-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800 text-purple-700 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800 text-orange-700 dark:text-orange-400',
  };
  return (
    <div className={`rounded-xl border p-4 text-center ${colors[color] || colors.blue}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-semibold mt-1 opacity-80">{label}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MonthlyReportTab() {
  const now = currentMonth();
  const [month, setMonth] = useState(now.month);
  const [year, setYear] = useState(now.year);
  const [section, setSection] = useState('');
  const [subject, setSubject] = useState('');
  const [report, setReport] = useState<MonthlyReportResponse | null>(null);
  const [subjects, setSubjects] = useState<SubjectAttendanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTime, setShowTime] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);
  const [tooltip, setTooltip] = useState<{
    cell: MonthlyDayCell;
    dateStr: string;
    position: { x: number; y: number };
  } | null>(null);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError('');
    setReport(null);
    setSubjects([]);
    setTooltip(null);
    try {
      const [reportRes, subjectRes] = await Promise.all([
        attendanceAPI.getMonthlyReport({
          month,
          year,
          section: section || undefined,
          subject: subject || undefined,
        }),
        attendanceAPI.getSubjectSummary({
          month,
          year,
          section: section || undefined,
        }),
      ]);
      setReport(reportRes.data);
      setSubjects(subjectRes.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  }, [month, year, section, subject]);

  const handleCellClick = useCallback(
    (cell: MonthlyDayCell, dateStr: string, e: React.MouseEvent) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setTooltip({ cell, dateStr, position: { x: rect.left + rect.width / 2, y: rect.bottom } });
    },
    []
  );

  const handleExportCSV = async () => {
    if (!report) return;
    setExporting('csv');
    try { exportMonthlyReportCSV(report); }
    finally { setExporting(null); }
  };

  const handleExportExcel = async () => {
    if (!report) return;
    setExporting('excel');
    try { await exportMonthlyReportExcel(report, subjects); }
    finally { setExporting(null); }
  };

  const monthName = MONTHS.find((m) => m.value === month)?.label || '';

  return (
    <div className="space-y-6" onClick={() => tooltip && setTooltip(null)}>
      {/* Tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <CellTooltip
              cell={tooltip.cell}
              dateStr={tooltip.dateStr}
              position={tooltip.position}
              onClose={() => setTooltip(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Attendance Report</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Section</label>
            <input
              type="text"
              placeholder="e.g. CSE-A"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
            <input
              type="text"
              placeholder="e.g. DAA"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          onClick={generateReport}
          disabled={loading}
          className="mt-4 px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating…' : 'Generate Report'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Calculating attendance…</span>
        </div>
      )}

      {report && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <SummaryCard label="Total Students" value={report.summary.total_students} color="blue" />
            <SummaryCard label="Sessions" value={report.summary.total_sessions} color="purple" />
            <SummaryCard label="Present Records" value={report.summary.total_present} color="green" />
            <SummaryCard label="Absent Records" value={report.summary.total_absent} color="red" />
            <SummaryCard
              label="Avg Attendance"
              value={`${report.summary.avg_percentage.toFixed(1)}%`}
              color="orange"
            />
          </div>

          {/* Subject Summary */}
          {subjects.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Subject-wise Breakdown</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subjects.map((s) => (
                  <div key={s.subject} className="flex items-center justify-between bg-gray-50 dark:bg-slate-700 rounded-lg px-4 py-2">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{s.subject}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{s.present}/{s.total} sessions</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${s.percentage >= 75 ? 'text-green-600 dark:text-green-400' : s.percentage >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                        {s.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matrix controls */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {monthName} {year} — {report.rows.length} students, {report.active_dates.length} session days
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600">
                <button
                  onClick={() => setShowTime(false)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${!showTime ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'}`}
                >
                  Status
                </button>
                <button
                  onClick={() => setShowTime(true)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${showTime ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'}`}
                >
                  Status + Time
                </button>
              </div>
              <button
                onClick={handleExportCSV}
                disabled={exporting === 'csv'}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                {exporting === 'csv' ? '…' : '⬇ CSV'}
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exporting === 'excel'}
                className="px-3 py-1.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50"
              >
                {exporting === 'excel' ? '…' : '⬇ Excel'}
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-5 h-5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-center font-bold leading-5 text-xs">P</span>
              Present
            </span>
            <span className="flex items-center gap-1">
              <span className="w-5 h-5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-center font-bold leading-5 text-xs">A</span>
              Absent
            </span>
            <span className="flex items-center gap-1">
              <span className="w-5 h-5 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded text-center font-bold leading-5 text-xs">—</span>
              No Session
            </span>
            <span className="text-gray-400">Click any cell for details</span>
          </div>

          {/* Matrix Table */}
          {report.rows.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 border border-dashed border-gray-200 dark:border-slate-700 rounded-xl p-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">No students or sessions found for the selected filters.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-700">
                      <th className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-700 px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 min-w-[160px] border-r border-gray-200 dark:border-slate-600">
                        Student
                      </th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 min-w-[90px]">IC Number</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 min-w-[70px]">Section</th>
                      {report.active_dates.map((d) => (
                        <th
                          key={d}
                          className="px-1 py-3 text-center font-semibold text-gray-600 dark:text-gray-400 min-w-[36px]"
                          title={formatDateHeader(d)}
                        >
                          {formatDate(d)}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center font-semibold text-green-700 dark:text-green-400 min-w-[56px]">P</th>
                      <th className="px-3 py-3 text-center font-semibold text-red-700 dark:text-red-400 min-w-[56px]">A</th>
                      <th className="px-3 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 min-w-[80px]">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {report.rows.map((row, i) => (
                      <tr
                        key={row.student_id}
                        className={`hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-slate-700/20'}`}
                      >
                        <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 px-4 py-2 font-medium text-gray-900 dark:text-white border-r border-gray-100 dark:border-slate-700">
                          {row.student_name}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-500 dark:text-gray-400">{row.ic_number}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{row.section}</td>
                        {report.active_dates.map((d) => (
                          <DayCell
                            key={d}
                            cell={row.days[d]}
                            showTime={showTime}
                            dateStr={d}
                            onCellClick={(c, ds, e) => { e.stopPropagation(); handleCellClick(c, ds, e); }}
                          />
                        ))}
                        <td className="px-3 py-2 text-center font-semibold text-green-700 dark:text-green-400">{row.present}</td>
                        <td className="px-3 py-2 text-center font-semibold text-red-700 dark:text-red-400">{row.absent}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-bold ${row.percentage >= 75 ? 'text-green-600 dark:text-green-400' : row.percentage >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                            {row.percentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {!report && !loading && (
        <div className="bg-white dark:bg-slate-800 border border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Select month/year and click Generate Report.</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            The report derives PRESENT/ABSENT from session records. Days without a session show —.
          </p>
        </div>
      )}
    </div>
  );
}
