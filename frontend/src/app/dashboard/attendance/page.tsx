'use client';

import React from 'react';

export default function AttendancePlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="p-6 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-2xl max-w-md w-full shadow-lg backdrop-blur-xl">
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
          Attendance Module
        </h1>
        <p className="text-dark-500 dark:text-dark-300">
          The Attendance module is currently disabled.
        </p>
      </div>
    </div>
  );
}
