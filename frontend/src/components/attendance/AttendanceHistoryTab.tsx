'use client';
import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { attendanceAPI } from '@/services/api';
import type {
  DailyReportResponse,
  DailyAttendanceRow,
  AttendanceSessionInfo,
  AttendanceStatus,
} from '@/types';
import { exportDailyReportCSV, exportDailyReportExcel } from '@/utils/attendanceExport';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  if (status === 'PRESENT') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        ✓ PRESENT
      </span>
    );
  }
  if (status === 'ABSENT') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
        ✗ ABSENT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      — NO SESSION
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AttendanceHistoryTab() {
  const [date, setDate] = useState(todayIST());
  const [section, setSection] = useState('');
  const [subject, setSubject] = useState('');
  const [report, setReport] = useState<DailyReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);
  const [search, setSearch] = useState('');

  const fetchReport = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError('');
    try {
      const res = await attendanceAPI.getDailyReport({
        date,
        section: section || undefined,
        subject: subject || undefined,
      });
      setReport(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [date, section, subject]);

  const handleExportCSV = async () => {
    if (!report) return;
    setExporting('csv');
    try {
      exportDailyReportCSV(report, { section, subject });
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    if (!report) return;
    setExporting('excel');
    try {
      await exportDailyReportExcel(report);
    } finally {
      setExporting(null);
    }
  };

  const filteredRows = (report?.rows ?? []).filter((row) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      row.student_name.toLowerCase().includes(q) ||
      row.ic_number.toLowerCase().includes(q) ||
      row.section.toLowerCase().includes(q)
    );
  });

  const presentCount = filteredRows.filter((r) => r.status === 'PRESENT').length;
  const absentCount = filteredRows.filter((r) => r.status === 'ABSENT').length;

  return (
    <div className="space-y-6">
      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Daily Attendance History</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Section</label>
            <input
              type="text"
              placeholder="e.g. CSE-A"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
            <input
              type="text"
              placeholder="e.g. DAA"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchReport}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Loading…' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {report && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Sessions', value: report.sessions.length, color: 'blue' },
              { label: 'Students', value: report.rows.length, color: 'purple' },
              { label: 'Present', value: report.total_present, color: 'green' },
              { label: 'Absent', value: report.total_absent, color: 'red' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className={`bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-100 dark:border-${color}-800 rounded-xl p-4 text-center`}
              >
                <p className={`text-2xl font-bold text-${color}-700 dark:text-${color}-400`}>{value}</p>
                <p className={`text-xs font-medium text-${color}-600 dark:text-${color}-500 mt-1`}>{label}</p>
              </div>
            ))}
          </div>

          {/* Table controls */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <input
              type="text"
              placeholder="Search by name, IC number, section…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 w-full sm:w-72"
            />
            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                disabled={exporting === 'csv'}
                className="px-3 py-2 text-sm font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                {exporting === 'csv' ? '…' : '⬇ CSV'}
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exporting === 'excel'}
                className="px-3 py-2 text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50"
              >
                {exporting === 'excel' ? '…' : '⬇ Excel'}
              </button>
            </div>
          </div>

          {/* Table */}
          {filteredRows.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                {report.rows.length === 0
                  ? 'No attendance sessions found for this date.'
                  : 'No results match your search.'}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-700 text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Student Name</th>
                      <th className="px-4 py-3 text-left font-semibold">IC Number</th>
                      <th className="px-4 py-3 text-left font-semibold">Section</th>
                      <th className="px-4 py-3 text-left font-semibold">Subject</th>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Present Time (IST)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {filteredRows.map((row, i) => (
                      <tr
                        key={`${row.session_id}-${row.student_id}`}
                        className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-slate-700/20'}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.student_name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">{row.ic_number}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.section}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.subject_name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.date_display}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                          {row.present_time ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-gray-50 dark:bg-slate-700/50 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-slate-700">
                Showing {filteredRows.length} of {report.rows.length} records •{' '}
                {presentCount} Present • {absentCount} Absent
              </div>
            </div>
          )}
        </motion.div>
      )}

      {!report && !loading && (
        <div className="bg-white dark:bg-slate-800 border border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Select a date and click Search to view attendance history.</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            Attendance shows PRESENT/ABSENT for every student expected in the session's section.
          </p>
        </div>
      )}
    </div>
  );
}
