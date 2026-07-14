'use client';

import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

export default function LogsPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Activity Logs</h1>
        <p className="text-dark-500 dark:text-dark-400 mt-1">Track all system activities</p>
      </div>
      <div className="glass-card p-8 text-center">
        <Activity className="w-12 h-12 text-dark-300 mx-auto mb-3" />
        <p className="text-dark-400">Activity logs are available via the dashboard API.</p>
        <p className="text-sm text-dark-500 mt-1">View recent activities on the main Dashboard page.</p>
      </div>
    </motion.div>
  );
}
