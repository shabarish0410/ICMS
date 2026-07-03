'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopNav from '@/components/layout/TopNav';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, UserCheck, FolderKanban, Calendar, Menu, X, 
  GraduationCap, Users2, ClipboardList, FileText, Megaphone, Video, 
  Bell, Settings, LogOut, Cpu, Sparkles
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, isAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && user) {
      if (user.must_change_password) {
        router.push('/complete-profile?step=password');
      } else if (!user.is_profile_completed) {
        router.push('/complete-profile');
      }
    }
  }, [isLoading, user, router]);

  // Handle drawer close when pathname changes
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="flex flex-col items-center gap-6">
          <motion.div 
            animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(37,99,235,0.3)] bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-blue/20 to-brand-purple/20 animate-pulse" />
            <Image 
              src="/logo.jpg" 
              alt="Loading..." 
              width={96} 
              height={96} 
              priority
              className="object-contain w-full h-full scale-110 mix-blend-screen"
            />
          </motion.div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-blue animate-bounce shadow-[0_0_10px_rgba(37,99,235,0.8)]" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-brand-purple animate-bounce shadow-[0_0_10px_rgba(124,58,237,0.8)]" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-brand-pink animate-bounce shadow-[0_0_10px_rgba(236,72,153,0.8)]" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Primary bottom navigation items for mobile
  const mobileNavItems = [
    { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Attendance', href: '/dashboard/attendance', icon: UserCheck },
    { label: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
    { label: 'Events', href: '/dashboard/events', icon: Calendar },
  ];

  // Secondary items shown in the bottom drawer
  const drawerItems = [
    ...(isAdmin ? [{ label: 'Students', href: '/dashboard/students', icon: GraduationCap }] : []),
    { label: 'Teams', href: '/dashboard/teams', icon: Users2 },
    { label: 'Forms', href: '/dashboard/forms', icon: ClipboardList },
    { label: 'Weekly Reports', href: '/dashboard/weekly-reports', icon: FileText },
    { label: 'Announcements', href: '/dashboard/announcements', icon: Megaphone },
    { label: 'Meetings', href: '/dashboard/meetings', icon: Video },
    { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col pb-[72px] lg:pb-0 selection:bg-brand-blue/30 relative">
      {/* Global Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[40%] h-[40%] bg-brand-blue/10 rounded-full mix-blend-screen filter blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[40%] bg-brand-purple/10 rounded-full mix-blend-screen filter blur-[120px]" />
      </div>

      {/* Sidebar for Desktop */}
      <Sidebar />

      {/* Main Container */}
      <div className="lg:pl-[280px] flex-1 flex flex-col transition-all duration-300 relative z-10">
        <TopNav onMenuToggle={() => setIsDrawerOpen(true)} />
        <motion.main 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="p-4 md:p-8 flex-1 w-full max-w-7xl mx-auto"
        >
          {children}
        </motion.main>
      </div>

      {/* Bottom Navigation for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-dark-900/80 backdrop-blur-xl border-t border-white/10 h-16 px-4 flex items-center justify-around shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center flex-1 h-full py-2">
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-gradient-to-br from-brand-blue to-brand-purple shadow-lg shadow-brand-blue/30 scale-110 text-white' : 'text-dark-400 hover:text-white hover:bg-white/5'}`}>
                <Icon className="w-5.5 h-5.5" />
              </div>
              <span className={`text-[10px] font-medium transition-colors mt-1 ${isActive ? 'text-white' : 'text-dark-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More Button to trigger Slide-up Drawer */}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full py-2 text-dark-400 hover:text-white"
        >
          <div className="p-1.5 rounded-xl transition-all duration-300 hover:bg-white/5">
            <Menu className="w-5.5 h-5.5" />
          </div>
          <span className="text-[10px] font-medium mt-1">More</span>
        </button>
      </div>

      {/* Mobile Bottom Drawer Sheet */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden"
            />

            {/* Bottom Drawer Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto bg-dark-900/95 backdrop-blur-xl rounded-t-3xl border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] p-6 lg:hidden flex flex-col"
            >
              {/* Drawer Handle */}
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />

              {/* Title / Close Button */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center shadow-lg shadow-brand-blue/20">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-heading font-bold text-white tracking-tight">Spark</h2>
                    <p className="text-[11px] text-brand-cyan font-medium uppercase tracking-wider">Quick Navigator</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 rounded-xl bg-white/5 text-dark-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Profile Card */}
              {user && (
                <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center text-white font-bold text-lg shadow-inner">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-white truncate">{user.full_name}</p>
                    <p className="text-sm text-dark-400 truncate mt-0.5">{user.ic_number} • <span className="text-brand-cyan">{user.role?.name}</span></p>
                  </div>
                </div>
              )}

              {/* Navigation Grid (Touch-Friendly Layout) */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {drawerItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${isActive ? 'bg-gradient-to-br from-brand-blue/20 to-brand-purple/20 border-brand-blue/50 text-white shadow-lg shadow-brand-blue/10' : 'bg-white/5 border-white/5 text-dark-300 hover:text-white hover:bg-white/10 hover:border-white/10'}`}>
                      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-brand-cyan' : 'text-dark-400'}`} />
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white text-base font-bold transition-all duration-300 mt-auto shadow-sm hover:shadow-red-500/25"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
