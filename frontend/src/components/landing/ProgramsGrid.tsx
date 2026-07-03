'use client';

import { motion } from 'framer-motion';
import { 
  Building2, FlaskConical, Cpu, Trophy, 
  Terminal, Presentation, Users, GraduationCap, 
  FileBadge, Banknote, ArrowRight 
} from 'lucide-react';

const programs = [
  { title: 'Startup Incubation', icon: Building2, desc: 'End-to-end support, workspace, and mentorship for early-stage startups.', color: 'from-brand-primary to-brand-blue' },
  { title: 'Research Support', icon: FlaskConical, desc: 'Grants and facilities for cutting-edge academic and industry research.', color: 'from-brand-blue to-brand-purple' },
  { title: 'Prototype Development', icon: Cpu, desc: 'Access to 3D printers, IoT labs, and hardware for rapid prototyping.', color: 'from-brand-purple to-brand-pink' },
  { title: 'Innovation Challenges', icon: Trophy, desc: 'Problem-solving competitions with industry partners and cash prizes.', color: 'from-brand-pink to-brand-orange' },
  { title: 'Hackathons', icon: Terminal, desc: '24-48 hour coding marathons to build innovative software solutions.', color: 'from-brand-orange to-brand-green' },
  { title: 'Workshops', icon: Presentation, desc: 'Skill-building sessions led by industry experts and successful founders.', color: 'from-brand-green to-brand-blue' },
  { title: 'Faculty Innovation', icon: Users, desc: 'Dedicated support for faculty-led research commercialization.', color: 'from-brand-blue to-brand-primary' },
  { title: 'Student Projects', icon: GraduationCap, desc: 'Funding and mentorship for final year and capstone projects.', color: 'from-brand-primary to-brand-purple' },
  { title: 'Patent Support', icon: FileBadge, desc: 'Legal and financial assistance for filing patents and IP protection.', color: 'from-brand-purple to-brand-pink' },
  { title: 'Funding Assistance', icon: Banknote, desc: 'Connect with seed funds, angel networks, and VC firms.', color: 'from-brand-pink to-brand-orange' },
];

export function ProgramsGrid() {
  return (
    <section id="programs" className="py-24 relative overflow-hidden bg-white dark:bg-bg-900">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-brand-primary/5 dark:bg-brand-primary/10 filter blur-[150px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Innovation <span className="text-gradient">Programs</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600 dark:text-gray-400"
          >
            Discover our comprehensive suite of programs designed to support every stage of your innovation journey.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {programs.map((program, index) => {
            const Icon = program.icon;
            return (
              <motion.div
                key={program.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="group relative rounded-2xl bg-white dark:bg-bg-800 p-[1px] hover:-translate-y-2 transition-all duration-300"
              >
                {/* Gradient Border */}
                <div className={`absolute inset-0 bg-gradient-to-br ${program.color} rounded-2xl opacity-50 group-hover:opacity-100 transition-opacity`} />
                
                <div className="relative h-full flex flex-col p-6 rounded-2xl bg-white dark:bg-bg-800/90 backdrop-blur-xl">
                  {/* Animated Background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${program.color} opacity-0 group-hover:opacity-5 transition-opacity rounded-2xl`} />
                  
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${program.color} p-0.5 mb-6 shadow-lg`}>
                    <div className="w-full h-full bg-white dark:bg-bg-800 rounded-[10px] flex items-center justify-center">
                      <Icon className="w-6 h-6 text-gray-900 dark:text-white" />
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{program.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">{program.desc}</p>
                  
                  <button className="flex items-center text-sm font-semibold text-gray-900 dark:text-white group/btn mt-auto">
                    Learn More 
                    <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform text-brand-primary" />
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
