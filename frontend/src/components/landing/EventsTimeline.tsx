'use client';

import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Users, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';

const events = [
  {
    status: 'Live Now',
    title: 'AI in Healthcare Hackathon',
    date: 'July 3 - July 5, 2026',
    time: '48 Hours',
    location: 'Main Innovation Hub',
    speakers: ['Dr. Alan Turing', 'Sarah Chen'],
    type: 'Hackathon'
  },
  {
    status: 'Upcoming',
    title: 'Seed Funding Pitch Day',
    date: 'July 15, 2026',
    time: '10:00 AM - 4:00 PM',
    location: 'Conference Room A',
    speakers: ['VC Partners'],
    type: 'Pitch Event'
  },
  {
    status: 'Completed',
    title: 'Web3 & Blockchain Workshop',
    date: 'June 28, 2026',
    time: '2:00 PM - 5:00 PM',
    location: 'Digital Library',
    speakers: ['Vitalik B.', 'Elena R.'],
    type: 'Workshop'
  }
];

export function EventsTimeline() {
  const [timeLeft, setTimeLeft] = useState({ days: 11, hours: 23, minutes: 59 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { days, hours, minutes } = prev;
        minutes -= 1;
        if (minutes < 0) { minutes = 59; hours -= 1; }
        if (hours < 0) { hours = 23; days -= 1; }
        return { days, hours, minutes };
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="events" className="py-24 bg-gray-50 dark:bg-bg-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6"
            >
              Upcoming <span className="text-gradient">Events</span>
            </motion.h2>
          </div>
          <div className="flex items-center gap-4 bg-white dark:bg-bg-900 rounded-full p-2 border border-gray-200 dark:border-white/10 shadow-sm">
            <div className="px-4 py-2 text-center">
              <span className="block text-2xl font-bold text-brand-primary">{timeLeft.days}</span>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Days</span>
            </div>
            <div className="text-2xl font-bold text-gray-300">:</div>
            <div className="px-4 py-2 text-center">
              <span className="block text-2xl font-bold text-brand-primary">{timeLeft.hours}</span>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Hrs</span>
            </div>
            <div className="text-2xl font-bold text-gray-300">:</div>
            <div className="px-4 py-2 text-center">
              <span className="block text-2xl font-bold text-brand-primary">{timeLeft.minutes}</span>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Min</span>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {events.map((event, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="glass-card flex flex-col md:flex-row gap-6 p-6 rounded-3xl relative overflow-hidden group"
            >
              {event.status === 'Live Now' && (
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
              )}
              {event.status === 'Upcoming' && (
                <div className="absolute top-0 left-0 w-1 h-full bg-brand-primary" />
              )}
              {event.status === 'Completed' && (
                <div className="absolute top-0 left-0 w-1 h-full bg-gray-400" />
              )}

              <div className="md:w-1/4 flex flex-col justify-center border-b md:border-b-0 md:border-r border-gray-100 dark:border-white/10 pb-6 md:pb-0 pr-6">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-4 w-max ${
                  event.status === 'Live Now' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse' :
                  event.status === 'Upcoming' ? 'bg-brand-primary/10 text-brand-primary' :
                  'bg-gray-100 text-gray-600 dark:bg-bg-800 dark:text-gray-400'
                }`}>
                  {event.status}
                </span>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">{event.date}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{event.time}</span>
                </div>
              </div>

              <div className="md:w-2/4 flex flex-col justify-center">
                <div className="text-sm font-semibold text-brand-blue mb-1 uppercase tracking-wider">{event.type}</div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 group-hover:text-brand-primary transition-colors">{event.title}</h3>
                
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-500">
                    <MapPin className="w-4 h-4" />
                    {event.location}
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <Users className="w-4 h-4" />
                    {event.speakers.join(', ')}
                  </div>
                </div>
              </div>

              <div className="md:w-1/4 flex items-center justify-end">
                <button className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                  event.status === 'Completed' 
                    ? 'bg-gray-100 text-gray-400 dark:bg-bg-800 cursor-not-allowed'
                    : 'bg-gradient-to-r from-brand-primary to-brand-blue text-white hover:shadow-lg hover:scale-105'
                }`}>
                  {event.status === 'Completed' ? 'Ended' : 'Register Now'}
                  {event.status !== 'Completed' && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
