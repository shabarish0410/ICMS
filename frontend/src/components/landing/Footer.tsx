import Link from 'next/link';
import { Zap, Twitter, Linkedin, Github, Instagram } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-bg-950 pt-20 pb-10 border-t border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-6 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-blue flex items-center justify-center text-white shadow-lg shadow-brand-primary/20">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">
                Spark
              </span>
            </Link>
            <p className="text-gray-400 mb-8 max-w-sm">
              Empowering the next generation of innovators, startups, and tech leaders to build solutions that shape the future.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 hover:bg-brand-primary text-gray-400 hover:text-white flex items-center justify-center transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 hover:bg-brand-primary text-gray-400 hover:text-white flex items-center justify-center transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 hover:bg-brand-primary text-gray-400 hover:text-white flex items-center justify-center transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 hover:bg-brand-primary text-gray-400 hover:text-white flex items-center justify-center transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-6">Quick Links</h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li><Link href="#about" className="hover:text-brand-primary transition-colors">About Us</Link></li>
              <li><Link href="#programs" className="hover:text-brand-primary transition-colors">Programs</Link></li>
              <li><Link href="#facilities" className="hover:text-brand-primary transition-colors">Facilities</Link></li>
              <li><Link href="#events" className="hover:text-brand-primary transition-colors">Events</Link></li>
              <li><Link href="#mentors" className="hover:text-brand-primary transition-colors">Mentorship</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-6">Resources</h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li><Link href="#" className="hover:text-brand-primary transition-colors">Innovation Blog</Link></li>
              <li><Link href="#" className="hover:text-brand-primary transition-colors">Startup Playbook</Link></li>
              <li><Link href="#" className="hover:text-brand-primary transition-colors">Funding Guide</Link></li>
              <li><Link href="#" className="hover:text-brand-primary transition-colors">Success Stories</Link></li>
              <li><Link href="#" className="hover:text-brand-primary transition-colors">Help Center</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-6">Newsletter</h4>
            <p className="text-sm text-gray-400 mb-4">Subscribe to get the latest startup news and event updates.</p>
            <form className="flex flex-col gap-3">
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
              />
              <button 
                type="button"
                className="w-full px-4 py-3 bg-brand-primary hover:bg-brand-blue text-white font-semibold rounded-xl transition-colors"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© 2026 Spark Innovation Center. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
