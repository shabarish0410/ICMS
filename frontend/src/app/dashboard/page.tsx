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
  CheckCircle, AlertCircle, Loader2, ArrowRight, Sparkles
} from 'lucide-react';

ChartJS.register(
  ArcElement, Tooltip, Legend, CategoryScale, 
  LinearScale, BarElement, PointElement, LineElement, Filler
);

// Global Chart Defaults for Theme
ChartJS.defaults.color = '#94a3b8'; // text-dark-400
ChartJS.defaults.font.family = 'var(--font-inter)';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

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
    { label: 'Students', value: s?.total_students || 0, icon: GraduationCap, color: 'from-[#2563EB] to-[#4F46E5]', link: '/dashboard/students' },
    { label: 'Teams', value: s?.total_teams || 0, icon: Users2, color: 'from-[#06B6D4] to-[#2563EB]', link: '/dashboard/teams' },
    { label: 'Projects', value: s?.active_projects || 0, icon: FolderKanban, color: 'from-[#7C3AED] to-[#EC4899]', link: '/dashboard/projects' },
    { label: 'Completed', value: s?.completed_projects || 0, icon: CheckCircle, color: 'from-[#10B981] to-[#059669]', link: '/dashboard/projects' },
    { label: 'Present Today', value: s?.students_present_today || 0, icon: UserCheck, color: 'from-[#10B981] to-emerald-400', link: '/dashboard/attendance', sub: `${s?.attendance_percentage || 0}% rate` },
    { label: 'Absent Today', value: s?.students_absent_today || 0, icon: UserX, color: 'from-[#F97316] to-[#EF4444]', link: '/dashboard/attendance' },
    { label: 'Reviews', value: s?.pending_reviews || 0, icon: AlertCircle, color: 'from-[#F97316] to-amber-500', link: '/dashboard/weekly-reports', sub: 'Action required' },
    { label: 'Meetings', value: s?.upcoming_meetings || 0, icon: Video, color: 'from-[#EC4899] to-rose-500', link: '/dashboard/meetings' },
  ];

  return (
    <div className="space-y-6">
      {/* Modern Welcome Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -20, scale: 0.98 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }} 
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-br from-brand-blue/20 via-[#0B1120] to-brand-purple/20 border border-white/10 shadow-2xl mb-8"
      >
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-brand-blue/30 rounded-full blur-[80px] pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-4xl font-heading font-extrabold text-white tracking-tight drop-shadow-sm">
              Admin Dashboard
            </h1>
            <p className="text-dark-300 mt-2 text-lg font-medium max-w-xl leading-relaxed">
              Real-time statistics and center utilization analytics
            </p>
          </div>
          <div className="text-xs font-bold text-brand-cyan bg-white/5 border border-white/10 px-5 py-3 rounded-xl flex items-center gap-2 w-fit shadow-inner backdrop-blur-md uppercase tracking-widest">
            <Clock className="w-4 h-4" />
            {new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </motion.div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, i) => (
          <motion.div 
            key={card.label} 
            {...fadeUp} 
            transition={{ delay: i * 0.05, duration: 0.4 }}
            onClick={() => router.push(card.link)}
            className="stat-card cursor-pointer group flex flex-col justify-between h-full"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-dark-400 uppercase tracking-widest">{card.label}</p>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300 bg-opacity-20`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-5xl font-heading font-extrabold text-white tracking-tighter group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/50 transition-all">{card.value}</p>
            </div>
            
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10 text-xs font-bold text-dark-500 group-hover:text-brand-blue transition-colors uppercase tracking-widest">
              <span>{card.sub || 'VIEW DETAILS'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        {/* Attendance Bar Chart */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.4, duration: 0.5 }}
          className="lg:col-span-2 glass-card p-6 border-t-[3px] border-t-brand-blue"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-heading font-bold text-white">Attendance Flow</h3>
            <span className="badge badge-blue">Last 7 Days</span>
          </div>
          {attendanceChart?.data ? (
            <div className="h-[250px] w-full">
              <Bar 
                data={attendanceChart.data} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { 
                    legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
                    tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', titleColor: '#fff', bodyColor: '#cbd5e1', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }
                  },
                  scales: { 
                    x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8' } }, 
                    y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' }, border: { display: false } } 
                  },
                }} 
              />
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-dark-500 font-medium">No attendance data available</div>
          )}
        </motion.div>

        {/* Project Status Doughnut Chart */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.45, duration: 0.5 }}
          className="glass-card p-6 border-t-[3px] border-t-brand-purple"
        >
          <h3 className="text-lg font-heading font-bold text-white mb-6">Project Status</h3>
          {projectChart?.data ? (
            <div className="h-[250px] flex items-center justify-center">
              <Doughnut 
                data={projectChart.data} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { 
                    legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, padding: 20 } },
                    tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }
                  },
                  cutout: '75%',
                  elements: { arc: { borderWidth: 0 } }
                }} 
              />
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-dark-500 font-medium">No project data available</div>
          )}
        </motion.div>

        {/* Department Distribution Chart */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.5, duration: 0.5 }}
          className="col-span-full glass-card p-6 border-t-[3px] border-t-brand-cyan"
        >
          <h3 className="text-lg font-heading font-bold text-white mb-6">Department Distribution</h3>
          {deptChart?.data ? (
            <div className="h-[300px] w-full flex justify-center">
              <Doughnut 
                data={deptChart.data} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { 
                    legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true, font: { size: 12 } } },
                    tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }
                  },
                  cutout: '60%',
                  elements: { arc: { borderWidth: 0 } }
                }} 
              />
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-dark-500 font-medium">No department data available</div>
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
    { title: "Attendance Notice", message: "Your attendance is strong, keep it up to maintain your perfect record.", type: "success" },
    { title: "Upcoming Meeting", message: "You have a mentor sync tomorrow. Make sure your project updates are ready.", type: "warning" },
  ];

  return (
    <div className="space-y-6">
      {/* Modern Welcome Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -20, scale: 0.98 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }} 
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-br from-brand-indigo/20 via-[#0B1120] to-brand-cyan/20 border border-white/10 shadow-2xl"
      >
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-brand-indigo/30 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-4xl font-heading font-extrabold text-white tracking-tight drop-shadow-sm">
            Welcome back, {d?.user?.full_name?.split(' ')[0] || 'Student'} <span className="inline-block animate-wave">👋</span>
          </h1>
          <p className="text-dark-300 mt-2 text-lg font-medium max-w-xl leading-relaxed">
            Here's what's happening in your innovation journey today.
          </p>
        </div>
      </motion.div>

      {/* AI Insights Section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {aiInsights.map((insight, idx) => (
          <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-xl group">
            <div className={`p-2.5 rounded-xl ${insight.type === 'success' ? 'bg-brand-emerald/10 text-brand-emerald group-hover:bg-brand-emerald/20' : 'bg-brand-amber/10 text-brand-amber group-hover:bg-brand-amber/20'} transition-colors`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">{insight.title}</h4>
              <p className="text-xs text-dark-300 mt-1 leading-relaxed">{insight.message}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Quick Interactive Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <motion.div 
          {...fadeUp}
          onClick={() => router.push('/dashboard/attendance')}
          className="stat-card cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-widest">Attendance</span>
            <div className="p-2.5 rounded-xl bg-white/5 group-hover:bg-brand-emerald/10 transition-colors">
              <UserCheck className="w-5 h-5 text-dark-300 group-hover:text-brand-emerald transition-colors" />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-5xl font-heading font-extrabold text-white tracking-tighter">{d?.attendance_percentage || 0}<span className="text-2xl text-dark-400 font-medium">%</span></p>
          </div>
          <div className="w-full bg-dark-800 rounded-full h-1.5 mt-5 overflow-hidden shadow-inner">
            <div className="bg-brand-emerald h-1.5 rounded-full transition-all duration-1000 ease-out relative shadow-[0_0_10px_rgba(16,185,129,0.8)]" style={{ width: `${d?.attendance_percentage || 0}%` }}>
               <div className="absolute inset-0 bg-white/30 animate-[slide-in-right_2s_infinite]" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.1 }}
          onClick={() => router.push('/dashboard/teams')}
          className="stat-card cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-widest">Active Team</span>
            <div className="p-2.5 rounded-xl bg-white/5 group-hover:bg-brand-indigo/10 transition-colors">
              <Users2 className="w-5 h-5 text-dark-300 group-hover:text-brand-indigo transition-colors" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white truncate leading-tight mt-2">{d?.team?.name || 'Not assigned'}</p>
          <p className="text-xs text-brand-cyan mt-3 font-semibold uppercase tracking-wider">{d?.team?.mentor_name ? `Mentor: ${d.team.mentor_name}` : 'No mentor'}</p>
        </motion.div>

        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.2 }}
          onClick={() => router.push('/dashboard/forms')}
          className="stat-card cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-widest">Pending Forms</span>
            <div className="p-2.5 rounded-xl bg-white/5 group-hover:bg-brand-amber/10 transition-colors">
              <ClipboardList className="w-5 h-5 text-dark-300 group-hover:text-brand-amber transition-colors" />
            </div>
          </div>
          <p className="text-5xl font-heading font-extrabold text-white tracking-tighter">{d?.pending_forms || 0}</p>
          <p className="text-xs text-dark-400 mt-4 font-semibold uppercase tracking-wider group-hover:text-brand-amber transition-colors">Action Required →</p>
        </motion.div>

        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.3 }}
          onClick={() => router.push('/dashboard/meetings')}
          className="stat-card cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-widest">Upcoming Calls</span>
            <div className="p-2.5 rounded-xl bg-white/5 group-hover:bg-brand-cyan/10 transition-colors">
              <Video className="w-5 h-5 text-dark-300 group-hover:text-brand-cyan transition-colors" />
            </div>
          </div>
          <p className="text-5xl font-heading font-extrabold text-white tracking-tighter">{d?.upcoming_meetings || 0}</p>
          <p className="text-xs text-dark-400 mt-4 font-semibold uppercase tracking-wider group-hover:text-brand-cyan transition-colors">Join Room →</p>
        </motion.div>
      </div>

      {/* Project + Notifications Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Project details card - Takes 2 cols */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 glass-card p-8 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-heading font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-brand-indigo/20 rounded-xl shadow-[0_0_10px_rgba(99,102,241,0.3)]"><FolderKanban className="w-5 h-5 text-brand-indigo" /></div> 
                Active Project
              </h3>
              {d?.project && (
                <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest border ${
                  d.project.status === 'completed' ? 'bg-brand-emerald/10 text-brand-emerald border-brand-emerald/20' : 'bg-brand-indigo/10 text-brand-indigo border-brand-indigo/20'
                }`}>{d.project.status}</span>
              )}
            </div>

            {d?.project ? (
              <div className="space-y-6">
                <div>
                  <p className="font-bold text-white text-2xl tracking-tight">{d.project.title}</p>
                  <p className="text-sm text-dark-300 mt-3 leading-relaxed max-w-3xl">{d.project.description}</p>
                </div>

                {d.project.technologies_used && (
                  <div className="flex flex-wrap gap-2 mt-6">
                    {(Array.isArray(d.project.technologies_used)
                      ? d.project.technologies_used
                      : typeof d.project.technologies_used === 'string'
                      ? d.project.technologies_used.split(',')
                      : []
                    ).map((tech: string) => (
                      <span key={tech} className="px-3 py-1 bg-white/5 border border-white/10 text-dark-200 rounded-lg text-xs font-semibold shadow-inner">
                        {tech.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-dark-500">
                <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-6 shadow-inner border border-white/10">
                  <FolderKanban className="w-8 h-8 text-dark-400" />
                </div>
                <p className="text-base font-semibold text-white">No active project assigned yet.</p>
                <p className="text-sm text-dark-400 mt-2">Check back later or contact your mentor.</p>
              </div>
            )}
          </div>

          {d?.project && (
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex justify-between items-center text-xs font-bold mb-3 text-dark-300 uppercase tracking-widest">
                <span>Progress Tracker</span>
                <span className="text-white bg-white/10 px-3 py-1 rounded-full font-mono shadow-inner">{d.project.progress}% Complete</span>
              </div>
              <div className="w-full bg-dark-800 rounded-full h-2.5 overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-brand-indigo to-brand-cyan h-2.5 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(6,182,212,0.6)]" style={{ width: `${d.project.progress}%` }} />
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
            <h3 className="text-lg font-heading font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-brand-amber/20 rounded-xl shadow-[0_0_10px_rgba(245,158,11,0.3)]"><Megaphone className="w-5 h-5 text-brand-amber" /></div> 
              Recent Activity
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
            {d?.recent_notifications?.length > 0 ? (
              <div className="space-y-4">
                {d.recent_notifications.map((n: any) => (
                  <div 
                    key={n.id} 
                    className={`p-4 rounded-2xl border transition-all duration-300 hover:bg-white/10 hover:shadow-lg hover:-translate-y-0.5 group ${
                      n.is_read 
                        ? 'border-white/5 bg-white/5' 
                        : 'border-brand-indigo/30 bg-brand-indigo/10 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                    }`}
                  >
                    <p className={`text-sm font-bold transition-colors ${n.is_read ? 'text-white' : 'text-brand-indigo group-hover:text-brand-cyan'}`}>{n.title}</p>
                    <p className="text-xs text-dark-300 mt-2 leading-relaxed">{n.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full py-16 flex flex-col items-center justify-center text-dark-500">
                <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-6 shadow-inner border border-white/10">
                  <Megaphone className="w-8 h-8 text-dark-400" />
                </div>
                <p className="text-sm font-semibold text-white">All caught up!</p>
                <p className="text-xs text-dark-400 mt-2 text-center">No recent announcements<br/>to display right now.</p>
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
      <div className="h-10 bg-white/5 border border-white/10 rounded-xl w-72 mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1,2,3,4].map(i => <div key={i} className="h-40 bg-white/5 border border-white/10 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        <div className="lg:col-span-2 h-96 bg-white/5 border border-white/10 rounded-2xl" />
        <div className="h-96 bg-white/5 border border-white/10 rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <StudentDashboard />;
}
