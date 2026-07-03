'use client';

import { motion } from 'framer-motion';
import { Linkedin, Mail } from 'lucide-react';

const mentors = [
  {
    name: 'Dr. Robert Chen',
    role: 'AI Research Director',
    expertise: 'Machine Learning, NLP',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=600'
  },
  {
    name: 'Amanda Brooks',
    role: 'Venture Partner',
    expertise: 'Seed Funding, Strategy',
    image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=600'
  },
  {
    name: 'Michael Chang',
    role: 'Hardware Engineer',
    expertise: 'IoT, Robotics',
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=600'
  },
  {
    name: 'Sarah Williams',
    role: 'Startup Advisor',
    expertise: 'Product Management',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=600'
  }
];

export function MentorsGrid() {
  return (
    <section id="mentors" className="py-24 bg-white dark:bg-bg-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Meet Our <span className="text-gradient">Mentors</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600 dark:text-gray-400"
          >
            Learn from industry veterans, successful founders, and domain experts who are dedicated to guiding you.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {mentors.map((mentor, index) => (
            <motion.div
              key={mentor.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative"
            >
              <div className="relative h-80 rounded-3xl overflow-hidden mb-6">
                <img
                  src={mentor.image}
                  alt={mentor.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                  <div className="flex gap-3 mb-4 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <button className="w-10 h-10 rounded-full bg-white/20 hover:bg-brand-primary backdrop-blur-md flex items-center justify-center text-white transition-colors">
                      <Linkedin className="w-5 h-5" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-white/20 hover:bg-brand-primary backdrop-blur-md flex items-center justify-center text-white transition-colors">
                      <Mail className="w-5 h-5" />
                    </button>
                  </div>
                  <button className="w-full py-2 bg-brand-primary hover:bg-brand-blue text-white rounded-xl font-semibold transition-colors transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                    Book Mentorship
                  </button>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-brand-primary transition-colors">{mentor.name}</h3>
                <p className="text-sm font-medium text-brand-primary dark:text-brand-blue mb-2">{mentor.role}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{mentor.expertise}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
