'use client';

import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { dashboardAPI } from '@/services/api';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Filler
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  GraduationCap, Users2, FolderKanban, Clock,
  UserCheck, UserX, Megaphone, Video, ClipboardList,
  CheckCircle, AlertCircle, ArrowRight, Sparkles, Server,
  TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import { useTheme } from 'next-themes';

ChartJS.register(
  ArcElement, Tooltip, Legend, CategoryScale,
  LinearScale, BarElement, PointElement, LineElement, Filler
);

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

// ─── Count-up Hook ────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1000) {
  const [count, setCount] = useState(0);
  const startTime = useRef<number | null>(null);
  const raf = useRef<number>();

  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    startTime.current = null;
    const animate = (now: number) => {
      if (!startTime.current) startTime.current = now;
      const progress = Math.min((now - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return count;
}

// ─── Animated Stat Number ─────────────────────────────────────────────────────
function AnimatedNumber({ value }: { value: number }) {
  const count = useCountUp(value, 900);
  return <>{count}</>;
}

// ─── Trend Chip ───────────────────────────────────────────────────────────────
function TrendChip({ value, label }: { value: number; label?: string }) {
  if (value === 0) return (
    <span className="flex items-center gap-1 text-xs text-dark-400 font-medium">
      <Minus className="w-3 h-3" /> No change
    </span>
  );
  const isUp = value > 0;
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold ${isUp ? 'text-brand-emerald' : 'text-brand-red'}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isUp ? '+' : ''}{value}% {label || 'this month'}
    </span>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();

  ChartJS.defaults.color = theme === 'dark' ? '#94a3b8' : '#64748b';
  ChartJS.defaults.font.family = 'var(--font-inter)';

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => dashboardAPI.admin()
  });
  const { data: projectChart } = useQuery({
    queryKey: ['project-chart'],
    queryFn: () => dashboardAPI.projectStatus()
  });
  const { data: deptChart } = useQuery({
    queryKey: ['dept-chart'],
    queryFn: () => dashboardAPI.departmentChart()
  });

  if (isLoading) return <DashboardSkeleton />;

  const s = stats?.data;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.full_name?.split(' ')[0] || 'Admin';

  const statCards = [
    {
      label: 'Total Students', value: s?.total_students || 0,
      icon: GraduationCap, color: 'text-brand-indigo', bg: 'bg-brand-indigo/10',
      link: '/dashboard/students', trend: 8
    },
    {
      label: 'Active Teams', value: s?.total_teams || 0,
      icon: Users2, color: 'text-brand-cyan', bg: 'bg-brand-cyan/10',
      link: '/dashboard/teams', trend: 3
    },
    {
      label: 'Active Projects', value: s?.active_projects || 0,
      icon: FolderKanban, color: 'text-brand-purple', bg: 'bg-brand-purple/10',
      link: '/dashboard/projects', trend: 12
    },
    {
      label: 'Completed', value: s?.completed_projects || 0,
      icon: CheckCircle, color: 'text-brand-emerald', bg: 'bg-brand-emerald/10',
      link: '/dashboard/projects', trend: 5
    },
    {
      label: 'Pending Reviews', value: s?.pending_reviews || 0,
      icon: AlertCircle, color: 'text-brand-amber', bg: 'bg-brand-amber/10',
      link: '/dashboard/weekly-reports', trend: -2, sub: 'Action required'
    },
    {
      label: 'Upcoming Meetings', value: s?.upcoming_meetings || 0,
      icon: Video, color: 'text-brand-red', bg: 'bg-brand-red/10',
      link: '/dashboard/meetings', trend: 0
    },
  ];

  // Mock attendance bar data (replace with real API when available)
  const attendanceBarData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    datasets: [
      {
        label: 'Present',
        data: [42, 38, 45, 50, 44, 28],
        backgroundColor: theme === 'dark' ? 'rgba(99,102,241,0.7)' : 'rgba(99,102,241,0.85)',
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: 'Absent',
        data: [8, 12, 5, 0, 6, 22],
        backgroundColor: theme === 'dark' ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.6)',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const chartTooltipStyle = {
    backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF',
    titleColor: theme === 'dark' ? '#fff' : '#0F172A',
    bodyColor: theme === 'dark' ? '#cbd5e1' : '#475569',
    borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    borderWidth: 1,
    padding: 10,
    cornerRadius: 10,
  };

  return (
    <div className="space-y-6">
      {/* ── Welcome Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="card p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm max-w-xl leading-relaxed">
            Here's your institution overview. Everything's running smoothly today.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/50 text-sm font-semibold text-green-700 dark:text-green-400 shrink-0">
          <Server className="w-4 h-4" />
          All systems operational
        </div>
      </motion.div>

      {/* ── Stat Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            {...fadeUp}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            onClick={() => router.push(card.link)}
            className="card p-5 cursor-pointer group flex flex-col justify-between xl:col-span-2 last:xl:col-span-2 hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {card.label}
                </p>
                <div className={`w-9 h-9 rounded-xl ${card.bg.replace('brand-', '').replace('dark', 'slate')} flex items-center justify-center transition-transform group-hover:scale-105 duration-200`}>
                  <card.icon className={`w-4.5 h-4.5 ${card.color.replace('brand-', '')}`} />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                <AnimatedNumber value={card.value} />
              </p>
            </div>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <TrendChip value={card.trend} />
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Attendance Bar Chart — 3 cols */}
        <motion.div
          {...fadeUp}
          transition={{ delay: 0.2 }}
          className="lg:col-span-3 card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Weekly Attendance
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
              This Week
            </span>
          </div>
          <div className="h-[260px]">
            <Bar
              data={attendanceBarData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', labels: { boxWidth: 8, usePointStyle: true, padding: 16 } },
                  tooltip: chartTooltipStyle as any,
                },
                scales: {
                  x: { grid: { display: false }, border: { display: false } },
                  y: {
                    grid: { color: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
                    border: { display: false },
                    ticks: { stepSize: 10 },
                  },
                },
              }}
            />
          </div>
        </motion.div>

        {/* Project Status Doughnut — 2 cols */}
        <motion.div
          {...fadeUp}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 card p-6"
        >
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-6">
            Project Status
          </h3>
          {projectChart?.data ? (
            <div className="h-[260px] flex items-center justify-center">
              <Doughnut
                data={projectChart.data}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 8, usePointStyle: true, padding: 18 } },
                    tooltip: chartTooltipStyle as any,
                  },
                  cutout: '75%',
                  elements: { arc: { borderWidth: 0 } },
                }}
              />
            </div>
          ) : (
            <div className="h-[260px] flex flex-col items-center justify-center gap-2 text-dark-400">
              <FolderKanban className="w-8 h-8 opacity-20" />
              <p className="text-sm font-medium">No project data yet</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Department Distribution ── */}
      {deptChart?.data && (
        <motion.div
          {...fadeUp}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-6">
            Department Distribution
          </h3>
          <div className="h-[280px] flex justify-center">
            <Doughnut
              data={deptChart.data}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'right', labels: { boxWidth: 8, usePointStyle: true, padding: 20 } },
                  tooltip: chartTooltipStyle as any,
                },
                cutout: '65%',
                elements: { arc: { borderWidth: 0 } },
              }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Student Dashboard ────────────────────────────────────────────────────────
function StudentDashboard() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => dashboardAPI.student()
  });

  if (isLoading) return <DashboardSkeleton />;
  const d = data?.data;

  const aiInsights = [
    {
      title: 'Attendance Notice',
      message: 'Your attendance is strong. Keep it up to maintain your perfect record.',
      type: 'success',
    },
    {
      title: 'Upcoming Meeting',
      message: 'You have a mentor sync tomorrow. Make sure your project updates are ready.',
      type: 'warning',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Welcome Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="card p-7 relative overflow-hidden"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Welcome back, {d?.user?.full_name?.split(' ')[0] || 'Student'} 👋
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm max-w-xl leading-relaxed">
          Here is your summary for today. Keep up the great work!
        </p>
      </motion.div>

      {/* ── AI Insights ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {aiInsights.map((insight, idx) => (
          <div
            key={idx}
            className="flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-white/5 border border-dark-100 dark:border-white/5 shadow-sm"
          >
            <div className={`p-2.5 rounded-xl flex-shrink-0 ${
              insight.type === 'success'
                ? 'bg-brand-emerald/10 text-brand-emerald'
                : 'bg-brand-amber/10 text-brand-amber'
            }`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-dark-900 dark:text-white">{insight.title}</h4>
              <p className="text-xs text-dark-500 dark:text-dark-300 mt-1 leading-relaxed">{insight.message}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Quick Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          {...fadeUp}
          transition={{ delay: 0.1 }}
          onClick={() => router.push('/dashboard/teams')}
          className="card p-6 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Team</span>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30">
              <Users2 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white truncate mt-2">
            {d?.team?.name || 'Not assigned'}
          </p>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            {d?.team?.mentor_name ? `Mentor: ${d.team.mentor_name}` : 'No mentor assigned'}
          </p>
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ delay: 0.15 }}
          onClick={() => router.push('/dashboard/forms')}
          className="card p-6 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Forms</span>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30">
              <ClipboardList className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            <AnimatedNumber value={d?.pending_forms || 0} />
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-500 mt-4 font-semibold group-hover:translate-x-1 transition-transform">
            Action Required →
          </p>
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ delay: 0.2 }}
          onClick={() => router.push('/dashboard/meetings')}
          className="card p-6 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Upcoming Calls</span>
            <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-900/30">
              <Video className="w-5 h-5 text-cyan-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            <AnimatedNumber value={d?.upcoming_meetings || 0} />
          </p>
          <p className="text-xs text-cyan-700 dark:text-cyan-500 mt-4 font-semibold group-hover:translate-x-1 transition-transform">
            View Schedule →
          </p>
        </motion.div>
      </div>

      {/* ── Project + Activity Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Active Project card */}
        <motion.div
          {...fadeUp}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 card p-7 flex flex-col"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                <FolderKanban className="w-5 h-5 text-blue-600" />
              </div>
              Active Project
            </h3>
            {d?.project && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                d.project.status === 'completed'
                  ? 'bg-brand-emerald/10 text-brand-emerald border-brand-emerald/20'
                  : 'bg-brand-indigo/10 text-brand-indigo border-brand-indigo/20'
              }`}>
                {d.project.status}
              </span>
            )}
          </div>

          {d?.project ? (
            <div className="flex-1 space-y-5">
              <div>
                <p className="font-bold text-dark-900 dark:text-white text-xl tracking-tight">{d.project.title}</p>
                <p className="text-sm text-dark-600 dark:text-dark-300 mt-2 leading-relaxed">{d.project.description}</p>
              </div>

              {d.project.technologies_used && (
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(d.project.technologies_used)
                    ? d.project.technologies_used
                    : typeof d.project.technologies_used === 'string'
                    ? d.project.technologies_used.split(',')
                    : []
                  ).map((tech: string) => (
                    <span
                      key={tech}
                      className="px-3 py-1 bg-dark-50 dark:bg-white/5 border border-dark-100 dark:border-white/10 text-dark-600 dark:text-dark-200 rounded-lg text-xs font-medium"
                    >
                      {tech.trim()}
                    </span>
                  ))}
                </div>
              )}

              {/* Progress Bar */}
              <div className="mt-auto pt-4 border-t border-dark-100 dark:border-white/10">
                <div className="flex justify-between items-center text-xs font-semibold mb-3 text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                  <span>Progress</span>
                  <span className="text-dark-900 dark:text-white bg-dark-50 dark:bg-white/5 px-2.5 py-1 rounded-md font-mono">
                    {d.project.progress}% Complete
                  </span>
                </div>
                <div className="w-full bg-dark-100 dark:bg-dark-800 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    className="h-2.5 rounded-full bg-gradient-to-r from-brand-indigo via-brand-cyan to-brand-emerald"
                    initial={{ width: 0 }}
                    animate={{ width: `${d.project.progress}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-dark-400">
              <div className="w-16 h-16 rounded-2xl bg-dark-50 dark:bg-white/5 flex items-center justify-center mb-5 border border-dark-100 dark:border-white/10">
                <FolderKanban className="w-8 h-8 text-dark-300" />
              </div>
              <p className="text-base font-semibold text-dark-900 dark:text-white">No active project assigned</p>
              <p className="text-sm text-dark-500 mt-1">Check back later or contact your mentor.</p>
            </div>
          )}
        </motion.div>

        {/* Recent Activity card */}
        <motion.div
          {...fadeUp}
          transition={{ delay: 0.3 }}
          className="card p-6 flex flex-col"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
              <Megaphone className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Activity
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3">
            {d?.recent_notifications?.length > 0 ? (
              d.recent_notifications.map((n: any) => (
                <div
                  key={n.id}
                  className={`p-3.5 rounded-xl border transition-all duration-200 ${
                    n.is_read
                      ? 'border-dark-100 dark:border-white/5 bg-dark-50/50 dark:bg-white/5'
                      : 'border-brand-indigo/20 bg-brand-indigo/5 dark:bg-brand-indigo/8'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      n.is_read ? 'bg-dark-300 dark:bg-white/20' : 'bg-brand-indigo dark:bg-brand-cyan'
                    }`} />
                    <div>
                      <p className={`text-sm font-semibold ${
                        n.is_read ? 'text-dark-800 dark:text-white' : 'text-brand-indigo dark:text-brand-cyan'
                      }`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-dark-500 dark:text-dark-300 mt-1 leading-relaxed">{n.message}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full py-14 flex flex-col items-center justify-center text-dark-400">
                <div className="w-14 h-14 rounded-2xl bg-dark-50 dark:bg-white/5 flex items-center justify-center mb-4 border border-dark-100 dark:border-white/10">
                  <Megaphone className="w-7 h-7 text-dark-300" />
                </div>
                <p className="text-sm font-semibold text-dark-900 dark:text-white">All caught up!</p>
                <p className="text-xs text-dark-500 mt-1 text-center">No recent announcements.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-28 bg-dark-100 dark:bg-white/5 rounded-[24px] w-full" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-36 bg-dark-100 dark:bg-white/5 rounded-[18px] xl:col-span-2" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 h-80 bg-dark-100 dark:bg-white/5 rounded-[18px]" />
        <div className="lg:col-span-2 h-80 bg-dark-100 dark:bg-white/5 rounded-[18px]" />
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <StudentDashboard />;
}
