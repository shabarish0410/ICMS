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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-heading font-bold text-white tracking-tight">Admin Dashboard</h1>
          <p className="text-dark-400 mt-1.5 font-medium">Real-time stats and center utilization analytics</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-xs font-semibold text-brand-cyan bg-white/5 border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2 w-fit shadow-inner">
          <Clock className="w-4 h-4" />
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </motion.div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, i) => (
          <motion.div 
            key={card.label} 
            {...fadeUp} 
            transition={{ delay: i * 0.05, duration: 0.4 }}
            onClick={() => router.push(card.link)}
            className="stat-card cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-dark-400 uppercase tracking-wider">{card.label}</p>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-4xl font-mono font-bold text-white tracking-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/50 transition-all">{card.value}</p>
            </div>
            
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10 text-xs font-bold text-dark-500 group-hover:text-brand-blue transition-colors">
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

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-white tracking-tight">
          Welcome back, {d?.user?.full_name?.split(' ')[0] || 'Student'} 👋
        </h1>
        <p className="text-dark-400 mt-2 font-medium">Your innovation journey snapshot</p>
      </motion.div>

      {/* Quick Interactive Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <motion.div 
          {...fadeUp}
          onClick={() => router.push('/dashboard/attendance')}
          className="stat-card cursor-pointer border-t-[3px] border-t-brand-emerald"
        >
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-wider">Attendance</span>
            <div className="p-2 rounded-xl bg-brand-emerald/10">
              <UserCheck className="w-5 h-5 text-brand-emerald group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <p className="text-4xl font-mono font-bold text-white tracking-tight">{d?.attendance_percentage || 0}%</p>
          <div className="w-full bg-white/5 rounded-full h-1.5 mt-4 overflow-hidden">
            <div className="bg-gradient-to-r from-brand-emerald to-emerald-400 h-1.5 rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${d?.attendance_percentage || 0}%` }}>
               <div className="absolute inset-0 bg-white/30 animate-[slide-in-right_2s_infinite]" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.1 }}
          onClick={() => router.push('/dashboard/teams')}
          className="stat-card cursor-pointer border-t-[3px] border-t-brand-purple"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-wider">Active Team</span>
            <div className="p-2 rounded-xl bg-brand-purple/10">
              <Users2 className="w-5 h-5 text-brand-purple group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <p className="text-xl font-bold text-white truncate">{d?.team?.name || 'Not assigned'}</p>
          <p className="text-xs text-brand-cyan mt-2 font-medium">{d?.team?.mentor_name ? `Mentor: ${d.team.mentor_name}` : 'No mentor assigned'}</p>
        </motion.div>

        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.2 }}
          onClick={() => router.push('/dashboard/forms')}
          className="stat-card cursor-pointer border-t-[3px] border-t-brand-orange"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-wider">Pending Forms</span>
            <div className="p-2 rounded-xl bg-brand-orange/10">
              <ClipboardList className="w-5 h-5 text-brand-orange group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <p className="text-4xl font-mono font-bold text-white">{d?.pending_forms || 0}</p>
          <p className="text-xs text-dark-400 mt-2 font-medium group-hover:text-brand-orange transition-colors">Click to fill forms</p>
        </motion.div>

        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.3 }}
          onClick={() => router.push('/dashboard/meetings')}
          className="stat-card cursor-pointer border-t-[3px] border-t-brand-blue"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-wider">Upcoming Calls</span>
            <div className="p-2 rounded-xl bg-brand-blue/10">
              <Video className="w-5 h-5 text-brand-blue group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <p className="text-4xl font-mono font-bold text-white">{d?.upcoming_meetings || 0}</p>
          <p className="text-xs text-dark-400 mt-2 font-medium group-hover:text-brand-blue transition-colors">Join secure rooms</p>
        </motion.div>
      </div>

      {/* Project + Notifications Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        {/* Project details card */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.4 }}
          className="glass-card p-6 lg:p-8"
        >
          <h3 className="text-lg font-heading font-bold text-white mb-6 flex items-center gap-3">
            <div className="p-2 bg-brand-blue/10 rounded-lg"><FolderKanban className="w-5 h-5 text-brand-blue" /></div> Active Project
          </h3>
          {d?.project ? (
            <div className="space-y-6">
              <div>
                <p className="font-bold text-white text-xl">{d.project.title}</p>
                <p className="text-sm text-dark-300 mt-2 leading-relaxed">{d.project.description}</p>
              </div>

              {/* Problem/Solution */}
              {d.project.problem_statement && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-sm space-y-2">
                  <span className="font-bold text-brand-cyan tracking-wide">Problem Statement:</span>
                  <p className="text-dark-300 italic leading-relaxed">"{d.project.problem_statement}"</p>
                </div>
              )}

              {/* Technologies Used */}
              {d.project.technologies_used && (
                <div>
                  <span className="text-xs font-bold text-dark-400 uppercase tracking-wider mb-3 block">Technologies:</span>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(d.project.technologies_used)
                      ? d.project.technologies_used
                      : typeof d.project.technologies_used === 'string'
                      ? d.project.technologies_used.split(',')
                      : []
                    ).map((tech: string) => (
                      <span key={tech} className="px-3 py-1 bg-brand-blue/10 border border-brand-blue/20 text-brand-blue rounded-lg text-xs font-bold shadow-inner">
                        {tech.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-center text-sm font-semibold mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs uppercase font-bold tracking-widest ${
                    d.project.status === 'completed' ? 'bg-brand-emerald/20 text-brand-emerald border border-brand-emerald/30' : 'bg-brand-blue/20 text-brand-blue border border-brand-blue/30'
                  }`}>{d.project.status}</span>
                  <span className="text-white bg-white/10 px-3 py-1 rounded-full font-mono">{d.project.progress}% Complete</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden shadow-inner">
                  <div className="bg-gradient-to-r from-brand-blue to-brand-purple h-2 rounded-full transition-all duration-1000 ease-out" style={{ width: `${d.project.progress}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center text-dark-500">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <FolderKanban className="w-8 h-8 text-dark-400" />
              </div>
              <p className="text-base font-medium">No active project assigned yet.</p>
            </div>
          )}
        </motion.div>

        {/* Notifications card */}
        <motion.div 
          {...fadeUp} 
          transition={{ delay: 0.5 }}
          className="glass-card p-6 lg:p-8"
        >
          <h3 className="text-lg font-heading font-bold text-white mb-6 flex items-center gap-3">
            <div className="p-2 bg-brand-orange/10 rounded-lg"><Megaphone className="w-5 h-5 text-brand-orange" /></div> Announcements
          </h3>
          {d?.recent_notifications?.length > 0 ? (
            <div className="space-y-4">
              {d.recent_notifications.map((n: any) => (
                <div 
                  key={n.id} 
                  className={`p-4 rounded-xl border transition-all hover:bg-white/5 group ${
                    n.is_read 
                      ? 'border-white/10 bg-white/5' 
                      : 'border-brand-pink/30 bg-brand-pink/5 shadow-[0_0_15px_rgba(236,72,153,0.1)]'
                  }`}
                >
                  <p className="text-sm font-bold text-white group-hover:text-brand-pink transition-colors">{n.title}</p>
                  <p className="text-xs text-dark-400 mt-2 leading-relaxed">{n.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center text-dark-500">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Megaphone className="w-8 h-8 text-dark-400" />
              </div>
              <p className="text-base font-medium">No recent announcements.</p>
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
