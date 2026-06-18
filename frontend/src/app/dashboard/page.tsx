'use client';

import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { dashboardAPI } from '@/services/api';
import { motion } from 'framer-motion';
import { 
  Chart as ChartJS, ArcElement, Tooltip, Legend, 
  CategoryScale, LinearScale, BarElement, PointElement, 
  LineElement, Filler 
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  GraduationCap, Users2, FolderKanban, Clock, 
  UserCheck, UserX, Megaphone, Video, ClipboardList,
  CheckCircle, AlertCircle, Loader2, ArrowRight
} from 'lucide-react';

ChartJS.register(
  ArcElement, Tooltip, Legend, CategoryScale, 
  LinearScale, BarElement, PointElement, LineElement, Filler
);

const fadeUp = { initial: { opacity: 0, y: 15 }, animate: { opacity: 1, y: 0 } };

// ─── Admin Dashboard ─────────────────────────────────────────────────────────
function AdminDashboard() {
  const router = useRouter();
  const { data: stats, isLoading } = useQuery({ 
    queryKey: ['admin-dashboard'], 
    queryFn: () => dashboardAPI.admin() 
  });
  const { data: projectChart } = useQuery({ 
    queryKey: ['project-chart'], 
    queryFn: () => dashboardAPI.projectStatus() 
  });
  const { data: attendanceChart } = useQuery({ 
    queryKey: ['attendance-chart'], 
    queryFn: () => dashboardAPI.attendanceTrend() 
  });
  const { data: deptChart } = useQuery({
    queryKey: ['dept-chart'],
    queryFn: () => dashboardAPI.departmentChart()
  });

  if (isLoading) return <DashboardSkeleton />;

  const s = stats?.data;
  const statCards = [
    { label: 'Total Enrolled Students', value: s?.total_students || 0, icon: GraduationCap, color: 'from-blue-500 to-indigo-600', link: '/dashboard/students' },
    { label: 'Registered Teams', value: s?.total_teams || 0, icon: Users2, color: 'from-purple-500 to-pink-600', link: '/dashboard/teams' },
    { label: 'Active Projects', value: s?.active_projects || 0, icon: FolderKanban, color: 'from-amber-500 to-orange-600', link: '/dashboard/projects' },
    { label: 'Completed Projects', value: s?.completed_projects || 0, icon: CheckCircle, color: 'from-green-500 to-emerald-600', link: '/dashboard/projects' },
    { label: 'Present Today', value: s?.students_present_today || 0, icon: UserCheck, color: 'from-teal-500 to-emerald-600', link: '/dashboard/attendance', sub: `${s?.attendance_percentage || 0}% rate` },
    { label: 'Absent Today', value: s?.students_absent_today || 0, icon: UserX, color: 'from-rose-500 to-red-650', link: '/dashboard/attendance' },
    { label: 'Submissions to Review', value: s?.pending_reviews || 0, icon: AlertCircle, color: 'from-orange-500 to-amber-600', link: '/dashboard/weekly-reports', sub: 'Action required' },
    { label: 'Upcoming Calls', value: s?.upcoming_meetings || 0, icon: Video, color: 'from-cyan-500 to-blue-600', link: '/dashboard/meetings' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">Real-time stats and center utilization analytics</p>
        </div>
        <div className="text-xs font-semibold text-dark-450 bg-dark-50 dark:bg-dark-800 border border-dark-150 dark:border-dark-750 px-3 py-1.5 rounded-xl flex items-center gap-2 w-fit">
          <Clock className="w-3.5 h-3.5" />
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, i) => (
          <motion.div 
            key={card.label} 
            {...fadeUp} 
            transition={{ delay: i * 0.04 }}
            onClick={() => router.push(card.link)}
            className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-dark-200 dark:border-dark-700 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-dark-400 uppercase tracking-wider">{card.label}</p>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-dark-900 dark:text-white tracking-tight">{card.value}</p>
            </div>
            
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-dark-100 dark:border-dark-750/60 text-[10px] font-bold text-dark-400 group-hover:text-primary-500 transition-colors">
              <span>{card.sub || 'VIEW DETAILS'}</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Bar Chart */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.35 }}
          className="lg:col-span-2 bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm"
        >
          <h3 className="text-base font-bold text-dark-900 dark:text-white mb-4">Daily Attendance History (7 Days)</h3>
          {attendanceChart?.data ? (
            <Bar 
              data={attendanceChart.data} 
              options={{
                responsive: true,
                plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 12 } } },
                scales: { 
                  x: { stacked: true, grid: { display: false } }, 
                  y: { stacked: true, grid: { color: 'rgba(156, 163, 175, 0.1)' } } 
                },
              }} 
            />
          ) : (
            <div className="h-48 flex items-center justify-center text-dark-400 italic">No attendance data logs available</div>
          )}
        </motion.div>

        {/* Project Status Doughnut Chart */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm"
        >
          <h3 className="text-base font-bold text-dark-900 dark:text-white mb-4">Project Status Metrics</h3>
          {projectChart?.data ? (
            <div className="max-w-[220px] mx-auto">
              <Doughnut 
                data={projectChart.data} 
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 10 } } } },
                  cutout: '70%',
                }} 
              />
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-dark-400 italic">No project data logs available</div>
          )}
        </motion.div>

        {/* Department Distribution Chart */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.45 }}
          className="col-span-full bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm"
        >
          <h3 className="text-base font-bold text-dark-900 dark:text-white mb-4">Enrolled Department Distribution</h3>
          {deptChart?.data ? (
            <div className="max-w-[400px] mx-auto">
              <Doughnut 
                data={deptChart.data} 
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'right' as const, labels: { boxWidth: 12, font: { size: 11 } } } }
                }} 
              />
            </div>
          ) : (
            <div className="text-center py-10 text-dark-400 italic">No department data to display</div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Student Dashboard ──────────────────────────────────────────────────────
function StudentDashboard() {
  const router = useRouter();
  const { data, isLoading } = useQuery({ 
    queryKey: ['student-dashboard'], 
    queryFn: () => dashboardAPI.student() 
  });

  if (isLoading) return <DashboardSkeleton />;
  const d = data?.data;

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
          Welcome back, {d?.user?.full_name?.split(' ')[0] || 'Student'} 👋
        </h1>
        <p className="text-dark-500 dark:text-dark-400 mt-1">Here is a quick snapshot of your Innovation Center logs</p>
      </div>

      {/* Quick Interactive Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <motion.div 
          {...fadeUp}
          onClick={() => router.push('/dashboard/attendance')}
          className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-dark-200 dark:border-dark-700 shadow-sm hover:shadow-md cursor-pointer group transition-all"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-wider">My Attendance</span>
            <UserCheck className="w-5 h-5 text-green-500 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-3xl font-extrabold text-dark-900 dark:text-white mt-1">{d?.attendance_percentage || 0}%</p>
          <div className="w-full bg-dark-100 dark:bg-dark-750 rounded-full h-1.5 mt-3.5">
            <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${d?.attendance_percentage || 0}%` }} />
          </div>
        </motion.div>

        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.1 }}
          onClick={() => router.push('/dashboard/teams')}
          className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-dark-200 dark:border-dark-700 shadow-sm hover:shadow-md cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-wider">My Active Team</span>
            <Users2 className="w-5 h-5 text-purple-500 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-lg font-bold text-dark-900 dark:text-white truncate mt-1">{d?.team?.name || 'Not assigned'}</p>
          <p className="text-xs text-dark-450 mt-1 font-medium">{d?.team?.mentor_name ? `Mentor: ${d.team.mentor_name}` : 'No mentor assigned'}</p>
        </motion.div>

        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.2 }}
          onClick={() => router.push('/dashboard/forms')}
          className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-dark-200 dark:border-dark-700 shadow-sm hover:shadow-md cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-wider">Pending Forms</span>
            <ClipboardList className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-3xl font-extrabold text-dark-900 dark:text-white mt-1">{d?.pending_forms || 0}</p>
          <p className="text-xs text-dark-450 mt-1 font-medium">Click to fill out forms</p>
        </motion.div>

        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.3 }}
          onClick={() => router.push('/dashboard/meetings')}
          className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-dark-200 dark:border-dark-700 shadow-sm hover:shadow-md cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-wider">Upcoming Calls</span>
            <Video className="w-5 h-5 text-cyan-500 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-3xl font-extrabold text-dark-900 dark:text-white mt-1">{d?.upcoming_meetings || 0}</p>
          <p className="text-xs text-dark-450 mt-1 font-medium">Built-in secure video rooms</p>
        </motion.div>
      </div>

      {/* Project + Notifications Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project details card */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm"
        >
          <h3 className="text-base font-bold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-indigo-500" /> Active Team Project
          </h3>
          {d?.project ? (
            <div className="space-y-4">
              <div>
                <p className="font-bold text-dark-900 dark:text-white text-base">{d.project.title}</p>
                <p className="text-xs text-dark-500 mt-1 leading-relaxed">{d.project.description}</p>
              </div>

              {/* Problem/Solution */}
              {d.project.problem_statement && (
                <div className="p-3 bg-dark-50 dark:bg-dark-850 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-dark-700 dark:text-dark-300">Problem Statement:</span>
                  <p className="text-dark-600 dark:text-dark-400 italic">"{d.project.problem_statement}"</p>
                </div>
              )}

              {/* Technologies Used */}
              {d.project.technologies_used && (
                <div>
                  <span className="text-[10px] font-bold text-dark-400 uppercase tracking-wider">Technologies:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(Array.isArray(d.project.technologies_used)
                      ? d.project.technologies_used
                      : typeof d.project.technologies_used === 'string'
                      ? d.project.technologies_used.split(',')
                      : []
                    ).map((tech: string) => (
                      <span key={tech} className="px-2 py-0.5 bg-indigo-55 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 rounded-md text-[10px] font-bold uppercase">
                        {tech.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                    d.project.status === 'completed' ? 'bg-green-150 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>{d.project.status}</span>
                  <span className="text-dark-500">{d.project.progress}% Complete</span>
                </div>
                <div className="w-full bg-dark-100 dark:bg-dark-750 rounded-full h-1.5">
                  <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${d.project.progress}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-dark-400">
              <FolderKanban className="w-10 h-10 mx-auto mb-2 opacity-25" />
              <p className="text-sm">No project assigned yet.</p>
            </div>
          )}
        </motion.div>

        {/* Notifications card */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm"
        >
          <h3 className="text-base font-bold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-500" /> Recent Announcements
          </h3>
          {d?.recent_notifications?.length > 0 ? (
            <div className="space-y-3">
              {d.recent_notifications.map((n: any) => (
                <div 
                  key={n.id} 
                  className={`p-3 rounded-xl border transition-all ${
                    n.is_read 
                      ? 'border-dark-150 dark:border-dark-750' 
                      : 'border-primary-150 dark:border-primary-950/40 bg-primary-50/40 dark:bg-primary-950/10'
                  }`}
                >
                  <p className="text-xs font-bold text-dark-950 dark:text-white">{n.title}</p>
                  <p className="text-[11px] text-dark-500 mt-1 leading-relaxed">{n.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-dark-400">
              <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-25" />
              <p className="text-sm">No recent notifications.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-dark-200 dark:bg-dark-700 rounded w-64" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-dark-200 dark:bg-dark-700 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-80 bg-dark-200 dark:bg-dark-700 rounded-xl" />
        <div className="h-80 bg-dark-200 dark:bg-dark-700 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <StudentDashboard />;
}
