'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import AdminAttendance from '@/components/attendance/AdminAttendance';
import StudentAttendance from '@/components/attendance/StudentAttendance';
import { motion } from 'framer-motion';

export default function AttendancePage() {
  const { user, isAdmin, isStudent } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Use the existing ICMS role implementation
  const isFacultyOrAdmin = isAdmin;
  const isUserStudent = isStudent;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-8 max-w-6xl mx-auto"
    >
      <div className="page-header mb-8">
        <div>
          <h1 className="page-title text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Attendance</h1>
          <p className="page-subtitle text-gray-500">
            {isFacultyOrAdmin ? 'Manage attendance sessions' : 'Mark your attendance securely'}
          </p>
        </div>
      </div>

      {isFacultyOrAdmin ? (
        <AdminAttendance />
      ) : isUserStudent ? (
        <StudentAttendance />
      ) : (
        <div className="bg-red-50 p-6 rounded-lg text-red-600 text-center">
          You do not have permission to view the attendance module.
        </div>
      )}
    </motion.div>
  );
}
