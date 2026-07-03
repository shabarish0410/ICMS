'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

export function CallToAction() {
  return (
    <section className="py-24 relative overflow-hidden bg-bg-900">
      {/* Animated Background */}
      <div className="absolute inset-0 w-full h-full">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-brand-primary/40 via-brand-purple/20 to-brand-blue/40 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md mb-8 text-sm font-medium text-white border border-white/20"
        >
          <Sparkles className="w-4 h-4 text-brand-blue" />
          <span>Your Future Starts Here</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-6xl font-bold text-white mb-8 leading-tight"
        >
          Ready to Build the Next <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue via-brand-primary to-brand-purple">
            Big Innovation?
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto"
        >
          Join a community of forward-thinking founders, researchers, and creators. Get access to funding, mentorship, and world-class facilities.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-4 text-base font-bold text-bg-900 bg-white hover:bg-gray-100 rounded-2xl shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group"
          >
            Apply for Incubation
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <button className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl transition-all">
            Become a Mentor
          </button>
          <button className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl transition-all">
            Partner With Us
          </button>
        </motion.div>
      </div>
    </section>
  );
}
