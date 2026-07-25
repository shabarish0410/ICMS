'use client';

import { motion } from 'framer-motion';
import { Camera, CheckCircle2, Clock, UserCheck, Shield, Zap, AlertCircle } from 'lucide-react';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay, ease: 'easeOut' as const },
});

const features = [
  {
    icon: Camera,
    title: 'Face Recognition',
    description:
      'AI-powered facial recognition automatically marks attendance — no manual check-ins or forms required.',
    iconClass: 'text-blue-600',
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    icon: Clock,
    title: 'Real-time Tracking',
    description:
      'Attendance is logged in real-time with precise timestamps. Late arrivals and absences are flagged automatically.',
    iconClass: 'text-green-600',
    bgClass: 'bg-green-50 dark:bg-green-950/30',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description:
      'Biometric data is encrypted at rest and in transit. The system is compliant with institutional privacy requirements.',
    iconClass: 'text-purple-600',
    bgClass: 'bg-purple-50 dark:bg-purple-950/30',
  },
  {
    icon: Zap,
    title: 'Instant Reports',
    description:
      'Daily, weekly, and monthly reports are generated automatically and available for export as CSV.',
    iconClass: 'text-amber-600',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
  },
];

const steps = [
  {
    number: '01',
    title: 'Enroll',
    description: 'An administrator registers your face via the secure enrollment workflow.',
  },
  {
    number: '02',
    title: 'Verify',
    description: 'The AI model validates the capture for accuracy before activating recognition.',
  },
  {
    number: '03',
    title: 'Check In',
    description: 'Walk past the camera. Attendance is marked instantly — no action needed.',
  },
  {
    number: '04',
    title: 'Review',
    description: 'View your full attendance history with daily and weekly breakdowns.',
  },
];

export default function AttendancePage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-8 max-w-4xl"
    >
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">AI-powered face recognition attendance system</p>
        </div>
      </div>

      {/* ── Status Notice ── */}
      <motion.div {...fadeUp(0.05)}>
        <div className="flex gap-4 p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <div className="flex-shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Attendance records coming soon
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Your attendance history and live session status will appear here once the facial
              recognition system is activated for your institution.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── How It Works ── */}
      <motion.div {...fadeUp(0.1)}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              {...fadeUp(0.12 + i * 0.05)}
              className="card p-5 relative overflow-hidden"
            >
              <div className="absolute top-4 right-4 text-4xl font-black text-slate-100 dark:text-white/5 select-none leading-none">
                {step.number}
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white relative">
                {step.title}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed relative">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Features ── */}
      <motion.div {...fadeUp(0.2)}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                {...fadeUp(0.22 + i * 0.05)}
                className="card p-6 flex gap-4 hover:shadow-md transition-shadow"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 self-start ${feat.bgClass}`}
                >
                  <Icon className={`w-5 h-5 ${feat.iconClass}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {feat.title}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Contact CTA ── */}
      <motion.div
        {...fadeUp(0.3)}
        className="card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Need to set up attendance?
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Contact your administrator to activate face recognition enrollment.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-green-600 font-semibold flex-shrink-0">
          <CheckCircle2 className="w-4 h-4" />
          System ready
        </div>
      </motion.div>
    </motion.div>
  );
}
