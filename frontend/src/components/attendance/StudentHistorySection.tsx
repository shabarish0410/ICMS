'use client';
import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { attendanceAPI } from '@/services/api';
import type {
  StudentAttendanceResponse,
  StudentAttendanceDay,
  SubjectAttendanceSummary,
  AttendanceStatus,
} from '@/types';

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

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AttendanceStatus }) {
  if (status === 'PRESENT') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        ✓ Present
      </span>
    );
  }
  if (status === 'ABSENT') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
        ✗ Absent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      — No Session
    </span>
  );
}

// ─── Attendance Percentage Circle ─────────────────────────────────────────────

function PercentageRing({ percentage }: { percentage: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 75 ? '#16a34a' : percentage >= 50 ? '#d97706' : '#dc2626';

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x="50" y="54" textAnchor="middle" className="text-xs font-bold" fill={color} style={{ fontSize: '14px', fontWeight: 700 }}>
          {percentage.toFixed(1)}%
        </text>
      </svg>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">Attendance</p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentHistorySection() {
  const now = currentMonth();
  const [month, setMonth] = useState(now.month);
  const [year, setYear] = useState(now.year);
  const [specificDate, setSpecificDate] = useState('');
  const [report, setReport] = useState<StudentAttendanceResponse | null>(null);
  const [subjects, setSubjects] = useState<SubjectAttendanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [attRes, subRes] = await Promise.all([
        attendanceAPI.getMyAttendance({
          month,
          year,
          date: specificDate || undefined,
        }),
        attendanceAPI.getMySubjects({ month, year }),
      ]);
      setReport(attRes.data as StudentAttendanceResponse);
      setSubjects(subRes.data as SubjectAttendanceSummary[]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || 'Failed to load attendance.');
    } finally {
      setLoading(false);
    }
  }, [month, year, specificDate]);

  const monthName = MONTHS.find((m) => m.value === month)?.label || '';

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">My Attendance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Specific Date <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchAttendance}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Loading…' : 'View Attendance'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {report && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Summary */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <PercentageRing percentage={report.summary.percentage} />
              <div className="grid grid-cols-3 gap-4 flex-1">
                {[
                  { label: 'Present', value: report.summary.present, color: 'green' },
                  { label: 'Absent', value: report.summary.absent, color: 'red' },
                  { label: 'Total Sessions', value: report.summary.applicable_sessions, color: 'blue' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <p className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{label}</p>
                  </div>
                ))}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p className="font-medium text-gray-700 dark:text-gray-300">{report.student_name}</p>
                <p className="text-xs">{report.ic_number}</p>
                <p className="text-xs">Section: {report.section || '—'}</p>
                <p className="text-xs mt-1">{monthName} {year}</p>
              </div>
            </div>
          </div>

          {/* Subject-wise Summary */}
          {subjects.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Subject-wise Attendance</h4>
              <div className="space-y-3">
                {subjects.map((s) => (
                  <div key={s.subject}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{s.subject}</span>
                      <span className={`text-sm font-bold ${s.percentage >= 75 ? 'text-green-600 dark:text-green-400' : s.percentage >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                        {s.percentage.toFixed(1)}% ({s.present}/{s.total})
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${s.percentage >= 75 ? 'bg-green-500' : s.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${s.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Table */}
          {report.rows.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 border border-dashed border-gray-200 dark:border-slate-700 rounded-xl p-10 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                {specificDate
                  ? 'No attendance session was conducted on this date for your section.'
                  : 'No attendance sessions found for this month.'}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Daily Attendance — {monthName} {year}
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-700 text-xs text-gray-600 dark:text-gray-400 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Subject</th>
                      <th className="px-4 py-3 text-left font-semibold">Section</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Present Time (IST)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {report.rows.map((row: StudentAttendanceDay, i) => (
                      <tr
                        key={`${row.session_id}-${i}`}
                        className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-slate-700/10'}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.date_display}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.subject_name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.section}</td>
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
            </div>
          )}
        </motion.div>
      )}

      {!report && !loading && (
        <div className="bg-white dark:bg-slate-800 border border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Select month and year, then click View Attendance.</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            Your attendance percentage is calculated only from sessions your section was expected to attend.
          </p>
        </div>
      )}
    </div>
  );
}
