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
  CheckCircle, AlertCircle, ArrowRight, Sparkles, Server
} from 'lucide-react';
import { useTheme } from 'next-themes';

ChartJS.register(
  ArcElement, Tooltip, Legend, CategoryScale, 
  LinearScale, BarElement, PointElement, LineElement, Filler
);

const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

// ─── Admin Dashboard ─────────────────────────────────────────────────────────
function AdminDashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  
  // Set Chart defaults based on theme
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
    { label: 'Students', value: s?.total_students || 0, icon: GraduationCap, color: 'text-brand-indigo', bg: 'bg-brand-indigo/10', link: '/dashboard/students' },
    { label: 'Teams', value: s?.total_teams || 0, icon: Users2, color: 'text-brand-cyan', bg: 'bg-brand-cyan/10', link: '/dashboard/teams' },
    { label: 'Projects', value: s?.active_projects || 0, icon: FolderKanban, color: 'text-brand-purple', bg: 'bg-brand-purple/10', link: '/dashboard/projects' },
    { label: 'Completed', value: s?.completed_projects || 0, icon: CheckCircle, color: 'text-brand-emerald', bg: 'bg-brand-emerald/10', link: '/dashboard/projects' },
    { label: 'Present Today', value: s?.students_present_today || 0, icon: UserCheck, color: 'text-brand-emerald', bg: 'bg-brand-emerald/10', link: '/dashboard/attendance', sub: `${s?.attendance_percentage || 0}% rate` },
    { label: 'Absent Today', value: s?.students_absent_today || 0, icon: UserX, color: 'text-brand-amber', bg: 'bg-brand-amber/10', link: '/dashboard/attendance' },
    { label: 'Reviews', value: s?.pending_reviews || 0, icon: AlertCircle, color: 'text-brand-amber', bg: 'bg-brand-amber/10', link: '/dashboard/weekly-reports', sub: 'Action required' },
    { label: 'Meetings', value: s?.upcoming_meetings || 0, icon: Video, color: 'text-brand-red', bg: 'bg-brand-red/10', link: '/dashboard/meetings' },
  ];

  return (
    <div className="space-y-6">
      {/* Clean Welcome Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-[24px] p-8 bg-white dark:bg-[#1E293B] border border-dark-200 dark:border-white/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6"
      >
        <div>
          <h1 className="text-3xl font-heading font-bold text-dark-900 dark:text-white tracking-tight">
            Overview
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1 text-base max-w-xl leading-relaxed">
            Real-time statistics and analytics for your institution.
          </p>
        </div>
        <div className="flex gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-50 dark:bg-[#0F172A] border border-dark-100 dark:border-white/5 text-sm font-medium text-dark-600 dark:text-dark-300">
              <Server className="w-4 h-4 text-brand-emerald" />
              All systems operational
            </div>
        </div>
      </motion.div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, i) => (
          <motion.div 
            key={card.label} 
            {...fadeUp} 
            transition={{ delay: i * 0.05, duration: 0.3 }}
            onClick={() => router.push(card.link)}
            className="glass-card p-6 cursor-pointer group flex flex-col justify-between h-full hover:shadow-md transition-shadow"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wider">{card.label}</p>
                <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center transition-transform group-hover:scale-105`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <p className="text-4xl font-heading font-bold text-dark-900 dark:text-white tracking-tight">{card.value}</p>
            </div>
            
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-dark-100 dark:border-white/5 text-xs font-medium text-dark-500 dark:text-dark-400 group-hover:text-brand-indigo transition-colors">
              <span>{card.sub || 'View details'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Attendance Bar Chart */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 glass-card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-heading font-bold text-dark-900 dark:text-white">Attendance Flow</h3>
            <span className="px-3 py-1 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-full text-xs font-medium text-dark-600 dark:text-dark-300">Last 7 Days</span>
          </div>
          {attendanceChart?.data ? (
            <div className="h-[280px] w-full">
              <Bar 
                data={attendanceChart.data} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { 
                    legend: { position: 'top', align: 'end', labels: { boxWidth: 8, usePointStyle: true, font: { family: 'Inter' } } },
                    tooltip: { backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF', titleColor: theme === 'dark' ? '#fff' : '#0F172A', bodyColor: theme === 'dark' ? '#cbd5e1' : '#475569', borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1, padding: 12 }
                  },
                  scales: { 
                    x: { stacked: true, grid: { display: false }, border: { display: false } }, 
                    y: { stacked: true, grid: { color: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }, border: { display: false } } 
                  },
                }} 
              />
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-dark-400 font-medium">No attendance data available</div>
          )}
        </motion.div>

        {/* Project Status Doughnut Chart */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-heading font-bold text-dark-900 dark:text-white mb-6">Project Status</h3>
          {projectChart?.data ? (
            <div className="h-[280px] flex items-center justify-center">
              <Doughnut 
                data={projectChart.data} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { 
                    legend: { position: 'bottom', labels: { boxWidth: 8, usePointStyle: true, padding: 20 } },
                    tooltip: { backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF', titleColor: theme === 'dark' ? '#fff' : '#0F172A', bodyColor: theme === 'dark' ? '#cbd5e1' : '#475569', borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1 }
                  },
                  cutout: '75%',
                  elements: { arc: { borderWidth: 0 } }
                }} 
              />
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-dark-400 font-medium">No project data available</div>
          )}
        </motion.div>

        {/* Department Distribution Chart */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.4 }}
          className="col-span-full glass-card p-6"
        >
          <h3 className="text-lg font-heading font-bold text-dark-900 dark:text-white mb-6">Department Distribution</h3>
          {deptChart?.data ? (
            <div className="h-[300px] w-full flex justify-center">
              <Doughnut 
                data={deptChart.data} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { 
                    legend: { position: 'right', labels: { boxWidth: 8, usePointStyle: true, padding: 20 } },
                    tooltip: { backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF', titleColor: theme === 'dark' ? '#fff' : '#0F172A', bodyColor: theme === 'dark' ? '#cbd5e1' : '#475569', borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1 }
                  },
                  cutout: '65%',
                  elements: { arc: { borderWidth: 0 } }
                }} 
              />
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-dark-400 font-medium">No department data available</div>
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

  // Mock AI Insights based on data
  const aiInsights = [
    { title: "Attendance Notice", message: "Your attendance is strong. Keep it up to maintain your perfect record.", type: "success" },
    { title: "Upcoming Meeting", message: "You have a mentor sync tomorrow. Make sure your project updates are ready.", type: "warning" },
  ];

  return (
    <div className="space-y-6">
      {/* Clean Welcome Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-[24px] p-8 bg-white dark:bg-[#1E293B] border border-dark-200 dark:border-white/5 shadow-sm"
      >
        <h1 className="text-3xl font-heading font-bold text-dark-900 dark:text-white tracking-tight">
          Welcome back, {d?.user?.full_name?.split(' ')[0] || 'Student'} 👋
        </h1>
        <p className="text-dark-500 dark:text-dark-400 mt-2 text-base max-w-xl leading-relaxed">
          Here is your summary for today. Keep up the great work!
        </p>
      </motion.div>

      {/* AI Insights Section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {aiInsights.map((insight, idx) => (
          <div key={idx} className="flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-white/5 border border-dark-100 dark:border-white/5 shadow-sm">
            <div className={`p-2.5 rounded-xl ${insight.type === 'success' ? 'bg-brand-emerald/10 text-brand-emerald' : 'bg-brand-amber/10 text-brand-amber'}`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-dark-900 dark:text-white">{insight.title}</h4>
              <p className="text-xs text-dark-500 dark:text-dark-300 mt-1 leading-relaxed">{insight.message}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <motion.div 
          {...fadeUp}
          onClick={() => router.push('/dashboard/attendance')}
          className="glass-card p-6 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wider">Attendance</span>
            <div className="p-2.5 rounded-xl bg-brand-emerald/10">
              <UserCheck className="w-5 h-5 text-brand-emerald" />
            </div>
          </div>
          <p className="text-4xl font-heading font-bold text-dark-900 dark:text-white tracking-tight">{d?.attendance_percentage || 0}<span className="text-xl text-dark-400 font-medium ml-1">%</span></p>
          <div className="w-full bg-dark-100 dark:bg-dark-800 rounded-full h-1.5 mt-5 overflow-hidden">
            <div className="bg-brand-emerald h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${d?.attendance_percentage || 0}%` }} />
          </div>
        </motion.div>

        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.1 }}
          onClick={() => router.push('/dashboard/teams')}
          className="glass-card p-6 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wider">Active Team</span>
            <div className="p-2.5 rounded-xl bg-brand-indigo/10">
              <Users2 className="w-5 h-5 text-brand-indigo" />
            </div>
          </div>
          <p className="text-2xl font-bold text-dark-900 dark:text-white truncate mt-2">{d?.team?.name || 'Not assigned'}</p>
          <p className="text-xs text-dark-500 dark:text-dark-400 mt-2 font-medium">{d?.team?.mentor_name ? `Mentor: ${d.team.mentor_name}` : 'No mentor assigned'}</p>
        </motion.div>

        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.2 }}
          onClick={() => router.push('/dashboard/forms')}
          className="glass-card p-6 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wider">Pending Forms</span>
            <div className="p-2.5 rounded-xl bg-brand-amber/10">
              <ClipboardList className="w-5 h-5 text-brand-amber" />
            </div>
          </div>
          <p className="text-4xl font-heading font-bold text-dark-900 dark:text-white tracking-tight">{d?.pending_forms || 0}</p>
          <p className="text-xs text-brand-amber mt-4 font-semibold group-hover:translate-x-1 transition-transform">Action Required →</p>
        </motion.div>

        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.3 }}
          onClick={() => router.push('/dashboard/meetings')}
          className="glass-card p-6 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wider">Upcoming Calls</span>
            <div className="p-2.5 rounded-xl bg-brand-cyan/10">
              <Video className="w-5 h-5 text-brand-cyan" />
            </div>
          </div>
          <p className="text-4xl font-heading font-bold text-dark-900 dark:text-white tracking-tight">{d?.upcoming_meetings || 0}</p>
          <p className="text-xs text-brand-cyan mt-4 font-semibold group-hover:translate-x-1 transition-transform">Join Room →</p>
        </motion.div>
      </div>

      {/* Project + Notifications Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Project details card */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 glass-card p-8 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-heading font-bold text-dark-900 dark:text-white flex items-center gap-3">
                <div className="p-2 bg-brand-indigo/10 rounded-xl"><FolderKanban className="w-5 h-5 text-brand-indigo" /></div> 
                Active Project
              </h3>
              {d?.project && (
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  d.project.status === 'completed' ? 'bg-brand-emerald/10 text-brand-emerald border-brand-emerald/20' : 'bg-brand-indigo/10 text-brand-indigo border-brand-indigo/20'
                }`}>{d.project.status}</span>
              )}
            </div>

            {d?.project ? (
              <div className="space-y-6">
                <div>
                  <p className="font-bold text-dark-900 dark:text-white text-2xl tracking-tight">{d.project.title}</p>
                  <p className="text-sm text-dark-600 dark:text-dark-300 mt-3 leading-relaxed max-w-3xl">{d.project.description}</p>
                </div>

                {d.project.technologies_used && (
                  <div className="flex flex-wrap gap-2 mt-6">
                    {(Array.isArray(d.project.technologies_used)
                      ? d.project.technologies_used
                      : typeof d.project.technologies_used === 'string'
                      ? d.project.technologies_used.split(',')
                      : []
                    ).map((tech: string) => (
                      <span key={tech} className="px-3 py-1 bg-dark-50 dark:bg-white/5 border border-dark-100 dark:border-white/10 text-dark-600 dark:text-dark-200 rounded-lg text-xs font-medium">
                        {tech.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-dark-500">
                <div className="w-16 h-16 rounded-2xl bg-dark-50 dark:bg-white/5 flex items-center justify-center mb-6 border border-dark-100 dark:border-white/10">
                  <FolderKanban className="w-8 h-8 text-dark-300" />
                </div>
                <p className="text-base font-semibold text-dark-900 dark:text-white">No active project assigned</p>
                <p className="text-sm text-dark-500 mt-1">Check back later or contact your mentor.</p>
              </div>
            )}
          </div>

          {d?.project && (
            <div className="mt-8 pt-6 border-t border-dark-100 dark:border-white/10">
              <div className="flex justify-between items-center text-xs font-semibold mb-3 text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                <span>Progress Tracker</span>
                <span className="text-dark-900 dark:text-white bg-dark-50 dark:bg-white/5 px-2.5 py-1 rounded-md font-mono">{d.project.progress}% Complete</span>
              </div>
              <div className="w-full bg-dark-100 dark:bg-dark-800 rounded-full h-2 overflow-hidden">
                <div className="bg-brand-indigo h-2 rounded-full transition-all duration-1000 ease-out" style={{ width: `${d.project.progress}%` }} />
              </div>
            </div>
          )}
        </motion.div>

        {/* Notifications card */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.5 }}
          className="glass-card p-6 flex flex-col h-full"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-heading font-bold text-dark-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-brand-amber/10 rounded-xl"><Megaphone className="w-5 h-5 text-brand-amber" /></div> 
              Recent Activity
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
            {d?.recent_notifications?.length > 0 ? (
              <div className="space-y-3">
                {d.recent_notifications.map((n: any) => (
                  <div 
                    key={n.id} 
                    className={`p-4 rounded-xl border transition-all duration-200 ${
                      n.is_read 
                        ? 'border-dark-100 dark:border-white/5 bg-dark-50/50 dark:bg-white/5' 
                        : 'border-brand-indigo/20 bg-brand-indigo/5'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${n.is_read ? 'text-dark-900 dark:text-white' : 'text-brand-indigo dark:text-brand-cyan'}`}>{n.title}</p>
                    <p className="text-xs text-dark-500 dark:text-dark-300 mt-1.5 leading-relaxed">{n.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full py-16 flex flex-col items-center justify-center text-dark-500">
                <div className="w-16 h-16 rounded-2xl bg-dark-50 dark:bg-white/5 flex items-center justify-center mb-6 border border-dark-100 dark:border-white/10">
                  <Megaphone className="w-8 h-8 text-dark-300" />
                </div>
                <p className="text-sm font-semibold text-dark-900 dark:text-white">All caught up!</p>
                <p className="text-xs text-dark-500 mt-1 text-center">No recent announcements<br/>to display right now.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-32 bg-dark-100 dark:bg-white/5 rounded-2xl w-full mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1,2,3,4].map(i => <div key={i} className="h-40 bg-dark-100 dark:bg-white/5 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        <div className="lg:col-span-2 h-96 bg-dark-100 dark:bg-white/5 rounded-2xl" />
        <div className="h-96 bg-dark-100 dark:bg-white/5 rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <StudentDashboard />;
}
