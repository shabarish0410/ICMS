'use client';

import { motion } from 'framer-motion';
import { Lightbulb, Search, Wrench, CheckCircle, TrendingUp, DollarSign, Rocket } from 'lucide-react';

const timelineSteps = [
  {
    title: 'Idea Generation',
    description: 'Brainstorm and conceptualize innovative solutions to real-world problems.',
    icon: Lightbulb,
    color: 'from-brand-primary to-brand-blue'
  },
  {
    title: 'Research & Analysis',
    description: 'Conduct market research, feasibility studies, and competitive analysis.',
    icon: Search,
    color: 'from-brand-blue to-brand-green'
  },
  {
    title: 'Prototype Development',
    description: 'Build minimum viable products (MVPs) using our state-of-the-art labs.',
    icon: Wrench,
    color: 'from-brand-green to-brand-orange'
  },
  {
    title: 'Validation',
    description: 'Test prototypes with real users and iterate based on feedback.',
    icon: CheckCircle,
    color: 'from-brand-orange to-brand-pink'
  },
  {
    title: 'Incubation',
    description: 'Join our comprehensive incubation program for mentorship and resources.',
    icon: TrendingUp,
    color: 'from-brand-pink to-brand-purple'
  },
  {
    title: 'Funding',
    description: 'Connect with angel investors and venture capitalists to secure seed funding.',
    icon: DollarSign,
    color: 'from-brand-purple to-brand-primary'
  },
  {
    title: 'Startup Launch',
    description: 'Scale your operations and launch your product to the global market.',
    icon: Rocket,
    color: 'from-brand-primary to-brand-blue'
  },
];

export function AboutTimeline() {
  return (
    <section id="about" className="py-24 bg-gray-50 dark:bg-bg-800/50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6"
          >
            The Innovation <span className="text-gradient">Journey</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600 dark:text-gray-400"
          >
            We provide an end-to-end ecosystem that supports your vision from the initial spark of an idea to a fully funded, scalable startup.
          </motion.p>
        </div>

        <div className="relative">
          {/* Central Line */}
          <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-px bg-gradient-to-b from-brand-primary via-brand-purple to-brand-blue opacity-20 hidden md:block" />

          <div className="space-y-12 md:space-y-0 relative">
            {timelineSteps.map((step, index) => {
              const Icon = step.icon;
              const isEven = index % 2 === 0;

              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 50, x: isEven ? -50 : 50 }}
                  whileInView={{ opacity: 1, y: 0, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
                  className={`flex flex-col md:flex-row items-center justify-between w-full md:py-8 ${
                    isEven ? 'md:flex-row-reverse' : ''
                  }`}
                >
                  <div className="hidden md:block w-5/12" />
                  
                  {/* Timeline Dot */}
                  <div className="z-10 w-12 h-12 rounded-full bg-white dark:bg-bg-900 border-4 border-gray-50 dark:border-bg-800 shadow-xl flex items-center justify-center shrink-0 my-4 md:my-0">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${step.color} p-2 text-white flex items-center justify-center shadow-inner`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="w-full md:w-5/12">
                    <div className="glass-card p-6 hover:-translate-y-2 transition-transform duration-300">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                      <p className="text-gray-600 dark:text-gray-400">{step.description}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
