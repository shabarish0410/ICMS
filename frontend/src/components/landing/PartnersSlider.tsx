'use client';

import { motion } from 'framer-motion';

const partners = [
  'Microsoft', 'Google', 'NVIDIA', 'Intel', 'IBM', 
  'AWS', 'Cisco', 'Qualcomm', 'Infosys', 'TCS', 
  'Accenture', 'Dell', 'Oracle'
];

export function PartnersSlider() {
  return (
    <section className="py-20 bg-white dark:bg-bg-900 border-y border-gray-100 dark:border-white/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-10">
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Trusted By Industry Leaders</p>
      </div>

      <div className="relative flex overflow-x-hidden">
        {/* Gradients to fade edges */}
        <div className="absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-white dark:from-bg-900 to-transparent z-10" />
        <div className="absolute top-0 bottom-0 right-0 w-32 bg-gradient-to-l from-white dark:from-bg-900 to-transparent z-10" />

        <div className="animate-marquee flex whitespace-nowrap items-center">
          {[...partners, ...partners, ...partners].map((partner, index) => (
            <div
              key={`${partner}-${index}`}
              className="mx-8 flex items-center justify-center grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300 cursor-pointer"
            >
              {/* Replace with actual logos in production */}
              <span className="text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-200 tracking-tight">
                {partner}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
