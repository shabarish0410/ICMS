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
  Bell, Settings, LogOut, Cpu
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
      <div className="min-h-screen flex items-center justify-center bg-dark-50 dark:bg-dark-900">
        <div className="flex flex-col items-center gap-6">
          <motion.div 
            animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 rounded-2xl overflow-hidden shadow-2xl bg-black ring-1 ring-white/10 flex items-center justify-center"
          >
            <Image 
              src="/logo.jpg" 
              alt="Loading..." 
              width={96} 
              height={96} 
              priority
              className="object-contain w-full h-full scale-110"
            />
          </motion.div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '300ms' }} />
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
    <div className="min-h-screen bg-dark-50 dark:bg-dark-900 flex flex-col pb-[72px] lg:pb-0">
      {/* Sidebar for Desktop */}
      <Sidebar />

      {/* Main Container */}
      <div className="lg:pl-[260px] flex-1 flex flex-col transition-all duration-300">
        <TopNav onMenuToggle={() => setIsDrawerOpen(true)} />
        <main className="p-4 md:p-6 flex-1">
          {children}
        </main>
      </div>

      {/* Bottom Navigation for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/80 dark:bg-dark-950/80 backdrop-blur-lg border-t border-dark-200 dark:border-dark-800 h-16 px-4 flex items-center justify-around">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center flex-1 h-full py-2">
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 scale-105' : 'text-dark-500 dark:text-dark-400'}`}>
                <Icon className="w-5.5 h-5.5" />
              </div>
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-dark-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More Button to trigger Slide-up Drawer */}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full py-2 text-dark-500 dark:text-dark-400"
        >
          <div className="p-1.5 rounded-xl transition-all duration-300 hover:bg-dark-50 dark:hover:bg-dark-850">
            <Menu className="w-5.5 h-5.5" />
          </div>
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>

      {/* Mobile Bottom Drawer Sheet */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 lg:hidden"
            />

            {/* Bottom Drawer Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto bg-white dark:bg-dark-950 rounded-t-3xl border-t border-dark-200 dark:border-dark-800 shadow-2xl p-6 lg:hidden flex flex-col"
            >
              {/* Drawer Handle */}
              <div className="w-12 h-1.5 bg-dark-200 dark:bg-dark-700 rounded-full mx-auto mb-6" />

              {/* Title / Close Button */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                    <Cpu className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-dark-900 dark:text-white">Spark</h2>
                    <p className="text-[10px] text-dark-400 -mt-0.5">Quick Navigator</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-lg bg-dark-50 dark:bg-dark-850 text-dark-500 hover:text-dark-750 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Profile Card */}
              {user && (
                <div className="mb-6 p-4 rounded-2xl bg-dark-50 dark:bg-dark-900/50 border border-dark-100 dark:border-dark-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-sm">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-dark-900 dark:text-white truncate">{user.full_name}</p>
                    <p className="text-xs text-dark-400 truncate">{user.ic_number} · {user.role?.name}</p>
                  </div>
                </div>
              )}

              {/* Navigation Grid (Touch-Friendly Layout) */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {drawerItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 ${isActive ? 'bg-primary-50/50 dark:bg-primary-950/20 border-primary-200 dark:border-primary-800/60 text-primary-600 dark:text-primary-400 font-semibold' : 'bg-transparent border-dark-150 dark:border-dark-850 text-dark-700 dark:text-dark-300 hover:bg-dark-50/50 dark:hover:bg-dark-900/30'}`}>
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-xs truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-500 hover:bg-red-100/50 dark:hover:bg-red-950/40 text-sm font-semibold transition-colors mt-auto"
              >
                <LogOut className="w-4.5 h-4.5" />
                Sign Out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
