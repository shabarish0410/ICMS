'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

const stats = [
  { label: 'Students', value: 500, suffix: '+' },
  { label: 'Startups', value: 120, suffix: '+' },
  { label: 'Mentors', value: 60, suffix: '+' },
  { label: 'Research Projects', value: 35, suffix: '+' },
  { label: 'Industry Partners', value: 20, suffix: '+' },
];

function Counter({ value, suffix }: { value: number; suffix: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 2000;
    const incrementTime = (duration / end) * 1.5;

    const timer = setInterval(() => {
      start += Math.ceil(end / 100);
      if (start > end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {count}
      {suffix}
    </span>
  );
}

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden bg-white dark:bg-bg-900">
      {/* Background Gradient Blobs */}
      <div className="absolute top-0 inset-x-0 h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-brand-primary/20 dark:bg-brand-primary/10 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-[120px] animate-blob" />
        <div className="absolute top-[30%] right-[10%] w-[400px] h-[400px] bg-brand-blue/20 dark:bg-brand-blue/10 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-[100px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-[20%] left-[40%] w-[600px] h-[600px] bg-brand-purple/20 dark:bg-brand-purple/10 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-[150px] animate-blob animation-delay-4000" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full py-20">
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-8 text-sm font-medium text-brand-primary dark:text-brand-blue border-brand-primary/20 dark:border-white/10"
          >
            <Sparkles className="w-4 h-4" />
            <span>Welcome to the Future of Innovation</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6 leading-tight"
          >
            Empowering Innovators. <br />
            Building Startups. <br />
            <span className="text-gradient">Creating the Future.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed"
          >
            Spark Innovation Center is a next-generation innovation ecosystem helping students, startups, researchers, and entrepreneurs transform ideas into successful products and companies.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
          >
            <a
              href="/register"
              className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-brand-primary to-brand-purple hover:from-brand-primary/90 hover:to-brand-purple/90 rounded-2xl shadow-xl shadow-brand-primary/25 hover:shadow-brand-primary/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group"
            >
              Start Your Innovation Journey
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="#programs"
              className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-gray-700 dark:text-white glass-card hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all flex items-center justify-center"
            >
              Explore Programs
            </a>
          </motion.div>
        </div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-5xl mx-auto"
        >
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="glass-card p-6 text-center group hover:-translate-y-1 transition-transform duration-300"
            >
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-brand-primary dark:group-hover:text-brand-blue transition-colors">
                <Counter value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
