'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Quote, Trophy, TrendingUp } from 'lucide-react';

const stories = [
  {
    founder: 'Sarah Chen',
    role: 'CEO & Founder',
    startup: 'EcoCharge AI',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=800',
    funding: '$2.5M Seed',
    achievement: 'Forbes 30 Under 30',
    quote: "The incubation program at Spark gave us the technical resources and mentorship needed to take our prototype from the lab to a market-ready product.",
    logoText: 'ECOCHARGE'
  },
  {
    founder: 'Marcus Johnson',
    role: 'Co-founder & CTO',
    startup: 'AeroDrone Systems',
    image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=800',
    funding: '$5M Series A',
    achievement: 'National Innovation Award',
    quote: "Access to the Robotics and IoT labs allowed us to iterate rapidly. The networking events connected us directly with our lead investors.",
    logoText: 'AERODRONE'
  },
  {
    founder: 'Elena Rodriguez',
    role: 'Founder',
    startup: 'MediTech Solutions',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=800',
    funding: '$1.2M Pre-Seed',
    achievement: 'FDA Breakthrough Designation',
    quote: "From patent filing support to faculty mentorship, Spark provided a comprehensive ecosystem that accelerated our healthcare startup by years.",
    logoText: 'MEDITECH'
  }
];

export function SuccessStories() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % stories.length);
  };

  const prev = () => {
    setCurrentIndex((prev) => (prev - 1 + stories.length) % stories.length);
  };

  return (
    <section className="py-24 bg-white dark:bg-bg-900 overflow-hidden relative">
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-brand-primary/10 rounded-full filter blur-[100px] -translate-y-1/2 -translate-x-1/2" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Startup <span className="text-gradient">Success Stories</span>
          </motion.h2>
        </div>

        <div className="relative max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="glass-card rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-2/5 relative h-[400px] md:h-auto">
                  <img
                    src={stories[currentIndex].image}
                    alt={stories[currentIndex].founder}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="text-2xl font-bold text-white mb-1">{stories[currentIndex].founder}</h3>
                    <p className="text-gray-300 font-medium">{stories[currentIndex].role}</p>
                  </div>
                </div>

                <div className="w-full md:w-3/5 p-8 md:p-12 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-8 pb-8 border-b border-gray-100 dark:border-white/10">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-2">Company</p>
                      <h4 className="text-2xl font-bold text-gray-900 dark:text-white">{stories[currentIndex].logoText}</h4>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-green/10 text-brand-green font-semibold mb-2">
                        <TrendingUp className="w-4 h-4" />
                        {stories[currentIndex].funding}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-brand-primary dark:text-brand-blue font-medium justify-end">
                        <Trophy className="w-4 h-4" />
                        {stories[currentIndex].achievement}
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <Quote className="absolute -top-4 -left-4 w-12 h-12 text-brand-primary/20 rotate-180" />
                    <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 italic relative z-10 leading-relaxed font-light">
                      "{stories[currentIndex].quote}"
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              onClick={prev}
              className="w-12 h-12 rounded-full glass-card flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-brand-primary hover:scale-110 transition-all shadow-lg"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex gap-2">
              {stories.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i === currentIndex ? 'bg-brand-primary w-8' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="w-12 h-12 rounded-full glass-card flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-brand-primary hover:scale-110 transition-all shadow-lg"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
