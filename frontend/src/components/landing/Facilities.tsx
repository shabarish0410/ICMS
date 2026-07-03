'use client';

import { motion } from 'framer-motion';
import { Monitor, Cpu, Radio, Settings, Plane, Glasses, Zap, Lightbulb, Library, Building } from 'lucide-react';

const facilities = [
  {
    title: 'Innovation Lab',
    features: ['High-end Workstations', 'Ideation Whiteboards', '24/7 Access'],
    availability: 'Open 24/7',
    icon: Lightbulb,
    image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=1000'
  },
  {
    title: 'AI Lab',
    features: ['NVIDIA DGX Systems', 'Deep Learning Workstations', 'Data Servers'],
    availability: 'Booking Required',
    icon: Monitor,
    image: 'https://images.unsplash.com/photo-1555255707-c07966088b7b?auto=format&fit=crop&q=80&w=1000'
  },
  {
    title: 'IoT & Electronics',
    features: ['Oscilloscopes', 'Microcontrollers', 'Sensors Library'],
    availability: 'Open 9AM - 8PM',
    icon: Zap,
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1000'
  },
  {
    title: 'Robotics Lab',
    features: ['Industrial Arms', 'Mobile Robots', 'Drone Testing Area'],
    availability: 'Booking Required',
    icon: Settings,
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=1000'
  },
  {
    title: '3D Printing',
    features: ['Resin Printers', 'FDM Printers', '3D Scanners'],
    availability: 'Booking Required',
    icon: Cpu,
    image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=1000'
  },
  {
    title: 'Co-working Space',
    features: ['Ergonomic Desks', 'High-Speed WiFi', 'Coffee Bar'],
    availability: 'Open 24/7',
    icon: Building,
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1000'
  },
];

export function Facilities() {
  return (
    <section id="facilities" className="py-24 bg-gray-50 dark:bg-bg-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6"
            >
              World-Class <span className="text-gradient">Facilities</span>
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg text-gray-600 dark:text-gray-400"
            >
              Access state-of-the-art equipment and specialized labs designed to bring your most ambitious ideas to life.
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <button className="px-6 py-3 rounded-full text-white bg-gradient-to-r from-brand-primary to-brand-blue hover:from-brand-primary/90 hover:to-brand-blue/90 shadow-lg transition-all font-semibold whitespace-nowrap">
              View All Facilities
            </button>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {facilities.map((facility, index) => {
            const Icon = facility.icon;
            return (
              <motion.div
                key={facility.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group glass-card overflow-hidden rounded-3xl"
              >
                <div className="relative h-64 overflow-hidden">
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors z-10" />
                  <img
                    src={facility.image}
                    alt={facility.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute top-4 right-4 z-20">
                    <span className="px-3 py-1 text-xs font-medium bg-black/50 backdrop-blur-md text-white rounded-full">
                      {facility.availability}
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4 z-20 w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{facility.title}</h3>
                  <ul className="space-y-2 mb-8">
                    {facility.features.map((feature) => (
                      <li key={feature} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button className="w-full py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white font-medium hover:bg-brand-primary hover:text-white hover:border-transparent transition-all duration-300">
                    Book Lab
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
