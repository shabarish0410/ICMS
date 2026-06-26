'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { attendanceAPI, attendanceExtAPI } from '@/services/api';
import { resolvePhotoUrl } from '@/lib/photoUrl';
import {
  Camera, X, ChevronLeft, ChevronRight, Calendar, Clock,
  UserCheck, Search, Filter, ZoomIn, ScanFace, ImageOff,
  ArrowLeft, ExternalLink, Trash2, Loader2, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: number;
  student_id: number;
  date: string;
  check_in_time?: string | null;
  method: string;
  status: string;
  photo_url?: string | null;
  student?: {
    user?: { full_name?: string; ic_number?: string; avatar_url?: string };
    department?: string;
    year?: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const fmtShortDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function statusStyle(s: string) {
  if (s === 'present') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (s === 'late')    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Snapshot Image component — handles loading, error, fallback ──────────────

interface SnapshotImgProps {
  photoUrl: string | null | undefined;
  name?: string;
  className?: string;
  objectFit?: 'cover' | 'contain';
}

function SnapshotImg({ photoUrl, name, className = '', objectFit = 'cover' }: SnapshotImgProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const resolvedUrl = resolvePhotoUrl(photoUrl);

  if (!resolvedUrl) {
    return (
      <div className={`flex items-center justify-center bg-dark-800 ${className}`}>
        <span className="text-2xl font-bold text-dark-400 select-none">{initials(name)}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Loading skeleton */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-dark-800 animate-pulse flex items-center justify-center">
          <Camera className="w-6 h-6 text-dark-600 animate-bounce" />
        </div>
      )}

      {/* Error fallback — show initials */}
      {status === 'error' && (
        <div className="absolute inset-0 bg-dark-800 flex flex-col items-center justify-center gap-1">
          <ImageOff className="w-5 h-5 text-dark-500" />
          <span className="text-xs text-dark-500 font-medium">No image</span>
          <span className="text-lg font-bold text-dark-400 select-none">{initials(name)}</span>
        </div>
      )}

      {/* Actual image */}
      <img
        src={resolvedUrl}
        alt={`Attendance snapshot for ${name ?? 'student'}`}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        className={`w-full h-full transition-opacity duration-300 ${
          objectFit === 'contain' ? 'object-contain' : 'object-cover'
        } ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendanceSnapshotsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch]                   = useState('');
  const [dateFilter, setDateFilter]           = useState('');
  const [statusFilter, setStatusFilter]       = useState('');
  const [showOnlyWithPhoto, setShowOnlyWithPhoto] = useState(false);
  const [lightbox, setLightbox]               = useState<AttendanceRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => attendanceExtAPI.deleteRecord(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-snapshots'] });
      qc.invalidateQueries({ queryKey: ['attendance-history'] });
      toast.success('Snapshot deleted');
      setConfirmDeleteId(null);
      setLightbox(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Delete failed'),
  });

  // Fetch all records
  const { data, isLoading } = useQuery({
    queryKey: ['attendance-snapshots', dateFilter],
    queryFn: () =>
      attendanceAPI.list({
        size: 200,
        page: 1,
        ...(dateFilter ? { date_filter: dateFilter } : {}),
      }),
  });

  const allRecords: AttendanceRecord[] = data?.data?.items ?? [];

  const filteredRecords = useMemo(() => {
    let recs = allRecords;
    if (showOnlyWithPhoto) recs = recs.filter((r) => !!r.photo_url);
    if (statusFilter) recs = recs.filter((r) => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      recs = recs.filter(
        (r) =>
          r.student?.user?.full_name?.toLowerCase().includes(q) ||
          r.student?.user?.ic_number?.toLowerCase().includes(q) ||
          r.student?.department?.toLowerCase().includes(q),
      );
    }
    return recs;
  }, [allRecords, search, statusFilter, showOnlyWithPhoto]);

  const photoRecords   = filteredRecords.filter((r) => !!r.photo_url);
  const manualRecords  = filteredRecords.filter((r) => !r.photo_url);

  // Lightbox navigation
  const lightboxIdx = lightbox ? photoRecords.findIndex((r) => r.id === lightbox.id) : -1;
  const prevPhoto   = useCallback(() => lightboxIdx > 0 && setLightbox(photoRecords[lightboxIdx - 1]), [lightboxIdx, photoRecords]);
  const nextPhoto   = useCallback(() => lightboxIdx < photoRecords.length - 1 && setLightbox(photoRecords[lightboxIdx + 1]), [lightboxIdx, photoRecords]);

  return (
    <div className="space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/attendance"
            className="p-2 rounded-xl border border-dark-200 dark:border-dark-700 hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors text-dark-500"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white flex items-center gap-2">
              <ScanFace className="w-6 h-6 text-primary-500" />
              Attendance Snapshots
            </h1>
            <p className="text-dark-500 text-sm mt-0.5">
              Face‑capture pipeline from Supabase Storage
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <Camera className="w-3.5 h-3.5" />
            {photoRecords.length} with photo
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dark-100 dark:bg-dark-800 border border-dark-200 dark:border-dark-700 text-dark-500 text-xs font-semibold">
            <ImageOff className="w-3.5 h-3.5" />
            {manualRecords.length} manual
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-dark-200 dark:border-dark-700 p-4 flex flex-wrap gap-3 items-center shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, IC, department…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all"
          />
        </div>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="absent">Absent</option>
        </select>

        <button
          onClick={() => setShowOnlyWithPhoto((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-xl border transition-all ${
            showOnlyWithPhoto
              ? 'bg-primary-500 text-white border-primary-500'
              : 'bg-dark-50 dark:bg-dark-900 text-dark-600 dark:text-dark-300 border-dark-200 dark:border-dark-700 hover:bg-dark-100 dark:hover:bg-dark-800'
          }`}
        >
          <Filter className="w-4 h-4" /> Photos Only
        </button>
      </div>

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-dark-800 rounded-2xl border border-dark-200 dark:border-dark-700 overflow-hidden shadow-sm animate-pulse"
            >
              <div className="aspect-square bg-dark-100 dark:bg-dark-900" />
              <div className="p-2.5 space-y-2">
                <div className="h-3 bg-dark-100 dark:bg-dark-700 rounded w-3/4" />
                <div className="h-2 bg-dark-100 dark:bg-dark-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Photo Pipeline Grid ── */}
      {!isLoading && photoRecords.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-dark-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary-500" />
            Face Capture Pipeline ({photoRecords.length})
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {photoRecords.map((record, i) => (
              <motion.article
                key={record.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.5) }}
                className="group relative bg-white dark:bg-dark-800 rounded-2xl border border-dark-200 dark:border-dark-700 overflow-hidden cursor-pointer shadow-sm hover:shadow-xl hover:border-primary-500/50 transition-all duration-300"
                onClick={() => setLightbox(record)}
              >
                {/* Thumbnail */}
                <div className="relative aspect-square">
                  <SnapshotImg
                    photoUrl={record.photo_url}
                    name={record.student?.user?.full_name}
                    className="w-full h-full"
                    objectFit="cover"
                  />

                  {/* Hover zoom overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <ZoomIn className="w-5 h-5 text-white" />
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(record.id); }}
                        className="p-1.5 rounded-lg bg-red-500/80 hover:bg-red-600 text-white transition-colors"
                        title="Delete snapshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Status badge */}
                  <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase border backdrop-blur-sm ${statusStyle(record.status)}`}>
                    {record.status}
                  </span>
                </div>

                {/* Card info */}
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-dark-900 dark:text-white truncate">
                    {record.student?.user?.full_name ?? '—'}
                  </p>
                  <p className="text-[10px] text-dark-400 truncate mt-0.5">
                    {record.student?.department ?? '—'}
                  </p>
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    <Calendar className="w-3 h-3 text-dark-400 flex-shrink-0" />
                    <span className="text-[10px] text-dark-500">{fmtShortDate(record.date)}</span>
                    {record.check_in_time && (
                      <>
                        <Clock className="w-3 h-3 text-dark-400 flex-shrink-0 ml-1" />
                        <span className="text-[10px] text-dark-500">{fmtTime(record.check_in_time)}</span>
                      </>
                    )}
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>
      )}

      {/* ── Manual / No-Photo Records ── */}
      {!isLoading && !showOnlyWithPhoto && manualRecords.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-dark-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Manual Check-ins ({manualRecords.length})
          </h2>
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-dark-200 dark:border-dark-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-dark-200 dark:border-dark-700 bg-dark-50/50 dark:bg-dark-850/50">
                    {isAdmin && (
                      <th className="text-left px-4 py-3 text-xs font-bold text-dark-500 uppercase tracking-wider">Student</th>
                    )}
                    <th className="text-left px-4 py-3 text-xs font-bold text-dark-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-dark-500 uppercase tracking-wider">Check-in</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-dark-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-dark-500 uppercase tracking-wider">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {manualRecords.map((r) => (
                    <tr key={r.id} className="border-b border-dark-100 dark:border-dark-800 hover:bg-dark-50/50 dark:hover:bg-dark-850/50 transition-colors">
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {initials(r.student?.user?.full_name)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-dark-900 dark:text-white">{r.student?.user?.full_name ?? '—'}</p>
                              <p className="text-xs text-dark-400">{r.student?.user?.ic_number}</p>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-dark-700 dark:text-dark-300">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-dark-500">
                        {r.check_in_time ? fmtTime(r.check_in_time) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase border ${statusStyle(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-dark-500">⌨️ Manual</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Empty state ── */}
      {!isLoading && filteredRecords.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-dark-100 dark:bg-dark-800 flex items-center justify-center mb-4">
            <ScanFace className="w-10 h-10 text-dark-300 dark:text-dark-600" />
          </div>
          <h3 className="text-lg font-bold text-dark-700 dark:text-dark-300 mb-1">No Snapshots Found</h3>
          <p className="text-sm text-dark-400 max-w-xs">
            {showOnlyWithPhoto
              ? 'No face-capture photos exist yet. Mark attendance using the Face Biometric scanner.'
              : 'No attendance records match your current filters.'}
          </p>
          <Link href="/dashboard/attendance" className="mt-5 btn-primary inline-flex items-center gap-2 text-sm">
            <Camera className="w-4 h-4" /> Go to Attendance
          </Link>
        </motion.div>
      )}

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="relative bg-dark-950 rounded-3xl overflow-hidden border border-dark-700/60 shadow-2xl w-full max-w-lg"
            >
              {/* ── Top controls ── */}
              <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                {resolvePhotoUrl(lightbox.photo_url) && (
                  <a
                    href={resolvePhotoUrl(lightbox.photo_url)!}
                    target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-black/60 text-white/70 hover:text-white hover:bg-black/80 transition-colors"
                    title="Open full image"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setConfirmDeleteId(lightbox.id)}
                    className="p-2 rounded-xl bg-red-500/70 hover:bg-red-600 text-white transition-colors"
                    title="Delete record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setLightbox(null)}
                  className="p-2 rounded-xl bg-black/60 text-white/70 hover:text-white hover:bg-black/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── Prev / Next arrows ── */}
              {lightboxIdx > 0 && (
                <button
                  onClick={prevPhoto}
                  className="absolute left-3 top-1/3 -translate-y-1/2 z-20 p-2.5 rounded-xl bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {lightboxIdx < photoRecords.length - 1 && (
                <button
                  onClick={nextPhoto}
                  className="absolute right-3 top-1/3 -translate-y-1/2 z-20 p-2.5 rounded-xl bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}

              {/* ── Full-width snapshot image ── */}
              <div className="w-full bg-black" style={{ aspectRatio: '4/3' }}>
                <SnapshotImg
                  photoUrl={lightbox.photo_url}
                  name={lightbox.student?.user?.full_name}
                  className="w-full h-full"
                  objectFit="contain"
                />
              </div>

              {/* ── Info panel ── */}
              <div className="p-5 space-y-4">
                {/* Student identity */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {initials(lightbox.student?.user?.full_name)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{lightbox.student?.user?.full_name ?? 'Unknown'}</p>
                      <p className="text-xs text-dark-400">
                        {lightbox.student?.user?.ic_number}
                        {lightbox.student?.department && ` · ${lightbox.student.department}`}
                        {lightbox.student?.year && ` · Year ${lightbox.student.year}`}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${statusStyle(lightbox.status)}`}>
                    {lightbox.status}
                  </span>
                </div>

                {/* Date & time */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-dark-800">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-dark-500 uppercase font-semibold tracking-wider">Date</p>
                      <p className="text-sm text-white font-medium">{fmtDate(lightbox.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-dark-500 uppercase font-semibold tracking-wider">Check-in</p>
                      <p className="text-sm text-white font-medium">
                        {lightbox.check_in_time ? fmtTime(lightbox.check_in_time) : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer: source info + record counter */}
                <div className="flex items-center justify-between text-[11px] text-dark-500">
                  <div className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-primary-500" />
                    <span>
                      {lightbox.method === 'face' ? '📷 Face Biometric' : '⌨️ Manual Entry'}
                      {resolvePhotoUrl(lightbox.photo_url)?.includes('supabase.co') && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">
                          Supabase Storage
                        </span>
                      )}
                      {resolvePhotoUrl(lightbox.photo_url)?.includes('localhost') && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold">
                          Local
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="font-medium">{lightboxIdx + 1} / {photoRecords.length}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirm ── */}
      <AnimatePresence>
        {confirmDeleteId !== null && (
          <DeleteConfirmDialog
            id={confirmDeleteId}
            onCancel={() => setConfirmDeleteId(null)}
            onConfirm={() => deleteMutation.mutate(confirmDeleteId)}
            isPending={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Delete Confirm Dialog (rendered inside page) ──────────────────────────────
function DeleteConfirmDialog({ id, onCancel, onConfirm, isPending }: { id: number; onCancel: () => void; onConfirm: () => void; isPending: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-sm border border-dark-200 dark:border-dark-700 shadow-2xl text-center"
      >
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <h3 className="font-bold text-dark-900 dark:text-white mb-1">Delete Attendance Record?</h3>
        <p className="text-sm text-dark-500 mb-5">This will permanently delete the record and its photo from Supabase Storage. This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-dark-200 dark:border-dark-700 text-sm font-semibold text-dark-600 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-850">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold flex items-center justify-center gap-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Delete</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
